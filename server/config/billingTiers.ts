/**
 * Billing Tiers & Usage Limits Configuration.
 *
 * Aligned with edge rate-limiting limits defined in cloudflare/workers/api/src/rateLimit.ts.
 * Tier RPM:
 *  - free: 10 req/min
 *  - starter: 100 req/min
 *  - growth: 1 000 req/min
 *  - pro / professional: 1 000 req/min
 *  - enterprise: 10 000 req/min
 *
 * @module server/config/billingTiers
 */

import type { BillingTierPlan, MeteredBillingTier } from '@public-records/core'

export const USAGE_BILLING_TIERS: Record<MeteredBillingTier, BillingTierPlan> = {
  free: {
    tier: 'free',
    name: 'Free (Community)',
    rateLimitRpm: 10,
    monthlyIncludedRequests: 100,
    basePriceUsd: 0,
    overageUnitPriceUsd: 0, // Hard cap, no overage allowed
    features: [
      'Public records / OSS data sources',
      '10 req/min edge rate limit',
      '100 requests/month included',
      'Community support'
    ],
    stripeMeterEventName: 'api_requests'
  },
  starter: {
    tier: 'starter',
    name: 'Starter',
    rateLimitRpm: 100,
    monthlyIncludedRequests: 10000,
    basePriceUsd: 49,
    overageUnitPriceUsd: 0.01,
    features: [
      'Commercial data sources & UCC searches',
      '100 req/min edge rate limit',
      '10,000 requests/month included',
      '$0.01/call metered overage',
      'Email support'
    ],
    stripeMeterEventName: 'api_requests'
  },
  growth: {
    tier: 'growth',
    name: 'Growth',
    rateLimitRpm: 1000,
    monthlyIncludedRequests: 50000,
    basePriceUsd: 199,
    overageUnitPriceUsd: 0.005,
    features: [
      'Multi-state UCC & filing alerts',
      '1,000 req/min edge rate limit',
      '50,000 requests/month included',
      '$0.005/call metered overage',
      'Webhooks & CRM push integrations'
    ],
    stripeMeterEventName: 'api_requests'
  },
  pro: {
    tier: 'pro',
    name: 'Professional',
    rateLimitRpm: 1000,
    monthlyIncludedRequests: 100000,
    basePriceUsd: 299,
    overageUnitPriceUsd: 0.003,
    features: [
      'Full data enrichment & ML scoring pipeline',
      '1,000 req/min edge rate limit',
      '100,000 requests/month included',
      '$0.003/call metered overage',
      'Priority support & SLA guarantee'
    ],
    stripeMeterEventName: 'api_requests'
  },
  professional: {
    tier: 'professional',
    name: 'Professional',
    rateLimitRpm: 1000,
    monthlyIncludedRequests: 100000,
    basePriceUsd: 299,
    overageUnitPriceUsd: 0.003,
    features: [
      'Full data enrichment & ML scoring pipeline',
      '1,000 req/min edge rate limit',
      '100,000 requests/month included',
      '$0.003/call metered overage',
      'Priority support & SLA guarantee'
    ],
    stripeMeterEventName: 'api_requests'
  },
  enterprise: {
    tier: 'enterprise',
    name: 'Enterprise',
    rateLimitRpm: 10000,
    monthlyIncludedRequests: 1000000,
    basePriceUsd: 999,
    overageUnitPriceUsd: 0.001,
    features: [
      'Dedicated tenant infrastructure',
      '10,000 req/min edge rate limit',
      '1,000,000 requests/month included',
      '$0.001/call metered overage',
      '24/7 dedicated support & custom contracts'
    ],
    stripeMeterEventName: 'api_requests'
  }
}

/**
 * Normalize an arbitrary tier string to a known MeteredBillingTier, default 'free'.
 */
export function normalizeBillingTier(tierName?: string | null): MeteredBillingTier {
  if (!tierName) return 'free'
  const normalized = tierName.trim().toLowerCase()
  if (normalized === 'pro') return 'professional'
  if (normalized in USAGE_BILLING_TIERS) {
    return normalized as MeteredBillingTier
  }
  return 'free'
}

/**
 * Retrieve billing tier configuration.
 */
export function getBillingTierConfig(tierName?: string | null): BillingTierPlan {
  const normalized = normalizeBillingTier(tierName)
  return USAGE_BILLING_TIERS[normalized] ?? USAGE_BILLING_TIERS.free
}

/**
 * Calculate usage and overage billing numbers for an org.
 */
export function calculateUsageBilling(
  tierName: string | null | undefined,
  totalRequests: number
): {
  tier: MeteredBillingTier
  rateLimitRpm: number
  includedQuota: number
  overageRequests: number
  basePriceUsd: number
  estimatedOverageCostUsd: number
  totalEstimatedCostUsd: number
} {
  const config = getBillingTierConfig(tierName)
  const includedQuota = config.monthlyIncludedRequests
  const overageRequests = Math.max(0, totalRequests - includedQuota)
  const estimatedOverageCostUsd = Number((overageRequests * config.overageUnitPriceUsd).toFixed(4))
  const totalEstimatedCostUsd = Number((config.basePriceUsd + estimatedOverageCostUsd).toFixed(2))

  return {
    tier: config.tier,
    rateLimitRpm: config.rateLimitRpm,
    includedQuota,
    overageRequests,
    basePriceUsd: config.basePriceUsd,
    estimatedOverageCostUsd,
    totalEstimatedCostUsd
  }
}
