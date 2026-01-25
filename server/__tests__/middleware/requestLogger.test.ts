import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Request, Response, NextFunction } from 'express'
import { requestLogger } from '../../middleware/requestLogger'

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'mock-correlation-id'
}))

describe('requestLogger middleware', () => {
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let mockNext: NextFunction
  let consoleSpy: ReturnType<typeof vi.spyOn>
  let finishCallback: (() => void) | undefined

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      path: '/api/test',
      query: {},
      body: {},
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'test-agent'
      }
    }
    mockRes = {
      statusCode: 200,
      on: vi.fn((event: string, callback: () => void) => {
        if (event === 'finish') {
          finishCallback = callback
        }
      })
    }
    mockNext = vi.fn()
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
    finishCallback = undefined
  })

  it('adds correlation ID to request', () => {
    requestLogger(mockReq as Request, mockRes as Response, mockNext)

    expect((mockReq as Request & { correlationId: string }).correlationId).toBe(
      'mock-correlation-id'
    )
  })

  it('calls next', () => {
    requestLogger(mockReq as Request, mockRes as Response, mockNext)

    expect(mockNext).toHaveBeenCalled()
  })

  it('logs incoming request with details', () => {
    requestLogger(mockReq as Request, mockRes as Response, mockNext)

    expect(consoleSpy).toHaveBeenCalledWith('[REQUEST]', expect.any(String))

    const logCall = consoleSpy.mock.calls[0]
    const logData = JSON.parse(logCall[1] as string)

    expect(logData).toMatchObject({
      correlationId: 'mock-correlation-id',
      method: 'GET',
      path: '/api/test',
      ip: '127.0.0.1',
      userAgent: 'test-agent'
    })
  })

  it('logs response on finish', () => {
    requestLogger(mockReq as Request, mockRes as Response, mockNext)

    // Simulate response finish
    if (finishCallback) {
      finishCallback()
    }

    // Find the RESPONSE log call
    const responseCall = consoleSpy.mock.calls.find((call) => call[0] === '[RESPONSE]')
    expect(responseCall).toBeDefined()

    const logData = JSON.parse(responseCall![1] as string)
    expect(logData).toMatchObject({
      correlationId: 'mock-correlation-id',
      method: 'GET',
      path: '/api/test',
      statusCode: 200
    })
  })

  it('redacts sensitive query parameters', () => {
    mockReq.query = {
      page: '1',
      token: 'secret-token',
      api_key: 'my-api-key',
      password: 'mypassword',
      search: 'normal-value'
    }

    requestLogger(mockReq as Request, mockRes as Response, mockNext)

    const logCall = consoleSpy.mock.calls[0]
    const logData = JSON.parse(logCall[1] as string)

    expect(logData.query).toEqual({
      page: '1',
      token: '[REDACTED]',
      api_key: '[REDACTED]',
      password: '[REDACTED]',
      search: 'normal-value'
    })
  })

  it('redacts authorization-related parameters', () => {
    mockReq.query = {
      authorization: 'Bearer xyz',
      auth: 'some-auth',
      jwt: 'eyJhbGciOiJIUzI1NiJ9',
      bearer: 'token',
      access_token: 'access-123',
      refresh_token: 'refresh-456'
    }

    requestLogger(mockReq as Request, mockRes as Response, mockNext)

    const logCall = consoleSpy.mock.calls[0]
    const logData = JSON.parse(logCall[1] as string)

    expect(logData.query).toEqual({
      authorization: '[REDACTED]',
      auth: '[REDACTED]',
      jwt: '[REDACTED]',
      bearer: '[REDACTED]',
      access_token: '[REDACTED]',
      refresh_token: '[REDACTED]'
    })
  })

  it('handles empty query object', () => {
    mockReq.query = {}

    requestLogger(mockReq as Request, mockRes as Response, mockNext)

    const logCall = consoleSpy.mock.calls[0]
    const logData = JSON.parse(logCall[1] as string)

    expect(logData.query).toEqual({})
  })

  it('includes duration in response log', () => {
    vi.useFakeTimers()

    requestLogger(mockReq as Request, mockRes as Response, mockNext)

    // Advance time by 100ms
    vi.advanceTimersByTime(100)

    if (finishCallback) {
      finishCallback()
    }

    const responseCall = consoleSpy.mock.calls.find((call) => call[0] === '[RESPONSE]')
    expect(responseCall).toBeDefined()

    const logData = JSON.parse(responseCall![1] as string)
    expect(logData.duration).toMatch(/\d+ms/)

    vi.useRealTimers()
  })

  it('redacts sensitive body fields', () => {
    mockReq.body = {
      username: 'testuser',
      password: 'secret123',
      apiKey: 'key-12345',
      data: 'normal-data'
    }

    requestLogger(mockReq as Request, mockRes as Response, mockNext)

    const logCall = consoleSpy.mock.calls[0]
    const logData = JSON.parse(logCall[1] as string)
    const body = JSON.parse(logData.body)

    expect(body).toEqual({
      username: 'testuser',
      password: '[REDACTED]',
      apiKey: '[REDACTED]',
      data: 'normal-data'
    })
  })

  it('redacts nested sensitive body fields', () => {
    mockReq.body = {
      user: {
        email: 'test@example.com',
        credentials: {
          password: 'nested-secret'
        }
      }
    }

    requestLogger(mockReq as Request, mockRes as Response, mockNext)

    const logCall = consoleSpy.mock.calls[0]
    const logData = JSON.parse(logCall[1] as string)
    const body = JSON.parse(logData.body)

    expect(body.user.credentials.password).toBe('[REDACTED]')
    expect(body.user.email).toBe('test@example.com')
  })

  it('does not include body when empty', () => {
    mockReq.body = {}

    requestLogger(mockReq as Request, mockRes as Response, mockNext)

    const logCall = consoleSpy.mock.calls[0]
    const logData = JSON.parse(logCall[1] as string)

    expect(logData.body).toBeUndefined()
  })

  it('truncates large body payloads', () => {
    mockReq.body = {
      data: 'x'.repeat(2000)
    }

    requestLogger(mockReq as Request, mockRes as Response, mockNext)

    const logCall = consoleSpy.mock.calls[0]
    const logData = JSON.parse(logCall[1] as string)

    expect(logData.body.endsWith('...[TRUNCATED]')).toBe(true)
  })
})
