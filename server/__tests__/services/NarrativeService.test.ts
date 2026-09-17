import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NarrativeService } from '../../services/NarrativeService'

vi.mock('../../database/connection', () => ({ database: { query: vi.fn() } }))
import { database } from '../../database/connection'
const query = vi.mocked(database.query)

function records(
  options: {
    industry?: string
    age?: number
    active?: number
    score?: number
    signals?: string[]
    revenue?: number
    violations?: number
    trend?: string
  } = {}
) {
  query
    .mockResolvedValueOnce([
      {
        id: 'test-prospect',
        company_name: 'Narrative contract test',
        industry: options.industry ?? 'retail',
        state: 'TX',
        status: 'active',
        default_date: '2020-01-01',
        time_since_default: options.age ?? 2000,
        priority_score: options.score ?? 90,
        estimated_revenue: options.revenue ?? 500000
      }
    ])
    .mockResolvedValueOnce([
      ...Array.from({ length: options.active ?? 0 }, () => ({
        status: 'active',
        filing_date: '2026-09-01',
        secured_party: 'Test secured party'
      })),
      { status: 'terminated', filing_date: '2024-01-01', secured_party: 'Test secured party' },
      { status: 'lapsed', filing_date: '2020-01-01', secured_party: 'Test secured party' }
    ])
    .mockResolvedValueOnce([
      {
        score: options.score ?? 90,
        review_count: 20,
        avg_sentiment: 0.8,
        violation_count: options.violations ?? 0,
        sentiment_trend: options.trend ?? 'improving'
      }
    ])
    .mockResolvedValueOnce(
      (options.signals ?? ['hiring', 'expansion']).map((type) => ({
        type,
        description: `Test evidence for ${type}`,
        detected_date: '2026-09-01',
        score: 80,
        confidence: 90
      }))
    )
}

beforeEach(() => {
  query.mockReset()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-16T12:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('NarrativeService generated output', () => {
  it('loads records for the requested prospect and produces evidence-based sections', async () => {
    records()
    const result = await new NarrativeService().generateNarrative('test-prospect')
    expect(query).toHaveBeenCalledTimes(4)
    expect(
      query.mock.calls.every(
        (call) => JSON.stringify(call[1]) === JSON.stringify(['test-prospect'])
      )
    ).toBe(true)
    expect(result.companyName).toBe('Narrative contract test')
    expect(result.summary).toContain('Narrative contract test')
    expect(result.summary).toContain('2 growth signals')
    expect(result.topGrowthSignals.map((signal) => signal.type)).toEqual(['hiring', 'expansion'])
    expect(result.isWhaleOpportunity).toBe(true)
    expect(result.riskLevel).toBe('low')
    expect(result.generatedAt).toBe('2026-09-16T12:00:00.000Z')
    expect(result.talkingPoints.length).toBeGreaterThan(0)
    expect(result.callOpeners.length).toBeGreaterThan(0)
    expect(result.potentialObjections.length).toBeGreaterThan(0)
  })

  it('marks recent default, deep debt, poor health and violations as high risk', async () => {
    records({ age: 90, active: 5, score: 20, violations: 4, trend: 'declining', signals: [] })
    const result = await new NarrativeService().generateNarrative('test-prospect')
    expect(result.riskLevel).toBe('high')
    expect(result.isWhaleOpportunity).toBe(false)
    expect(result.riskFactors.map((risk) => risk.factor)).toEqual(
      expect.arrayContaining([
        'Default less than 1 year ago',
        '5 active positions - heavily leveraged',
        '4 regulatory violations',
        'Declining customer sentiment',
        'Low health score (20)'
      ])
    )
    expect(result.topGrowthSignals).toEqual([])
  })

  it.each([
    'restaurant',
    'retail',
    'construction',
    'healthcare',
    'manufacturing',
    'transportation',
    'technology',
    'unknown'
  ])('generates a complete narrative for %s', async (industry) => {
    records({ industry })
    const result = await new NarrativeService().generateNarrative('test-prospect')
    expect(result.detailedNarrative).toContain('Narrative contract test')
    expect(JSON.stringify(result)).not.toMatch(/undefined|NaN/)
    expect(result.talkingPoints.every((point) => point.point.length > 0)).toBe(true)
  })

  it.each([
    ['permit', 'equipment'],
    ['contract'],
    ['equipment'],
    ['hiring'],
    [],
    ['permit', 'expansion']
  ])('uses the retrieved growth evidence %j', async (...signals) => {
    records({ signals })
    const result = await new NarrativeService().generateNarrative('test-prospect')
    expect(result.topGrowthSignals.map((signal) => signal.type)).toEqual(signals.slice(0, 3))
    expect(result.growthAnalysis.length).toBeGreaterThan(0)
  })

  it.each([0, 1, 2, 3, 4])('describes %i active filings from persisted records', async (active) => {
    records({ active, age: 500, score: 55, violations: 1, revenue: 500 })
    const result = await new NarrativeService({ minEstimatedRevenue: 100 }).generateNarrative(
      'test-prospect'
    )
    expect(result.stackInsight.length).toBeGreaterThan(0)
    expect(
      result.riskFactors.some((risk) => risk.factor.includes('Default less than 2 years'))
    ).toBe(true)
    if (active >= 2)
      expect(
        result.riskFactors.some((risk) => risk.factor.includes(`${active} active positions`))
      ).toBe(true)
    expect(result.riskFactors.some((risk) => risk.factor.includes('Below-average health'))).toBe(
      true
    )
  })

  it('rejects absent prospects without constructing a narrative', async () => {
    query.mockResolvedValueOnce([])
    await expect(new NarrativeService().generateNarrative('missing')).rejects.toThrow(
      'Prospect not found: missing'
    )
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('propagates storage failure instead of manufacturing a narrative', async () => {
    query.mockRejectedValueOnce(new Error('storage unavailable'))
    await expect(new NarrativeService().generateNarrative('test-prospect')).rejects.toThrow(
      'storage unavailable'
    )
  })
})
