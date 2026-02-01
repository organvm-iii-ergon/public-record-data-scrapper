import { describe, expect, it } from 'vitest'
import { generateDashboardStats } from './mockData'
import type { Prospect, PortfolioCompany } from './types'

describe('generateDashboardStats', () => {
  it('returns default values when datasets are empty', () => {
    const stats = generateDashboardStats([], [])

    expect(stats).toEqual({
      totalProspects: 0,
      highValueProspects: 0,
      avgPriorityScore: 0,
      newSignalsToday: 0,
      portfolioAtRisk: 0,
      avgHealthGrade: 'N/A'
    })
  })

  it('calculates metrics when data is provided', () => {
    const prospects: Prospect[] = [
      {
        id: 'prospect-1',
        companyName: 'Test Co',
        industry: 'services',
        state: 'CA',
        status: 'qualified',
        priorityScore: 80,
        defaultDate: new Date().toISOString(),
        timeSinceDefault: 0,
        uccFilings: [],
        growthSignals: [
          {
            id: 'signal-1',
            type: 'hiring',
            description: 'Hiring staff',
            detectedDate: new Date().toISOString(),
            score: 10,
            confidence: 1
          }
        ],
        healthScore: {
          grade: 'B',
          score: 85,
          sentimentTrend: 'stable',
          reviewCount: 10,
          avgSentiment: 4,
          violationCount: 0,
          lastUpdated: new Date().toISOString()
        },
        narrative: 'Strong growth'
      }
    ]

    const portfolio: PortfolioCompany[] = [
      {
        id: 'portfolio-1',
        companyName: 'Portfolio Test',
        fundingDate: new Date().toISOString(),
        fundingAmount: 100000,
        currentStatus: 'performing',
        healthScore: {
          grade: 'A',
          score: 95,
          sentimentTrend: 'improving',
          reviewCount: 10,
          avgSentiment: 4.5,
          violationCount: 0,
          lastUpdated: new Date().toISOString()
        }
      }
    ]

    const stats = generateDashboardStats(prospects, portfolio)

    expect(stats.totalProspects).toBe(1)
    expect(stats.highValueProspects).toBe(1)
    expect(stats.avgPriorityScore).toBe(80)
    expect(stats.newSignalsToday).toBe(1)
    expect(stats.portfolioAtRisk).toBe(0)
    expect(stats.avgHealthGrade).toBe('A-')
  })
})
