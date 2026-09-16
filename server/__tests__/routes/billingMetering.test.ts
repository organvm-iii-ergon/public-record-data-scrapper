import { describe, it, expect, vi, beforeEach } from 'vitest'
import express, { Express } from 'express'
import request from 'supertest'
import billingRouter from '../../routes/billing'
import v1BillingRouter from '../../routes/v1/billing'
import { usageMeteringMiddleware } from '../../middleware/usageMetering'
import { stripeMeteringService } from '../../services/StripeMeteringService'
import { USAGE_BILLING_TIERS } from '../../config/billingTiers'

vi.mock('../../services/StripeMeteringService', () => ({
  stripeMeteringService: {
    recordApiUsage: vi.fn(async () => {}),
    getOrgUsageSummary: vi.fn(async (orgId: string) => ({
      orgId,
      tier: 'starter',
      periodStart: '2026-09-01T00:00:00.000Z',
      periodEnd: '2026-09-30T23:59:59.999Z',
      rateLimitRpm: 100,
      monthlyIncludedRequests: 10000,
      totalRequests: 12000,
      billableOverageRequests: 2000,
      basePriceUsd: 49,
      estimatedOverageCostUsd: 20,
      totalEstimatedCostUsd: 69,
      reportedToStripeCount: 10000,
      unreportedCount: 2000
    })),
    reportUsageToStripe: vi.fn(async ({ orgId, quantity }) => ({
      orgId,
      quantity: quantity ?? 2000,
      reportedToStripe: true,
      eventId: 'meter_evt_test_123'
    })),
    syncUnreportedUsage: vi.fn(async () => ({
      syncedOrgsCount: 1,
      totalEventsReported: 2000,
      errors: []
    }))
  }
}))

vi.mock('../../integrations/stripe', async () => {
  const actual = await vi.importActual<typeof import('../../integrations/stripe')>(
    '../../integrations/stripe'
  )
  return {
    ...actual,
    isStripeConfigured: vi.fn(() => true)
  }
})

describe('Billing & Metering Routes', () => {
  let app: Express

  beforeEach(() => {
    vi.clearAllMocks()
    app = express()
    app.use(express.json())
    app.use('/api/billing', billingRouter)
    app.use('/v1/billing', v1BillingRouter)
  })

  describe('GET /api/billing/tiers', () => {
    it('returns all active usage-based billing tiers with rate limits', async () => {
      const res = await request(app).get('/api/billing/tiers')
      expect(res.status).toBe(200)
      expect(res.body.tiers).toHaveLength(Object.keys(USAGE_BILLING_TIERS).length)
      expect(res.body.tiers.some((t: { tier: string }) => t.tier === 'starter')).toBe(true)
      expect(res.body.tiers.some((t: { tier: string }) => t.tier === 'growth')).toBe(true)
      expect(
        res.body.tiers.some((t: { tier: string }) => t.tier === 'pro' || t.tier === 'professional')
      ).toBe(true)
    })
  })

  describe('GET /v1/billing/tiers', () => {
    it('returns tiers on the versioned v1 namespace', async () => {
      const res = await request(app).get('/v1/billing/tiers')
      expect(res.status).toBe(200)
      expect(res.body.tiers).toBeDefined()
    })
  })

  describe('GET /api/billing/usage', () => {
    it('returns 400 when organization ID is missing', async () => {
      const res = await request(app).get('/api/billing/usage')
      expect(res.status).toBe(400)
      expect(res.body.error).toContain('Organization ID is required')
    })

    it('returns usage statistics when orgId is provided via query param', async () => {
      const res = await request(app).get('/api/billing/usage?orgId=org-test-123')
      expect(res.status).toBe(200)
      expect(res.body.orgId).toBe('org-test-123')
      expect(res.body.rateLimitRpm).toBe(100)
      expect(res.body.totalRequests).toBe(12000)
      expect(res.body.billableOverageRequests).toBe(2000)
      expect(stripeMeteringService.getOrgUsageSummary).toHaveBeenCalledWith('org-test-123')
    })

    it('returns usage statistics when orgId is provided via X-Org-Id header', async () => {
      const res = await request(app).get('/api/billing/usage').set('X-Org-Id', 'org-header-456')

      expect(res.status).toBe(200)
      expect(res.body.orgId).toBe('org-header-456')
      expect(stripeMeteringService.getOrgUsageSummary).toHaveBeenCalledWith('org-header-456')
    })
  })

  describe('POST /api/billing/usage/report', () => {
    it('triggers Stripe meter sync for a specific org', async () => {
      const res = await request(app)
        .post('/api/billing/usage/report')
        .send({ orgId: 'org-test-123', quantity: 500 })

      expect(res.status).toBe(200)
      expect(res.body.reportedToStripe).toBe(true)
      expect(stripeMeteringService.reportUsageToStripe).toHaveBeenCalledWith({
        orgId: 'org-test-123',
        quantity: 500
      })
    })

    it('triggers batch sync across all orgs when no orgId is specified', async () => {
      const res = await request(app).post('/api/billing/usage/report').send({})
      expect(res.status).toBe(200)
      expect(res.body.syncedOrgsCount).toBe(1)
      expect(stripeMeteringService.syncUnreportedUsage).toHaveBeenCalledTimes(1)
    })
  })

  describe('usageMeteringMiddleware', () => {
    it('stamps tier and usage headers on requests and meters completed calls', async () => {
      const testApp = express()
      testApp.use((req, res, next) => {
        ;(req as express.Request & { user?: { orgId: string; id: string } }).user = {
          orgId: 'org-meter-test',
          id: 'apikey:key-xyz'
        }
        next()
      })
      testApp.use(usageMeteringMiddleware)
      testApp.get('/v1/test-endpoint', (_req, res) => {
        res.status(200).json({ ok: true })
      })

      const res = await request(testApp).get('/v1/test-endpoint')

      expect(res.status).toBe(200)
      expect(res.headers['x-usage-tier']).toBe('free')
      expect(res.headers['x-usage-limit-rpm']).toBe('10')
      expect(res.headers['x-usage-quota-monthly']).toBe('100')

      expect(stripeMeteringService.recordApiUsage).toHaveBeenCalledWith({
        orgId: 'org-meter-test',
        keyId: 'key-xyz',
        endpoint: '/v1/test-endpoint',
        method: 'GET',
        statusCode: 200,
        requestCount: 1
      })
    })
  })
})
