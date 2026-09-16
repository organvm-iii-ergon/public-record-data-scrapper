import { apiRequest } from './client'
import type { PartnerMetrics, PartnerReferralProgram, ReferralEvent } from '@public-records/core'

export interface PartnerStatsSummary {
  partnerCode: string
  referralUrl: string
  tier: string
  commissionRate: number
  totalClicks: number
  totalSignups: number
  totalConversions: number
  conversionRate: number
  totalEarningsUsd: number
  pendingEarningsUsd: number
}

export interface TrackClickParams {
  partnerCode: string
  referrer?: string
  landingPage?: string
}

export interface TrackClickResponse {
  tracked: boolean
  eventId: string
}

export interface UpdateProgramResponse {
  success: boolean
  program: PartnerReferralProgram
}

/**
 * Fetch tenant partner portal configuration, conversion metrics, and event log.
 */
export async function fetchPartnerPortal(signal?: AbortSignal): Promise<PartnerMetrics> {
  return apiRequest<PartnerMetrics>('/partner/portal', { signal })
}

/**
 * Update tenant custom partner / referral code.
 */
export async function updatePartnerCode(partnerCode: string): Promise<UpdateProgramResponse> {
  return apiRequest<UpdateProgramResponse>('/partner/code', {
    method: 'POST',
    body: { partnerCode }
  })
}

/**
 * Update tenant affiliate payout destination email.
 */
export async function updatePayoutEmail(payoutEmail: string): Promise<UpdateProgramResponse> {
  return apiRequest<UpdateProgramResponse>('/partner/payout-email', {
    method: 'POST',
    body: { payoutEmail }
  })
}

/**
 * Track a referral link click.
 */
export async function trackPartnerClick(params: TrackClickParams): Promise<TrackClickResponse> {
  return apiRequest<TrackClickResponse>('/partner/track/click', {
    method: 'POST',
    body: params
  })
}

/**
 * Fetch aggregate partner conversion stats.
 */
export async function fetchPartnerStats(signal?: AbortSignal): Promise<PartnerStatsSummary> {
  return apiRequest<PartnerStatsSummary>('/partner/stats', { signal })
}

export type { PartnerMetrics, PartnerReferralProgram, ReferralEvent }
