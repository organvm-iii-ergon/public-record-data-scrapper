/**
 * Cloudflare Edge Billing & Metering Route (v1).
 *
 * GET /v1/billing/usage — returns current tenant usage, rate limits, and allowance.
 * GET /v1/billing/tiers — returns active billing tiers and edge rate limits.
 */

import { Hono } from 'hono'
import { TIER_LIMITS, TIER_MONTHLY_QUOTAS } from '../rateLimit'
import type { AppBindings, SubscriptionTier } from '../types'

export const billingRoute = new Hono<AppBindings>()

/**
 * GET /v1/billing/tiers
 */
billingRoute.get('/tiers', (c) => {
  const tiers: SubscriptionTier[] = ['free', 'starter', 'growth', 'pro', 'enterprise']
  const details = tiers.map((tier) => ({
    tier,
    rateLimitRpm: TIER_LIMITS[tier],
    monthlyIncludedRequests: TIER_MONTHLY_QUOTAS[tier]
  }))
  return c.json({ tiers: details })
})

/**
 * GET /v1/billing/usage
 */
billingRoute.get('/usage', async (c) => {
  const identity = c.get('identity')
  const orgId = identity?.orgId ?? 'anonymous'
  const tier: SubscriptionTier = identity?.tier ?? 'free'
  const limitRpm = TIER_LIMITS[tier] ?? TIER_LIMITS.free
  const monthlyQuota = TIER_MONTHLY_QUOTAS[tier] ?? TIER_MONTHLY_QUOTAS.free

  let totalRequests = 0
  if (c.env.DB && orgId !== 'anonymous') {
    try {
      const row = await c.env.DB.prepare(
        `SELECT COALESCE(SUM(request_count), 0) AS count
           FROM api_usage_events
          WHERE org_id = ?`
      )
        .bind(orgId)
        .first<{ count: number }>()

      totalRequests = Number(row?.count ?? 0)
    } catch {
      // D1 query failure is non-fatal
    }
  }

  const billableOverageRequests = Math.max(0, totalRequests - monthlyQuota)

  return c.json({
    orgId,
    tier,
    rateLimitRpm: limitRpm,
    monthlyIncludedRequests: monthlyQuota,
    totalRequests,
    billableOverageRequests
  })
})
