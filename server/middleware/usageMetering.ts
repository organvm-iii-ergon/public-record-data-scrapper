/**
 * Usage-Based Billing & Metering Middleware.
 *
 * Meters API requests under versioned endpoints (/v1/*) for paying and free
 * tenants, tracking usage counts against edge rate-limit allowances.
 *
 * Runs non-blockingly on response completion so the client latency is unaffected.
 *
 * @module server/middleware/usageMetering
 */

import type { Request, Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from './authMiddleware'
import { getResolvedDataTier } from './dataTier'
import { stripeMeteringService } from '../services/StripeMeteringService'
import { getBillingTierConfig } from '../config/billingTiers'

/**
 * Middleware that stamps tier headers on the response and records usage
 * events on completion for authenticated tenant requests.
 */
export function usageMeteringMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authReq = req as AuthenticatedRequest
  const orgId = authReq.user?.orgId || authReq.orgId
  const keyId = authReq.user?.id?.startsWith('apikey:')
    ? authReq.user.id.replace('apikey:', '')
    : undefined

  // Stamp tier and rate limit metadata headers
  // dataTierRouter stores a context object; normalize only its trusted
  // resolved value so authenticated v1 requests cannot crash here.
  const resolvedDataTier = getResolvedDataTier(req)
  const resolvedTier = resolvedDataTier === 'starter-tier' ? 'starter' : 'free'
  const tierConfig = getBillingTierConfig(resolvedTier)

  res.setHeader('X-Usage-Tier', tierConfig.tier)
  res.setHeader('X-Usage-Limit-RPM', String(tierConfig.rateLimitRpm))
  res.setHeader('X-Usage-Quota-Monthly', String(tierConfig.monthlyIncludedRequests))

  if (!orgId) {
    // Unauthenticated or system requests are not metered to a tenant
    return next()
  }

  // Hook into response finish event for non-blocking asynchronous usage logging
  res.on('finish', () => {
    // Only meter successful or business client errors; do not bill 5xx server failures
    if (res.statusCode >= 500) {
      return
    }

    const endpoint = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path

    // Skip internal health probes from billing metering
    if (endpoint.endsWith('/health') || endpoint.includes('/billing/usage')) {
      return
    }

    stripeMeteringService
      .recordApiUsage({
        orgId,
        keyId,
        endpoint,
        method: req.method,
        statusCode: res.statusCode,
        requestCount: 1
      })
      .catch((err) => {
        console.warn('[usageMeteringMiddleware] Failed to meter request:', err)
      })
  })

  next()
}
