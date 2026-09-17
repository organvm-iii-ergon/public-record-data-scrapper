import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Request, Response, NextFunction } from 'express'
import { httpsRedirect, createHttpsRedirect } from '../../middleware/httpsRedirect'

// Mock config
vi.mock('../../config', () => ({
  config: {
    server: {
      env: 'production'
    }
  }
}))

describe('httpsRedirect middleware', () => {
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let mockNext: NextFunction

  beforeEach(() => {
    mockReq = {
      headers: {
        host: 'example.com'
      },
      url: '/api/test',
      secure: false,
      connection: { encrypted: false } as Request['connection']
    }
    mockRes = {
      redirect: vi.fn(),
      setHeader: vi.fn()
    }
    mockNext = vi.fn()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('httpsRedirect', () => {
    describe('in production', () => {
      it('should redirect HTTP to HTTPS', () => {
        httpsRedirect(mockReq as Request, mockRes as Response, mockNext)

        expect(mockRes.redirect).toHaveBeenCalledWith(301, 'https://example.com/api/test')
        expect(mockNext).not.toHaveBeenCalled()
      })

      it('should not redirect when X-Forwarded-Proto is https', () => {
        mockReq.headers = { ...mockReq.headers, 'x-forwarded-proto': 'https' }

        httpsRedirect(mockReq as Request, mockRes as Response, mockNext)

        expect(mockRes.redirect).not.toHaveBeenCalled()
        expect(mockNext).toHaveBeenCalled()
      })

      it('should not redirect when req.secure is true', () => {
        mockReq.secure = true

        httpsRedirect(mockReq as Request, mockRes as Response, mockNext)

        expect(mockRes.redirect).not.toHaveBeenCalled()
        expect(mockNext).toHaveBeenCalled()
      })

      it('should not redirect when connection is encrypted', () => {
        mockReq.connection = { encrypted: true } as Request['connection']

        httpsRedirect(mockReq as Request, mockRes as Response, mockNext)

        expect(mockRes.redirect).not.toHaveBeenCalled()
        expect(mockNext).toHaveBeenCalled()
      })

      it('should add HSTS header for HTTPS requests', () => {
        mockReq.headers = { ...mockReq.headers, 'x-forwarded-proto': 'https' }

        httpsRedirect(mockReq as Request, mockRes as Response, mockNext)

        expect(mockRes.setHeader).toHaveBeenCalledWith(
          'Strict-Transport-Security',
          'max-age=31536000; includeSubDomains; preload'
        )
      })

      it('should preserve URL path and query in redirect', () => {
        mockReq.url = '/api/users?page=2&sort=name'

        httpsRedirect(mockReq as Request, mockRes as Response, mockNext)

        expect(mockRes.redirect).toHaveBeenCalledWith(
          301,
          'https://example.com/api/users?page=2&sort=name'
        )
      })

      it('should use 301 permanent redirect', () => {
        httpsRedirect(mockReq as Request, mockRes as Response, mockNext)

        expect(mockRes.redirect).toHaveBeenCalledWith(301, expect.any(String))
      })
    })
  })

  describe('createHttpsRedirect', () => {
    it('should create middleware with default options', () => {
      const middleware = createHttpsRedirect()
      mockReq.headers = { ...mockReq.headers, 'x-forwarded-proto': 'https' }

      middleware(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      )
      expect(mockNext).toHaveBeenCalled()
    })

    it('should skip redirect when disabled', () => {
      const middleware = createHttpsRedirect({ enabled: false })

      middleware(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.redirect).not.toHaveBeenCalled()
      expect(mockRes.setHeader).not.toHaveBeenCalled()
      expect(mockNext).toHaveBeenCalled()
    })

    it('should use custom HSTS max-age', () => {
      const middleware = createHttpsRedirect({ hstsMaxAge: 86400 })
      mockReq.headers = { ...mockReq.headers, 'x-forwarded-proto': 'https' }

      middleware(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        expect.stringContaining('max-age=86400')
      )
    })

    it('should exclude includeSubDomains when disabled', () => {
      const middleware = createHttpsRedirect({ includeSubDomains: false })
      mockReq.headers = { ...mockReq.headers, 'x-forwarded-proto': 'https' }

      middleware(mockReq as Request, mockRes as Response, mockNext)

      const hstsHeader = (mockRes.setHeader as ReturnType<typeof vi.fn>).mock.calls[0][1]
      expect(hstsHeader).not.toContain('includeSubDomains')
    })

    it('should exclude preload when disabled', () => {
      const middleware = createHttpsRedirect({ preload: false })
      mockReq.headers = { ...mockReq.headers, 'x-forwarded-proto': 'https' }

      middleware(mockReq as Request, mockRes as Response, mockNext)

      const hstsHeader = (mockRes.setHeader as ReturnType<typeof vi.fn>).mock.calls[0][1]
      expect(hstsHeader).not.toContain('preload')
    })

    it('should redirect HTTP requests to HTTPS', () => {
      const middleware = createHttpsRedirect()

      middleware(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.redirect).toHaveBeenCalledWith(301, 'https://example.com/api/test')
    })

    it('should combine all HSTS options', () => {
      const middleware = createHttpsRedirect({
        hstsMaxAge: 604800,
        includeSubDomains: true,
        preload: true
      })
      mockReq.headers = { ...mockReq.headers, 'x-forwarded-proto': 'https' }

      middleware(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        'max-age=604800; includeSubDomains; preload'
      )
    })

    it('should build minimal HSTS header when all options disabled', () => {
      const middleware = createHttpsRedirect({
        hstsMaxAge: 3600,
        includeSubDomains: false,
        preload: false
      })
      mockReq.headers = { ...mockReq.headers, 'x-forwarded-proto': 'https' }

      middleware(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.setHeader).toHaveBeenCalledWith('Strict-Transport-Security', 'max-age=3600')
    })
  })

  describe('development mode behavior', () => {
    beforeEach(() => {
      vi.doMock('../../config', () => ({
        config: {
          server: {
            env: 'development'
          }
        }
      }))
    })

    afterEach(() => {
      vi.doUnmock('../../config')
    })

    it('createHttpsRedirect should skip when enabled is explicitly false', () => {
      const middleware = createHttpsRedirect({ enabled: false })

      middleware(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.redirect).not.toHaveBeenCalled()
      expect(mockNext).toHaveBeenCalled()
    })
  })
})
