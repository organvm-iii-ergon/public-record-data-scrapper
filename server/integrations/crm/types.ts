/**
 * CRM Adapter Interface
 *
 * Unified contract that every CRM adapter must implement. Adapters translate
 * a Prospect into a CRM-native contact/lead record and push it to the
 * remote CRM API.
 */

import type { Prospect } from '@public-records/core'

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface CrmConfig {
  /** API key / token for the CRM. Stored as an org-level secret. */
  apiKey: string
  /** Optional CRM-specific base URL (useful for multi-tenant / sandbox envs). */
  baseUrl?: string
}

export interface CrmPushResult {
  /** Whether the push succeeded. */
  success: boolean
  /** The CRM-assigned ID of the created/updated contact record. */
  remoteId?: string
  /** Raw error message on failure. */
  error?: string
}

// ---------------------------------------------------------------------------
// Adapter interface
// ---------------------------------------------------------------------------

export interface CrmAdapter {
  /** Short display name of the CRM. */
  name: string
  /**
   * Push a prospect to the CRM as a new contact/lead. Implementations
   * should be idempotent where the CRM allows it (e.g. upsert by email).
   */
  pushProspect(prospect: Prospect, config: CrmConfig): Promise<CrmPushResult>
}
