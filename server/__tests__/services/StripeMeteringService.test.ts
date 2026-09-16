import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StripeMeteringService } from '../../services/StripeMeteringService'
import {
  calculateUsageBilling,
  normalizeBillingTier,
  USAGE_BILLING_TIERS
} from '../../config/billingTiers'
import { database } from '../../database/connection'
import * as stripeIntegration from '../../integrations/stripe'

vi.mock('../../database/connection', () => ({
  database: {
    query: vi.fn()
  }
}))

vi.mock('../../integrations/stripe', async () => {
  const actual = await vi.importActual<typeof import('../../integrations/stripe')>(
    '../../integrations/stripe'
  )
  return {
    ...actual,
    isStripeConfigured: vi.fn(() => true),
    recordStripeMeterEvent: vi.fn(async () => ({
      identifier: 'meter_evt_mock_123',
      event_name: 'api_requests'
    })),
    recordStripeUsage: vi.fn(async () => ({
      id: 'mrec_123',
      quantity: 50
    }))
  }
})

describe('Billing Tiers & Edge Rate Limits Mapping', () => {
  it('normalizes tier names correctly', () => {
    expect(normalizeBillingTier('free')).toBe('free')
    expect(normalizeBillingTier('starter')).toBe('starter')
    expect(normalizeBillingTier('growth')).toBe('growth')
    expect(normalizeBillingTier('pro')).toBe('professional')
    expect(normalizeBillingTier('professional')).toBe('professional')
    expect(normalizeBillingTier('enterprise')).toBe('enterprise')
    expect(normalizeBillingTier(null)).toBe('free')
    expect(normalizeBillingTier('unknown')).toBe('free')
  })

  it('matches edge rate-limiting limits (10, 100, 1000, 10000)', () => {
    expect(USAGE_BILLING_TIERS.free.rateLimitRpm).toBe(10)
    expect(USAGE_BILLING_TIERS.starter.rateLimitRpm).toBe(100)
    expect(USAGE_BILLING_TIERS.growth.rateLimitRpm).toBe(1000)
    expect(USAGE_BILLING_TIERS.professional.rateLimitRpm).toBe(1000)
    expect(USAGE_BILLING_TIERS.enterprise.rateLimitRpm).toBe(10000)
  })

  it('calculates billing for within-quota requests', () => {
    const result = calculateUsageBilling('starter', 5000)
    expect(result.tier).toBe('starter')
    expect(result.includedQuota).toBe(10000)
    expect(result.overageRequests).toBe(0)
    expect(result.basePriceUsd).toBe(49)
    expect(result.estimatedOverageCostUsd).toBe(0)
    expect(result.totalEstimatedCostUsd).toBe(49)
  })

  it('calculates billing for overage requests accurately', () => {
    // 10,000 included + 2,500 overage at $0.01 = $25.00
    const result = calculateUsageBilling('starter', 12500)
    expect(result.overageRequests).toBe(2500)
    expect(result.estimatedOverageCostUsd).toBe(25)
    expect(result.totalEstimatedCostUsd).toBe(74)
  })

  it('enforces free tier hard cap with zero overage cost', () => {
    const result = calculateUsageBilling('free', 150)
    expect(result.includedQuota).toBe(100)
    expect(result.estimatedOverageCostUsd).toBe(0)
    expect(result.totalEstimatedCostUsd).toBe(0)
  })
})

describe('StripeMeteringService', () => {
  let service: StripeMeteringService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new StripeMeteringService()
  })

  describe('recordApiUsage', () => {
    it('persists usage events with method and status code', async () => {
      const dbMock = vi.mocked(database.query).mockResolvedValueOnce([])

      await service.recordApiUsage({
        orgId: 'org-test-123',
        keyId: 'key-test-456',
        endpoint: '/v1/prospects',
        method: 'GET',
        statusCode: 200,
        requestCount: 1
      })

      expect(dbMock).toHaveBeenCalledTimes(1)
      const call = dbMock.mock.calls[0]
      expect(call[0]).toContain('INSERT INTO api_usage_events')
      expect(call[1]).toEqual([
        'org-test-123',
        'key-test-456',
        '/v1/prospects',
        'GET',
        200,
        1,
        expect.any(String)
      ])
    })

    it('does not throw when database fails', async () => {
      vi.mocked(database.query).mockRejectedValueOnce(new Error('DB Connection Failed'))

      await expect(
        service.recordApiUsage({
          orgId: 'org-error-safe',
          endpoint: '/v1/jobs',
          method: 'POST',
          statusCode: 201
        })
      ).resolves.not.toThrow()
    })
  })

  describe('getOrgUsageSummary', () => {
    it('returns structured usage stats with overage calculations', async () => {
      // 1. Return org tier
      vi.mocked(database.query)
        .mockResolvedValueOnce([
          {
            subscription_tier: 'starter',
            stripe_customer_id: 'cus_123',
            subscription_current_period_end: null
          }
        ])
        // 2. Return aggregated usage
        .mockResolvedValueOnce([
          {
            total_requests: '15000',
            reported_count: '10000',
            unreported_count: '5000'
          }
        ])

      const summary = await service.getOrgUsageSummary('org-test-123')

      expect(summary.orgId).toBe('org-test-123')
      expect(summary.tier).toBe('starter')
      expect(summary.rateLimitRpm).toBe(100)
      expect(summary.monthlyIncludedRequests).toBe(10000)
      expect(summary.totalRequests).toBe(15000)
      expect(summary.billableOverageRequests).toBe(5000)
      expect(summary.estimatedOverageCostUsd).toBe(50) // 5,000 * $0.01
      expect(summary.totalEstimatedCostUsd).toBe(99) // $49 base + $50 overage
      expect(summary.reportedToStripeCount).toBe(10000)
      expect(summary.unreportedCount).toBe(5000)
    })
  })

  describe('reportUsageToStripe', () => {
    it('sends meter event to Stripe and marks rows as reported', async () => {
      vi.mocked(database.query)
        // Org query
        .mockResolvedValueOnce([
          {
            stripe_customer_id: 'cus_xyz_999',
            stripe_subscription_id: 'sub_123',
            subscription_tier: 'growth'
          }
        ])
        // Pending count query
        .mockResolvedValueOnce([{ count: '250' }])
        // Update query
        .mockResolvedValueOnce([])
        // Upsert record query
        .mockResolvedValueOnce([])

      const result = await service.reportUsageToStripe({ orgId: 'org-test-growth' })

      expect(result.reportedToStripe).toBe(true)
      expect(result.quantity).toBe(250)
      expect(stripeIntegration.recordStripeMeterEvent).toHaveBeenCalledWith({
        eventName: 'api_requests',
        customerId: 'cus_xyz_999',
        value: 250,
        timestamp: expect.any(Date),
        identifier: expect.stringContaining('meter_org-test-growth')
      })
    })

    it('returns error when organization is not found', async () => {
      vi.mocked(database.query).mockResolvedValueOnce([])

      const result = await service.reportUsageToStripe({ orgId: 'org-nonexistent' })
      expect(result.reportedToStripe).toBe(false)
      expect(result.error).toBe('Organization not found')
    })

    it('keeps usage pending when Stripe rejects the meter event', async () => {
      vi.mocked(database.query)
        .mockResolvedValueOnce([
          {
            stripe_customer_id: 'cus_failed',
            stripe_subscription_id: 'sub_failed',
            subscription_tier: 'starter'
          }
        ])
        .mockResolvedValueOnce([{ count: '25' }])
      vi.mocked(stripeIntegration.recordStripeMeterEvent).mockRejectedValueOnce(
        new Error('Stripe unavailable')
      )

      const result = await service.reportUsageToStripe({ orgId: 'org-failed' })

      expect(result).toMatchObject({
        orgId: 'org-failed',
        quantity: 25,
        reportedToStripe: false,
        error: 'Stripe unavailable'
      })
      expect(database.query).toHaveBeenCalledTimes(2)
      expect(
        vi
          .mocked(database.query)
          .mock.calls.some(([sql]) => String(sql).includes('SET reported_to_stripe = true'))
      ).toBe(false)
    })
  })

  describe('syncUnreportedUsage', () => {
    it('iterates through orgs with unreported events and reports to Stripe', async () => {
      // Find orgs with pending events
      vi.mocked(database.query).mockResolvedValueOnce([
        { org_id: 'org-1', pending_count: '100' },
        { org_id: 'org-2', pending_count: '200' }
      ])

      const reportSpy = vi.spyOn(service, 'reportUsageToStripe').mockResolvedValue({
        orgId: 'org-mock',
        quantity: 100,
        reportedToStripe: true
      })

      const sync = await service.syncUnreportedUsage()

      expect(sync.syncedOrgsCount).toBe(2)
      expect(reportSpy).toHaveBeenCalledTimes(2)
    })
  })
})
