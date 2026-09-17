import { beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { auditMiddleware, createAuditLog } from '../../middleware/auditMiddleware'
import type { AuthenticatedRequest } from '../../middleware/authMiddleware'
vi.mock('../../database/connection', () => ({ database: { query: vi.fn() } }))
import { database } from '../../database/connection'
const query = vi.mocked(database.query)
const id = '11111111-1111-4111-8111-111111111111'
const flush = () => new Promise<void>((resolve) => setImmediate(resolve))
function app(
  response: unknown,
  status = 200,
  mode: 'json' | 'send' = 'json',
  authenticated = true
) {
  const instance = express()
  instance.use(express.json())
  instance.use((req: AuthenticatedRequest, _res, next) => {
    if (authenticated) req.user = { id: 'user-1', orgId: 'verified-tenant' }
    next()
  })
  instance.use(auditMiddleware)
  instance.use((_req, res) => {
    res.status(status)
    if (mode === 'json') res.json(response)
    else res.send(response)
  })
  return instance
}
beforeEach(() => query.mockReset().mockResolvedValue([]))

describe('mutation audit attribution and redaction', () => {
  it('attributes creates to verified identity, redacts nested secrets, and writes exactly once', async () => {
    const response = {
      id,
      orgId: 'untrusted-tenant',
      nested: [{ api_key: 'secret-key', accountNumber: 'private-number', public: 'kept' }]
    }
    await request(app(response))
      .post('/api/contacts')
      .set('User-Agent', 'test-agent')
      .send({ orgId: 'untrusted-tenant' })
      .expect(200)
    await flush()
    expect(query).toHaveBeenCalledTimes(1)
    const values = query.mock.calls[0][1]!
    expect(values.slice(0, 4)).toEqual(['verified-tenant', 'user-1', 'create', 'contact'])
    expect(JSON.parse(values[7] as string)).toEqual({
      id,
      orgId: 'untrusted-tenant',
      nested: [{ api_key: '[REDACTED]', accountNumber: '[REDACTED]', public: 'kept' }]
    })
    expect(values[9]).toBe('test-agent')
    expect(values[10]).toMatch(/^[a-f0-9-]{36}$/)
  })
  it.each(['put', 'patch'] as const)(
    'records %s changes while ignoring timestamp-only differences',
    async (method) => {
      const changedRequest = request(
        app({ id, value: 2, updated_at: 'new', stable: { nested: true } })
      )
      await changedRequest[method](`/api/deals/${id}`)
        .send({ value: 1, updated_at: 'old', stable: { nested: true } })
        .expect(200)
      await flush()
      const values = query.mock.calls[0][1]!
      expect(values[4]).toBe(id)
      expect(JSON.parse(values[5] as string)).toEqual({
        id: { new: id },
        value: { old: 1, new: 2 }
      })
      query.mockClear()
      const unchangedRequest = request(app({ value: 1, updatedAt: 'new' }))
      await unchangedRequest[method]('/api/deals/not-a-uuid')
        .send({ value: 1, updatedAt: 'old' })
        .expect(200)
      await flush()
      expect(query.mock.calls[0][1]![5]).toBeNull()
    }
  )
  it('audits bodyless deletes and handles parsed and non-JSON send responses', async () => {
    await request(app(undefined, 204, 'send'))
      .delete(`/api/prospects/${id}`)
      .expect(204)
    await flush()
    expect(query.mock.calls[0][1]![2]).toBe('delete')
    expect(query.mock.calls[0][1]![4]).toBe(id)
    for (const body of [JSON.stringify({ value: 1 }), 'plain response', ['array response']]) {
      query.mockClear()
      await request(app(body, 200, 'send', false))
        .post('/api/unknown')
        .expect(200)
      await flush()
      expect(query.mock.calls[0][1]!.slice(0, 4)).toEqual([null, null, 'create', 'unknown'])
    }
  })
  it.each(['/api/health', '/api/metrics', '/api/auth/refresh'])(
    'skips excluded path %s',
    async (path) => {
      await request(app({})).post(path).expect(200)
      await flush()
      expect(query).not.toHaveBeenCalled()
    }
  )
  it('does not record reads or failed mutations as successful changes', async () => {
    await request(app({})).get('/api/deals').expect(200)
    await request(app({ error: 'rejected' }, 403))
      .post('/api/deals')
      .send({ secret: 'private' })
      .expect(403)
    await flush()
    expect(query).not.toHaveBeenCalled()
  })
  it('redacts explicit change records as well as before/after state', async () => {
    const nested: Record<string, unknown> = { token: 'private' }
    nested.self = nested
    await createAuditLog({
      orgId: 'tenant',
      userId: 'user',
      action: 'update',
      entityType: 'integration',
      entityId: id,
      requestId: 'request-1',
      beforeState: { nested },
      afterState: { value: 2 },
      changes: {
        apiKey: { old: 'old-secret', new: 'new-secret' },
        value: { old: { token: 'private' }, new: 2 }
      },
      ipAddress: '127.0.0.1',
      userAgent: 'test'
    })
    const values = query.mock.calls[0][1]!
    expect(JSON.parse(values[5] as string)).toEqual({
      apiKey: { old: '[REDACTED]', new: '[REDACTED]' },
      value: { old: { token: '[REDACTED]' }, new: 2 }
    })
    expect(values[6]).toContain('[TRUNCATED]')
    expect(values[6]).not.toContain('private')
    expect(values[10]).toBe('request-1')
  })
  it('contains storage failures without logging raw private state', async () => {
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {})
    query.mockRejectedValueOnce(new Error('database unavailable'))
    await createAuditLog({ action: 'create', entityType: 'test' })
    expect(logger).toHaveBeenCalledWith(
      '[AuditMiddleware] Failed to write audit log:',
      expect.any(Error)
    )
    logger.mockRestore()
  })
})
