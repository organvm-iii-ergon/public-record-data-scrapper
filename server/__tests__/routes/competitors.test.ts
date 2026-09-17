import { describe, it, expect, vi, beforeEach } from 'vitest'
import express, { Express } from 'express'
import request from 'supertest'
import { errorHandler } from '../../middleware/errorHandler'

// Create a mock service instance
const mockServiceInstance = {
  list: vi.fn(),
  getById: vi.fn(),
  getAnalysis: vi.fn(),
  getStats: vi.fn()
}

// Mock the CompetitorsService before importing routes
vi.mock('../../services/CompetitorsService', () => {
  return {
    CompetitorsService: class MockCompetitorsService {
      list = mockServiceInstance.list
      getById = mockServiceInstance.getById
      getAnalysis = mockServiceInstance.getAnalysis
      getStats = mockServiceInstance.getStats
    }
  }
})

// Import router after mock is set up
import competitorsRouter from '../../routes/competitors'

describe('Competitors Routes', () => {
  let app: Express

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use('/api/competitors', competitorsRouter)
    app.use(errorHandler)

    // Reset all mocks
    vi.clearAllMocks()
  })

  describe('GET /api/competitors', () => {
    it('returns paginated list of competitors with default params', async () => {
      const mockCompetitors = [
        { id: '1', name: 'Competitor A', filing_count: 100 },
        { id: '2', name: 'Competitor B', filing_count: 80 }
      ]

      mockServiceInstance.list.mockResolvedValueOnce({
        competitors: mockCompetitors,
        page: 1,
        limit: 20,
        total: 2
      })

      const response = await request(app).get('/api/competitors')

      expect(response.status).toBe(200)
      expect(response.body.competitors).toHaveLength(2)
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1
      })
    })

    it('returns empty list when no competitors', async () => {
      mockServiceInstance.list.mockResolvedValueOnce({
        competitors: [],
        page: 1,
        limit: 20,
        total: 0
      })

      const response = await request(app).get('/api/competitors')

      expect(response.status).toBe(200)
      expect(response.body.competitors).toHaveLength(0)
      expect(response.body.pagination.total).toBe(0)
    })

    it('validates sort_by parameter rejects invalid values', async () => {
      const response = await request(app).get('/api/competitors?sort_by=invalid_field')

      expect(response.status).toBe(400)
      expect(response.body.error).toBeDefined()
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('validates state must be 2 characters', async () => {
      const response = await request(app).get('/api/competitors?state=CALIFORNIA')

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('accepts valid sort_by values', async () => {
      mockServiceInstance.list.mockResolvedValueOnce({
        competitors: [],
        page: 1,
        limit: 20,
        total: 0
      })

      const response = await request(app).get('/api/competitors?sort_by=total_amount')

      expect(response.status).toBe(200)
    })
  })

  describe('GET /api/competitors/:id', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000'

    it('returns competitor by ID', async () => {
      const mockCompetitor = {
        id: validUuid,
        name: 'Test Competitor',
        filing_count: 50
      }

      mockServiceInstance.getById.mockResolvedValueOnce(mockCompetitor)

      const response = await request(app).get(`/api/competitors/${validUuid}`)

      expect(response.status).toBe(200)
      expect(response.body).toEqual(mockCompetitor)
      expect(mockServiceInstance.getById).toHaveBeenCalledWith(validUuid)
    })

    it('returns 404 for non-existent competitor', async () => {
      mockServiceInstance.getById.mockResolvedValueOnce(null)

      const response = await request(app).get(`/api/competitors/${validUuid}`)

      expect(response.status).toBe(404)
      expect(response.body.error.code).toBe('NOT_FOUND')
    })

    it('validates UUID format', async () => {
      const response = await request(app).get('/api/competitors/not-a-uuid')

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('GET /api/competitors/:id/analysis', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000'

    it('returns SWOT analysis for competitor', async () => {
      const mockAnalysis = {
        strengths: ['High market share', 'Strong brand'],
        weaknesses: ['Limited geographic coverage'],
        opportunities: ['Growing market', 'New verticals'],
        threats: ['New competitors', 'Regulatory changes']
      }

      mockServiceInstance.getAnalysis.mockResolvedValueOnce(mockAnalysis)

      const response = await request(app).get(`/api/competitors/${validUuid}/analysis`)

      expect(response.status).toBe(200)
      expect(response.body.strengths).toBeDefined()
      expect(response.body.weaknesses).toBeDefined()
      expect(response.body.opportunities).toBeDefined()
      expect(response.body.threats).toBeDefined()
    })

    it('returns 404 when competitor not found', async () => {
      mockServiceInstance.getAnalysis.mockResolvedValueOnce(null)

      const response = await request(app).get(`/api/competitors/${validUuid}/analysis`)

      expect(response.status).toBe(404)
      expect(response.body.error.code).toBe('NOT_FOUND')
    })
  })

  describe('GET /api/competitors/stats/summary', () => {
    it('returns competitor statistics', async () => {
      const mockStats = {
        totalCompetitors: 150,
        totalFilings: 50000,
        averageFilingCount: 333,
        topCompetitor: 'ABC Lending'
      }

      mockServiceInstance.getStats.mockResolvedValueOnce(mockStats)

      const response = await request(app).get('/api/competitors/stats/summary')

      expect(response.status).toBe(200)
      expect(response.body).toEqual(mockStats)
    })

    it('handles service errors gracefully', async () => {
      mockServiceInstance.getStats.mockRejectedValueOnce(new Error('Database error'))

      const response = await request(app).get('/api/competitors/stats/summary')

      expect(response.status).toBe(500)
    })
  })
})
