import type { SubscriptionTier } from './types'

/**
 * Translate billing/database tier names into the edge entitlement vocabulary.
 * Unknown values fail closed to the free tier.
 */
export function normalizeSubscriptionTier(tier: string | null | undefined): SubscriptionTier {
  switch (tier?.trim().toLowerCase()) {
    case 'starter':
      return 'starter'
    case 'growth':
      return 'growth'
    case 'professional':
    case 'pro':
      return 'pro'
    case 'scale':
    case 'enterprise':
      return 'enterprise'
    default:
      return 'free'
  }
}
