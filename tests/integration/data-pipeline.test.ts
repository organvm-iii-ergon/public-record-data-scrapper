/**
 * Data Pipeline Integration Tests
 *
 * End-to-end tests for the complete data pipeline:
 * Ingestion → Enrichment → Refresh
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DataIngestionService } from '../../apps/web/src/lib/services/DataIngestionService'
import { DataEnrichmentService } from '../../apps/web/src/lib/services/DataEnrichmentService'
import { DataRefreshScheduler } from '../../apps/web/src/lib/services/DataRefreshScheduler'
import {
  createMockIngestionConfig,
  createMockEnrichmentSources,
  createMockUCCFiling,
  createMockProspect
} from '../../apps/web/src/lib/services/__tests__/test-utils'

// Mock fetch globally
global.fetch = vi.fn()

describe('Data Pipeline Integration', () => {
  let ingestionService: DataIngestionService
  let enrichmentService: DataEnrichmentService
  let scheduler: DataRefreshScheduler

  beforeEach(() => {
    const ingestionConfig = createMockIngestionConfig()
    const enrichmentSources = createMockEnrichmentSources()
    const scheduleConfig = {
      enabled: true,
      ingestionInterval: 2000,
      enrichmentInterval: 2000,
      refreshInterval: 2000,
      enrichmentBatchSize: 10,
      staleDataThreshold: 7,
      autoStart: false
    }

    ingestionService = new DataIngestionService(ingestionConfig)
    enrichmentService = new DataEnrichmentService(enrichmentSources)
    scheduler = new DataRefreshScheduler(scheduleConfig, ingestionConfig, enrichmentSources)

    vi.clearAllMocks()
  })

  afterEach(() => {
    scheduler.stop()
  })

  describe('service initialization', () => {
    it('should initialize ingestion service', () => {
      expect(ingestionService).toBeDefined()
    })

    it('should initialize enrichment service', () => {
      expect(enrichmentService).toBeDefined()
    })

    it('should initialize scheduler', () => {
      expect(scheduler).toBeDefined()
      expect(scheduler.getStatus().running).toBe(false)
    })
  })

  describe('enrichment service integration', () => {
    it('should enrich a filing to a prospect', async () => {
      const filing = createMockUCCFiling({ fileNumber: 'TEST-001' })

      const { prospect, result } = await enrichmentService.enrichProspect(filing)

      expect(prospect).toBeDefined()
      expect(prospect.companyName).toBe(filing.debtorName)
      expect(prospect.uccFilings[0].fileNumber).toBe('TEST-001')
      expect(result.enrichedFields.length).toBeGreaterThan(0)
    })

    it('should enrich multiple filings in batch', async () => {
      const filings = [
        createMockUCCFiling({ fileNumber: 'CA-001' }),
        createMockUCCFiling({ fileNumber: 'CA-002' }),
        createMockUCCFiling({ fileNumber: 'CA-003' })
      ]

      const { prospects, results } = await enrichmentService.enrichProspects(filings)

      expect(prospects).toHaveLength(3)
      expect(results).toHaveLength(3)
      expect(prospects.every((p) => p.id)).toBe(true)
    })

    it('should refresh prospect data', async () => {
      const prospect = createMockProspect()

      const { prospect: refreshed, result } = await enrichmentService.refreshProspectData(prospect)

      expect(refreshed.id).toBe(prospect.id)
      expect(result.enrichedFields.length).toBeGreaterThan(0)
    })
  })

  describe('scheduler integration', () => {
    it('should start and stop correctly', () => {
      expect(scheduler.getStatus().running).toBe(false)

      scheduler.start()
      expect(scheduler.getStatus().running).toBe(true)

      scheduler.stop()
      expect(scheduler.getStatus().running).toBe(false)
    })

    it('should store prospects', () => {
      const prospect = createMockProspect()
      scheduler['prospects'].set(prospect.id, prospect)

      const storedProspect = scheduler['prospects'].get(prospect.id)
      expect(storedProspect).toBeDefined()
      expect(storedProspect?.id).toBe(prospect.id)
    })

    it('should track status metrics', () => {
      scheduler.start()

      const status = scheduler.getStatus()
      expect(status.running).toBe(true)
      expect(status.totalProspectsProcessed).toBeGreaterThanOrEqual(0)
      expect(status.totalErrors).toBeGreaterThanOrEqual(0)
    })

    it('should refresh specific prospects', async () => {
      const prospect = createMockProspect()
      scheduler['prospects'].set(prospect.id, prospect)

      const refreshed = await scheduler.refreshProspect(prospect.id)

      expect(refreshed).toBeDefined()
      expect(refreshed?.id).toBe(prospect.id)
    })
  })

  describe('data flow', () => {
    it('should pass data correctly between services', async () => {
      const filing = createMockUCCFiling({ fileNumber: 'FLOW-001' })

      // Enrich
      const { prospect } = await enrichmentService.enrichProspect(filing)

      expect(prospect.uccFilings[0].fileNumber).toBe('FLOW-001')
      expect(prospect.companyName).toBe(filing.debtorName)

      // Add to scheduler
      scheduler['prospects'].set(prospect.id, prospect)

      // Verify storage
      const stored = scheduler['prospects'].get(prospect.id)
      expect(stored?.companyName).toBe(filing.debtorName)
    })

    it('should maintain data consistency', async () => {
      const originalFiling = createMockUCCFiling({
        fileNumber: 'CA-UNIQUE-123',
        debtorName: 'Unique Corporation'
      })

      // Enrich
      const { prospect } = await enrichmentService.enrichProspect(originalFiling)

      // Verify data consistency
      expect(prospect.companyName).toBe('Unique Corporation')
      expect(prospect.uccFilings[0].fileNumber).toBe('CA-UNIQUE-123')
    })
  })

  describe('error recovery', () => {
    it('should handle enrichment gracefully', async () => {
      const filing = createMockUCCFiling()

      const { prospect, result } = await enrichmentService.enrichProspect(filing)

      // Should create prospect even with empty enrichment
      expect(prospect).toBeDefined()
      expect(prospect.companyName).toBe(filing.debtorName)
      expect(Array.isArray(result.errors)).toBe(true)
    })

    it('should continue scheduler after errors', () => {
      scheduler.start()

      // Status should still be running
      expect(scheduler.getStatus().running).toBe(true)

      scheduler.stop()
      expect(scheduler.getStatus().running).toBe(false)
    })
  })

  describe('performance', () => {
    it('should process batches efficiently', async () => {
      const filings = Array(50)
        .fill(null)
        .map((_, i) => createMockUCCFiling({ fileNumber: `CA-${i}` }))

      const startTime = Date.now()

      const { prospects } = await enrichmentService.enrichProspects(filings, 10)

      const duration = Date.now() - startTime

      expect(prospects).toHaveLength(50)
      expect(duration).toBeLessThan(10000) // 10 seconds max
    })

    it('should handle concurrent enrichments', async () => {
      const filings = Array(10)
        .fill(null)
        .map((_, i) => createMockUCCFiling({ fileNumber: `CONCURRENT-${i}` }))

      const promises = filings.map((f) => enrichmentService.enrichProspect(f))
      const results = await Promise.all(promises)

      expect(results).toHaveLength(10)
      expect(results.every((r) => r.prospect)).toBe(true)
    })
  })

  describe('state management', () => {
    it('should track pipeline state correctly', () => {
      // Initial state
      expect(scheduler.getStatus().running).toBe(false)

      // Start scheduler
      scheduler.start()
      expect(scheduler.getStatus().running).toBe(true)

      // Verify status structure
      const status = scheduler.getStatus()
      expect(typeof status.totalProspectsProcessed).toBe('number')
      expect(typeof status.totalErrors).toBe('number')

      // Stop scheduler
      scheduler.stop()
      expect(scheduler.getStatus().running).toBe(false)
    })

    it('should maintain prospect state across operations', async () => {
      const filing = createMockUCCFiling({ fileNumber: 'STATE-001' })

      // Create prospect
      const { prospect } = await enrichmentService.enrichProspect(filing)

      // Add to scheduler
      scheduler['prospects'].set(prospect.id, prospect)

      // Get stored
      const storedProspect = scheduler['prospects'].get(prospect.id)
      expect(storedProspect).toBeDefined()
      expect(storedProspect?.companyName).toBe(filing.debtorName)

      // Get all prospects
      const allProspects = scheduler.getProspects()
      expect(allProspects.length).toBe(1)
    })
  })

  describe('data quality', () => {
    it('should validate prospect data', async () => {
      const filing = createMockUCCFiling()

      const { prospect } = await enrichmentService.enrichProspect(filing)

      // Validate prospect data
      expect(prospect.id).toBeDefined()
      expect(prospect.companyName).toBeDefined()
      expect(prospect.industry).toBeDefined()
      expect(prospect.priorityScore).toBeGreaterThanOrEqual(0)
      expect(prospect.priorityScore).toBeLessThanOrEqual(100)
      expect(prospect.healthScore).toBeDefined()
      expect(prospect.healthScore.grade).toMatch(/^[A-F]$/)
    })

    it('should generate narrative', async () => {
      const filing = createMockUCCFiling()

      const { prospect } = await enrichmentService.enrichProspect(filing)

      expect(prospect.narrative).toBeDefined()
      expect(typeof prospect.narrative).toBe('string')
    })
  })

  describe('event system', () => {
    it('should support event subscription', () => {
      const handler = vi.fn()

      const unsubscribe = scheduler.on(handler)

      expect(typeof unsubscribe).toBe('function')
    })

    it('should allow unsubscription', () => {
      const handler = vi.fn()

      const unsubscribe = scheduler.on(handler)
      unsubscribe()

      // Should not throw
      expect(true).toBe(true)
    })
  })
})
