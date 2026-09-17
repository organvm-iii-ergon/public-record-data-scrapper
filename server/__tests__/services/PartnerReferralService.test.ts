import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  PartnerReferralService,
  determinePartnerTier,
  sanitizePartnerCode,
  PARTNER_TIER_CONFIG
} from '../../services/PartnerReferralService'

vi.mock('../../database/connection', () => ({
  database: {
    query: vi.fn()
  }
}))

vi.mock('../../config', () => ({
  config: {
    app: {
      publicUrl: 'https://app.test.com'
    },
    cors: {
      origin: ['https://app.test.com']
    }
  }
}))

import { database } from '../../database/connection'

const mockQuery = vi.mocked(database.query)

describe('PartnerReferralService', () => {
  let service: PartnerReferralService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new PartnerReferralService()
  })

  describe('determinePartnerTier and tier configs', () => {
    it('accurately resolves tier based on conversion count', () => {
      expect(determinePartnerTier(0)).toBe('bronze')
      expect(determinePartnerTier(4)).toBe('bronze')
      expect(determinePartnerTier(5)).toBe('silver')
      expect(determinePartnerTier(19)).toBe('silver')
      expect(determinePartnerTier(20)).toBe('gold')
      expect(determinePartnerTier(49)).toBe('gold')
      expect(determinePartnerTier(50)).toBe('platinum')
      expect(determinePartnerTier(100)).toBe('platinum')
    })

    it('has expected commission rates configured', () => {
      expect(PARTNER_TIER_CONFIG.bronze.commissionRate).toBe(15)
      expect(PARTNER_TIER_CONFIG.silver.commissionRate).toBe(20)
      expect(PARTNER_TIER_CONFIG.gold.commissionRate).toBe(25)
      expect(PARTNER_TIER_CONFIG.platinum.commissionRate).toBe(30)
    })
  })

  describe('sanitizePartnerCode', () => {
    it('trims, uppercases, and strips disallowed characters', () => {
      expect(sanitizePartnerCode('  my-partner_code!@#  ')).toBe('MY-PARTNER_CODE')
      expect(sanitizePartnerCode('abc def$')).toBe('ABCDEF')
      expect(sanitizePartnerCode('a'.repeat(40))).toHaveLength(30)
    })
  })

  describe('getOrCreateProgram', () => {
    it('returns existing program when present', async () => {
      const mockProgram = {
        id: 'prog-1',
        orgId: 'org-1',
        partnerCode: 'EXISTING-CODE',
        referralUrl: 'https://app.test.com/?ref=EXISTING-CODE',
        commissionRate: '15.00',
        tier: 'bronze',
        payoutEmail: null,
        status: 'active',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      }
      mockQuery.mockResolvedValueOnce([mockProgram])

      const result = await service.getOrCreateProgram('org-1')
      expect(result.partnerCode).toBe('EXISTING-CODE')
      expect(result.commissionRate).toBe(15)
      expect(mockQuery).toHaveBeenCalledTimes(1)
    })

    it('provisions new program when not found', async () => {
      mockQuery.mockResolvedValueOnce([]) // existing SELECT
      const inserted = {
        id: 'prog-new',
        orgId: 'org-2-test',
        partnerCode: 'PARTNER-ORG2TEST',
        referralUrl: 'https://app.test.com/?ref=PARTNER-ORG2TEST',
        commissionRate: '15.00',
        tier: 'bronze',
        payoutEmail: null,
        status: 'active',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      }
      mockQuery.mockResolvedValueOnce([inserted])

      const result = await service.getOrCreateProgram('org-2-test')
      expect(result.id).toBe('prog-new')
      expect(result.partnerCode).toBe('PARTNER-ORG2TEST')
      expect(result.commissionRate).toBe(15)
      expect(mockQuery).toHaveBeenCalledTimes(2)
    })
  })

  describe('updatePartnerCode', () => {
    it('rejects short partner codes', async () => {
      await expect(service.updatePartnerCode('org-1', 'ab')).rejects.toThrow(
        'Partner code must be at least 3 characters long'
      )
    })

    it('rejects code if already claimed by another organization', async () => {
      mockQuery.mockResolvedValueOnce([{ id: 'conflict-id' }]) // conflict check

      await expect(service.updatePartnerCode('org-1', 'TAKEN-CODE')).rejects.toThrow(
        "Referral code 'TAKEN-CODE' is already taken"
      )
    })

    it('successfully updates code when available', async () => {
      mockQuery.mockResolvedValueOnce([]) // conflict check passes
      mockQuery.mockResolvedValueOnce([
        {
          id: 'prog-1',
          orgId: 'org-1',
          partnerCode: 'NEW-VIP-CODE',
          referralUrl: 'https://app.test.com/?ref=NEW-VIP-CODE',
          commissionRate: '15.00',
          tier: 'bronze',
          payoutEmail: null,
          status: 'active',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z'
        }
      ])

      const res = await service.updatePartnerCode('org-1', 'NEW-VIP-CODE')
      expect(res.partnerCode).toBe('NEW-VIP-CODE')
      expect(res.referralUrl).toContain('NEW-VIP-CODE')
    })
  })

  describe('updatePayoutEmail', () => {
    it('updates payout destination email', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          id: 'prog-1',
          orgId: 'org-1',
          partnerCode: 'CODE-1',
          referralUrl: 'https://app.test.com/?ref=CODE-1',
          commissionRate: '15.00',
          tier: 'bronze',
          payoutEmail: 'payouts@partner.com',
          status: 'active',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z'
        }
      ])

      const res = await service.updatePayoutEmail('org-1', 'payouts@partner.com')
      expect(res.payoutEmail).toBe('payouts@partner.com')
    })
  })

  describe('recordReferralEvent', () => {
    it('returns null if partner code does not exist', async () => {
      mockQuery.mockResolvedValueOnce([]) // program not found
      const res = await service.recordReferralEvent({
        partnerCode: 'UNKNOWN-CODE',
        eventType: 'click'
      })
      expect(res).toBeNull()
    })

    it('records click event with metadata', async () => {
      mockQuery.mockResolvedValueOnce([{ id: 'prog-1', commission_rate: 15, tier: 'bronze' }])
      mockQuery.mockResolvedValueOnce([
        {
          id: 'evt-1',
          programId: 'prog-1',
          eventType: 'click',
          referredEmail: null,
          referredOrgId: null,
          revenueAmount: '0.00',
          commissionAmount: '0.00',
          metadata: { ip: '127.0.0.1' },
          createdAt: '2026-01-01T00:00:00Z'
        }
      ])

      const res = await service.recordReferralEvent({
        partnerCode: 'CODE-1',
        eventType: 'click',
        metadata: { ip: '127.0.0.1' }
      })

      expect(res).not.toBeNull()
      expect(res?.eventType).toBe('click')
      expect(res?.commissionAmount).toBe(0)
    })

    it('calculates commission on conversion and checks tier promotion', async () => {
      mockQuery.mockResolvedValueOnce([{ id: 'prog-1', commission_rate: 20, tier: 'silver' }])
      mockQuery.mockResolvedValueOnce([
        {
          id: 'evt-2',
          programId: 'prog-1',
          eventType: 'conversion',
          referredEmail: 'buyer@test.com',
          referredOrgId: 'org-sub',
          revenueAmount: '200.00',
          commissionAmount: '40.00',
          metadata: {},
          createdAt: '2026-01-01T00:00:00Z'
        }
      ])
      // evaluateTierPromotion: count query and update
      mockQuery.mockResolvedValueOnce([{ count: '20' }])
      mockQuery.mockResolvedValueOnce([]) // tier update query

      const res = await service.recordReferralEvent({
        partnerCode: 'CODE-1',
        eventType: 'conversion',
        referredEmail: 'buyer@test.com',
        revenueAmount: 200
      })

      expect(res?.commissionAmount).toBe(40)
      expect(res?.revenueAmount).toBe(200)
      // Check tier update query was issued for 20 conversions (gold tier)
      const updateCall = mockQuery.mock.calls.find((call) =>
        String(call[0]).includes('UPDATE partner_referral_programs')
      )
      expect(updateCall).toBeDefined()
      expect(updateCall?.[1]).toContain('gold')
    })
  })

  describe('getPartnerMetrics', () => {
    it('aggregates stats, conversion rate, earnings, and recent events', async () => {
      // getOrCreateProgram queries
      mockQuery.mockResolvedValueOnce([
        {
          id: 'prog-1',
          orgId: 'org-1',
          partnerCode: 'CODE-1',
          referralUrl: 'https://app.test.com/?ref=CODE-1',
          commissionRate: '20.00',
          tier: 'silver',
          payoutEmail: 'pay@test.com',
          status: 'active',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z'
        }
      ])

      // Aggregates query
      mockQuery.mockResolvedValueOnce([
        {
          clicks: '100',
          signups: '20',
          conversions: '10',
          total_earnings: '500.00',
          paid_earnings: '200.00'
        }
      ])

      // Recent events query
      mockQuery.mockResolvedValueOnce([
        {
          id: 'evt-1',
          programId: 'prog-1',
          eventType: 'conversion',
          referredEmail: 'test@customer.com',
          referredOrgId: null,
          revenueAmount: '100.00',
          commissionAmount: '20.00',
          metadata: {},
          createdAt: '2026-01-01T00:00:00Z'
        }
      ])

      const metrics = await service.getPartnerMetrics('org-1')

      expect(metrics.totalClicks).toBe(100)
      expect(metrics.totalSignups).toBe(20)
      expect(metrics.totalConversions).toBe(10)
      expect(metrics.conversionRate).toBe(10.0) // 10 / 100 * 100
      expect(metrics.totalEarningsUsd).toBe(500)
      expect(metrics.paidEarningsUsd).toBe(200)
      expect(metrics.pendingEarningsUsd).toBe(300)
      expect(metrics.partnerTier).toBe('silver')
      expect(metrics.commissionRate).toBe(20)
      expect(metrics.nextTierThreshold).toBe(20)
      expect(metrics.conversionsToNextTier).toBe(10)
      expect(metrics.recentEvents).toHaveLength(1)
    })
  })
})
