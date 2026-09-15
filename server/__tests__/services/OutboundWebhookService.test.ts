/**
 * Tests for OutboundWebhookService
 *
 * Covers:
 *  - HMAC-SHA256 signature generation
 *  - Retry backoff schedule
 *  - DLQ promotion after max retries
 *  - Payload envelope structure
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'
import {
  signPayload,
  retryDelayMs,
  nextRetryAt,
  buildWebhookPayload,
  deliverWebhook,
  MAX_DELIVERY_ATTEMPTS,
  OutboundWebhookService
} from '../../services/OutboundWebhookService'

// ---------------------------------------------------------------------------
// HMAC-SHA256 signature generation
// ---------------------------------------------------------------------------

describe('signPayload', () => {
  it('produces sha256=<hex> format', () => {
    const sig = signPayload('{"hello":"world"}', 'mysecret')
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/)
  })

  it('produces a deterministic signature for the same input', () => {
    const body = '{"event":"prospect.created"}'
    const secret = 'test-secret-abc'
    expect(signPayload(body, secret)).toBe(signPayload(body, secret))
  })

  it('matches a manually computed HMAC-SHA256', () => {
    const body = 'hello'
    const secret = 'world'
    const expected =
      'sha256=' + crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex')
    expect(signPayload(body, secret)).toBe(expected)
  })

  it('produces different signatures for different secrets', () => {
    const body = 'same body'
    expect(signPayload(body, 'secret-a')).not.toBe(signPayload(body, 'secret-b'))
  })

  it('produces different signatures for different bodies', () => {
    const secret = 'shared-secret'
    expect(signPayload('body-a', secret)).not.toBe(signPayload('body-b', secret))
  })
})

// ---------------------------------------------------------------------------
// Retry backoff schedule
// ---------------------------------------------------------------------------

describe('retryDelayMs', () => {
  it('returns 30 s for attempt 1', () => {
    expect(retryDelayMs(1)).toBe(30_000)
  })

  it('returns 5 min for attempt 2', () => {
    expect(retryDelayMs(2)).toBe(5 * 60_000)
  })

  it('returns 30 min for attempt 3', () => {
    expect(retryDelayMs(3)).toBe(30 * 60_000)
  })

  it('returns 2 hr for attempt 4', () => {
    expect(retryDelayMs(4)).toBe(2 * 60 * 60_000)
  })

  it('returns null for attempt 5 (DLQ promotion)', () => {
    expect(retryDelayMs(5)).toBeNull()
  })

  it('returns null for any attempt beyond MAX_DELIVERY_ATTEMPTS', () => {
    expect(retryDelayMs(MAX_DELIVERY_ATTEMPTS)).toBeNull()
    expect(retryDelayMs(MAX_DELIVERY_ATTEMPTS + 1)).toBeNull()
  })
})

describe('nextRetryAt', () => {
  it('returns an ISO string offset by the correct delay', () => {
    const now = new Date('2026-09-15T12:00:00.000Z')
    const result = nextRetryAt(1, now)
    expect(result).toBe(new Date(now.getTime() + 30_000).toISOString())
  })

  it('returns null when max retries are exhausted (attempt 5)', () => {
    expect(nextRetryAt(5)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Payload envelope
// ---------------------------------------------------------------------------

describe('buildWebhookPayload', () => {
  it('includes required envelope fields', () => {
    const payload = buildWebhookPayload('prospect.created', { id: '123' })
    expect(payload).toMatchObject({
      event: 'prospect.created',
      api_version: 'v1',
      data: { id: '123' }
    })
    expect(payload.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
    expect(typeof payload.created_at).toBe('string')
    expect(new Date(payload.created_at).toISOString()).toBe(payload.created_at)
  })

  it('respects a caller-supplied id for idempotent retries', () => {
    const id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
    const payload = buildWebhookPayload('job.finished', {}, id)
    expect(payload.id).toBe(id)
  })
})

// ---------------------------------------------------------------------------
// HTTP delivery (fetch mocked)
// ---------------------------------------------------------------------------

describe('deliverWebhook', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('sends POST with X-Webhook-Signature and returns success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'ok'
    } as unknown as Response)

    const payload = buildWebhookPayload('prospect.created', { id: 'abc' })
    const result = await deliverWebhook(payload, {
      url: 'https://hooks.example.com/wh',
      secret: 'test-secret'
    })

    expect(result.success).toBe(true)
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const headers = call[1].headers as Record<string, string>
    expect(headers['X-Webhook-Signature']).toMatch(/^sha256=[0-9a-f]{64}$/)
    expect(headers['X-Webhook-Id']).toBe(payload.id)
  })

  it('returns failure on non-2xx response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'Service Unavailable'
    } as unknown as Response)

    const payload = buildWebhookPayload('enrichment.completed', {})
    const result = await deliverWebhook(payload, {
      url: 'https://hooks.example.com/wh',
      secret: 'sec'
    })

    expect(result.success).toBe(false)
    expect(result.responseStatus).toBe(503)
    expect(result.error).toBe('HTTP 503')
  })

  it('rejects non-https URLs', async () => {
    const payload = buildWebhookPayload('test', {})
    const result = await deliverWebhook(payload, {
      url: 'http://hooks.example.com/wh',
      secret: 'sec'
    })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/https/)
  })

  it('rejects localhost targets', async () => {
    const payload = buildWebhookPayload('test', {})
    const result = await deliverWebhook(payload, {
      url: 'https://localhost/wh',
      secret: 'sec'
    })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/private/)
  })
})

// ---------------------------------------------------------------------------
// DLQ promotion after max retries (service-level)
// ---------------------------------------------------------------------------

describe('OutboundWebhookService.deliver — DLQ lifecycle', () => {
  const savedFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = savedFetch
    vi.restoreAllMocks()
  })

  it('promotes to dead after MAX_DELIVERY_ATTEMPTS failed attempts', async () => {
    // Build a mock db that simulates attempt_count = MAX_DELIVERY_ATTEMPTS - 1
    // (meaning the next attempt will be attempt MAX_DELIVERY_ATTEMPTS → dead).
    const failingAttemptCount = MAX_DELIVERY_ATTEMPTS - 1

    const queries: string[] = []
    const mockDb = {
      query: vi.fn(async (sql: string, _params?: unknown[]) => {
        queries.push(sql.trim().split('\n')[0].trim())

        // Fetch delivery + subscription
        if (sql.includes('webhook_deliveries d')) {
          return [
            {
              delivery_id: 'del-1',
              attempt_count: failingAttemptCount,
              payload: buildWebhookPayload('prospect.created', {}),
              url: 'https://hooks.example.com/wh',
              secret: 'sec'
            }
          ]
        }
        // UPDATE after attempt
        return []
      })
    }

    // Make fetch fail
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error'
    } as unknown as Response)

    const service = new OutboundWebhookService(mockDb)
    const result = await service.deliver('del-1')

    expect(result.success).toBe(false)

    // The UPDATE call should have set status = 'dead' and next_retry_at = null
    const updateCall = mockDb.query.mock.calls.find(([sql]) => sql.includes('UPDATE webhook_deliveries'))
    expect(updateCall).toBeDefined()
    const updateParams = updateCall![1] as unknown[]
    expect(updateParams[0]).toBe('dead')
    expect(updateParams[2]).toBeNull() // next_retry_at = null
  })

  it('sets status = failed with next_retry_at on first failure', async () => {
    const mockDb = {
      query: vi.fn(async (sql: string, _params?: unknown[]) => {
        if (sql.includes('webhook_deliveries d')) {
          return [
            {
              delivery_id: 'del-2',
              attempt_count: 0,
              payload: buildWebhookPayload('prospect.created', {}),
              url: 'https://hooks.example.com/wh',
              secret: 'sec'
            }
          ]
        }
        return []
      })
    }

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'rate limited'
    } as unknown as Response)

    const service = new OutboundWebhookService(mockDb)
    await service.deliver('del-2')

    const updateCall = mockDb.query.mock.calls.find(([sql]) => sql.includes('UPDATE webhook_deliveries'))
    expect(updateCall).toBeDefined()
    const updateParams = updateCall![1] as unknown[]
    expect(updateParams[0]).toBe('failed')
    expect(updateParams[2]).not.toBeNull() // next_retry_at is set
  })
})
