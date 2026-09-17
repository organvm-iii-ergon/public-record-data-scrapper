/**
 * Partner & Referral Portal Routes (Issue #480).
 *
 * GET  /api/partner/portal       - Full partner program details, metrics, and event history
 * POST /api/partner/code         - Update custom referral code
 * POST /api/partner/payout-email - Update affiliate payout email
 * POST /api/partner/track/click  - Public click tracking endpoint (?ref=CODE)
 * GET  /api/partner/stats        - Aggregate partner conversion stats
 *
 * @module server/routes/partnerReferrals
 */

import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../middleware/errorHandler'
import { validateRequest } from '../middleware/validateRequest'
import { authMiddleware, type AuthenticatedRequest } from '../middleware/authMiddleware'
import { orgContextMiddleware } from '../middleware/orgContext'
import { partnerReferralService } from '../services/PartnerReferralService'

const router = Router()

const updateCodeSchema = z.object({
  partnerCode: z
    .string()
    .trim()
    .min(3, 'Partner code must be at least 3 characters')
    .max(30, 'Partner code must be at most 30 characters')
    .regex(
      /^[A-Za-z0-9_-]+$/,
      'Partner code can only contain letters, numbers, hyphens, and underscores'
    )
})

const updatePayoutEmailSchema = z.object({
  payoutEmail: z.string().trim().email('Valid email address required')
})

const trackClickSchema = z.object({
  partnerCode: z.string().trim().min(1, 'Partner code is required'),
  referrer: z.string().optional(),
  landingPage: z.string().optional()
})

/**
 * GET /api/partner/portal
 * Authenticated endpoint for viewing the tenant's partner portal dashboard.
 */
router.get(
  '/portal',
  authMiddleware,
  orgContextMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest
    const orgId = authReq.user?.orgId
    if (!orgId) {
      res.status(401).json({ error: 'Tenant organization context required' })
      return
    }

    const metrics = await partnerReferralService.getPartnerMetrics(orgId)
    res.json(metrics)
  })
)

/**
 * POST /api/partner/code
 * Update / customize tenant referral code.
 */
router.post(
  '/code',
  authMiddleware,
  orgContextMiddleware,
  validateRequest({ body: updateCodeSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest
    const orgId = authReq.user?.orgId
    if (!orgId) {
      res.status(401).json({ error: 'Tenant organization context required' })
      return
    }

    const { partnerCode } = req.body as z.infer<typeof updateCodeSchema>
    try {
      const updated = await partnerReferralService.updatePartnerCode(orgId, partnerCode)
      res.json({ success: true, program: updated })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      res.status(400).json({ error: message })
    }
  })
)

/**
 * POST /api/partner/payout-email
 * Update affiliate payout email.
 */
router.post(
  '/payout-email',
  authMiddleware,
  orgContextMiddleware,
  validateRequest({ body: updatePayoutEmailSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest
    const orgId = authReq.user?.orgId
    if (!orgId) {
      res.status(401).json({ error: 'Tenant organization context required' })
      return
    }

    const { payoutEmail } = req.body as z.infer<typeof updatePayoutEmailSchema>
    const updated = await partnerReferralService.updatePayoutEmail(orgId, payoutEmail)
    res.json({ success: true, program: updated })
  })
)

/**
 * POST /api/partner/track/click
 * Public endpoint to track link clicks with a referral code.
 */
router.post(
  '/track/click',
  validateRequest({ body: trackClickSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { partnerCode, referrer, landingPage } = req.body as z.infer<typeof trackClickSchema>

    const event = await partnerReferralService.recordReferralEvent({
      partnerCode,
      eventType: 'click',
      metadata: {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        referrer,
        landingPage
      }
    })

    if (!event) {
      res.status(404).json({ error: 'Invalid or unknown partner referral code' })
      return
    }

    res.json({ tracked: true, eventId: event.id })
  })
)

/**
 * GET /api/partner/stats
 * Quick summary stats for partner performance.
 */
router.get(
  '/stats',
  authMiddleware,
  orgContextMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest
    const orgId = authReq.user?.orgId
    if (!orgId) {
      res.status(401).json({ error: 'Tenant organization context required' })
      return
    }

    const metrics = await partnerReferralService.getPartnerMetrics(orgId)
    res.json({
      partnerCode: metrics.program.partnerCode,
      referralUrl: metrics.program.referralUrl,
      tier: metrics.partnerTier,
      commissionRate: metrics.commissionRate,
      totalClicks: metrics.totalClicks,
      totalSignups: metrics.totalSignups,
      totalConversions: metrics.totalConversions,
      conversionRate: metrics.conversionRate,
      totalEarningsUsd: metrics.totalEarningsUsd,
      pendingEarningsUsd: metrics.pendingEarningsUsd
    })
  })
)

export default router
