/**
 * Partner & Referral Program Service (Issue #480).
 *
 * Manages affiliate partner programs, generates and customizes referral links,
 * and tracks conversion funnel metrics (clicks, signups, paid conversions, commissions).
 *
 * Commission Tiers:
 *  - Bronze: 15% commission (< 5 paid conversions)
 *  - Silver: 20% commission (5 - 19 paid conversions)
 *  - Gold: 25% commission (20 - 49 paid conversions)
 *  - Platinum: 30% commission (50+ paid conversions)
 *
 * @module server/services/PartnerReferralService
 */

import { database } from '../database/connection'
import { config } from '../config'
import type {
  PartnerMetrics,
  PartnerReferralProgram,
  PartnerTier,
  ReferralEvent,
  ReferralEventType
} from '@public-records/core'

export const PARTNER_TIER_CONFIG: Record<
  PartnerTier,
  { commissionRate: number; minConversions: number; nextTierThreshold: number }
> = {
  bronze: { commissionRate: 15, minConversions: 0, nextTierThreshold: 5 },
  silver: { commissionRate: 20, minConversions: 5, nextTierThreshold: 20 },
  gold: { commissionRate: 25, minConversions: 20, nextTierThreshold: 50 },
  platinum: { commissionRate: 30, minConversions: 50, nextTierThreshold: Infinity }
}

export function determinePartnerTier(totalConversions: number): PartnerTier {
  if (totalConversions >= 50) return 'platinum'
  if (totalConversions >= 20) return 'gold'
  if (totalConversions >= 5) return 'silver'
  return 'bronze'
}

export function sanitizePartnerCode(code: string): string {
  return code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 30)
}

export class PartnerReferralService {
  private getBaseUrl(): string {
    return (
      config.app.publicUrl ||
      (config.cors.origin.length > 0 ? config.cors.origin[0] : 'http://localhost:5173')
    )
  }

  /**
   * Get an organization's partner referral program or automatically provision one.
   */
  async getOrCreateProgram(
    orgId: string,
    initialCustomCode?: string
  ): Promise<PartnerReferralProgram> {
    const existing = await database.query<PartnerReferralProgram>(
      `SELECT id, org_id as "orgId", partner_code as "partnerCode",
              referral_url as "referralUrl", commission_rate as "commissionRate",
              tier, payout_email as "payoutEmail", status,
              created_at as "createdAt", updated_at as "updatedAt"
         FROM partner_referral_programs
        WHERE org_id = $1 LIMIT 1`,
      [orgId]
    )

    if (existing.length > 0) {
      return {
        ...existing[0],
        commissionRate: Number(existing[0].commissionRate)
      }
    }

    // Generate clean partner referral code
    const rawCode =
      initialCustomCode && initialCustomCode.trim().length >= 3
        ? sanitizePartnerCode(initialCustomCode)
        : `PARTNER-${orgId.replace(/-/g, '').slice(0, 8).toUpperCase()}`

    const baseUrl = this.getBaseUrl()
    const referralUrl = `${baseUrl}/?ref=${rawCode}`

    const created = await database.query<PartnerReferralProgram>(
      `INSERT INTO partner_referral_programs
         (org_id, partner_code, referral_url, commission_rate, tier, status)
       VALUES ($1, $2, $3, 15.00, 'bronze', 'active')
       ON CONFLICT (org_id) DO UPDATE
         SET updated_at = NOW()
       RETURNING id, org_id as "orgId", partner_code as "partnerCode",
                 referral_url as "referralUrl", commission_rate as "commissionRate",
                 tier, payout_email as "payoutEmail", status,
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [orgId, rawCode, referralUrl]
    )

    return {
      ...created[0],
      commissionRate: Number(created[0].commissionRate)
    }
  }

  /**
   * Update / customize a partner's referral code.
   */
  async updatePartnerCode(orgId: string, newCode: string): Promise<PartnerReferralProgram> {
    const cleanCode = sanitizePartnerCode(newCode)
    if (cleanCode.length < 3) {
      throw new Error('Partner code must be at least 3 characters long')
    }

    // Ensure uniqueness
    const conflict = await database.query<{ id: string }>(
      `SELECT id FROM partner_referral_programs WHERE partner_code = $1 AND org_id != $2 LIMIT 1`,
      [cleanCode, orgId]
    )
    if (conflict.length > 0) {
      throw new Error(`Referral code '${cleanCode}' is already taken`)
    }

    const baseUrl = this.getBaseUrl()
    const referralUrl = `${baseUrl}/?ref=${cleanCode}`

    const updated = await database.query<PartnerReferralProgram>(
      `UPDATE partner_referral_programs
         SET partner_code = $2,
             referral_url = $3,
             updated_at = NOW()
       WHERE org_id = $1
       RETURNING id, org_id as "orgId", partner_code as "partnerCode",
                 referral_url as "referralUrl", commission_rate as "commissionRate",
                 tier, payout_email as "payoutEmail", status,
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [orgId, cleanCode, referralUrl]
    )

    if (updated.length === 0) {
      throw new Error('Partner program not found')
    }

    return {
      ...updated[0],
      commissionRate: Number(updated[0].commissionRate)
    }
  }

  /**
   * Update payout destination email.
   */
  async updatePayoutEmail(orgId: string, email: string): Promise<PartnerReferralProgram> {
    const updated = await database.query<PartnerReferralProgram>(
      `UPDATE partner_referral_programs
         SET payout_email = $2,
             updated_at = NOW()
       WHERE org_id = $1
       RETURNING id, org_id as "orgId", partner_code as "partnerCode",
                 referral_url as "referralUrl", commission_rate as "commissionRate",
                 tier, payout_email as "payoutEmail", status,
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [orgId, email.trim().toLowerCase()]
    )

    if (updated.length === 0) {
      throw new Error('Partner program not found')
    }

    return {
      ...updated[0],
      commissionRate: Number(updated[0].commissionRate)
    }
  }

  /**
   * Record a referral event (click, signup, conversion, payout).
   */
  async recordReferralEvent(options: {
    partnerCode: string
    eventType: ReferralEventType
    referredEmail?: string | null
    referredOrgId?: string | null
    revenueAmount?: number
    commissionAmount?: number
    metadata?: Record<string, unknown>
  }): Promise<ReferralEvent | null> {
    const cleanCode = sanitizePartnerCode(options.partnerCode)

    const programRows = await database.query<{
      id: string
      commission_rate: number
      tier: PartnerTier
    }>(
      `SELECT id, commission_rate, tier FROM partner_referral_programs WHERE partner_code = $1 LIMIT 1`,
      [cleanCode]
    )

    if (programRows.length === 0) {
      return null
    }

    const program = programRows[0]
    const revenue = options.revenueAmount ?? 0
    let commission = options.commissionAmount ?? 0

    if (options.eventType === 'conversion' && commission === 0 && revenue > 0) {
      commission = Number(((revenue * Number(program.commission_rate)) / 100).toFixed(2))
    }

    const eventRows = await database.query<ReferralEvent>(
      `INSERT INTO partner_referral_events
         (program_id, event_type, referred_email, referred_org_id, revenue_amount,
          commission_amount, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       RETURNING id, program_id as "programId", event_type as "eventType",
                 referred_email as "referredEmail", referred_org_id as "referredOrgId",
                 revenue_amount as "revenueAmount", commission_amount as "commissionAmount",
                 metadata, created_at as "createdAt"`,
      [
        program.id,
        options.eventType,
        options.referredEmail ?? null,
        options.referredOrgId ?? null,
        revenue,
        commission,
        JSON.stringify(options.metadata ?? {})
      ]
    )

    // Check for tier elevation on conversions
    if (options.eventType === 'conversion') {
      await this.evaluateTierPromotion(program.id)
    }

    return {
      ...eventRows[0],
      revenueAmount: Number(eventRows[0].revenueAmount),
      commissionAmount: Number(eventRows[0].commissionAmount)
    }
  }

  /**
   * Check and upgrade partner tier if conversion milestone is reached.
   */
  private async evaluateTierPromotion(programId: string): Promise<void> {
    const countRows = await database.query<{ count: string | number }>(
      `SELECT COUNT(*) as count
         FROM partner_referral_events
        WHERE program_id = $1 AND event_type = 'conversion'`,
      [programId]
    )

    const conversions = Number(countRows[0]?.count ?? 0)
    const newTier = determinePartnerTier(conversions)
    const newCommissionRate = PARTNER_TIER_CONFIG[newTier].commissionRate

    await database.query(
      `UPDATE partner_referral_programs
         SET tier = $2,
             commission_rate = $3,
             updated_at = NOW()
       WHERE id = $1`,
      [programId, newTier, newCommissionRate]
    )
  }

  /**
   * Retrieve aggregated metrics, earnings, and conversion funnel for an organization.
   */
  async getPartnerMetrics(orgId: string): Promise<PartnerMetrics> {
    const program = await this.getOrCreateProgram(orgId)

    const statsRows = await database.query<{
      clicks: string | number
      signups: string | number
      conversions: string | number
      total_earnings: string | number
      paid_earnings: string | number
    }>(
      `SELECT
         COALESCE(SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END), 0) AS clicks,
         COALESCE(SUM(CASE WHEN event_type = 'signup' THEN 1 ELSE 0 END), 0) AS signups,
         COALESCE(SUM(CASE WHEN event_type = 'conversion' THEN 1 ELSE 0 END), 0) AS conversions,
         COALESCE(SUM(CASE WHEN event_type = 'conversion' THEN commission_amount ELSE 0 END), 0) AS total_earnings,
         COALESCE(SUM(CASE WHEN event_type = 'payout' THEN commission_amount ELSE 0 END), 0) AS paid_earnings
       FROM partner_referral_events
       WHERE program_id = $1`,
      [program.id]
    )

    const totalClicks = Number(statsRows[0]?.clicks ?? 0)
    const totalSignups = Number(statsRows[0]?.signups ?? 0)
    const totalConversions = Number(statsRows[0]?.conversions ?? 0)
    const totalEarningsUsd = Number(Number(statsRows[0]?.total_earnings ?? 0).toFixed(2))
    const paidEarningsUsd = Number(Number(statsRows[0]?.paid_earnings ?? 0).toFixed(2))
    const pendingEarningsUsd = Number(Math.max(0, totalEarningsUsd - paidEarningsUsd).toFixed(2))

    // Conversion rate % (conversions / clicks, or 0 if no clicks)
    const conversionRate =
      totalClicks > 0 ? Number(((totalConversions / totalClicks) * 100).toFixed(1)) : 0

    const tierConfig = PARTNER_TIER_CONFIG[program.tier]
    const nextTierThreshold = tierConfig.nextTierThreshold
    const conversionsToNextTier =
      nextTierThreshold === Infinity ? 0 : Math.max(0, nextTierThreshold - totalConversions)

    // Recent events log
    const recentEventsRows = await database.query<ReferralEvent>(
      `SELECT id, program_id as "programId", event_type as "eventType",
              referred_email as "referredEmail", referred_org_id as "referredOrgId",
              revenue_amount as "revenueAmount", commission_amount as "commissionAmount",
              metadata, created_at as "createdAt"
         FROM partner_referral_events
        WHERE program_id = $1
        ORDER BY created_at DESC
        LIMIT 20`,
      [program.id]
    )

    const recentEvents = recentEventsRows.map((e) => ({
      ...e,
      revenueAmount: Number(e.revenueAmount),
      commissionAmount: Number(e.commissionAmount)
    }))

    return {
      program,
      totalClicks,
      totalSignups,
      totalConversions,
      conversionRate,
      totalEarningsUsd,
      pendingEarningsUsd,
      paidEarningsUsd,
      partnerTier: program.tier,
      commissionRate: program.commissionRate,
      nextTierThreshold,
      conversionsToNextTier,
      recentEvents
    }
  }
}

export const partnerReferralService = new PartnerReferralService()
