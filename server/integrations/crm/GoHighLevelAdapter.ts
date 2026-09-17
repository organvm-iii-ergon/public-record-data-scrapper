/**
 * GoHighLevel CRM Adapter
 *
 * Pushes a Prospect to the GoHighLevel (GHL) Contacts API v1 when a
 * `prospect.created` event fires. Authenticates via GHL API key
 * (org-level secret).
 *
 * Field mapping:
 *   Prospect.companyName   → companyName
 *   Prospect.state         → state
 *   Prospect.industry      → tags[0]     (GHL has no industry field; use a tag)
 *   Prospect.priorityScore → customField: ucc_priority_score
 *   Prospect.narrative     → source / notes  (stored as a custom note)
 *   Prospect.id            → externalId  (idempotency)
 */

import type { Prospect } from '@public-records/core'
import type { CrmAdapter, CrmConfig, CrmPushResult } from './types'

const GHL_API_BASE = 'https://rest.gohighlevel.com'
const CONTACTS_ENDPOINT = '/v1/contacts/'
const DEFAULT_TIMEOUT_MS = 10_000

/** Build the GHL contact payload from a Prospect. */
function buildGhlContact(prospect: Prospect): Record<string, unknown> {
  return {
    companyName: prospect.companyName ?? '',
    state: prospect.state ?? '',
    source: 'UCC-MCA Intelligence',
    tags: [prospect.industry ?? 'unknown-industry'],
    customField: {
      ucc_priority_score: prospect.priorityScore ?? null
    },
    notes: prospect.narrative ?? '',
    externalId: prospect.id
  }
}

export class GoHighLevelAdapter implements CrmAdapter {
  readonly name = 'gohighlevel'

  async pushProspect(prospect: Prospect, config: CrmConfig): Promise<CrmPushResult> {
    const baseUrl = config.baseUrl ?? GHL_API_BASE
    const url = `${baseUrl}${CONTACTS_ENDPOINT}`
    const body = JSON.stringify(buildGhlContact(prospect))

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`
        },
        body,
        signal: controller.signal
      })

      const data = (await response.json().catch(() => ({}))) as {
        contact?: { id?: string }
        id?: string
        message?: string
        msg?: string
      }

      if (!response.ok) {
        return {
          success: false,
          error: data.message ?? data.msg ?? `GHL API error ${response.status}`
        }
      }

      const remoteId = data.contact?.id ?? data.id
      return { success: true, remoteId }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    } finally {
      clearTimeout(timeout)
    }
  }
}
