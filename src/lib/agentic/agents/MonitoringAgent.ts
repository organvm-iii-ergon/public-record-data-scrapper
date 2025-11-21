/**
 * Monitoring Agent
 * 
 * Tracks usage, enforces quotas, and monitors system health
 */

import { BaseAgent } from '../BaseAgent'
import { AgentAnalysis, SystemContext, AgentTask, AgentTaskResult } from '../types'
import { usageTracker, UsageTracker } from '../../subscription/usage-tracker'


export class MonitoringAgent extends BaseAgent {
  constructor() {
    super('monitoring', 'Monitoring Agent', [
      'Usage tracking',
      'Quota enforcement',
      'Cost calculation',
      'Alert generation',
      'Audit trail logging',
      'Usage reporting'
    ])
  }

  async analyze(context: SystemContext): Promise<AgentAnalysis> {
    const findings = []
    const improvements = []

    // Check for users approaching quota limits
    const usersAtRisk = usageTracker.getUsersApproachingLimit()
    if (usersAtRisk.length > 0) {
      findings.push(this.createFinding(
        'performance',
        'warning',
        `${usersAtRisk.length} users are approaching their quota limits (>80% used)`,
        { users: usersAtRisk }
      ))

      improvements.push(this.createImprovement(
        'usability',
        'medium',
        'Send quota warning notifications',
        'Automatically notify users when they reach 80% of their monthly quota',
        'Detected users approaching quota limits who may not be aware',
        'Improve user experience and prevent unexpected service interruptions',
        true,
        95,
        {
          steps: [
            'Set up email notification system',
            'Create warning templates',
            'Implement 80% threshold check',
            'Add user preferences for notifications'
          ],
          risks: ['Email delivery issues', 'User notification fatigue'],
          rollbackPlan: ['Disable notifications', 'Revert to manual checks'],
          validationCriteria: [
            'Notifications sent within 1 minute of threshold',
            '95%+ delivery rate',
            'User preferences respected'
          ]
        }
      ))
    }

    return this.createAnalysis(findings, improvements)
  }

  /**
   * Execute a monitoring task
   */
  async executeTask(task: AgentTask): Promise<AgentTaskResult> {
    const { type, payload } = task

    try {
      switch (type) {
        case 'check-quota':
          return this.checkQuota(payload.userId)
        case 'get-usage':
          return this.getUsage(payload.userId, payload.period)
        case 'track-usage':
          return this.trackUsage(payload)
        case 'get-users-at-risk':
          return this.getUsersAtRisk()
        case 'enforce-quota':
          return this.enforceQuota(payload.userId)
        default:
          return {
            success: false,
            error: `Unknown task type: ${type}`,
            timestamp: new Date().toISOString()
          }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Check user's quota status
   */
  private checkQuota(userId: string): AgentTaskResult {
    const hasQuota = usageTracker.hasQuotaRemaining(userId)
    const isApproaching = usageTracker.isApproachingLimit(userId)
    const stats = usageTracker.getUsageStats(userId, 'monthly')

    return {
      success: true,
      data: {
        hasQuota,
        isApproaching,
        quotaRemaining: stats.quotaRemaining,
        quotaLimit: stats.quotaLimit,
        percentUsed: stats.percentUsed
      },
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Get usage statistics
   */
  private getUsage(userId: string, period: 'daily' | 'monthly' = 'monthly'): AgentTaskResult {
    const stats = usageTracker.getUsageStats(userId, period)

    return {
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Track a usage event
   */
  private trackUsage(payload: any): AgentTaskResult {
    usageTracker.trackUsage({
      userId: payload.userId,
      action: payload.action,
      source: payload.source,
      cost: payload.cost || 0,
      timestamp: new Date().toISOString(),
      success: payload.success !== false,
      metadata: payload.metadata
    })

    return {
      success: true,
      data: { tracked: true },
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Get users approaching quota limits
   */
  private getUsersAtRisk(): AgentTaskResult {
    const users = usageTracker.getUsersApproachingLimit()

    return {
      success: true,
      data: {
        count: users.length,
        users: users.map(userId => ({
          userId,
          stats: usageTracker.getUsageStats(userId, 'monthly')
        }))
      },
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Enforce quota limits
   */
  private enforceQuota(userId: string): AgentTaskResult {
    const hasQuota = usageTracker.hasQuotaRemaining(userId)
    const stats = usageTracker.getUsageStats(userId, 'monthly')

    if (!hasQuota && stats.quotaLimit !== -1) {
      return {
        success: false,
        error: 'Quota exceeded',
        data: {
          quotaExceeded: true,
          quotaUsed: stats.quotaUsed,
          quotaLimit: stats.quotaLimit,
          tier: stats.tier
        },
        timestamp: new Date().toISOString()
      }
    }

    return {
      success: true,
      data: {
        quotaExceeded: false,
        quotaRemaining: stats.quotaRemaining,
        quotaLimit: stats.quotaLimit
      },
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Generate usage alert for a user
   */
  generateAlert(userId: string, threshold: number): { shouldAlert: boolean; message?: string } {
    const stats = usageTracker.getUsageStats(userId, 'monthly')

    if (stats.percentUsed >= threshold) {
      return {
        shouldAlert: true,
        message: `You have used ${stats.percentUsed.toFixed(1)}% of your monthly quota (${stats.quotaUsed}/${stats.quotaLimit} requests)`
      }
    }

    return { shouldAlert: false }
  }

  /**
   * Calculate estimated cost for a request
   */
  calculateCost(sources: string[]): number {
    return sources.reduce((total, source) => {
      return total + (UsageTracker.getSourceCost(source) || 0)
    }, 0)
  }
}
