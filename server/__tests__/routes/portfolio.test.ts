import { describe, it, expect, vi, beforeEach } from 'vitest'
import express, { Express } from 'express'
import request from 'supertest'
import { errorHandler } from '../../middleware/errorHandler'

// Create a mock service instance
const mockServiceInstance = {
  list: vi.fn(),
  getById: vi.fn(),
  getHealthHistory: vi.fn(),
  getStats: vi.fn()
}

// Mock the PortfolioService before importing routes
vi.mock('../../services/PortfolioService', () => {
  return {
    PortfolioService: class MockPortfolioService {
      list = mockServiceInstance.list
      getById = mockServiceInstance.getById
      getHealthHistory = mockServiceInstance.getHealthHistory
      getStats = mockServiceInstance.getStats
    }
  }
})

// Import router after mock is set up
import portfolioRouter from '../../routes/portfolio'

describe('Portfolio Routes', () => {
  let app: Express

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use('/api/portfolio', portfolioRouter)
    app.use(errorHandler)

    // Reset all mocks
    vi.clearAllMocks()
  })

  describe('GET /api/portfolio', () => {
    it('returns paginated list of portfolio companies', async () => {
      const mockCompanies = [
        { id: '1', company_name: 'Company A', health_score: 85, health_grade: 'A' },
        { id: '2', company_name: 'Company B', health_score: 72, health_grade: 'B' }
      ]

      mockServiceInstance.list.mockResolvedValueOnce({
        companies: mockCompanies,
        page: 1,
        limit: 20,
        total: 2
      })

      const response = await request(app).get('/api/portfolio')

      expect(response.status).toBe(200)
      expect(response.body.companies).toHaveLength(2)
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1
      })
    })

    it('returns empty list when no companies', async () => {
      mockServiceInstance.list.mockResolvedValueOnce({
        companies: [],
        page: 1,
        limit: 20,
        total: 0
      })

      const response = await request(app).get('/api/portfolio')

      expect(response.status).toBe(200)
      expect(response.body.companies).toHaveLength(0)
    })

    it('validates health_grade parameter', async () => {
      const response = await request(app).get('/api/portfolio?health_grade=X')

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('accepts valid health_grade values', async () => {
      mockServiceInstance.list.mockResolvedValueOnce({
        companies: [],
        page: 1,
        limit: 20,
        total: 0
      })

      const response = await request(app).get('/api/portfolio?health_grade=A')

      expect(response.status).toBe(200)
    })

    it('validates sort_by parameter', async () => {
      const response = await request(app).get('/api/portfolio?sort_by=invalid')

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('GET /api/portfolio/:id', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000'

    it('returns portfolio company by ID', async () => {
      const mockCompany = {
        id: validUuid,
        company_name: 'Test Company',
        health_score: 85,
        health_grade: 'A',
        funded_date: '2024-01-15',
        funded_amount: 50000
      }

      mockServiceInstance.getById.mockResolvedValueOnce(mockCompany)

      const response = await request(app).get(`/api/portfolio/${validUuid}`)

      expect(response.status).toBe(200)
      expect(response.body).toEqual(mockCompany)
      expect(mockServiceInstance.getById).toHaveBeenCalledWith(validUuid)
    })

    it('returns 404 for non-existent company', async () => {
      mockServiceInstance.getById.mockResolvedValueOnce(null)

      const response = await request(app).get(`/api/portfolio/${validUuid}`)

      expect(response.status).toBe(404)
      expect(response.body.error.code).toBe('NOT_FOUND')
    })

    it('validates UUID format', async () => {
      const response = await request(app).get('/api/portfolio/not-a-uuid')

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('GET /api/portfolio/:id/health-history', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000'

    it('returns health score history', async () => {
      const mockHistory = {
        companyId: validUuid,
        history: [
          { date: '2024-01-01', score: 85, grade: 'A' },
          { date: '2024-02-01', score: 82, grade: 'A' },
          { date: '2024-03-01', score: 78, grade: 'B' }
        ]
      }

      mockServiceInstance.getHealthHistory.mockResolvedValueOnce(mockHistory)

      const response = await request(app).get(`/api/portfolio/${validUuid}/health-history`)

      expect(response.status).toBe(200)
      expect(response.body.history).toHaveLength(3)
      expect(response.body.companyId).toBe(validUuid)
    })

    it('returns empty history for new company', async () => {
      mockServiceInstance.getHealthHistory.mockResolvedValueOnce({
        companyId: validUuid,
        history: []
      })

      const response = await request(app).get(`/api/portfolio/${validUuid}/health-history`)

      expect(response.status).toBe(200)
      expect(response.body.history).toHaveLength(0)
    })
  })

  describe('GET /api/portfolio/stats/summary', () => {
    it('returns portfolio statistics', async () => {
      const mockStats = {
        totalCompanies: 100,
        totalFundedAmount: 5000000,
        averageHealthScore: 75.5,
        gradeDistribution: {
          A: 20,
          B: 35,
          C: 30,
          D: 10,
          F: 5
        }
      }

      mockServiceInstance.getStats.mockResolvedValueOnce(mockStats)

      const response = await request(app).get('/api/portfolio/stats/summary')

      expect(response.status).toBe(200)
      expect(response.body).toEqual(mockStats)
    })

    it('handles service errors gracefully', async () => {
      mockServiceInstance.getStats.mockRejectedValueOnce(new Error('Database error'))

      const response = await request(app).get('/api/portfolio/stats/summary')

      expect(response.status).toBe(500)
    })
  })
})
