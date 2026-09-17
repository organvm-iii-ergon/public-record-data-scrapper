import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PortfolioService } from '../../services/PortfolioService'

// Mock the database module
vi.mock('../../database/connection', () => ({
  database: {
    query: vi.fn()
  }
}))

import { database } from '../../database/connection'

const mockQuery = vi.mocked(database.query)

describe('PortfolioService', () => {
  let service: PortfolioService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new PortfolioService()
  })

  describe('list', () => {
    it('should return paginated list of portfolio companies', async () => {
      const mockCompanies = [
        {
          id: '1',
          company_name: 'Company A',
          funded_date: '2024-01-01',
          funded_amount: 1000000,
          current_health_score: 85,
          health_grade: 'B',
          health_trend: 'stable',
          state: 'CA',
          industry: 'Technology',
          days_since_funding: 180
        },
        {
          id: '2',
          company_name: 'Company B',
          funded_date: '2024-02-01',
          funded_amount: 2000000,
          current_health_score: 92,
          health_grade: 'A',
          health_trend: 'improving',
          state: 'NY',
          industry: 'Manufacturing',
          days_since_funding: 150
        }
      ]

      mockQuery.mockResolvedValueOnce(mockCompanies).mockResolvedValueOnce([{ count: '2' }])

      const result = await service.list({
        page: 1,
        limit: 10,
        sort_by: 'funded_date',
        sort_order: 'desc'
      })

      expect(result).toBeDefined()
      expect(result.companies).toBeInstanceOf(Array)
      expect(result.companies.length).toBe(2)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(10)
      expect(result.total).toBe(2)
    })

    it('should filter by health grade', async () => {
      const mockCompanies = [
        { id: '1', company_name: 'Company A', health_grade: 'A' },
        { id: '2', company_name: 'Company B', health_grade: 'A' }
      ]

      mockQuery.mockResolvedValueOnce(mockCompanies).mockResolvedValueOnce([{ count: '2' }])

      const result = await service.list({
        page: 1,
        limit: 10,
        health_grade: 'A',
        sort_by: 'funded_date',
        sort_order: 'desc'
      })

      expect(result.companies.length).toBe(2)

      // Verify health grade filter was applied
      const queryCall = mockQuery.mock.calls[0]
      expect(queryCall[0]).toContain('WHERE')
      expect(queryCall[0]).toContain('health_grade = $1')
      expect(queryCall[1]).toContain('A')
    })

    it('should handle pagination correctly', async () => {
      const page1Companies = Array.from({ length: 10 }, (_, i) => ({
        id: `${i + 1}`,
        company_name: `Company ${i + 1}`,
        days_since_funding: 100 + i
      }))

      mockQuery.mockResolvedValueOnce(page1Companies).mockResolvedValueOnce([{ count: '25' }])

      const page1 = await service.list({
        page: 1,
        limit: 10,
        sort_by: 'funded_date',
        sort_order: 'desc'
      })

      expect(page1.companies.length).toBe(10)
      expect(page1.total).toBe(25)
    })

    it('should sort by different fields', async () => {
      const mockCompanies = [
        { id: '1', company_name: 'Alpha Corp', current_health_score: 95 },
        { id: '2', company_name: 'Gamma LLC', current_health_score: 85 },
        { id: '3', company_name: 'Beta Inc', current_health_score: 75 }
      ]

      mockQuery.mockResolvedValueOnce(mockCompanies).mockResolvedValueOnce([{ count: '3' }])

      const result = await service.list({
        page: 1,
        limit: 10,
        sort_by: 'current_health_score',
        sort_order: 'desc'
      })

      expect(result.companies[0].company_name).toBe('Alpha Corp')

      // Verify sort column
      const queryCall = mockQuery.mock.calls[0]
      expect(queryCall[0]).toContain('ORDER BY current_health_score DESC')
    })

    it('should include days since funding', async () => {
      const mockCompanies = [
        {
          id: '1',
          company_name: 'Company A',
          days_since_funding: 180
        }
      ]

      mockQuery.mockResolvedValueOnce(mockCompanies).mockResolvedValueOnce([{ count: '1' }])

      const result = await service.list({
        page: 1,
        limit: 10,
        sort_by: 'funded_date',
        sort_order: 'desc'
      })

      expect(result.companies[0]).toHaveProperty('days_since_funding')
      expect(typeof result.companies[0].days_since_funding).toBe('number')
      expect(result.companies[0].days_since_funding).toBeGreaterThanOrEqual(0)
    })
  })

  describe('getById', () => {
    it('should return company by id', async () => {
      const mockCompany = {
        id: 'test-id',
        company_name: 'Test Company',
        funded_date: '2024-01-01',
        funded_amount: 1500000,
        current_health_score: 88,
        health_grade: 'B',
        health_trend: 'stable',
        state: 'CA',
        industry: 'Technology',
        days_since_funding: 200
      }

      mockQuery.mockResolvedValueOnce([mockCompany])

      const result = await service.getById('test-id')

      expect(result).toBeDefined()
      expect(result?.id).toBe('test-id')
      expect(result?.company_name).toBe('Test Company')
      expect(result?.funded_amount).toBe(1500000)
      expect(result?.current_health_score).toBe(88)
    })

    it('should return null for non-existent id', async () => {
      mockQuery.mockResolvedValueOnce([])

      const result = await service.getById('00000000-0000-0000-0000-000000000000')

      expect(result).toBeNull()
    })

    it('should include all company details', async () => {
      const mockCompany = {
        id: 'test-id',
        company_name: 'Test Company',
        funded_date: '2024-01-01',
        funded_amount: 1000000,
        current_health_score: 85,
        health_grade: 'B',
        health_trend: 'stable',
        state: 'CA',
        industry: 'Technology',
        contact_email: 'test@example.com',
        contact_phone: '555-0123',
        notes: 'Test notes',
        days_since_funding: 180,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-06-01T00:00:00Z'
      }

      mockQuery.mockResolvedValueOnce([mockCompany])

      const result = await service.getById('test-id')

      expect(result).toBeDefined()
      expect(result).toHaveProperty('id')
      expect(result).toHaveProperty('company_name')
      expect(result).toHaveProperty('funded_date')
      expect(result).toHaveProperty('funded_amount')
      expect(result).toHaveProperty('current_health_score')
      expect(result).toHaveProperty('health_grade')
      expect(result).toHaveProperty('health_trend')
      expect(result).toHaveProperty('state')
      expect(result).toHaveProperty('industry')
      expect(result).toHaveProperty('days_since_funding')
    })
  })

  describe('getHealthHistory', () => {
    it('should return health score history', async () => {
      const mockHistory = [
        {
          score: 90,
          grade: 'A',
          trend: 'improving',
          violations_count: 0,
          sentiment_score: 0.9,
          recorded_at: '2024-06-01'
        },
        {
          score: 88,
          grade: 'B',
          trend: 'stable',
          violations_count: 1,
          sentiment_score: 0.85,
          recorded_at: '2024-05-01'
        },
        {
          score: 85,
          grade: 'B',
          trend: 'stable',
          violations_count: 0,
          sentiment_score: 0.8,
          recorded_at: '2024-04-01'
        }
      ]

      mockQuery.mockResolvedValueOnce(mockHistory)

      const history = await service.getHealthHistory('test-id')

      expect(history).toBeInstanceOf(Array)
      expect(history.length).toBe(3)
    })

    it('should return health scores in descending order', async () => {
      const mockHistory = [
        { score: 90, recorded_at: '2024-06-01T00:00:00Z' },
        { score: 85, recorded_at: '2024-05-01T00:00:00Z' },
        { score: 80, recorded_at: '2024-04-01T00:00:00Z' }
      ]

      mockQuery.mockResolvedValueOnce(mockHistory)

      const history = await service.getHealthHistory('test-id')

      // Most recent should be first (already sorted by mock)
      expect(history[0].score).toBe(90)

      // Verify query uses ORDER BY DESC
      const queryCall = mockQuery.mock.calls[0]
      expect(queryCall[0]).toContain('ORDER BY recorded_at DESC')
    })

    it('should limit to 30 most recent scores', async () => {
      mockQuery.mockResolvedValueOnce(
        Array.from({ length: 30 }, (_, i) => ({ score: 80 + (i % 20) }))
      )

      const history = await service.getHealthHistory('test-id')

      expect(history.length).toBe(30)

      // Verify LIMIT in query
      const queryCall = mockQuery.mock.calls[0]
      expect(queryCall[0]).toContain('LIMIT 30')
    })

    it('should include score details', async () => {
      const mockHistory = [
        {
          score: 85,
          grade: 'B',
          trend: 'stable',
          violations_count: 1,
          sentiment_score: 0.8,
          recorded_at: '2024-06-01T00:00:00Z'
        }
      ]

      mockQuery.mockResolvedValueOnce(mockHistory)

      const history = await service.getHealthHistory('test-id')

      expect(history[0]).toHaveProperty('score')
      expect(history[0]).toHaveProperty('grade')
      expect(history[0]).toHaveProperty('trend')
      expect(history[0]).toHaveProperty('violations_count')
      expect(history[0]).toHaveProperty('sentiment_score')
      expect(history[0]).toHaveProperty('recorded_at')
    })

    it('should return empty array for company with no history', async () => {
      mockQuery.mockResolvedValueOnce([])

      const history = await service.getHealthHistory('test-id')

      expect(history).toBeInstanceOf(Array)
      expect(history.length).toBe(0)
    })
  })

  describe('getStats', () => {
    it('should return portfolio statistics', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          total_companies: 3,
          total_funded: 4500000,
          avg_health_score: 85,
          grade_a_count: 2,
          grade_b_count: 1,
          grade_c_count: 0,
          grade_d_count: 0,
          grade_f_count: 0,
          improving_count: 1,
          stable_count: 1,
          declining_count: 1
        }
      ])

      const stats = await service.getStats()

      expect(stats).toBeDefined()
      expect(stats.total_companies).toBe(3)
      expect(stats.total_funded).toBe(4500000)
      expect(stats.grade_a_count).toBe(2)
      expect(stats.grade_b_count).toBe(1)
    })

    it('should calculate average health score', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          total_companies: 3,
          total_funded: 3000000,
          avg_health_score: 85,
          grade_a_count: 0,
          grade_b_count: 0,
          grade_c_count: 0,
          grade_d_count: 0,
          grade_f_count: 0,
          improving_count: 0,
          stable_count: 0,
          declining_count: 0
        }
      ])

      const stats = await service.getStats()

      expect(stats.avg_health_score).toBe(85)
    })

    it('should count companies by health trend', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          total_companies: 4,
          total_funded: 4000000,
          avg_health_score: 80,
          grade_a_count: 0,
          grade_b_count: 0,
          grade_c_count: 0,
          grade_d_count: 0,
          grade_f_count: 0,
          improving_count: 2,
          stable_count: 1,
          declining_count: 1
        }
      ])

      const stats = await service.getStats()

      expect(stats.improving_count).toBe(2)
      expect(stats.stable_count).toBe(1)
      expect(stats.declining_count).toBe(1)
    })

    it('should count companies by all health grades', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          total_companies: 6,
          total_funded: 6000000,
          avg_health_score: 70,
          grade_a_count: 1,
          grade_b_count: 2,
          grade_c_count: 1,
          grade_d_count: 1,
          grade_f_count: 1,
          improving_count: 0,
          stable_count: 0,
          declining_count: 0
        }
      ])

      const stats = await service.getStats()

      expect(stats.grade_a_count).toBe(1)
      expect(stats.grade_b_count).toBe(2)
      expect(stats.grade_c_count).toBe(1)
      expect(stats.grade_d_count).toBe(1)
      expect(stats.grade_f_count).toBe(1)
    })

    it('should return zero stats when no companies exist', async () => {
      mockQuery.mockResolvedValueOnce([])

      const stats = await service.getStats()

      expect(stats.total_companies).toBe(0)
      expect(stats.total_funded).toBe(0)
      expect(stats.avg_health_score).toBe(0)
      expect(stats.grade_a_count).toBe(0)
      expect(stats.improving_count).toBe(0)
    })
  })
})
