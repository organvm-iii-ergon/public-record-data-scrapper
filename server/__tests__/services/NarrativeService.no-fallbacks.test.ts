import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NarrativeService } from '../../services/NarrativeService'
vi.mock('../../database/connection', () => ({ database: { query: vi.fn() } }))
import { database } from '../../database/connection'
const query = vi.mocked(database.query)

beforeEach(() => query.mockReset())
function records(health: Record<string, unknown>[] = [], extra: Record<string, unknown> = {}) {
  query
    .mockResolvedValueOnce([
      {
        id: 'no-fallback-test',
        company_name: 'Source record',
        industry: 'retail',
        state: 'TX',
        status: 'active',
        priority_score: 80,
        ...extra
      }
    ])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce(health)
    .mockResolvedValueOnce([])
}

describe('narrative missing-data behavior', () => {
  it('keeps missing health, business age, rating, and default history unknown', async () => {
    records()
    const result = await new NarrativeService().generateNarrative('no-fallback-test')
    expect(result.detailedNarrative).toContain('No health assessment is recorded.')
    expect(result.detailedNarrative).not.toMatch(/3 years in business|\brating\b|score: 50/)
    expect(result.riskFactors.some((risk) => risk.factor.includes('Default less than'))).toBe(false)
    expect(result.isWhaleOpportunity).toBe(false)
    expect(JSON.stringify(result)).not.toMatch(/NaN|undefined/)
  })
  it('preserves a recorded zero score instead of substituting 50', async () => {
    records([{ score: 0, review_count: 0, violation_count: 0 }])
    const result = await new NarrativeService().generateNarrative('no-fallback-test')
    expect(result.detailedNarrative).toContain('score: 0/100')
    expect(result.riskFactors.some((risk) => risk.factor === 'Low health score (0)')).toBe(true)
  })
  it('reports review count without inventing a star rating from sentiment', async () => {
    records([
      {
        score: 70,
        review_count: 10,
        avg_sentiment: 0.8,
        sentiment_trend: 'improving',
        violation_count: 0
      }
    ])
    const result = await new NarrativeService().generateNarrative('no-fallback-test')
    expect(result.detailedNarrative).toContain('10 recorded reviews')
    expect(result.detailedNarrative).not.toContain('/5 rating')
  })
})
