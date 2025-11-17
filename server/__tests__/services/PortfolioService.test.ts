import { describe, it, expect, beforeEach } from 'vitest'
import { PortfolioService } from '../../services/PortfolioService'
import { TestDataFactory } from '../helpers/testData'

describe('PortfolioService', () => {
  let service: PortfolioService

  beforeEach(() => {
    service = new PortfolioService()
  })

  describe('list', () => {
    it('should return paginated list of portfolio companies', async () => {
      await TestDataFactory.createPortfolioCompany()
      await TestDataFactory.createPortfolioCompany()
      await TestDataFactory.createPortfolioCompany()

      const result = await service.list({
        page: 1,
        limit: 10,
        sort_by: 'funded_date',
        sort_order: 'desc'
      })

      expect(result).toBeDefined()
      expect(result.companies).toBeInstanceOf(Array)
      expect(result.companies.length).toBe(3)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(10)
      expect(result.total).toBe(3)
    })

    it('should filter by health grade', async () => {
      await TestDataFactory.createPortfolioCompany({ healthGrade: 'A' })
      await TestDataFactory.createPortfolioCompany({ healthGrade: 'A' })
      await TestDataFactory.createPortfolioCompany({ healthGrade: 'B' })
      await TestDataFactory.createPortfolioCompany({ healthGrade: 'C' })

      const result = await service.list({
        page: 1,
        limit: 10,
        health_grade: 'A',
        sort_by: 'funded_date',
        sort_order: 'desc'
      })

      expect(result.companies.length).toBe(2)
      result.companies.forEach(c => {
        expect(c.health_grade).toBe('A')
      })
    })

    it('should handle pagination correctly', async () => {
      // Create 25 companies
      for (let i = 0; i < 25; i++) {
        await TestDataFactory.createPortfolioCompany()
      }

      const page1 = await service.list({
        page: 1,
        limit: 10,
        sort_by: 'funded_date',
        sort_order: 'desc'
      })

      expect(page1.companies.length).toBe(10)
      expect(page1.total).toBe(25)

      const page3 = await service.list({
        page: 3,
        limit: 10,
        sort_by: 'funded_date',
        sort_order: 'desc'
      })

      expect(page3.companies.length).toBe(5)
    })

    it('should sort by different fields', async () => {
      await TestDataFactory.createPortfolioCompany({
        companyName: 'Alpha Corp',
        healthScore: 95
      })
      await TestDataFactory.createPortfolioCompany({
        companyName: 'Beta Inc',
        healthScore: 75
      })
      await TestDataFactory.createPortfolioCompany({
        companyName: 'Gamma LLC',
        healthScore: 85
      })

      // Sort by health score descending
      const result = await service.list({
        page: 1,
        limit: 10,
        sort_by: 'current_health_score',
        sort_order: 'desc'
      })

      expect(result.companies[0].company_name).toBe('Alpha Corp')
      expect(result.companies[1].company_name).toBe('Gamma LLC')
      expect(result.companies[2].company_name).toBe('Beta Inc')
    })

    it('should include days since funding', async () => {
      const company = await TestDataFactory.createPortfolioCompany()

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
      const company = await TestDataFactory.createPortfolioCompany({
        companyName: 'Test Company',
        fundedAmount: 1500000,
        healthScore: 88
      })

      const result = await service.getById(company.id)

      expect(result).toBeDefined()
      expect(result?.id).toBe(company.id)
      expect(result?.company_name).toBe('Test Company')
      expect(result?.funded_amount).toBe(1500000)
      expect(result?.current_health_score).toBe(88)
    })

    it('should return null for non-existent id', async () => {
      const result = await service.getById('00000000-0000-0000-0000-000000000000')

      expect(result).toBeNull()
    })

    it('should include all company details', async () => {
      const company = await TestDataFactory.createPortfolioCompany()

      const result = await service.getById(company.id)

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
      const company = await TestDataFactory.createPortfolioCompany()

      // Create health score history
      await TestDataFactory.createHealthScore(company.id, 85, true)
      await TestDataFactory.createHealthScore(company.id, 88, true)
      await TestDataFactory.createHealthScore(company.id, 90, true)

      const history = await service.getHealthHistory(company.id)

      expect(history).toBeInstanceOf(Array)
      expect(history.length).toBe(3)
    })

    it('should return health scores in descending order', async () => {
      const company = await TestDataFactory.createPortfolioCompany()

      // Create scores with delays to ensure different timestamps
      await TestDataFactory.createHealthScore(company.id, 80, true)
      await new Promise(resolve => setTimeout(resolve, 10))
      await TestDataFactory.createHealthScore(company.id, 85, true)
      await new Promise(resolve => setTimeout(resolve, 10))
      await TestDataFactory.createHealthScore(company.id, 90, true)

      const history = await service.getHealthHistory(company.id)

      // Most recent should be first
      expect(history[0].score).toBe(90)
    })

    it('should limit to 30 most recent scores', async () => {
      const company = await TestDataFactory.createPortfolioCompany()

      // Create 40 health scores
      for (let i = 0; i < 40; i++) {
        await TestDataFactory.createHealthScore(company.id, 80 + i % 20, true)
      }

      const history = await service.getHealthHistory(company.id)

      expect(history.length).toBe(30)
    })

    it('should include score details', async () => {
      const company = await TestDataFactory.createPortfolioCompany()
      await TestDataFactory.createHealthScore(company.id, 85, true)

      const history = await service.getHealthHistory(company.id)

      expect(history[0]).toHaveProperty('score')
      expect(history[0]).toHaveProperty('grade')
      expect(history[0]).toHaveProperty('trend')
      expect(history[0]).toHaveProperty('violations_count')
      expect(history[0]).toHaveProperty('sentiment_score')
      expect(history[0]).toHaveProperty('recorded_at')
    })

    it('should return empty array for company with no history', async () => {
      const company = await TestDataFactory.createPortfolioCompany()

      const history = await service.getHealthHistory(company.id)

      expect(history).toBeInstanceOf(Array)
      expect(history.length).toBe(0)
    })
  })

  describe('getStats', () => {
    it('should return portfolio statistics', async () => {
      await TestDataFactory.createPortfolioCompany({ fundedAmount: 1000000, healthGrade: 'A' })
      await TestDataFactory.createPortfolioCompany({ fundedAmount: 2000000, healthGrade: 'B' })
      await TestDataFactory.createPortfolioCompany({ fundedAmount: 1500000, healthGrade: 'A' })

      const stats = await service.getStats()

      expect(stats).toBeDefined()
      expect(stats.total_companies).toBe(3)
      expect(stats.total_funded).toBe(4500000)
      expect(stats.grade_a_count).toBe(2)
      expect(stats.grade_b_count).toBe(1)
    })

    it('should calculate average health score', async () => {
      await TestDataFactory.createPortfolioCompany({ healthScore: 80 })
      await TestDataFactory.createPortfolioCompany({ healthScore: 90 })
      await TestDataFactory.createPortfolioCompany({ healthScore: 85 })

      const stats = await service.getStats()

      expect(stats.avg_health_score).toBeCloseTo(85, 0)
    })

    it('should count companies by health trend', async () => {
      await TestDataFactory.createPortfolioCompany({ healthTrend: 'improving' })
      await TestDataFactory.createPortfolioCompany({ healthTrend: 'improving' })
      await TestDataFactory.createPortfolioCompany({ healthTrend: 'stable' })
      await TestDataFactory.createPortfolioCompany({ healthTrend: 'declining' })

      const stats = await service.getStats()

      expect(stats.improving_count).toBe(2)
      expect(stats.stable_count).toBe(1)
      expect(stats.declining_count).toBe(1)
    })

    it('should count companies by all health grades', async () => {
      await TestDataFactory.createPortfolioCompany({ healthGrade: 'A' })
      await TestDataFactory.createPortfolioCompany({ healthGrade: 'B' })
      await TestDataFactory.createPortfolioCompany({ healthGrade: 'B' })
      await TestDataFactory.createPortfolioCompany({ healthGrade: 'C' })
      await TestDataFactory.createPortfolioCompany({ healthGrade: 'D' })
      await TestDataFactory.createPortfolioCompany({ healthGrade: 'F' })

      const stats = await service.getStats()

      expect(stats.grade_a_count).toBe(1)
      expect(stats.grade_b_count).toBe(2)
      expect(stats.grade_c_count).toBe(1)
      expect(stats.grade_d_count).toBe(1)
      expect(stats.grade_f_count).toBe(1)
    })

    it('should return zero stats when no companies exist', async () => {
      const stats = await service.getStats()

      expect(stats.total_companies).toBe(0)
      expect(stats.total_funded).toBe(0)
      expect(stats.avg_health_score).toBe(0)
      expect(stats.grade_a_count).toBe(0)
      expect(stats.improving_count).toBe(0)
    })
  })
})
