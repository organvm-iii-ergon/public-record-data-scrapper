/**
 * HubSpot CRM Adapter
 *
 * Pushes a Prospect to the HubSpot Contacts API (v3) when a
 * `prospect.created` event fires. Authenticates via HubSpot Private App
 * Bearer token (org-level secret).
 *
 * Field mapping:
 *   Prospect.companyName   → company
 *   Prospect.state         → state
 *   Prospect.industry      → industry
 *   Prospect.priorityScore → ucc_priority_score  (custom property)
 *   Prospect.narrative     → description
 */

import type { Prospect } from '@public-records/core'
import type { CrmAdapter, CrmConfig, CrmPushResult } from './types'

const HUBSPOT_API_BASE = 'https://api.hubapi.com'
const CONTACTS_ENDPOINT = '/crm/v3/objects/contacts'
const DEFAULT_TIMEOUT_MS = 10_000

/** Build the HubSpot Contact properties payload from a Prospect. */
function buildHubSpotProperties(prospect: Prospect): Record<string, string> {
  return {
    company: prospect.companyName ?? '',
    state: prospect.state ?? '',
    industry: prospect.industry ?? '',
    ucc_priority_score: String(prospect.priorityScore ?? ''),
    description: prospect.narrative ?? ''
  }
}

export class HubSpotAdapter implements CrmAdapter {
  readonly name = 'hubspot'

  async pushProspect(prospect: Prospect, config: CrmConfig): Promise<CrmPushResult> {
    const baseUrl = config.baseUrl ?? HUBSPOT_API_BASE
    const url = `${baseUrl}${CONTACTS_ENDPOINT}`
    const body = JSON.stringify({ properties: buildHubSpotProperties(prospect) })

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
        id?: string
        message?: string
        error?: string
      }

      if (!response.ok) {
        return {
          success: false,
          error: data.message ?? data.error ?? `HubSpot API error ${response.status}`
        }
      }

      return { success: true, remoteId: data.id }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    } finally {
      clearTimeout(timeout)
    }
  }
}
