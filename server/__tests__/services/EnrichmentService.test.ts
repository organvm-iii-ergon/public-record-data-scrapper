import { describe, it, expect, beforeEach } from 'vitest'
import { EnrichmentService } from '../../services/EnrichmentService'
import { TestDataFactory } from '../helpers/testData'
import { database } from '../../database/connection'

// TODO: These tests require database connection - TestDataFactory needs DB
describe.skip('EnrichmentService', () => {
  let service: EnrichmentService

  beforeEach(() => {
    service = new EnrichmentService()
  })

  describe('enrichProspect', () => {
    it('should enrich a prospect with growth signals and health score', async () => {
      const prospect = await TestDataFactory.createProspect()

      const result = await service.enrichProspect(prospect.id)

      expect(result).toBeDefined()
      expect(result.growth_signals).toBeDefined()
      expect(result.health_score).toBeDefined()
      expect(result.estimated_revenue).toBeDefined()
      expect(result.industry_classification).toBeDefined()
    })

    it('should store growth signals in database', async () => {
      const prospect = await TestDataFactory.createProspect()

      await service.enrichProspect(prospect.id)

      const signals = await database.query('SELECT * FROM growth_signals WHERE prospect_id = $1', [
        prospect.id
      ])

      expect(signals.length).toBeGreaterThan(0)
    })

    it('should store health score in database', async () => {
      const prospect = await TestDataFactory.createProspect()

      await service.enrichProspect(prospect.id)

      const healthScores = await database.query(
        'SELECT * FROM health_scores WHERE prospect_id = $1',
        [prospect.id]
      )

      expect(healthScores.length).toBe(1)
      expect(healthScores[0].score).toBeGreaterThanOrEqual(60)
      expect(healthScores[0].score).toBeLessThanOrEqual(100)
    })

    it('should update prospect enrichment timestamp', async () => {
      const prospect = await TestDataFactory.createProspect()

      await service.enrichProspect(prospect.id)

      const updated = await database.query(
        'SELECT last_enriched_at, enrichment_confidence FROM prospects WHERE id = $1',
        [prospect.id]
      )

      expect(updated[0].last_enriched_at).toBeDefined()
      expect(updated[0].enrichment_confidence).toBe(0.85)
    })

    it('should throw error for non-existent prospect', async () => {
      await expect(service.enrichProspect('00000000-0000-0000-0000-000000000000')).rejects.toThrow(
        'Prospect'
      )
    })

    it('should calculate health grade correctly', async () => {
      const prospect = await TestDataFactory.createProspect()

      const result = await service.enrichProspect(prospect.id)

      const validGrades = ['A', 'B', 'C', 'D', 'F']
      expect(validGrades).toContain(result.health_score.grade)

      // Verify grade matches score
      const score = result.health_score.score
      if (score >= 90) expect(result.health_score.grade).toBe('A')
      else if (score >= 80) expect(result.health_score.grade).toBe('B')
      else if (score >= 70) expect(result.health_score.grade).toBe('C')
      else if (score >= 60) expect(result.health_score.grade).toBe('D')
      else expect(result.health_score.grade).toBe('F')
    })
  })

  describe('enrichBatch', () => {
    it('should enrich multiple prospects', async () => {
      const prospects = await TestDataFactory.createProspects(3)
      const prospectIds = prospects.map((p) => p.id)

      const results = await service.enrichBatch(prospectIds)

      expect(results).toBeInstanceOf(Array)
      expect(results.length).toBe(3)
      results.forEach((r) => {
        expect(r.success).toBe(true)
      })
    })

    it('should handle partial failures', async () => {
      const prospect = await TestDataFactory.createProspect()
      const invalidId = '00000000-0000-0000-0000-000000000000'

      const results = await service.enrichBatch([prospect.id, invalidId])

      expect(results.length).toBe(2)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(false)
      expect(results[1].error).toBeDefined()
    })

    it('should return empty array for empty input', async () => {
      const results = await service.enrichBatch([])

      expect(results).toBeInstanceOf(Array)
      expect(results.length).toBe(0)
    })
  })

  describe('triggerRefresh', () => {
    it('should enrich prospects that have never been enriched', async () => {
      await TestDataFactory.createProspects(5)

      const result = await service.triggerRefresh(false)

      expect(result).toBeDefined()
      expect(result.queued).toBe(5)
      expect(result.successful).toBe(5)
      expect(result.failed).toBe(0)
    })

    it('should limit refresh to 100 prospects by default', async () => {
      await TestDataFactory.createProspects(150)

      const result = await service.triggerRefresh(false)

      expect(result.queued).toBe(100)
    })

    it('should force refresh all prospects when force=true', async () => {
      const prospect1 = await TestDataFactory.createProspect()
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const prospect2 = await TestDataFactory.createProspect()

      // Enrich first prospect
      await service.enrichProspect(prospect1.id)

      // Trigger refresh with force
      const result = await service.triggerRefresh(true)

      // Should include both prospects (even the already enriched one)
      expect(result.queued).toBe(2)
    })

    it('should skip recently enriched prospects when force=false', async () => {
      const prospect = await TestDataFactory.createProspect()

      // Enrich the prospect
      await service.enrichProspect(prospect.id)

      // Trigger refresh without force
      const result = await service.triggerRefresh(false)

      // Should skip the recently enriched prospect
      expect(result.queued).toBe(0)
    })
  })

  describe('getStatus', () => {
    it('should return enrichment pipeline status', async () => {
      await TestDataFactory.createProspects(5)
      await TestDataFactory.createProspects(3)

      // Enrich some prospects
      const all = await database.query<{ id: string }>('SELECT id FROM prospects LIMIT 3')
      for (const p of all) {
        await service.enrichProspect(p.id)
      }

      const status = await service.getStatus()

      expect(status).toBeDefined()
      expect(status.total_prospects).toBe(8)
      expect(status.enriched_count).toBe(3)
      expect(status.unenriched_count).toBe(5)
      expect(status.avg_confidence).toBeGreaterThan(0)
    })

    it('should return zero stats when no prospects exist', async () => {
      const status = await service.getStatus()

      expect(status.total_prospects).toBe(0)
      expect(status.enriched_count).toBe(0)
      expect(status.unenriched_count).toBe(0)
      expect(status.avg_confidence).toBe(0)
    })
  })

  describe('getQueueStatus', () => {
    it('should return queue status', async () => {
      const status = await service.getQueueStatus()

      expect(status).toBeDefined()
      expect(status.waiting).toBeDefined()
      expect(status.active).toBeDefined()
      expect(status.completed).toBeDefined()
      expect(status.failed).toBeDefined()
      expect(status.delayed).toBeDefined()
    })

    it('should return mock data in Phase 3', async () => {
      // Phase 3 returns mock queue status
      const status = await service.getQueueStatus()

      expect(status.waiting).toBe(0)
      expect(status.active).toBe(0)
      expect(status.completed).toBe(0)
      expect(status.failed).toBe(0)
      expect(status.delayed).toBe(0)
    })
  })
})
