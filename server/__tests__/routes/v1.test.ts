/**
 * v1 REST API integration tests.
 *
 * Verifies the `/v1` versioned namespace behaviour:
 *  1. Unauthenticated requests → 401
 *  2. Valid API key → 200
 *  3. Rate-limit exceeded → 429
 *  4. `X-API-Version: v1` header present on every response
 *
 * These tests construct a minimal Express app that mounts the v1Router
 * directly — no full Server bootstrap needed — then uses supertest to drive
 * HTTP requests against it.
 *
 * Heavy collaborators (ApiKeyService, rate limiter, ProspectsService, etc.)
 * are vitest-mocked so the tests remain fast and hermetic.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import express, { Express } from 'express'

// ---------------------------------------------------------------------------
// Hoisted mock controls — vi.hoisted() runs before module evaluation so the
// functions are available inside vi.mock() factories without TDZ issues.
// ---------------------------------------------------------------------------
const { mockVerify, mockRateLimiterFn } = vi.hoisted(() => {
  const mockVerify = vi.fn()
  const mockRateLimiterFn = vi.fn((_req: unknown, _res: unknown, next: () => void) => next())
  return { mockVerify, mockRateLimiterFn }
})

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../services/ApiKeyService', () => ({
  ApiKeyService: vi.fn(function () {
    return { verify: mockVerify }
  }),
  API_KEY_PREFIX: 'prk_'
}))

// authMiddleware fallback (JWT path) — always rejects in these tests
vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: vi.fn(
    (_req: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }) => {
      res.status(401).json({ error: 'Unauthorized', message: 'No valid credentials' })
    }
  ),
  requireRole: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next())
}))

vi.mock('../../middleware/rateLimiter', () => ({
  createApiKeyRateLimiter: vi.fn(() => mockRateLimiterFn),
  createRateLimiter: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next())
}))

vi.mock('../../middleware/orgContext', () => ({
  orgContextMiddleware: vi.fn((_req: unknown, _res: unknown, next: () => void) => next())
}))

vi.mock('../../middleware/dataTier', () => ({
  dataTierRouter: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
  getResolvedDataTier: vi.fn(() => 'starter-tier')
}))

const mockList = vi.fn()
vi.mock('../../services/ProspectsService', () => ({
  ProspectsService: vi.fn(function () {
    return { list: mockList }
  })
}))

vi.mock('../../services/EnrichmentService', () => ({
  EnrichmentService: vi.fn(function () {
    return { getStatus: vi.fn().mockResolvedValue({ status: 'idle' }) }
  })
}))

vi.mock('../../queue/queues', () => ({
  getIngestionCircuitGate: vi.fn(),
  getIngestionQueue: vi.fn(),
  getEnrichmentQueue: vi.fn(),
  getHealthScoreQueue: vi.fn(),
  recordIngestionQueued: vi.fn(),
  resolvePrimaryIngestionStrategy: vi.fn(),
  resolveStateIngestionStrategyChain: vi.fn()
}))

vi.mock('../../config/tieredIntegrations', () => ({
  resolveUccProvider: vi.fn()
}))

// v1 router (imported after mocks)
import v1Router from '../../routes/v1/index'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildApp(): Express {
  const app = express()
  app.use(express.json())
  app.use('/v1', v1Router)
  return app
}

const VALID_API_KEY = 'prk_validtestkey123'
const VALID_ORG_ID = 'org-abc-123'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('v1 API — /v1/health', () => {
  let app: Express

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset rate limiter to pass-through
    mockRateLimiterFn.mockImplementation((_req: unknown, _res: unknown, next: () => void) => next())
    mockVerify.mockResolvedValue({ keyId: 'key-1', orgId: VALID_ORG_ID, role: 'user' })
    app = buildApp()
  })

  it('returns 200 with version=v1 and status=ok for a valid API key', async () => {
    const res = await request(app).get('/v1/health').set('X-API-Key', VALID_API_KEY)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ version: 'v1', status: 'ok' })
  })

  it('adds X-API-Version: v1 header to a successful response', async () => {
    const res = await request(app).get('/v1/health').set('X-API-Key', VALID_API_KEY)

    expect(res.headers['x-api-version']).toBe('v1')
  })

  it('returns 401 when no credentials are provided', async () => {
    // No API key → extractApiKey returns undefined → falls back to JWT mock which rejects
    const res = await request(app).get('/v1/health')

    expect(res.status).toBe(401)
  })

  it('adds X-API-Version: v1 even on a 401 response', async () => {
    const res = await request(app).get('/v1/health')

    // versionHeader middleware runs before auth, so the header appears on error responses
    expect(res.headers['x-api-version']).toBe('v1')
  })
})

describe('v1 API — /v1/prospects auth guard', () => {
  let app: Express

  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimiterFn.mockImplementation((_req: unknown, _res: unknown, next: () => void) => next())
    mockList.mockResolvedValue({ prospects: [], page: 1, limit: 20, total: 0 })
    app = buildApp()
  })

  it('returns 401 when no credentials are provided', async () => {
    const res = await request(app).get('/v1/prospects')

    expect(res.status).toBe(401)
  })

  it('returns 401 when an invalid API key is presented', async () => {
    mockVerify.mockResolvedValue(null) // invalid key

    const res = await request(app).get('/v1/prospects').set('X-API-Key', 'prk_badkey')

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/invalid or expired/i)
  })

  it('returns 200 when a valid API key is presented', async () => {
    mockVerify.mockResolvedValue({ keyId: 'key-1', orgId: VALID_ORG_ID, role: 'user' })

    const res = await request(app).get('/v1/prospects').set('X-API-Key', VALID_API_KEY)

    expect(res.status).toBe(200)
    expect(res.headers['x-api-version']).toBe('v1')
  })

  it('accepts credentials via Authorization: Bearer prk_... header', async () => {
    mockVerify.mockResolvedValue({ keyId: 'key-2', orgId: VALID_ORG_ID, role: 'user' })

    const res = await request(app)
      .get('/v1/prospects')
      .set('Authorization', `Bearer ${VALID_API_KEY}`)

    expect(res.status).toBe(200)
  })
})

describe('v1 API — rate limiting', () => {
  let app: Express

  beforeEach(() => {
    vi.clearAllMocks()
    mockVerify.mockResolvedValue({ keyId: 'key-1', orgId: VALID_ORG_ID, role: 'user' })
  })

  it('returns 429 when the rate limiter denies the request', async () => {
    mockRateLimiterFn.mockImplementationOnce(
      (
        _req: unknown,
        res: {
          status: (n: number) => { json: (b: unknown) => void }
          set: (k: string, v: string) => void
        }
      ) => {
        res.set('X-RateLimit-Limit', '10')
        res.set('X-RateLimit-Remaining', '0')
        res.set('X-RateLimit-Reset', String(Math.floor(Date.now() / 1000) + 60))
        res.set('Retry-After', '60')
        res.status(429).json({
          error: {
            message: 'Too many requests. Please try again later.',
            code: 'RATE_LIMIT_EXCEEDED',
            statusCode: 429
          }
        })
      }
    )

    app = buildApp()

    const res = await request(app).get('/v1/prospects').set('X-API-Key', VALID_API_KEY)

    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED')
    expect(res.headers['x-ratelimit-remaining']).toBe('0')
    // Version header should still be present even on 429
    expect(res.headers['x-api-version']).toBe('v1')
  })

  it('passes through when quota is within limit', async () => {
    mockRateLimiterFn.mockImplementationOnce((_req: unknown, _res: unknown, next: () => void) =>
      next()
    )
    mockList.mockResolvedValue({ prospects: [], page: 1, limit: 20, total: 0 })
    app = buildApp()

    const res = await request(app).get('/v1/prospects').set('X-API-Key', VALID_API_KEY)

    expect(res.status).toBe(200)
  })
})

describe('v1 API — X-API-Version header on all responses', () => {
  let app: Express

  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimiterFn.mockImplementation((_req: unknown, _res: unknown, next: () => void) => next())
    mockVerify.mockResolvedValue({ keyId: 'key-1', orgId: VALID_ORG_ID, role: 'user' })
    mockList.mockResolvedValue({ prospects: [], page: 1, limit: 20, total: 0 })
    app = buildApp()
  })

  it('includes X-API-Version: v1 on GET /v1/health', async () => {
    const res = await request(app).get('/v1/health').set('X-API-Key', VALID_API_KEY)

    expect(res.headers['x-api-version']).toBe('v1')
  })

  it('includes X-API-Version: v1 on GET /v1/prospects', async () => {
    const res = await request(app).get('/v1/prospects').set('X-API-Key', VALID_API_KEY)

    expect(res.headers['x-api-version']).toBe('v1')
  })

  it('includes X-API-Version: v1 on a 401 unauthenticated response', async () => {
    mockVerify.mockResolvedValue(null)

    const res = await request(app).get('/v1/prospects').set('X-API-Key', 'prk_invalid')

    expect(res.status).toBe(401)
    expect(res.headers['x-api-version']).toBe('v1')
  })
})
