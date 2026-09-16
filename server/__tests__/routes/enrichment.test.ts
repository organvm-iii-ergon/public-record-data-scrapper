import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { createTestApp, createAuthHeader } from '../helpers/testApp'
import type { Express } from 'express'

// Use vi.hoisted to ensure mocks are available when vi.mock runs
const {
  mockEnrichProspect,
  mockEnrichBatch,
  mockTriggerRefresh,
  mockGetStatus,
  mockGetQueueStatus,
  mockDeduplicateFilings,
  mockMatchPair,
  mockResolveAndEnrichProspect
} = vi.hoisted(() => ({
  mockEnrichProspect: vi.fn(),
  mockEnrichBatch: vi.fn(),
  mockTriggerRefresh: vi.fn(),
  mockGetStatus: vi.fn(),
  mockGetQueueStatus: vi.fn(),
  mockDeduplicateFilings: vi.fn(),
  mockMatchPair: vi.fn(),
  mockResolveAndEnrichProspect: vi.fn()
}))

// Mock the EnrichmentService
vi.mock('../../services/EnrichmentService', () => ({
  EnrichmentService: class MockEnrichmentService {
    enrichProspect = mockEnrichProspect
    enrichBatch = mockEnrichBatch
    triggerRefresh = mockTriggerRefresh
    getStatus = mockGetStatus
    getQueueStatus = mockGetQueueStatus
  }
}))

// Mock the EntityResolutionService
vi.mock('../../services/EntityResolutionService', () => ({
  entityResolutionService: {
    deduplicateFilings: mockDeduplicateFilings,
    matchPair: mockMatchPair,
    resolveAndEnrichProspect: mockResolveAndEnrichProspect
  }
}))

describe('Enrichment API', () => {
  let app: Express
  let authHeader: string

  beforeEach(() => {
    vi.clearAllMocks()
    app = createTestApp()
    authHeader = createAuthHeader()
  })

  describe('POST /api/enrichment/prospect', () => {
    it('should enrich a single prospect', async () => {
      const mockEnrichment = {
        growth_signals: { hiring: 2, permits: 1, contracts: 0, expansion: 1, equipment: 0 },
        health_score: { score: 85, grade: 'B', trend: 'improving', violations: 0 },
        estimated_revenue: 2500000,
        industry_classification: 'Technology',
        data_sources_used: ['mock-data']
      }

      mockEnrichProspect.mockResolvedValueOnce(mockEnrichment)

      const response = await request(app)
        .post('/api/enrichment/prospect')
        .set('Authorization', authHeader)
        .send({
          prospect_id: '550e8400-e29b-41d4-a716-446655440000'
        })

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('prospect_id')
      expect(response.body).toHaveProperty('enrichment')
      expect(response.body).toHaveProperty('enriched_at')
      expect(response.body.enrichment).toHaveProperty('growth_signals')
      expect(response.body.enrichment).toHaveProperty('health_score')
    })

    it('should validate prospect_id format', async () => {
      const response = await request(app)
        .post('/api/enrichment/prospect')
        .set('Authorization', authHeader)
        .send({
          prospect_id: 'invalid-uuid'
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBeDefined()
    })

    it('should return error for non-existent prospect', async () => {
      mockEnrichProspect.mockRejectedValueOnce(new Error('Prospect not-found not found'))

      const response = await request(app)
        .post('/api/enrichment/prospect')
        .set('Authorization', authHeader)
        .send({
          prospect_id: '00000000-0000-0000-0000-000000000000'
        })

      expect(response.status).toBe(500)
      expect(response.body.error).toBeDefined()
    })

    it('should require authentication', async () => {
      const response = await request(app).post('/api/enrichment/prospect').send({
        prospect_id: '550e8400-e29b-41d4-a716-446655440000'
      })

      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/enrichment/batch', () => {
    it('should enrich multiple prospects', async () => {
      const mockResults = [
        { prospect_id: 'id-1', success: true },
        { prospect_id: 'id-2', success: true },
        { prospect_id: 'id-3', success: true }
      ]

      mockEnrichBatch.mockResolvedValueOnce(mockResults)

      const prospectIds = [
        '550e8400-e29b-41d4-a716-446655440001',
        '550e8400-e29b-41d4-a716-446655440002',
        '550e8400-e29b-41d4-a716-446655440003'
      ]

      const response = await request(app)
        .post('/api/enrichment/batch')
        .set('Authorization', authHeader)
        .send({
          prospect_ids: prospectIds
        })

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('total')
      expect(response.body).toHaveProperty('successful')
      expect(response.body).toHaveProperty('failed')
      expect(response.body).toHaveProperty('results')
      expect(response.body.total).toBe(3)
      expect(response.body.successful).toBe(3)
    })

    it('should handle partial failures in batch', async () => {
      const mockResults = [
        { prospect_id: 'id-1', success: true },
        { prospect_id: 'id-2', success: false, error: 'Not found' }
      ]

      mockEnrichBatch.mockResolvedValueOnce(mockResults)

      const response = await request(app)
        .post('/api/enrichment/batch')
        .set('Authorization', authHeader)
        .send({
          prospect_ids: [
            '550e8400-e29b-41d4-a716-446655440001',
            '00000000-0000-0000-0000-000000000000'
          ]
        })

      expect(response.status).toBe(200)
      expect(response.body.successful).toBe(1)
      expect(response.body.failed).toBe(1)
    })

    it('should validate prospect_ids array', async () => {
      const response = await request(app)
        .post('/api/enrichment/batch')
        .set('Authorization', authHeader)
        .send({
          prospect_ids: [] // empty array
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBeDefined()
    })

    it('should enforce maximum batch size', async () => {
      // Create 101 prospect IDs (max is 100)
      const ids = Array(101)
        .fill(null)
        .map((_, i) => `550e8400-e29b-41d4-a716-4466554400${String(i).padStart(2, '0')}`)

      const response = await request(app)
        .post('/api/enrichment/batch')
        .set('Authorization', authHeader)
        .send({
          prospect_ids: ids
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBeDefined()
    })

    it('should validate UUID format in array', async () => {
      const response = await request(app)
        .post('/api/enrichment/batch')
        .set('Authorization', authHeader)
        .send({
          prospect_ids: ['invalid-uuid', 'another-invalid']
        })

      expect(response.status).toBe(400)
    })
  })

  describe('POST /api/enrichment/refresh', () => {
    it('should trigger data refresh', async () => {
      mockTriggerRefresh.mockResolvedValueOnce({
        queued: 5,
        successful: 5,
        failed: 0
      })

      const response = await request(app)
        .post('/api/enrichment/refresh')
        .set('Authorization', authHeader)
        .send({
          force: false
        })

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('triggered')
      expect(response.body).toHaveProperty('queued')
      expect(response.body).toHaveProperty('successful')
      expect(response.body).toHaveProperty('failed')
      expect(response.body.triggered).toBe(true)
    })

    it('should support force refresh parameter', async () => {
      mockTriggerRefresh.mockResolvedValueOnce({
        queued: 3,
        successful: 3,
        failed: 0
      })

      const response = await request(app)
        .post('/api/enrichment/refresh')
        .set('Authorization', authHeader)
        .send({
          force: true
        })

      expect(response.status).toBe(200)
      expect(response.body.force).toBe(true)

      // Verify service was called with force=true
      expect(mockTriggerRefresh).toHaveBeenCalledWith(true, 'free-tier')
    })

    it('should default force to false', async () => {
      mockTriggerRefresh.mockResolvedValueOnce({
        queued: 0,
        successful: 0,
        failed: 0
      })

      const response = await request(app)
        .post('/api/enrichment/refresh')
        .set('Authorization', authHeader)
        .send({})

      expect(response.status).toBe(200)
      expect(response.body.force).toBe(false)

      // Verify service was called with force=false
      expect(mockTriggerRefresh).toHaveBeenCalledWith(false, 'free-tier')
    })
  })

  describe('GET /api/enrichment/status', () => {
    it('should return enrichment pipeline status', async () => {
      mockGetStatus.mockResolvedValueOnce({
        total_prospects: 5,
        enriched_count: 3,
        unenriched_count: 2,
        stale_count: 1,
        avg_confidence: 0.85
      })

      const response = await request(app)
        .get('/api/enrichment/status')
        .set('Authorization', authHeader)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('total_prospects')
      expect(response.body).toHaveProperty('enriched_count')
      expect(response.body).toHaveProperty('unenriched_count')
      expect(response.body).toHaveProperty('stale_count')
      expect(response.body).toHaveProperty('avg_confidence')
    })

    it('should return zero stats when no prospects exist', async () => {
      mockGetStatus.mockResolvedValueOnce({
        total_prospects: 0,
        enriched_count: 0,
        unenriched_count: 0,
        stale_count: 0,
        avg_confidence: 0
      })

      const response = await request(app)
        .get('/api/enrichment/status')
        .set('Authorization', authHeader)

      expect(response.status).toBe(200)
      expect(response.body.total_prospects).toBe(0)
      expect(response.body.enriched_count).toBe(0)
    })
  })

  describe('GET /api/enrichment/queue', () => {
    it('should return queue status', async () => {
      mockGetQueueStatus.mockResolvedValueOnce({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1
      })

      const response = await request(app)
        .get('/api/enrichment/queue')
        .set('Authorization', authHeader)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('waiting')
      expect(response.body).toHaveProperty('active')
      expect(response.body).toHaveProperty('completed')
      expect(response.body).toHaveProperty('failed')
      expect(response.body).toHaveProperty('delayed')
    })

    it('should return numeric values for all queue states', async () => {
      mockGetQueueStatus.mockResolvedValueOnce({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0
      })

      const response = await request(app)
        .get('/api/enrichment/queue')
        .set('Authorization', authHeader)

      expect(response.status).toBe(200)
      expect(typeof response.body.waiting).toBe('number')
      expect(typeof response.body.active).toBe('number')
      expect(typeof response.body.completed).toBe('number')
      expect(typeof response.body.failed).toBe('number')
      expect(typeof response.body.delayed).toBe('number')
    })
  })

  describe('POST /api/enrichment/resolve-entities', () => {
    it('should deduplicate and link state filings', async () => {
      const mockSummary = {
        totalFilingsProcessed: 2,
        corporateClusters: [
          {
            clusterId: 'corp-1',
            entityType: 'corporate',
            canonicalName: 'Apex Logistics LLC',
            aliases: [],
            primaryState: 'CA',
            states: ['CA', 'TX'],
            filingIds: ['f-1', 'f-2'],
            recordCount: 2,
            enrichment_confidence: 0.92,
            securedParties: ['Rapid Finance'],
            principals: [],
            crossStateLinksCount: 1,
            explanation: 'Linked across 2 states'
          }
        ],
        individualClusters: [],
        crossStateEntities: 1,
        deduplicationRatio: 0.5,
        averageConfidence: 0.92
      }

      mockDeduplicateFilings.mockReturnValueOnce(mockSummary)

      const response = await request(app)
        .post('/api/enrichment/resolve-entities')
        .set('Authorization', authHeader)
        .send({
          filings: [
            {
              id: 'f-1',
              filingDate: '2024-01-01',
              debtorName: 'Apex Logistics LLC',
              state: 'CA',
              securedParty: 'Rapid Finance'
            },
            {
              id: 'f-2',
              filingDate: '2024-02-01',
              debtorName: 'Apex Logistics Inc',
              state: 'TX',
              securedParty: 'Rapid Finance'
            }
          ]
        })

      expect(response.status).toBe(200)
      expect(response.body.totalFilingsProcessed).toBe(2)
      expect(response.body.corporateClusters).toHaveLength(1)
      expect(response.body.corporateClusters[0].enrichment_confidence).toBe(0.92)
    })

    it('should reject invalid filings payload', async () => {
      const response = await request(app)
        .post('/api/enrichment/resolve-entities')
        .set('Authorization', authHeader)
        .send({ filings: [] })

      expect(response.status).toBe(400)
    })
  })

  describe('POST /api/enrichment/match-pair', () => {
    it('should evaluate an entity pair and return match prediction and confidence', async () => {
      const mockPrediction = {
        probability: 0.94,
        score: 94,
        enrichment_confidence: 0.92,
        isMatch: true,
        needsReview: false,
        explanation: 'Exact normalized company name match; Shared secured party',
        featureContributions: { exactNormalizedMatch: 4.5 }
      }

      mockMatchPair.mockReturnValueOnce(mockPrediction)

      const response = await request(app)
        .post('/api/enrichment/match-pair')
        .set('Authorization', authHeader)
        .send({
          entity1: { name: 'Acme Transport LLC', state: 'CA' },
          entity2: { name: 'Acme Transport Inc', state: 'TX' }
        })

      expect(response.status).toBe(200)
      expect(response.body.isMatch).toBe(true)
      expect(response.body.enrichment_confidence).toBe(0.92)
    })
  })

  describe('POST /api/enrichment/resolve-prospect/:id', () => {
    it('should resolve and link cross-state filings for a prospect', async () => {
      const mockResult = {
        prospectId: '550e8400-e29b-41d4-a716-446655440000',
        canonicalName: 'Atlas Corp',
        states: ['CA', 'TX'],
        filingCount: 2,
        newlyLinkedFilings: 1,
        enrichment_confidence: 0.93,
        explanation: 'Multi-state enterprise resolved across 2 states'
      }

      mockResolveAndEnrichProspect.mockResolvedValueOnce(mockResult)

      const response = await request(app)
        .post('/api/enrichment/resolve-prospect/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', authHeader)

      expect(response.status).toBe(200)
      expect(response.body.prospectId).toBe('550e8400-e29b-41d4-a716-446655440000')
      expect(response.body.enrichment_confidence).toBe(0.93)
    })
  })
})
