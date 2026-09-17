import { describe, it, expect, beforeEach, vi } from 'vitest'
import express, { Express } from 'express'
import request from 'supertest'
import { partnerReferralService } from '../../services/PartnerReferralService'
import partnerReferralsRouter from '../../routes/partnerReferrals'
import { errorHandler } from '../../middleware/errorHandler'
import { createAuthHeader } from '../helpers/testApp'

vi.mock('../../services/PartnerReferralService', () => ({
  partnerReferralService: {
    getPartnerMetrics: vi.fn(),
    updatePartnerCode: vi.fn(),
    updatePayoutEmail: vi.fn(),
    recordReferralEvent: vi.fn()
  }
}))

const mockPartnerService = vi.mocked(partnerReferralService)

function createTestApp(): Express {
  const app = express()
  app.use(express.json())
  app.use('/api/partner', partnerReferralsRouter)
  app.use(errorHandler)
  return app
}

describe('Partner Referrals Routes (/api/partner)', () => {
  let app: Express
  let authHeader: string

  beforeEach(() => {
    vi.clearAllMocks()
    app = createTestApp()
    authHeader = createAuthHeader('user-1', { orgId: 'org-1' })
  })

  describe('GET /api/partner/portal', () => {
    it('returns 401 if unauthenticated', async () => {
      const res = await request(app).get('/api/partner/portal')
      expect(res.status).toBe(401)
    })

    it('returns 401 if token has no org context', async () => {
      const unattachedAuth = createAuthHeader('user-1', { orgId: null })
      const res = await request(app).get('/api/partner/portal').set('Authorization', unattachedAuth)
      expect(res.status).toBe(401)
    })

    it('returns full partner metrics for authenticated tenant', async () => {
      const mockMetrics = {
        program: {
          id: 'prog-1',
          orgId: 'org-1',
          partnerCode: 'CODE-123',
          referralUrl: 'https://app.test.com/?ref=CODE-123',
          commissionRate: 15,
          tier: 'bronze' as const,
          payoutEmail: null,
          status: 'active' as const,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z'
        },
        totalClicks: 50,
        totalSignups: 10,
        totalConversions: 3,
        conversionRate: 6.0,
        totalEarningsUsd: 150.0,
        pendingEarningsUsd: 150.0,
        paidEarningsUsd: 0.0,
        partnerTier: 'bronze' as const,
        commissionRate: 15,
        nextTierThreshold: 5,
        conversionsToNextTier: 2,
        recentEvents: []
      }

      mockPartnerService.getPartnerMetrics.mockResolvedValueOnce(mockMetrics)

      const res = await request(app).get('/api/partner/portal').set('Authorization', authHeader)

      expect(res.status).toBe(200)
      expect(res.body.program.partnerCode).toBe('CODE-123')
      expect(res.body.totalClicks).toBe(50)
      expect(mockPartnerService.getPartnerMetrics).toHaveBeenCalledWith('org-1')
    })
  })

  describe('POST /api/partner/code', () => {
    it('returns 401 if unauthenticated', async () => {
      const res = await request(app).post('/api/partner/code').send({ partnerCode: 'NEW-CODE' })
      expect(res.status).toBe(401)
    })

    it('returns 400 for invalid partner code schema', async () => {
      const res = await request(app)
        .post('/api/partner/code')
        .set('Authorization', authHeader)
        .send({ partnerCode: 'hi' }) // too short (< 3)

      expect(res.status).toBe(400)
      expect(mockPartnerService.updatePartnerCode).not.toHaveBeenCalled()
    })

    it('returns 400 when service throws an error (e.g. duplicate code)', async () => {
      mockPartnerService.updatePartnerCode.mockRejectedValueOnce(
        new Error("Referral code 'TAKEN-CODE' is already taken")
      )

      const res = await request(app)
        .post('/api/partner/code')
        .set('Authorization', authHeader)
        .send({ partnerCode: 'TAKEN-CODE' })

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('already taken')
    })

    it('successfully updates code', async () => {
      mockPartnerService.updatePartnerCode.mockResolvedValueOnce({
        id: 'prog-1',
        orgId: 'org-1',
        partnerCode: 'MY-CODE',
        referralUrl: 'https://app.test.com/?ref=MY-CODE',
        commissionRate: 15,
        tier: 'bronze',
        payoutEmail: null,
        status: 'active',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z'
      })

      const res = await request(app)
        .post('/api/partner/code')
        .set('Authorization', authHeader)
        .send({ partnerCode: 'MY-CODE' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.program.partnerCode).toBe('MY-CODE')
      expect(mockPartnerService.updatePartnerCode).toHaveBeenCalledWith('org-1', 'MY-CODE')
    })
  })

  describe('POST /api/partner/payout-email', () => {
    it('returns 400 for invalid email', async () => {
      const res = await request(app)
        .post('/api/partner/payout-email')
        .set('Authorization', authHeader)
        .send({ payoutEmail: 'not-an-email' })

      expect(res.status).toBe(400)
    })

    it('successfully updates payout email', async () => {
      mockPartnerService.updatePayoutEmail.mockResolvedValueOnce({
        id: 'prog-1',
        orgId: 'org-1',
        partnerCode: 'MY-CODE',
        referralUrl: 'https://app.test.com/?ref=MY-CODE',
        commissionRate: 15,
        tier: 'bronze',
        payoutEmail: 'payout@firm.com',
        status: 'active',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z'
      })

      const res = await request(app)
        .post('/api/partner/payout-email')
        .set('Authorization', authHeader)
        .send({ payoutEmail: 'payout@firm.com' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.program.payoutEmail).toBe('payout@firm.com')
      expect(mockPartnerService.updatePayoutEmail).toHaveBeenCalledWith('org-1', 'payout@firm.com')
    })
  })

  describe('POST /api/partner/track/click', () => {
    it('is public and records click for valid code', async () => {
      mockPartnerService.recordReferralEvent.mockResolvedValueOnce({
        id: 'evt-101',
        programId: 'prog-1',
        eventType: 'click',
        revenueAmount: 0,
        commissionAmount: 0,
        createdAt: '2026-01-01T00:00:00Z'
      })

      const res = await request(app).post('/api/partner/track/click').send({
        partnerCode: 'GROWTH-10',
        referrer: 'https://linkedin.com'
      })

      expect(res.status).toBe(200)
      expect(res.body.tracked).toBe(true)
      expect(res.body.eventId).toBe('evt-101')
      expect(mockPartnerService.recordReferralEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          partnerCode: 'GROWTH-10',
          eventType: 'click'
        })
      )
    })

    it('returns 404 when partner code does not exist', async () => {
      mockPartnerService.recordReferralEvent.mockResolvedValueOnce(null)

      const res = await request(app)
        .post('/api/partner/track/click')
        .send({ partnerCode: 'INVALID-CODE' })

      expect(res.status).toBe(404)
      expect(res.body.error).toContain('Invalid or unknown partner referral code')
    })
  })

  describe('GET /api/partner/stats', () => {
    it('returns aggregate summary metrics', async () => {
      mockPartnerService.getPartnerMetrics.mockResolvedValueOnce({
        program: {
          id: 'prog-1',
          orgId: 'org-1',
          partnerCode: 'CODE-99',
          referralUrl: 'https://app.test.com/?ref=CODE-99',
          commissionRate: 20,
          tier: 'silver' as const,
          payoutEmail: null,
          status: 'active' as const,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z'
        },
        totalClicks: 200,
        totalSignups: 30,
        totalConversions: 8,
        conversionRate: 4.0,
        totalEarningsUsd: 640.0,
        pendingEarningsUsd: 140.0,
        paidEarningsUsd: 500.0,
        partnerTier: 'silver' as const,
        commissionRate: 20,
        nextTierThreshold: 20,
        conversionsToNextTier: 12,
        recentEvents: []
      })

      const res = await request(app).get('/api/partner/stats').set('Authorization', authHeader)

      expect(res.status).toBe(200)
      expect(res.body.partnerCode).toBe('CODE-99')
      expect(res.body.tier).toBe('silver')
      expect(res.body.totalClicks).toBe(200)
      expect(res.body.totalConversions).toBe(8)
      expect(res.body.conversionRate).toBe(4.0)
      expect(res.body.totalEarningsUsd).toBe(640.0)
    })
  })
})
