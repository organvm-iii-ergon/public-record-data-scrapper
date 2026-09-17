/**
 * Versioned REST API — v1 Billing & Metering routes.
 *
 * GET /v1/billing/usage — returns current tenant usage, rate limits, and projected billing.
 * GET /v1/billing/tiers — returns supported usage-based billing tiers.
 *
 * @module server/routes/v1/billing
 */

import { Router } from 'express'
import { asyncHandler } from '../../middleware/errorHandler'
import type { AuthenticatedRequest } from '../../middleware/authMiddleware'
import { stripeMeteringService } from '../../services/StripeMeteringService'
import { USAGE_BILLING_TIERS } from '../../config/billingTiers'

const router = Router()

/**
 * GET /v1/billing/usage
 * Returns current tenant usage statistics, rate limits, included allowances,
 * and estimated overage charges.
 */
router.get(
  '/usage',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest
    const orgId = authReq.user?.orgId || authReq.orgId
    if (!orgId) {
      res.status(400).json({
        error: {
          message: 'Tenant organization context is required to query usage',
          code: 'ORG_CONTEXT_REQUIRED',
          statusCode: 400
        }
      })
      return
    }

    const summary = await stripeMeteringService.getOrgUsageSummary(orgId)
    res.json(summary)
  })
)

/**
 * GET /v1/billing/tiers
 * Returns all active billing tiers, rate limits (RPM), monthly quotas, and overage pricing.
 */
router.get('/tiers', (_req, res) => {
  res.json({
    tiers: Object.values(USAGE_BILLING_TIERS)
  })
})

export default router
