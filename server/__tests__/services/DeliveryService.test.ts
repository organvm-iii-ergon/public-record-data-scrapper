import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ValidationError } from '../../errors'
import { DeliveryService, type DeliveryConfig } from '../../services/DeliveryService'
import type { Prospect } from '@public-records/core'

const prospect: Prospect = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  companyName: 'Test Company',
  state: 'NY',
  industry: 'technology',
  status: 'new',
  priorityScore: 85,
  defaultDate: '2026-01-01',
  timeSinceDefault: 10,
  uccFilings: [],
  growthSignals: [],
  healthScore: {
    grade: 'A',
    score: 90,
    sentimentTrend: 'stable',
    reviewCount: 0,
    avgSentiment: 0,
    violationCount: 0,
    lastUpdated: '2026-01-01'
  },
  narrative: 'High priority lead'
}

function config(overrides: Partial<DeliveryConfig> = {}): DeliveryConfig {
  return {
    integration: 'zapier',
    webhookUrl: 'https://hooks.example.com/lead',
    ...overrides
  }
}

describe('DeliveryService', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'x-request-id': 'request-1' })
    } satisfies Partial<Response>) as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('posts a provider-safe Zapier payload to an HTTPS webhook', async () => {
    const result = await new DeliveryService().deliverLead(prospect, config())

    expect(result).toEqual({
      success: true,
      integration: 'zapier',
      providerId: 'request-1'
    })
    expect(globalThis.fetch).toHaveBeenCalledWith(
      new URL('https://hooks.example.com/lead'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"company_name":"Test Company"')
      })
    )
  })

  it('rejects non-HTTPS webhooks', async () => {
    await expect(
      new DeliveryService().deliverLead(prospect, config({ webhookUrl: 'http://example.com/lead' }))
    ).rejects.toBeInstanceOf(ValidationError)

    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('rejects local or private webhook targets', async () => {
    await expect(
      new DeliveryService().deliverLead(prospect, config({ webhookUrl: 'https://127.0.0.1/lead' }))
    ).rejects.toBeInstanceOf(ValidationError)

    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('surfaces provider HTTP failures', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      headers: new Headers()
    } satisfies Partial<Response>) as typeof fetch

    await expect(new DeliveryService().deliverLead(prospect, config())).rejects.toThrow(
      'Delivery failed with status 503'
    )
  })
})
