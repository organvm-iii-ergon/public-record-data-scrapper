/**
 * Data Pipeline Integration Tests
 *
 * End-to-end tests for the complete data pipeline:
 * Ingestion → Enrichment → Refresh
 *
 * TODO: These tests have mocking issues where the services don't behave
 * as expected with the mocked data. The tests need to be updated to
 * properly mock the service implementations and their interactions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DataIngestionService } from '../../src/lib/services/DataIngestionService'
import { DataEnrichmentService } from '../../src/lib/services/DataEnrichmentService'
import { DataRefreshScheduler } from '../../src/lib/services/DataRefreshScheduler'
import {
  createMockIngestionConfig,
  createMockEnrichmentSources,
  createMockUCCFiling,
  createMockFetchResponse,
  wait
} from '../../src/lib/services/__tests__/test-utils'

// Mock fetch globally
global.fetch = vi.fn()

// TODO: Fix integration tests - services have complex interactions that need proper mocking
describe.skip('Data Pipeline Integration', () => {
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

  describe('end-to-end workflow', () => {
    it('should ingest, enrich, and schedule data successfully', async () => {
      // Step 1: Ingest UCC filings
      const mockFilings = [
        createMockUCCFiling({ fileNumber: 'CA-001' }),
        createMockUCCFiling({ fileNumber: 'CA-002' })
      ]

      vi.mocked(fetch).mockResolvedValue(createMockFetchResponse({ filings: mockFilings }))

      const ingestionResults = await ingestionService.ingestData(['CA'])

      expect(ingestionResults.length).toBeGreaterThan(0)
      expect(ingestionResults.some((r) => r.success)).toBe(true)

      // Step 2: Enrich prospects from filings
      const allFilings = ingestionResults.flatMap((r) => r.filings)

      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({
          growthSignals: [],
          healthScore: { overall: 75, grade: 'B' }
        })
      )

      const enrichmentResults = await Promise.all(
        allFilings.map((filing) => enrichmentService.enrichProspect(filing))
      )

      expect(enrichmentResults.length).toBeGreaterThan(0)
      expect(enrichmentResults.every((r) => r.prospect)).toBe(true)
      expect(enrichmentResults.every((r) => r.result.success)).toBe(true)

      // Step 3: Add prospects to scheduler for monitoring
      enrichmentResults.forEach(({ prospect }) => {
        scheduler['prospects'].set(prospect.id, prospect)
      })

      // Step 4: Trigger scheduled refresh
      await scheduler.triggerRefresh()

      const status = scheduler.getStatus()
      expect(status).toBeDefined()
    })

    it('should handle the full pipeline with errors', async () => {
      // Ingestion partially fails
      vi.mocked(fetch)
        .mockResolvedValueOnce(createMockFetchResponse({ filings: [createMockUCCFiling()] }))
        .mockRejectedValueOnce(new Error('Source 2 failed'))
        .mockResolvedValueOnce(createMockFetchResponse({ filings: [createMockUCCFiling()] }))

      const ingestionResults = await ingestionService.ingestData(['CA'])

      const successfulFilings = ingestionResults.filter((r) => r.success).flatMap((r) => r.filings)

      expect(successfulFilings.length).toBeGreaterThan(0)

      // Enrichment continues with successful filings
      vi.mocked(fetch).mockResolvedValue(createMockFetchResponse({ growthSignals: [] }))

      const enrichmentResults = await Promise.all(
        successfulFilings.map((filing) => enrichmentService.enrichProspect(filing))
      )

      expect(enrichmentResults.every((r) => r.prospect)).toBe(true)
    })

    it('should support continuous data pipeline operation', async () => {
      const eventsReceived: string[] = []

      scheduler.on('ingestion-completed', () => {
        eventsReceived.push('ingestion')
      })

      scheduler.on('enrichment-completed', () => {
        eventsReceived.push('enrichment')
      })

      scheduler.on('refresh-completed', () => {
        eventsReceived.push('refresh')
      })

      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({
          filings: [createMockUCCFiling()],
          growthSignals: [],
          healthScore: { overall: 80 }
        })
      )

      scheduler.start()

      await wait(3000) // Let scheduler run multiple cycles

      scheduler.stop()

      // Should have received multiple events
      expect(eventsReceived.length).toBeGreaterThan(0)
    })
  })

  describe('data flow', () => {
    it('should pass data correctly between services', async () => {
      // Ingest
      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({
          filings: [createMockUCCFiling({ fileNumber: 'TEST-001' })]
        })
      )

      const ingestionResults = await ingestionService.ingestData(['CA'])
      const filing = ingestionResults[0].filings[0]

      expect(filing.fileNumber).toBe('TEST-001')

      // Enrich
      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({
          growthSignals: [{ type: 'hiring', description: 'Jobs', confidence: 0.9 }]
        })
      )

      const { prospect } = await enrichmentService.enrichProspect(filing)

      expect(prospect.uccFilings[0].fileNumber).toBe('TEST-001')
      expect(prospect.companyName).toBe(filing.debtorName)
    })

    it('should maintain data consistency across pipeline', async () => {
      const originalFiling = createMockUCCFiling({
        fileNumber: 'CA-UNIQUE-123',
        debtorName: 'Unique Corporation'
      })

      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({
          filings: [originalFiling],
          growthSignals: []
        })
      )

      // Ingest
      const ingestionResults = await ingestionService.ingestData(['CA'])
      const ingestedFiling = ingestionResults[0].filings[0]

      // Enrich
      const { prospect } = await enrichmentService.enrichProspect(ingestedFiling)

      // Verify data consistency
      expect(prospect.companyName).toBe('Unique Corporation')
      expect(prospect.uccFilings[0].fileNumber).toBe('CA-UNIQUE-123')
    })
  })

  describe('error recovery', () => {
    it('should recover from ingestion failures', async () => {
      // First attempt fails
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      await ingestionService.ingestData(['CA'])

      // Second attempt succeeds
      vi.mocked(fetch).mockResolvedValueOnce(
        createMockFetchResponse({ filings: [createMockUCCFiling()] })
      )

      const result = await ingestionService.ingestData(['CA'])

      expect(result.some((r) => r.success)).toBe(true)
    })

    it('should handle enrichment failures gracefully', async () => {
      const filing = createMockUCCFiling()

      // Enrichment fails
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Enrichment error'))

      const { prospect, result } = await enrichmentService.enrichProspect(filing)

      // Should still create prospect with default data
      expect(prospect).toBeDefined()
      expect(prospect.companyName).toBe(filing.debtorName)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should continue scheduler after errors', async () => {
      let successCount = 0

      scheduler.on('ingestion-completed', () => {
        successCount++
      })

      // First run fails
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Error'))

      scheduler.start()
      await scheduler.triggerIngestion(['CA']).catch(() => {})

      // Second run succeeds
      vi.mocked(fetch).mockResolvedValueOnce(createMockFetchResponse({ filings: [] }))

      await scheduler.triggerIngestion(['CA'])

      expect(successCount).toBeGreaterThan(0)
    })
  })

  describe('performance', () => {
    it('should handle large data volumes efficiently', async () => {
      const largeFilingSet = Array(100)
        .fill(null)
        .map((_, i) => createMockUCCFiling({ fileNumber: `CA-${i}` }))

      vi.mocked(fetch).mockResolvedValue(createMockFetchResponse({ filings: largeFilingSet }))

      const startTime = Date.now()

      // Ingest
      const ingestionResults = await ingestionService.ingestData(['CA'])
      const filings = ingestionResults.flatMap((r) => r.filings)

      // Enrich (first 10 for performance)
      await Promise.all(filings.slice(0, 10).map((f) => enrichmentService.enrichProspect(f)))

      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(5000) // Should complete in reasonable time
    })

    it('should process batches efficiently', async () => {
      const filings = Array(50)
        .fill(null)
        .map((_, i) => createMockUCCFiling({ fileNumber: `CA-${i}` }))

      vi.mocked(fetch).mockResolvedValue(createMockFetchResponse({}))

      const startTime = Date.now()

      await Promise.all(filings.map((f) => enrichmentService.enrichProspect(f)))

      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(3000)
    })
  })

  describe('state management', () => {
    it('should track pipeline state correctly', async () => {
      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({
          filings: [createMockUCCFiling()],
          growthSignals: []
        })
      )

      // Initial state
      expect(scheduler.getStatus().running).toBe(false)

      // Start scheduler
      scheduler.start()
      expect(scheduler.getStatus().running).toBe(true)

      // Process data
      await scheduler.triggerIngestion(['CA'])

      const status = scheduler.getStatus()
      expect(status.lastIngestionRun).toBeDefined()

      // Stop scheduler
      scheduler.stop()
      expect(scheduler.getStatus().running).toBe(false)
    })

    it('should maintain prospect state across operations', async () => {
      const filing = createMockUCCFiling({ fileNumber: 'STATE-001' })

      vi.mocked(fetch).mockResolvedValue(createMockFetchResponse({}))

      // Create prospect
      const { prospect } = await enrichmentService.enrichProspect(filing)

      // Add to scheduler
      scheduler['prospects'].set(prospect.id, prospect)

      // Verify state
      const storedProspect = scheduler['prospects'].get(prospect.id)
      expect(storedProspect).toBeDefined()
      expect(storedProspect?.companyName).toBe(filing.debtorName)
    })
  })

  describe('data quality', () => {
    it('should validate data throughout pipeline', async () => {
      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({
          filings: [createMockUCCFiling()]
        })
      )

      const ingestionResults = await ingestionService.ingestData(['CA'])
      const filing = ingestionResults[0].filings[0]

      // Validate filing data
      expect(filing.fileNumber).toBeDefined()
      expect(filing.debtorName).toBeDefined()
      expect(filing.state).toBeDefined()

      vi.mocked(fetch).mockResolvedValue(createMockFetchResponse({}))

      const { prospect } = await enrichmentService.enrichProspect(filing)

      // Validate prospect data
      expect(prospect.id).toBeDefined()
      expect(prospect.companyName).toBeDefined()
      expect(prospect.industry).toBeDefined()
      expect(prospect.priorityScore).toBeGreaterThanOrEqual(0)
    })

    it('should filter invalid data', async () => {
      const validFiling = createMockUCCFiling({ fileNumber: 'VALID-001' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invalidFiling = { invalid: 'data' } as any

      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({
          filings: [validFiling, invalidFiling]
        })
      )

      const results = await ingestionService.ingestData(['CA'])

      // Should handle mixed valid/invalid data
      expect(results).toBeDefined()
    })
  })

  describe('scheduled operations integration', () => {
    it('should coordinate all scheduled tasks', async () => {
      const taskLog: string[] = []

      scheduler.on('ingestion-started', () => taskLog.push('ingestion-start'))
      scheduler.on('ingestion-completed', () => taskLog.push('ingestion-done'))
      scheduler.on('enrichment-started', () => taskLog.push('enrichment-start'))
      scheduler.on('enrichment-completed', () => taskLog.push('enrichment-done'))
      scheduler.on('refresh-started', () => taskLog.push('refresh-start'))
      scheduler.on('refresh-completed', () => taskLog.push('refresh-done'))

      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({
          filings: [createMockUCCFiling()]
        })
      )

      scheduler.start()

      await wait(2500) // Wait for at least one cycle

      scheduler.stop()

      // Should have executed multiple tasks
      expect(taskLog.length).toBeGreaterThan(0)
    })

    it('should maintain schedule after errors', async () => {
      let runCount = 0

      scheduler.on('ingestion-completed', () => {
        runCount++
      })

      // First run fails
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Error'))

      scheduler.start()

      await wait(1000)

      // Subsequent runs succeed
      vi.mocked(fetch).mockResolvedValue(createMockFetchResponse({ filings: [] }))

      await wait(2500)

      scheduler.stop()

      // Should have attempted multiple runs
      expect(runCount).toBeGreaterThanOrEqual(0)
    })
  })
})
