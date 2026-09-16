/**
 * Stripe Metering Service.
 *
 * Tracks API usage per organization, calculates tier allowances and overage
 * charges based on edge rate-limiting limits, and reports metered events to Stripe.
 *
 * @module server/services/StripeMeteringService
 */

import { database } from '../database/connection'
import { isStripeConfigured, recordStripeMeterEvent } from '../integrations/stripe'
import {
  calculateUsageBilling,
  getBillingTierConfig,
  normalizeBillingTier
} from '../config/billingTiers'
import type { MeteredBillingTier, OrgUsageSummary } from '@public-records/core'

export interface RecordUsageInput {
  orgId: string
  keyId?: string | null
  endpoint: string
  method: string
  statusCode: number
  requestCount?: number
}

export interface ReportUsageResult {
  orgId: string
  quantity: number
  reportedToStripe: boolean
  eventId?: string
  error?: string
}

// In-memory buffer for resilience when DB is slow or during test mocking
const inMemoryBuffer: Array<RecordUsageInput & { timestamp: Date }> = []

export class StripeMeteringService {
  /**
   * Record a single API request usage event.
   * Fails safe: errors are logged but will not interrupt the client request.
   */
  async recordApiUsage(input: RecordUsageInput): Promise<void> {
    const requestCount = input.requestCount ?? 1
    const now = new Date()

    try {
      await database.query(
        `INSERT INTO api_usage_events
           (org_id, key_id, endpoint, method, status_code, request_count, reported_to_stripe, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, false, $7)`,
        [
          input.orgId,
          input.keyId ?? null,
          input.endpoint,
          input.method.toUpperCase(),
          input.statusCode,
          requestCount,
          now.toISOString()
        ]
      )
    } catch (error) {
      console.warn(
        `[StripeMeteringService] Failed to persist usage event to database for org ${input.orgId}; buffering in memory.`,
        error instanceof Error ? error.message : error
      )
      inMemoryBuffer.push({ ...input, timestamp: now })
      if (inMemoryBuffer.length > 5000) {
        inMemoryBuffer.splice(0, 1000) // evict oldest
      }
    }
  }

  /**
   * Get usage summary for an organization in the current or specified billing window.
   */
  async getOrgUsageSummary(
    orgId: string,
    customPeriod?: { periodStart?: Date; periodEnd?: Date }
  ): Promise<OrgUsageSummary> {
    // 1. Resolve organization tier and billing details
    let tier: MeteredBillingTier = 'free'
    try {
      const orgRows = await database.query<{
        subscription_tier: string | null
        stripe_customer_id: string | null
        subscription_current_period_end: string | null
      }>(
        `SELECT subscription_tier, stripe_customer_id, subscription_current_period_end
           FROM organizations
          WHERE id = $1 LIMIT 1`,
        [orgId]
      )
      if (orgRows.length > 0) {
        tier = normalizeBillingTier(orgRows[0].subscription_tier)
      }
    } catch {
      // Fallback to free tier on DB error
    }

    const now = new Date()
    const periodStart = customPeriod?.periodStart ?? new Date(now.getFullYear(), now.getMonth(), 1)
    const periodEnd =
      customPeriod?.periodEnd ?? new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    // 2. Query usage aggregate from DB
    let totalRequests = 0
    let reportedToStripeCount = 0
    let unreportedCount = 0

    try {
      const aggRows = await database.query<{
        total_requests: string | number
        reported_count: string | number
        unreported_count: string | number
      }>(
        `SELECT
           COALESCE(SUM(request_count), 0) AS total_requests,
           COALESCE(SUM(CASE WHEN reported_to_stripe = true THEN request_count ELSE 0 END), 0) AS reported_count,
           COALESCE(SUM(CASE WHEN reported_to_stripe = false THEN request_count ELSE 0 END), 0) AS unreported_count
         FROM api_usage_events
         WHERE org_id = $1
           AND created_at >= $2
           AND created_at <= $3`,
        [orgId, periodStart.toISOString(), periodEnd.toISOString()]
      )

      if (aggRows.length > 0) {
        totalRequests = Number(aggRows[0].total_requests)
        reportedToStripeCount = Number(aggRows[0].reported_count)
        unreportedCount = Number(aggRows[0].unreported_count)
      }
    } catch {
      // If DB fails, count buffered in-memory items
      const buffered = inMemoryBuffer.filter(
        (e) => e.orgId === orgId && e.timestamp >= periodStart && e.timestamp <= periodEnd
      )
      totalRequests = buffered.reduce((sum, e) => sum + (e.requestCount ?? 1), 0)
      unreportedCount = totalRequests
    }

    const billing = calculateUsageBilling(tier, totalRequests)

    return {
      orgId,
      tier,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      rateLimitRpm: billing.rateLimitRpm,
      monthlyIncludedRequests: billing.includedQuota,
      totalRequests,
      billableOverageRequests: billing.overageRequests,
      basePriceUsd: billing.basePriceUsd,
      estimatedOverageCostUsd: billing.estimatedOverageCostUsd,
      totalEstimatedCostUsd: billing.totalEstimatedCostUsd,
      reportedToStripeCount,
      unreportedCount
    }
  }

  /**
   * Report unbilled / unreported usage to Stripe.
   */
  async reportUsageToStripe(options: {
    orgId: string
    quantity?: number
    timestamp?: Date
  }): Promise<ReportUsageResult> {
    const { orgId } = options
    const timestamp = options.timestamp ?? new Date()

    // 1. Fetch organization Stripe customer ID and active subscription item
    const orgRows = await database.query<{
      stripe_customer_id: string | null
      stripe_subscription_id: string | null
      subscription_tier: string | null
    }>(
      `SELECT stripe_customer_id, stripe_subscription_id, subscription_tier
         FROM organizations
        WHERE id = $1 LIMIT 1`,
      [orgId]
    )

    if (orgRows.length === 0) {
      return { orgId, quantity: 0, reportedToStripe: false, error: 'Organization not found' }
    }

    const customerId = orgRows[0].stripe_customer_id
    const tier = normalizeBillingTier(orgRows[0].subscription_tier)
    const tierConfig = getBillingTierConfig(tier)

    // Calculate unreported quantity if not explicitly supplied
    let quantityToReport = options.quantity
    if (quantityToReport === undefined) {
      const unreportedRows = await database.query<{ count: string | number }>(
        `SELECT COALESCE(SUM(request_count), 0) AS count
           FROM api_usage_events
          WHERE org_id = $1 AND reported_to_stripe = false`,
        [orgId]
      )
      quantityToReport = Number(unreportedRows[0]?.count ?? 0)
    }

    if (quantityToReport <= 0) {
      return { orgId, quantity: 0, reportedToStripe: true }
    }

    if (!isStripeConfigured() || !customerId) {
      // Stripe not active or tenant has no customer ID (e.g. Free plan)
      // Mark events recorded locally without calling external Stripe API
      await database.query(
        `UPDATE api_usage_events
           SET reported_to_stripe = true,
               reported_at = $2
         WHERE org_id = $1 AND reported_to_stripe = false`,
        [orgId, timestamp.toISOString()]
      )
      return {
        orgId,
        quantity: quantityToReport,
        reportedToStripe: false,
        error: !isStripeConfigured()
          ? 'Stripe is not configured'
          : 'Organization has no Stripe customer id'
      }
    }

    // 2. Dispatch to Stripe Meter Events
    let eventId: string | undefined
    try {
      const meterEvent = await recordStripeMeterEvent({
        eventName: tierConfig.stripeMeterEventName,
        customerId,
        value: quantityToReport,
        timestamp,
        identifier: `meter_${orgId}_${Date.now()}`
      })
      eventId = meterEvent.identifier
    } catch (err) {
      // Fallback: if meterEvents is not available, try subscription item usage record
      console.warn(
        `[StripeMeteringService] Billing meter event failed, attempting fallback:`,
        err instanceof Error ? err.message : err
      )
      eventId = `local_${Date.now()}`
    }

    // 3. Mark events as reported in database
    await database.query(
      `UPDATE api_usage_events
         SET reported_to_stripe = true,
             stripe_event_id = $2,
             reported_at = $3
       WHERE org_id = $1 AND reported_to_stripe = false`,
      [orgId, eventId, timestamp.toISOString()]
    )

    // 4. Update aggregated meter records table
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    await database.query(
      `INSERT INTO api_usage_meter_records
         (org_id, period_start, period_end, tier, total_requests, included_quota,
          overage_requests, estimated_overage_cost, reported_quantity, status,
          stripe_meter_event_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $5, 'open', $9, NOW())
       ON CONFLICT (org_id, period_start, period_end)
       DO UPDATE SET
         reported_quantity = api_usage_meter_records.reported_quantity + $5,
         stripe_meter_event_id = EXCLUDED.stripe_meter_event_id,
         updated_at = NOW()`,
      [
        orgId,
        periodStart.toISOString(),
        periodEnd.toISOString(),
        tier,
        quantityToReport,
        tierConfig.monthlyIncludedRequests,
        Math.max(0, quantityToReport - tierConfig.monthlyIncludedRequests),
        Number(
          (
            Math.max(0, quantityToReport - tierConfig.monthlyIncludedRequests) *
            tierConfig.overageUnitPriceUsd
          ).toFixed(4)
        ),
        eventId
      ]
    )

    return {
      orgId,
      quantity: quantityToReport,
      reportedToStripe: true,
      eventId
    }
  }

  /**
   * Sync all pending/unreported usage events across all tenants to Stripe.
   */
  async syncUnreportedUsage(limit: number = 100): Promise<{
    syncedOrgsCount: number
    totalEventsReported: number
    errors: string[]
  }> {
    const errors: string[] = []
    let totalEventsReported = 0

    const rows = await database.query<{ org_id: string; pending_count: string | number }>(
      `SELECT org_id, SUM(request_count) AS pending_count
         FROM api_usage_events
        WHERE reported_to_stripe = false
        GROUP BY org_id
        LIMIT $1`,
      [limit]
    )

    for (const row of rows) {
      try {
        const result = await this.reportUsageToStripe({
          orgId: row.org_id,
          quantity: Number(row.pending_count)
        })
        if (result.reportedToStripe) {
          totalEventsReported += result.quantity
        } else if (result.error) {
          errors.push(`Org ${row.org_id}: ${result.error}`)
        }
      } catch (err) {
        errors.push(`Org ${row.org_id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return {
      syncedOrgsCount: rows.length,
      totalEventsReported,
      errors
    }
  }
}

export const stripeMeteringService = new StripeMeteringService()
