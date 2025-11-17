import { describe, it, expect, beforeEach } from 'vitest'
import { ApiTestHelper } from '../helpers/apiHelper'
import { TestDataFactory } from '../helpers/testData'

describe('Enrichment API', () => {
  let api: ApiTestHelper

  beforeEach(() => {
    api = new ApiTestHelper()
  })

  describe('POST /api/enrichment/prospect', () => {
    it('should enrich a single prospect', async () => {
      const prospect = await TestDataFactory.createProspect()

      const response = await api.post('/api/enrichment/prospect', {
        prospect_id: prospect.id
      })

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('prospect_id')
      expect(response.body).toHaveProperty('enrichment')
      expect(response.body).toHaveProperty('enriched_at')
      expect(response.body.enrichment).toHaveProperty('growth_signals')
      expect(response.body.enrichment).toHaveProperty('health_score')
    })

    it('should validate prospect_id format', async () => {
      const response = await api.post('/api/enrichment/prospect', {
        prospect_id: 'invalid-uuid'
      })

      expect(response.status).toBe(400)
      expect(response.body.error).toBeDefined()
    })

    it('should return error for non-existent prospect', async () => {
      const response = await api.post('/api/enrichment/prospect', {
        prospect_id: '00000000-0000-0000-0000-000000000000'
      })

      expect(response.status).toBe(500)
      expect(response.body.error).toBeDefined()
    })
  })

  describe('POST /api/enrichment/batch', () => {
    it('should enrich multiple prospects', async () => {
      const prospects = await TestDataFactory.createProspects(3)
      const prospectIds = prospects.map(p => p.id)

      const response = await api.post('/api/enrichment/batch', {
        prospect_ids: prospectIds
      })

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('total')
      expect(response.body).toHaveProperty('successful')
      expect(response.body).toHaveProperty('failed')
      expect(response.body).toHaveProperty('results')
      expect(response.body.total).toBe(3)
      expect(response.body.results.length).toBe(3)
    })

    it('should handle partial failures in batch', async () => {
      const prospect = await TestDataFactory.createProspect()
      const invalidId = '00000000-0000-0000-0000-000000000000'

      const response = await api.post('/api/enrichment/batch', {
        prospect_ids: [prospect.id, invalidId]
      })

      expect(response.status).toBe(200)
      expect(response.body.successful).toBe(1)
      expect(response.body.failed).toBe(1)
    })

    it('should validate prospect_ids array', async () => {
      const response = await api.post('/api/enrichment/batch', {
        prospect_ids: []  // empty array
      })

      expect(response.status).toBe(400)
      expect(response.body.error).toBeDefined()
    })

    it('should enforce maximum batch size', async () => {
      // Create 101 prospect IDs (max is 100)
      const ids = Array(101).fill('00000000-0000-0000-0000-000000000000')

      const response = await api.post('/api/enrichment/batch', {
        prospect_ids: ids
      })

      expect(response.status).toBe(400)
      expect(response.body.error).toBeDefined()
    })

    it('should validate UUID format in array', async () => {
      const response = await api.post('/api/enrichment/batch', {
        prospect_ids: ['invalid-uuid', 'another-invalid']
      })

      expect(response.status).toBe(400)
    })
  })

  describe('POST /api/enrichment/refresh', () => {
    it('should trigger data refresh', async () => {
      await TestDataFactory.createProspects(5)

      const response = await api.post('/api/enrichment/refresh', {
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
      await TestDataFactory.createProspects(3)

      const response = await api.post('/api/enrichment/refresh', {
        force: true
      })

      expect(response.status).toBe(200)
      expect(response.body.force).toBe(true)
    })

    it('should default force to false', async () => {
      const response = await api.post('/api/enrichment/refresh', {})

      expect(response.status).toBe(200)
      expect(response.body.force).toBe(false)
    })
  })

  describe('GET /api/enrichment/status', () => {
    it('should return enrichment pipeline status', async () => {
      await TestDataFactory.createProspects(5)

      const response = await api.get('/api/enrichment/status')

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('total_prospects')
      expect(response.body).toHaveProperty('enriched_count')
      expect(response.body).toHaveProperty('unenriched_count')
      expect(response.body).toHaveProperty('stale_count')
      expect(response.body).toHaveProperty('avg_confidence')
    })

    it('should return zero stats when no prospects exist', async () => {
      const response = await api.get('/api/enrichment/status')

      expect(response.status).toBe(200)
      expect(response.body.total_prospects).toBe(0)
      expect(response.body.enriched_count).toBe(0)
      expect(response.body.unenriched_count).toBe(0)
    })
  })

  describe('GET /api/enrichment/queue', () => {
    it('should return queue status', async () => {
      const response = await api.get('/api/enrichment/queue')

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('waiting')
      expect(response.body).toHaveProperty('active')
      expect(response.body).toHaveProperty('completed')
      expect(response.body).toHaveProperty('failed')
      expect(response.body).toHaveProperty('delayed')
    })

    it('should return numeric values for all queue states', async () => {
      const response = await api.get('/api/enrichment/queue')

      expect(response.status).toBe(200)
      expect(typeof response.body.waiting).toBe('number')
      expect(typeof response.body.active).toBe('number')
      expect(typeof response.body.completed).toBe('number')
      expect(typeof response.body.failed).toBe('number')
      expect(typeof response.body.delayed).toBe('number')
    })
  })
})
