import type { Prospect } from '@public-records/core'
import { ValidationError } from '../errors'

export type DeliveryIntegration = 'zapier' | 'sfdc' | 'airtable'

export interface DeliveryConfig {
  integration: DeliveryIntegration
  webhookUrl: string
  timeoutMs?: number
}

export interface DeliveryResult {
  success: boolean
  integration: DeliveryIntegration
  providerId?: string
}

const DEFAULT_TIMEOUT_MS = 5_000

function assertSafeWebhookUrl(rawUrl: string): URL {
  const url = new URL(rawUrl)
  const hostname = url.hostname.toLowerCase()

  if (url.protocol !== 'https:') {
    throw new ValidationError('Delivery webhook URL must use https')
  }

  if (
    hostname === 'localhost' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname.endsWith('.local') ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^169\.254\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  ) {
    throw new ValidationError('Delivery webhook URL must not target local or private hosts')
  }

  return url
}

function buildDeliveryPayload(prospect: Prospect, integration: DeliveryIntegration): unknown {
  const lead = {
    lead_id: prospect.id,
    company_name: prospect.companyName,
    state: prospect.state,
    industry: prospect.industry,
    status: prospect.status,
    priority_score: prospect.priorityScore,
    estimated_revenue: prospect.estimatedRevenue ?? null,
    default_date: prospect.defaultDate,
    last_filing_date: prospect.lastFilingDate ?? null,
    narrative: prospect.narrative,
    delivered_at: new Date().toISOString()
  }

  if (integration === 'sfdc') {
    return {
      Company: lead.company_name,
      State: lead.state,
      Industry: lead.industry,
      LeadSource: 'Public Record Data Scraper',
      Rating: lead.priority_score >= 75 ? 'Hot' : 'Warm',
      Description: lead.narrative
    }
  }

  if (integration === 'airtable') {
    return {
      records: [
        {
          fields: {
            'Lead ID': lead.lead_id,
            'Company Name': lead.company_name,
            State: lead.state,
            Industry: lead.industry,
            Status: lead.status,
            'Priority Score': lead.priority_score,
            'Estimated Revenue': lead.estimated_revenue,
            Narrative: lead.narrative
          }
        }
      ]
    }
  }

  return lead
}

export class DeliveryService {
  async deliverLead(prospect: Prospect, config: DeliveryConfig): Promise<DeliveryResult> {
    const url = assertSafeWebhookUrl(config.webhookUrl)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? DEFAULT_TIMEOUT_MS)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildDeliveryPayload(prospect, config.integration)),
        signal: controller.signal
      })

      if (!response.ok) {
        throw new Error(`Delivery failed with status ${response.status}`)
      }

      return {
        success: true,
        integration: config.integration,
        providerId:
          response.headers.get('x-request-id') ??
          response.headers.get('x-amzn-requestid') ??
          `delivered-${config.integration}`
      }
    } finally {
      clearTimeout(timeout)
    }
  }
}
