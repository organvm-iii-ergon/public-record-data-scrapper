/**
 * Tests for HubSpot and GoHighLevel CRM adapter field mapping
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HubSpotAdapter } from '../../integrations/crm/HubSpotAdapter'
import { GoHighLevelAdapter } from '../../integrations/crm/GoHighLevelAdapter'
import type { Prospect } from '@public-records/core'

// ---------------------------------------------------------------------------
// Shared prospect fixture
// ---------------------------------------------------------------------------

const prospect: Prospect = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  companyName: 'Acme Widgets LLC',
  state: 'TX',
  industry: 'manufacturing',
  status: 'new',
  priorityScore: 88,
  defaultDate: '2026-01-15',
  timeSinceDefault: 30,
  uccFilings: [],
  growthSignals: [],
  healthScore: {
    grade: 'B',
    score: 72,
    sentimentTrend: 'stable',
    reviewCount: 5,
    avgSentiment: 0.4,
    violationCount: 0,
    lastUpdated: '2026-09-01'
  },
  narrative: 'Strong cashflow trend, growing equipment filings.'
}

const crmConfig = { apiKey: 'test-api-key-abc123' }

// ---------------------------------------------------------------------------
// HubSpot adapter
// ---------------------------------------------------------------------------

describe('HubSpotAdapter', () => {
  const originalFetch = globalThis.fetch
  const adapter = new HubSpotAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('adapter name is "hubspot"', () => {
    expect(adapter.name).toBe('hubspot')
  })

  it('maps all Prospect fields to HubSpot Contact properties', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 'hs-contact-99' })
    } as unknown as Response)

    const result = await adapter.pushProspect(prospect, crmConfig)

    expect(result.success).toBe(true)
    expect(result.remoteId).toBe('hs-contact-99')

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const sentBody = JSON.parse(call[1].body as string) as {
      properties: Record<string, string>
    }
    expect(sentBody.properties.company).toBe('Acme Widgets LLC')
    expect(sentBody.properties.state).toBe('TX')
    expect(sentBody.properties.industry).toBe('manufacturing')
    expect(sentBody.properties.ucc_priority_score).toBe('88')
    expect(sentBody.properties.description).toBe(
      'Strong cashflow trend, growing equipment filings.'
    )
  })

  it('uses Bearer token authorization header', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'hs-1' })
    } as unknown as Response)

    await adapter.pushProspect(prospect, crmConfig)

    const headers = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1]
      .headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer test-api-key-abc123')
  })

  it('returns failure on non-2xx response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: 'Property value is invalid.' })
    } as unknown as Response)

    const result = await adapter.pushProspect(prospect, crmConfig)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Property value is invalid.')
  })

  it('returns failure on fetch error (e.g. network timeout)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('AbortError'))

    const result = await adapter.pushProspect(prospect, crmConfig)

    expect(result.success).toBe(false)
    expect(result.error).toBe('AbortError')
  })

  it('respects a custom baseUrl', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'hs-sandbox-1' })
    } as unknown as Response)

    await adapter.pushProspect(prospect, {
      apiKey: 'key',
      baseUrl: 'https://sandbox.hubapi.com'
    })

    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(calledUrl).toContain('sandbox.hubapi.com')
  })
})

// ---------------------------------------------------------------------------
// GoHighLevel adapter
// ---------------------------------------------------------------------------

describe('GoHighLevelAdapter', () => {
  const originalFetch = globalThis.fetch
  const adapter = new GoHighLevelAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('adapter name is "gohighlevel"', () => {
    expect(adapter.name).toBe('gohighlevel')
  })

  it('maps all Prospect fields to GHL Contact fields', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ contact: { id: 'ghl-contact-77' } })
    } as unknown as Response)

    const result = await adapter.pushProspect(prospect, crmConfig)

    expect(result.success).toBe(true)
    expect(result.remoteId).toBe('ghl-contact-77')

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const sentBody = JSON.parse(call[1].body as string) as {
      companyName: string
      state: string
      source: string
      tags: string[]
      customField: { ucc_priority_score: number }
      notes: string
      externalId: string
    }

    expect(sentBody.companyName).toBe('Acme Widgets LLC')
    expect(sentBody.state).toBe('TX')
    expect(sentBody.source).toBe('UCC-MCA Intelligence')
    expect(sentBody.tags).toContain('manufacturing')
    expect(sentBody.customField.ucc_priority_score).toBe(88)
    expect(sentBody.notes).toBe('Strong cashflow trend, growing equipment filings.')
    expect(sentBody.externalId).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('uses Bearer token authorization header', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ contact: { id: 'ghl-1' } })
    } as unknown as Response)

    await adapter.pushProspect(prospect, crmConfig)

    const headers = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1]
      .headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer test-api-key-abc123')
  })

  it('falls back to top-level id when contact.id is absent', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'ghl-top-level-id' })
    } as unknown as Response)

    const result = await adapter.pushProspect(prospect, crmConfig)
    expect(result.remoteId).toBe('ghl-top-level-id')
  })

  it('returns failure on non-2xx response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ msg: 'Duplicate external ID.' })
    } as unknown as Response)

    const result = await adapter.pushProspect(prospect, crmConfig)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Duplicate external ID.')
  })

  it('returns failure on fetch error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network unreachable'))

    const result = await adapter.pushProspect(prospect, crmConfig)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Network unreachable')
  })
})
