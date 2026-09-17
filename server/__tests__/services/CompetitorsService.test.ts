import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CompetitorsService } from '../../services/CompetitorsService'

// Mock the database module
vi.mock('../../database/connection', () => ({
  database: {
    query: vi.fn()
  }
}))

import { database } from '../../database/connection'

const mockQuery = vi.mocked(database.query)

describe('CompetitorsService', () => {
  let service: CompetitorsService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new CompetitorsService()
  })

  describe('list', () => {
    it('should return paginated list of competitors', async () => {
      const mockCompetitors = [
        {
          id: '1',
          name: 'LENDER A',
          filing_count: 5,
          total_amount: 500000,
          avg_amount: 100000,
          states: ['NY', 'CA'],
          first_filing: '2024-01-01',
          last_filing: '2024-06-01'
        },
        {
          id: '2',
          name: 'LENDER B',
          filing_count: 3,
          total_amount: 300000,
          avg_amount: 100000,
          states: ['TX'],
          first_filing: '2024-02-01',
          last_filing: '2024-05-01'
        }
      ]

      mockQuery
        .mockResolvedValueOnce(mockCompetitors) // Main query
        .mockResolvedValueOnce([{ count: '2' }]) // Count query

      const result = await service.list({
        page: 1,
        limit: 10,
        sort_by: 'filing_count',
        sort_order: 'desc'
      })

      expect(result).toBeDefined()
      expect(result.competitors).toBeInstanceOf(Array)
      expect(result.competitors.length).toBe(2)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(10)
      expect(result.total).toBe(2)
    })

    it('should aggregate filings by secured party', async () => {
      const mockCompetitor = {
        id: '1',
        name: 'TEST LENDER',
        filing_count: 3,
        total_amount: 600000,
        avg_amount: 200000,
        states: ['NY'],
        first_filing: '2024-01-01',
        last_filing: '2024-06-01'
      }

      mockQuery.mockResolvedValueOnce([mockCompetitor]).mockResolvedValueOnce([{ count: '1' }])

      const result = await service.list({
        page: 1,
        limit: 10,
        sort_by: 'filing_count',
        sort_order: 'desc'
      })

      const testLender = result.competitors.find((c) => c.name === 'TEST LENDER')
      expect(testLender).toBeDefined()
      expect(testLender?.filing_count).toBe(3)
      expect(testLender?.total_amount).toBe(600000)
      expect(testLender?.avg_amount).toBe(200000)
    })

    it('should filter by state', async () => {
      const mockCompetitors = [{ id: '1', name: 'LENDER NY', filing_count: 2, states: ['NY'] }]

      mockQuery.mockResolvedValueOnce(mockCompetitors).mockResolvedValueOnce([{ count: '1' }])

      const result = await service.list({
        page: 1,
        limit: 10,
        state: 'NY',
        sort_by: 'filing_count',
        sort_order: 'desc'
      })

      expect(result.competitors.length).toBe(1)
      expect(result.competitors[0].name).toBe('LENDER NY')

      // Verify state filter was applied
      const queryCall = mockQuery.mock.calls[0]
      expect(queryCall[0]).toContain('WHERE')
      expect(queryCall[1]).toContain('NY')
    })

    it('should handle pagination correctly', async () => {
      const page1Competitors = Array.from({ length: 10 }, (_, i) => ({
        id: `${i + 1}`,
        name: `LENDER ${i + 1}`,
        filing_count: 10 - i
      }))

      mockQuery.mockResolvedValueOnce(page1Competitors).mockResolvedValueOnce([{ count: '15' }])

      const page1 = await service.list({
        page: 1,
        limit: 10,
        sort_by: 'filing_count',
        sort_order: 'desc'
      })

      expect(page1.competitors.length).toBe(10)
      expect(page1.total).toBe(15)

      // Verify LIMIT and OFFSET
      const queryCall = mockQuery.mock.calls[0]
      expect(queryCall[0]).toContain('LIMIT')
      expect(queryCall[0]).toContain('OFFSET')
    })

    it('should sort by different fields', async () => {
      const mockCompetitors = [
        { id: '1', name: 'ALPHA', total_amount: 500000 },
        { id: '2', name: 'GAMMA', total_amount: 400000 },
        { id: '3', name: 'BETA', total_amount: 300000 }
      ]

      mockQuery.mockResolvedValueOnce(mockCompetitors).mockResolvedValueOnce([{ count: '3' }])

      const byAmount = await service.list({
        page: 1,
        limit: 10,
        sort_by: 'total_amount',
        sort_order: 'desc'
      })

      expect(byAmount.competitors[0].name).toBe('ALPHA')

      // Verify sort column
      const queryCall = mockQuery.mock.calls[0]
      expect(queryCall[0]).toContain('ORDER BY total_amount DESC')
    })

    it('should use safe default for invalid sort column', async () => {
      mockQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: '0' }])

      await service.list({
        page: 1,
        limit: 10,
        sort_by: 'malicious; DROP TABLE--',
        sort_order: 'desc'
      })

      const queryCall = mockQuery.mock.calls[0]
      expect(queryCall[0]).toContain('ORDER BY filing_count')
      expect(queryCall[0]).not.toContain('malicious')
    })
  })

  describe('getById', () => {
    it('should return competitor details', async () => {
      const mockCompetitor = {
        id: 'test-id',
        name: 'TEST LENDER',
        filing_count: 5,
        total_amount: 250000,
        avg_amount: 50000,
        states: ['NY'],
        first_filing: '2024-01-01',
        last_filing: '2024-06-01'
      }

      mockQuery.mockResolvedValueOnce([mockCompetitor])

      const result = await service.getById('test-id')

      expect(result).toBeDefined()
      expect(result).toHaveProperty('name')
      expect(result).toHaveProperty('filing_count')
      expect(result).toHaveProperty('total_amount')
    })

    it('should return null when competitor not found', async () => {
      mockQuery.mockResolvedValueOnce([])

      const result = await service.getById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('getAnalysis', () => {
    it('should return SWOT analysis with market share', async () => {
      const mockCompetitor = {
        id: '1',
        name: 'MAJOR LENDER',
        filing_count: 150,
        total_amount: 2000000,
        avg_amount: 100000,
        states: ['NY', 'CA', 'TX', 'FL', 'IL', 'WA'],
        first_filing: '2024-01-01',
        last_filing: '2024-06-01'
      }

      mockQuery
        .mockResolvedValueOnce([mockCompetitor]) // getById
        .mockResolvedValueOnce([{ total_market: 10000000 }]) // market total

      const analysis = await service.getAnalysis('1')

      expect(analysis).toBeDefined()
      expect(analysis).toHaveProperty('market_share')
      expect(analysis).toHaveProperty('analysis')
      expect(analysis?.analysis).toHaveProperty('strengths')
      expect(analysis?.analysis).toHaveProperty('weaknesses')
      expect(analysis?.analysis).toHaveProperty('opportunities')
      expect(analysis?.analysis).toHaveProperty('threats')
    })

    it('should calculate market share correctly', async () => {
      const mockCompetitor = {
        id: '1',
        name: 'LENDER A',
        filing_count: 10,
        total_amount: 2000000,
        avg_amount: 200000,
        states: ['NY'],
        first_filing: '2024-01-01',
        last_filing: '2024-06-01'
      }

      mockQuery
        .mockResolvedValueOnce([mockCompetitor])
        .mockResolvedValueOnce([{ total_market: 3000000 }]) // 2M / 3M = 66.67%

      const analysis = await service.getAnalysis('1')

      expect(analysis?.market_share).toBeCloseTo(66.67, 1)
    })

    it('should identify high volume as strength', async () => {
      const mockCompetitor = {
        id: '1',
        name: 'HIGH VOLUME LENDER',
        filing_count: 101,
        total_amount: 1010000,
        avg_amount: 10000,
        states: ['NY'],
        first_filing: '2024-01-01',
        last_filing: '2024-06-01'
      }

      mockQuery
        .mockResolvedValueOnce([mockCompetitor])
        .mockResolvedValueOnce([{ total_market: 5000000 }])

      const analysis = await service.getAnalysis('1')

      expect(analysis?.analysis.strengths).toContain('High volume of transactions')
    })

    it('should identify dominant market position as strength', async () => {
      const mockCompetitor = {
        id: '1',
        name: 'DOMINANT',
        filing_count: 50,
        total_amount: 2000000,
        avg_amount: 40000,
        states: ['NY'],
        first_filing: '2024-01-01',
        last_filing: '2024-06-01'
      }

      mockQuery
        .mockResolvedValueOnce([mockCompetitor])
        .mockResolvedValueOnce([{ total_market: 2100000 }]) // >10% share

      const analysis = await service.getAnalysis('1')

      expect(analysis?.analysis.strengths).toContain('Dominant market position')
    })

    it('should return null when competitor not found', async () => {
      mockQuery.mockResolvedValueOnce([])

      const analysis = await service.getAnalysis('non-existent')

      expect(analysis).toBeNull()
    })
  })

  describe('getStats', () => {
    it('should return competitor statistics', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          total_competitors: 2,
          total_filings: 3,
          total_market_value: 1000000,
          avg_filing_amount: 333333
        }
      ])

      const stats = await service.getStats()

      expect(stats).toBeDefined()
      expect(stats.total_competitors).toBe(2)
      expect(stats.total_filings).toBe(3)
      expect(stats.total_market_value).toBe(1000000)
    })

    it('should return zero stats when no filings exist', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          total_competitors: 0,
          total_filings: 0,
          total_market_value: 0,
          avg_filing_amount: 0
        }
      ])

      const stats = await service.getStats()

      expect(stats.total_competitors).toBe(0)
      expect(stats.total_filings).toBe(0)
      expect(stats.total_market_value).toBe(0)
      expect(stats.avg_filing_amount).toBe(0)
    })

    it('should return default values when query returns empty', async () => {
      mockQuery.mockResolvedValueOnce([])

      const stats = await service.getStats()

      expect(stats.total_competitors).toBe(0)
      expect(stats.total_filings).toBe(0)
    })
  })
})
