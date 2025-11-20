/**
 * Tier Management System
 * 
 * Manages subscription tiers and access control for data enrichment features
 */

import { SubscriptionTier } from '../agentic/types'

export interface TierConfig {
  tier: SubscriptionTier
  monthlyQuota: number
  maxConcurrentRequests: number
  allowedSources: string[]
  features: string[]
}

export const TIER_CONFIGS: Record<SubscriptionTier, TierConfig> = {
  free: {
    tier: 'free',
    monthlyQuota: 100,
    maxConcurrentRequests: 1,
    allowedSources: ['sec-edgar', 'osha', 'uspto', 'census'],
    features: ['basic-enrichment', 'ucc-search']
  },
  starter: {
    tier: 'starter',
    monthlyQuota: 1000,
    maxConcurrentRequests: 3,
    allowedSources: [
      'sec-edgar', 'osha', 'uspto', 'census',
      'dnb', 'google-places', 'clearbit'
    ],
    features: ['basic-enrichment', 'ucc-search', 'commercial-data', 'priority-support']
  },
  professional: {
    tier: 'professional',
    monthlyQuota: 5000,
    maxConcurrentRequests: 5,
    allowedSources: [
      'sec-edgar', 'osha', 'uspto', 'census',
      'dnb', 'google-places', 'clearbit',
      'experian', 'zoominfo', 'newsapi'
    ],
    features: [
      'basic-enrichment', 'ucc-search', 'commercial-data',
      'premium-data', 'advanced-analytics', 'priority-support',
      'custom-integrations'
    ]
  },
  enterprise: {
    tier: 'enterprise',
    monthlyQuota: -1, // unlimited
    maxConcurrentRequests: 10,
    allowedSources: ['all'],
    features: [
      'basic-enrichment', 'ucc-search', 'commercial-data',
      'premium-data', 'advanced-analytics', 'priority-support',
      'custom-integrations', 'dedicated-support', 'sla-guarantee',
      'white-label', 'api-access'
    ]
  }
}

export class TierManager {
  /**
   * Get tier configuration for a user
   */
  static getTierConfig(tier: SubscriptionTier): TierConfig {
    return TIER_CONFIGS[tier]
  }

  /**
   * Check if a user has access to a data source
   */
  static hasSourceAccess(tier: SubscriptionTier, sourceName: string): boolean {
    const config = this.getTierConfig(tier)
    return config.allowedSources.includes('all') || config.allowedSources.includes(sourceName)
  }

  /**
   * Check if a user has access to a feature
   */
  static hasFeatureAccess(tier: SubscriptionTier, featureName: string): boolean {
    const config = this.getTierConfig(tier)
    return config.features.includes(featureName)
  }

  /**
   * Get monthly quota for a tier
   */
  static getMonthlyQuota(tier: SubscriptionTier): number {
    return TIER_CONFIGS[tier].monthlyQuota
  }

  /**
   * Check if tier has unlimited quota
   */
  static hasUnlimitedQuota(tier: SubscriptionTier): boolean {
    return TIER_CONFIGS[tier].monthlyQuota === -1
  }

  /**
   * Get max concurrent requests for a tier
   */
  static getMaxConcurrentRequests(tier: SubscriptionTier): number {
    return TIER_CONFIGS[tier].maxConcurrentRequests
  }

  /**
   * Validate tier upgrade path
   */
  static canUpgradeTo(currentTier: SubscriptionTier, targetTier: SubscriptionTier): boolean {
    const tiers: SubscriptionTier[] = ['free', 'starter', 'professional', 'enterprise']
    const currentIndex = tiers.indexOf(currentTier)
    const targetIndex = tiers.indexOf(targetTier)
    return targetIndex > currentIndex
  }
}
