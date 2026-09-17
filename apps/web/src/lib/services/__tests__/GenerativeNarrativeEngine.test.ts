import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GenerativeNarrativeEngine } from '../GenerativeNarrativeEngine'
import { Prospect, GenerativeContext } from '@public-records/core'

describe('GenerativeNarrativeEngine', () => {
  let engine: GenerativeNarrativeEngine
  const mockProspect: Prospect = {
    id: 'p-123',
    companyName: 'Test Corp',
    industry: 'technology',
    state: 'CA',
    status: 'new',
    priorityScore: 85,
    defaultDate: '2023-01-01',
    timeSinceDefault: 365,
    uccFilings: [
      {
        id: 'u-1',
        filingDate: '2023-01-01',
        securedParty: 'Bank A',
        debtorName: 'Test Corp',
        state: 'CA',
        status: 'active',
        filingType: 'UCC-1'
      }
    ],
    growthSignals: [
      {
        id: 'g-1',
        type: 'hiring',
        description: 'Hiring engineers',
        detectedDate: '2023-06-01',
        score: 0.8,
        confidence: 0.9
      }
    ],
    healthScore: {
      grade: 'B',
      score: 80,
      sentimentTrend: 'stable',
      reviewCount: 10,
      avgSentiment: 0.8,
      violationCount: 0,
      lastUpdated: '2023-06-01'
    },
    narrative: ''
  }

  const mockContext: GenerativeContext = {
    prospect: mockProspect,
    marketData: [],
    relationships: undefined,
    historicalSignals: [],
    industryTrends: []
  }

  beforeEach(() => {
    // Mock environment variables
    vi.stubEnv('VITE_USE_MOCK_DATA', 'true')
    engine = new GenerativeNarrativeEngine()
  })

  it('should parse keyInsights correctly from mock response', async () => {
    // We rely on generateMockResponse being used because of VITE_USE_MOCK_DATA='true'
    // but we need to inspect what generateMockResponse returns.
    // However, the test is to ensure that generateNarrative populates keyInsights.

    const narrative = await engine.generateNarrative(mockContext)

    expect(narrative).toBeDefined()
    expect(narrative.prospectId).toBe(mockProspect.id)
    expect(narrative.summary).toBeTruthy()

    // This is what we expect to fail initially
    expect(narrative.keyInsights).toBeDefined()
    expect(narrative.keyInsights.length).toBeGreaterThan(0)

    // Also check other fields
    expect(narrative.riskFactors).toBeDefined()
    expect(narrative.opportunities).toBeDefined()
    expect(narrative.recommendedActions).toBeDefined()
  })
})
