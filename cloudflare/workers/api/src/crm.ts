/**
 * ucc-mca-edge CRM Push Integrations (Issue #485).
 *
 * Implements:
 * - Extensible `CrmAdapter` pattern for pushing UCC prospects to customer CRMs.
 * - Native `HubSpotAdapter` using HubSpot REST API v3 (the #1 requested MCA/SMB CRM).
 * - `SalesforceAdapter` and `GoHighLevelAdapter` interfaces.
 * - Integration credential verification and tenant-isolated prospect push.
 * - Complete audit logging to D1 `crm_push_logs`.
 */

import { first, run } from './db'
import { decryptCredential } from './integrationSafety'
import type { CrmIntegrationRow, CrmProvider, CrmPushResult, Env } from './types'

export const CRM_REQUEST_TIMEOUT_MS = 10_000

function crmRequestSignal(): AbortSignal {
  return AbortSignal.timeout(CRM_REQUEST_TIMEOUT_MS)
}

export interface ProspectPayload {
  id: string
  company_name: string | null
  priority_score: number | null
  status: string | null
  city?: string
  state?: string
  domain?: string
  phone?: string
  description?: string
  raw_data?: string | null
}

export interface CrmAdapter {
  readonly provider: CrmProvider
  verifyCredentials(apiKey: string, config?: Record<string, unknown>): Promise<boolean>
  pushProspect(
    apiKey: string,
    prospect: ProspectPayload,
    config?: Record<string, unknown>
  ): Promise<CrmPushResult>
}

/**
 * Native HubSpot Adapter
 *
 * Connects via HubSpot REST API v3 using Private App Access Tokens.
 * Maps UCC prospects to HubSpot Companies (and associated Deals/Contacts).
 */
export class HubSpotAdapter implements CrmAdapter {
  readonly provider: CrmProvider = 'hubspot'
  private readonly baseUrl = 'https://api.hubapi.com'

  async verifyCredentials(apiKey: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/crm/v3/objects/companies?limit=1`, {
        method: 'GET',
        signal: crmRequestSignal(),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      })
      return res.ok
    } catch {
      return false
    }
  }

  async pushProspect(
    apiKey: string,
    prospect: ProspectPayload,
    config: Record<string, unknown> = {}
  ): Promise<CrmPushResult> {
    const companyName = prospect.company_name ?? 'Unnamed Prospect'

    // Extract any extra fields from raw_data if available
    let parsedRaw: Record<string, unknown> = {}
    if (prospect.raw_data) {
      try {
        parsedRaw = JSON.parse(prospect.raw_data)
      } catch {
        // ignore JSON parse error
      }
    }

    const domain =
      prospect.domain ?? (typeof parsedRaw.domain === 'string' ? parsedRaw.domain : undefined)
    const phone =
      prospect.phone ?? (typeof parsedRaw.phone === 'string' ? parsedRaw.phone : undefined)
    const state =
      prospect.state ?? (typeof parsedRaw.state === 'string' ? parsedRaw.state : undefined)
    const city = prospect.city ?? (typeof parsedRaw.city === 'string' ? parsedRaw.city : undefined)

    const properties: Record<string, string> = {
      name: companyName,
      ...(domain ? { domain } : {}),
      ...(phone ? { phone } : {}),
      ...(city ? { city } : {}),
      ...(state ? { state } : {}),
      ...(prospect.priority_score !== null
        ? { ucc_priority_score: String(prospect.priority_score) }
        : {}),
      ...(prospect.status ? { ucc_status: prospect.status } : {}),
      description:
        prospect.description ??
        `UCC Filing Prospect | Priority Score: ${prospect.priority_score ?? 'N/A'} | Status: ${prospect.status ?? 'new'} (Imported via UCC-MCA Platform)`
    }

    // Custom properties mapped if configured
    if (config.customProperties && typeof config.customProperties === 'object') {
      Object.assign(properties, config.customProperties)
    }

    try {
      const res = await fetch(`${this.baseUrl}/crm/v3/objects/companies`, {
        method: 'POST',
        signal: crmRequestSignal(),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ properties })
      })

      const data = (await res.json()) as { id?: string; message?: string; status?: string }

      if (!res.ok) {
        return {
          success: false,
          provider: this.provider,
          error: data.message ?? `HubSpot returned HTTP ${res.status}`
        }
      }

      return {
        success: true,
        provider: this.provider,
        externalId: data.id
      }
    } catch (err: unknown) {
      return {
        success: false,
        provider: this.provider,
        error: err instanceof Error ? err.message : String(err)
      }
    }
  }
}

/**
 * Salesforce Adapter
 *
 * REST API push to Salesforce Lead object using OAuth access token.
 */
export class SalesforceAdapter implements CrmAdapter {
  readonly provider: CrmProvider = 'salesforce'

  async verifyCredentials(apiKey: string, config: Record<string, unknown> = {}): Promise<boolean> {
    const instanceUrl = salesforceInstanceUrl(config.instanceUrl)
    if (!instanceUrl) return false

    try {
      const res = await fetch(`${instanceUrl}/services/oauth2/userinfo`, {
        method: 'GET',
        signal: crmRequestSignal(),
        headers: { Authorization: `Bearer ${apiKey}` },
        redirect: 'error'
      })
      return res.ok
    } catch {
      return false
    }
  }

  async pushProspect(
    apiKey: string,
    prospect: ProspectPayload,
    config: Record<string, unknown> = {}
  ): Promise<CrmPushResult> {
    const instanceUrl = salesforceInstanceUrl(config.instanceUrl)
    const companyName = prospect.company_name ?? 'Unnamed Company'

    if (!instanceUrl) {
      return { success: false, provider: this.provider, error: 'Invalid Salesforce instance URL' }
    }

    try {
      const res = await fetch(`${instanceUrl}/services/data/v58.0/sobjects/Lead`, {
        method: 'POST',
        signal: crmRequestSignal(),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          Company: companyName,
          LastName: companyName,
          Status: 'Open - Not Contacted',
          Rating: (prospect.priority_score ?? 0) > 70 ? 'Hot' : 'Warm',
          Description: `UCC Prospect Score: ${prospect.priority_score ?? 'N/A'}`
        })
      })

      const data = (await res.json()) as { id?: string; errors?: Array<{ message: string }> }
      if (!res.ok) {
        const msg = data.errors?.[0]?.message ?? `Salesforce HTTP ${res.status}`
        return { success: false, provider: this.provider, error: msg }
      }

      return { success: true, provider: this.provider, externalId: data.id }
    } catch (err: unknown) {
      return {
        success: false,
        provider: this.provider,
        error: err instanceof Error ? err.message : String(err)
      }
    }
  }
}

/**
 * GoHighLevel (LeadConnector) Adapter
 *
 * Connects via GoHighLevel v2 REST API to create a Contact / Company opportunity.
 */
export class GoHighLevelAdapter implements CrmAdapter {
  readonly provider: CrmProvider = 'gohighlevel'
  private readonly baseUrl = 'https://services.leadconnectorhq.com'

  async verifyCredentials(apiKey: string, config: Record<string, unknown> = {}): Promise<boolean> {
    const locationId = typeof config.locationId === 'string' ? config.locationId.trim() : ''
    if (!locationId) return false

    try {
      const url = new URL(`${this.baseUrl}/contacts/`)
      url.searchParams.set('locationId', locationId)
      url.searchParams.set('limit', '1')
      const res = await fetch(url, {
        method: 'GET',
        signal: crmRequestSignal(),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Version: '2021-07-28'
        },
        redirect: 'error'
      })
      return res.ok
    } catch {
      return false
    }
  }

  async pushProspect(
    apiKey: string,
    prospect: ProspectPayload,
    config: Record<string, unknown> = {}
  ): Promise<CrmPushResult> {
    const locationId = config.locationId as string | undefined

    try {
      const res = await fetch(`${this.baseUrl}/contacts/`, {
        method: 'POST',
        signal: crmRequestSignal(),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Version: '2021-07-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: prospect.company_name ?? 'Prospect',
          companyName: prospect.company_name,
          tags: ['ucc-mca-lead', `score-${prospect.priority_score ?? 0}`],
          ...(locationId ? { locationId } : {})
        })
      })

      const data = (await res.json()) as { contact?: { id?: string }; message?: string }
      if (!res.ok) {
        return {
          success: false,
          provider: this.provider,
          error: data.message ?? `GoHighLevel HTTP ${res.status}`
        }
      }

      return {
        success: true,
        provider: this.provider,
        externalId: data.contact?.id
      }
    } catch (err: unknown) {
      return {
        success: false,
        provider: this.provider,
        error: err instanceof Error ? err.message : String(err)
      }
    }
  }
}

function salesforceInstanceUrl(value: unknown): string | null {
  const candidate = typeof value === 'string' ? value.trim() : ''
  if (!candidate) return null
  try {
    const url = new URL(candidate)
    const host = url.hostname.toLowerCase()
    if (
      url.protocol !== 'https:' ||
      (!host.endsWith('.salesforce.com') &&
        host !== 'salesforce.com' &&
        !host.endsWith('.force.com') &&
        host !== 'force.com')
    ) {
      return null
    }
    return url.origin
  } catch {
    return null
  }
}

/**
 * Registry of CRM adapters
 */
export const CRM_ADAPTERS: Record<CrmProvider, CrmAdapter> = {
  hubspot: new HubSpotAdapter(),
  salesforce: new SalesforceAdapter(),
  gohighlevel: new GoHighLevelAdapter()
}

/**
 * Push a prospect to the organization's configured CRM.
 * Tenant isolated: enforces orgId on prospect query and CRM integration query.
 */
export async function pushProspectToCrm(
  env: Env,
  orgId: string,
  prospectId: string,
  targetProvider?: CrmProvider
): Promise<CrmPushResult> {
  // Query CRM integration
  const crmIntegration = targetProvider
    ? await first<CrmIntegrationRow>(
        env,
        `SELECT * FROM crm_integrations WHERE org_id = ? AND provider = ? AND status = 'active'`,
        orgId,
        targetProvider
      )
    : await first<CrmIntegrationRow>(
        env,
        `SELECT * FROM crm_integrations WHERE org_id = ? AND status = 'active' ORDER BY created_at ASC`,
        orgId
      )

  if (!crmIntegration) {
    return {
      success: false,
      provider: targetProvider ?? 'hubspot',
      error: `No active CRM integration found for org ${orgId}`
    }
  }

  // Query prospect (strictly scoped to org_id)
  const prospect = await first<ProspectPayload>(
    env,
    `SELECT id, company_name, priority_score, status, raw_data
       FROM prospects
      WHERE id = ? AND org_id = ?`,
    prospectId,
    orgId
  )

  if (!prospect) {
    return {
      success: false,
      provider: crmIntegration.provider,
      error: `Prospect ${prospectId} not found in org ${orgId}`
    }
  }

  const adapter = CRM_ADAPTERS[crmIntegration.provider]
  if (!adapter) {
    return {
      success: false,
      provider: crmIntegration.provider,
      error: `Unsupported CRM provider "${crmIntegration.provider}"`
    }
  }

  let config: Record<string, unknown> = {}
  if (crmIntegration.config) {
    try {
      config = JSON.parse(crmIntegration.config)
    } catch {
      // ignore JSON parse error
    }
  }

  const idempotencyKey = `crm-push:${orgId}:${crmIntegration.id}:${prospectId}:${crmIntegration.provider}`
  const existing = await first<{ status: string; external_id: string | null }>(
    env,
    'SELECT status, external_id FROM crm_push_logs WHERE org_id = ? AND idempotency_key = ?',
    orgId,
    idempotencyKey
  )
  if (existing) {
    return existing.status === 'success'
      ? {
          success: true,
          provider: crmIntegration.provider,
          externalId: existing.external_id ?? undefined
        }
      : {
          success: false,
          provider: crmIntegration.provider,
          error: 'CRM push is already recorded; review the audit log before retrying'
        }
  }

  const logId = `cpl_${crypto.randomUUID()}`
  const claim = await run(
    env,
    `INSERT OR IGNORE INTO crm_push_logs
       (id, org_id, crm_id, prospect_id, provider, external_id, status, error_message, idempotency_key)
     VALUES (?, ?, ?, ?, ?, NULL, 'pending', NULL, ?)`,
    logId,
    orgId,
    crmIntegration.id,
    prospectId,
    crmIntegration.provider,
    idempotencyKey
  )
  if (claim.meta.changes !== 1) {
    return {
      success: false,
      provider: crmIntegration.provider,
      error: 'CRM push is already in progress'
    }
  }

  let result: CrmPushResult
  try {
    const apiKey = await decryptCredential(
      crmIntegration.api_key,
      env.CRM_CREDENTIAL_ENCRYPTION_KEY
    )
    result = await adapter.pushProspect(apiKey, prospect, config)
  } catch (error) {
    result = {
      success: false,
      provider: crmIntegration.provider,
      error: error instanceof Error ? error.message : 'CRM credential is unavailable'
    }
  }

  await run(
    env,
    `UPDATE crm_push_logs
        SET external_id = ?, status = ?, error_message = ?
      WHERE id = ? AND org_id = ? AND idempotency_key = ?`,
    result.externalId ?? null,
    result.success ? 'success' : 'failed',
    result.error ?? null,
    logId,
    orgId,
    idempotencyKey
  )

  return result
}
