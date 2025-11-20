/**
 * Usage Tracking System
 * 
 * Tracks API usage, costs, and quota consumption for subscription tiers
 */

import { SubscriptionTier } from '../agentic/types'
import { TierManager } from './tier-manager'

export interface UsageRecord {
  userId: string
  action: string
  source?: string
  cost: number
  timestamp: string
  success: boolean
  metadata?: Record<string, any>
}

export interface UsageStats {
  userId: string
  tier: SubscriptionTier
  period: 'daily' | 'monthly'
  totalCalls: number
  successfulCalls: number
  failedCalls: number
  totalCost: number
  quotaUsed: number
  quotaLimit: number
  quotaRemaining: number
  percentUsed: number
  lastUpdated: string
}

export class UsageTracker {
  private usageData: Map<string, UsageRecord[]> = new Map()
  private userTiers: Map<string, SubscriptionTier> = new Map()

  /**
   * Initialize tracker with user tier
   */
  setUserTier(userId: string, tier: SubscriptionTier): void {
    this.userTiers.set(userId, tier)
  }

  /**
   * Get user's current tier
   */
  getUserTier(userId: string): SubscriptionTier {
    return this.userTiers.get(userId) || 'free'
  }

  /**
   * Track a usage event
   */
  trackUsage(record: UsageRecord): void {
    const records = this.usageData.get(record.userId) || []
    records.push(record)
    this.usageData.set(record.userId, records)
  }

  /**
   * Get usage statistics for a user
   */
  getUsageStats(userId: string, period: 'daily' | 'monthly' = 'monthly'): UsageStats {
    const tier = this.getUserTier(userId)
    const records = this.getUserRecords(userId, period)
    
    const totalCalls = records.length
    const successfulCalls = records.filter(r => r.success).length
    const failedCalls = totalCalls - successfulCalls
    const totalCost = records.reduce((sum, r) => sum + r.cost, 0)
    
    const quotaLimit = TierManager.getMonthlyQuota(tier)
    const quotaUsed = successfulCalls
    const quotaRemaining = quotaLimit === -1 ? Infinity : Math.max(0, quotaLimit - quotaUsed)
    const percentUsed = quotaLimit === -1 ? 0 : (quotaUsed / quotaLimit) * 100

    return {
      userId,
      tier,
      period,
      totalCalls,
      successfulCalls,
      failedCalls,
      totalCost,
      quotaUsed,
      quotaLimit,
      quotaRemaining,
      percentUsed,
      lastUpdated: new Date().toISOString()
    }
  }

  /**
   * Check if user has quota remaining
   */
  hasQuotaRemaining(userId: string): boolean {
    const stats = this.getUsageStats(userId, 'monthly')
    return stats.quotaRemaining > 0 || stats.quotaLimit === -1
  }

  /**
   * Check if user is approaching quota limit (>80%)
   */
  isApproachingLimit(userId: string): boolean {
    const stats = this.getUsageStats(userId, 'monthly')
    return stats.percentUsed >= 80 && stats.quotaLimit !== -1
  }

  /**
   * Get usage records for a user in a period
   */
  private getUserRecords(userId: string, period: 'daily' | 'monthly'): UsageRecord[] {
    const allRecords = this.usageData.get(userId) || []
    const cutoffDate = new Date()

    if (period === 'daily') {
      cutoffDate.setHours(0, 0, 0, 0)
    } else {
      cutoffDate.setDate(1)
      cutoffDate.setHours(0, 0, 0, 0)
    }

    return allRecords.filter(r => new Date(r.timestamp) >= cutoffDate)
  }

  /**
   * Calculate cost for a data source
   */
  static getSourceCost(sourceName: string): number {
    const costs: Record<string, number> = {
      'sec-edgar': 0,
      'osha': 0,
      'uspto': 0,
      'census': 0,
      'sam-gov': 0,
      'dnb': 0.50,
      'google-places': 0.02,
      'clearbit': 1.00,
      'experian': 3.00,
      'zoominfo': 2.50,
      'newsapi': 0.10
    }
    return costs[sourceName] || 0
  }

  /**
   * Clear old usage data (cleanup)
   */
  clearOldData(daysToKeep: number = 365): void {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    this.usageData.forEach((records, userId) => {
      const filteredRecords = records.filter(
        r => new Date(r.timestamp) >= cutoffDate
      )
      this.usageData.set(userId, filteredRecords)
    })
  }

  /**
   * Export usage data for a user
   */
  exportUsageData(userId: string): UsageRecord[] {
    return this.usageData.get(userId) || []
  }

  /**
   * Get all users approaching their quota limit
   */
  getUsersApproachingLimit(): string[] {
    const users: string[] = []
    this.userTiers.forEach((_, userId) => {
      if (this.isApproachingLimit(userId)) {
        users.push(userId)
      }
    })
    return users
  }
}

// Global singleton instance
export const usageTracker = new UsageTracker()
