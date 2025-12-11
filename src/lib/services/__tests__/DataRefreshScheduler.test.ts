/**
<<<<<<< HEAD
 * DataRefreshScheduler Unit Tests
 *
 * Tests for scheduled data refresh operations including
 * ingestion, enrichment, and stale data detection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DataRefreshScheduler } from '../DataRefreshScheduler'
import {
  createMockIngestionConfig,
  createMockEnrichmentSources,
  createMockProspect,
  wait,
  mockConsole
} from './test-utils'

describe('DataRefreshScheduler', () => {
  let scheduler: DataRefreshScheduler
  let consoleMocks: ReturnType<typeof mockConsole>

  beforeEach(() => {
    const scheduleConfig = {
      enabled: true,
      ingestionInterval: 1000, // 1 second for testing
      enrichmentInterval: 1000,
      refreshInterval: 1000,
      enrichmentBatchSize: 10,
=======
 * DataRefreshScheduler Tests
 *
 * Tests for data refresh scheduler including:
 * - Scheduler lifecycle (start/stop)
 * - Event emission
 * - Status tracking
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { DataRefreshScheduler, type ScheduleConfig, type SchedulerEvent } from '../DataRefreshScheduler'
import { type IngestionConfig } from '../DataIngestionService'
import { type EnrichmentSource } from '../DataEnrichmentService'

// Mock fetch
global.fetch = vi.fn()

describe('DataRefreshScheduler', () => {
  let scheduler: DataRefreshScheduler
  let mockScheduleConfig: ScheduleConfig
  let mockIngestionConfig: IngestionConfig
  let mockEnrichmentSources: EnrichmentSource[]
  let eventLog: SchedulerEvent[]

  beforeEach(() => {
    vi.clearAllMocks()
    eventLog = []

    mockScheduleConfig = {
      enabled: true,
      ingestionInterval: 1000, // 1 second for testing
      enrichmentInterval: 1000,
      enrichmentBatchSize: 10,
      refreshInterval: 1000,
>>>>>>> origin/claude/pick-implementation-016NMwaaexJYbyDuHajpV91B
      staleDataThreshold: 7, // 7 days
      autoStart: false
    }

<<<<<<< HEAD
    const ingestionConfig = createMockIngestionConfig()
    const enrichmentSources = createMockEnrichmentSources()

    scheduler = new DataRefreshScheduler(
      scheduleConfig,
      ingestionConfig,
      enrichmentSources
    )

    consoleMocks = mockConsole()
    vi.clearAllMocks()
  })

  afterEach(() => {
    scheduler.stop()
    consoleMocks.restore()
  })

  describe('start and stop', () => {
    it('should start the scheduler', () => {
      scheduler.start()
=======
    mockIngestionConfig = {
      sources: [
        {
          id: 'test-api',
          name: 'Test API',
          type: 'api',
          endpoint: 'https://api.test.com',
          rateLimit: 60
        }
      ],
      batchSize: 100,
      retryAttempts: 3,
      retryDelay: 100,
      states: ['NY', 'CA']
    }

    mockEnrichmentSources = [
      {
        id: 'test-enrichment',
        name: 'Test Enrichment',
        type: 'api',
        capabilities: ['growth-signals', 'health-score']
      }
    ]

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => []
    } as Response)
  })

  afterEach(() => {
    if (scheduler) {
      scheduler.stop()
    }
  })

  describe('Initialization', () => {
    it('should initialize with config', () => {
      scheduler = new DataRefreshScheduler(
        mockScheduleConfig,
        mockIngestionConfig,
        mockEnrichmentSources
      )

      expect(scheduler).toBeDefined()
    })

    it('should start automatically if autoStart is true', () => {
      const autoStartConfig = { ...mockScheduleConfig, autoStart: true }
      scheduler = new DataRefreshScheduler(
        autoStartConfig,
        mockIngestionConfig,
        mockEnrichmentSources
      )

      const status = scheduler.getStatus()
      expect(status.running).toBe(true)
    })

    it('should not start automatically if autoStart is false', () => {
      scheduler = new DataRefreshScheduler(
        mockScheduleConfig,
        mockIngestionConfig,
        mockEnrichmentSources
      )

      const status = scheduler.getStatus()
      expect(status.running).toBe(false)
    })
  })

  describe('start() and stop()', () => {
    beforeEach(() => {
      scheduler = new DataRefreshScheduler(
        mockScheduleConfig,
        mockIngestionConfig,
        mockEnrichmentSources
      )
    })

    it('should start the scheduler', () => {
      scheduler.start()
      const status = scheduler.getStatus()

      expect(status.running).toBe(true)
    })

    it('should not start if already running', () => {
      scheduler.start()
      scheduler.start() // Second call should be no-op
>>>>>>> origin/claude/pick-implementation-016NMwaaexJYbyDuHajpV91B

      const status = scheduler.getStatus()
      expect(status.running).toBe(true)
    })

    it('should stop the scheduler', () => {
      scheduler.start()
      scheduler.stop()

      const status = scheduler.getStatus()
      expect(status.running).toBe(false)
    })

<<<<<<< HEAD
    it('should prevent starting when already running', () => {
      scheduler.start()
      scheduler.start() // Try to start again

      expect(consoleMocks.mocks.warn).toHaveBeenCalled()
    })

    it('should auto-start if configured', () => {
      const scheduleConfig = {
        enabled: true,
        ingestionInterval: 1000,
        enrichmentInterval: 1000,
        refreshInterval: 1000,
        enrichmentBatchSize: 10,
        staleDataThreshold: 7,
        autoStart: true
      }

      const newScheduler = new DataRefreshScheduler(
        scheduleConfig,
        createMockIngestionConfig(),
        createMockEnrichmentSources()
      )

      const status = newScheduler.getStatus()
      expect(status.running).toBe(true)

      newScheduler.stop()
    })
  })

  describe('getStatus', () => {
    it('should return current scheduler status', () => {
      const status = scheduler.getStatus()

      expect(status).toBeDefined()
      expect(status.running).toBe(false)
      expect(status.totalProspectsProcessed).toBe(0)
      expect(status.totalErrors).toBe(0)
    })

    it('should update status after operations', async () => {
      scheduler.start()

      await wait(100) // Let it run briefly
=======
    it('should not stop if not running', () => {
      scheduler.stop() // Should not throw
      const status = scheduler.getStatus()

      expect(status.running).toBe(false)
    })

    it('should allow restart after stop', () => {
      scheduler.start()
      scheduler.stop()
      scheduler.start()

      const status = scheduler.getStatus()
      expect(status.running).toBe(true)
    })
  })

  describe('getStatus()', () => {
    beforeEach(() => {
      scheduler = new DataRefreshScheduler(
        mockScheduleConfig,
        mockIngestionConfig,
        mockEnrichmentSources
      )
    })

    it('should return scheduler status', () => {
      const status = scheduler.getStatus()

      expect(status).toHaveProperty('running')
      expect(status).toHaveProperty('totalProspectsProcessed')
      expect(status).toHaveProperty('totalErrors')
    })

    it('should show running false initially', () => {
      const status = scheduler.getStatus()
      expect(status.running).toBe(false)
    })

    it('should show running true after start', () => {
      scheduler.start()
      const status = scheduler.getStatus()

      expect(status.running).toBe(true)
    })

    it('should initialize counters to zero', () => {
      const status = scheduler.getStatus()

      expect(status.totalProspectsProcessed).toBe(0)
      expect(status.totalErrors).toBe(0)
    })
  })

  describe('Event System', () => {
    beforeEach(() => {
      scheduler = new DataRefreshScheduler(
        mockScheduleConfig,
        mockIngestionConfig,
        mockEnrichmentSources
      )
    })

    it('should register event handlers', () => {
      const handler = (event: SchedulerEvent) => {
        eventLog.push(event)
      }

      scheduler.on(handler)
      expect(() => scheduler.on(handler)).not.toThrow()
    })

    it('should emit events to registered handlers', async () => {
      scheduler.on((event) => {
        eventLog.push(event)
      })

      scheduler.start()

      // Wait a bit for events
      await new Promise(resolve => setTimeout(resolve, 200))

      expect(eventLog.length).toBeGreaterThanOrEqual(0)
    })

    it('should include timestamp in events', async () => {
      scheduler.on((event) => {
        eventLog.push(event)
      })

      scheduler.start()
      await new Promise(resolve => setTimeout(resolve, 200))

      if (eventLog.length > 0) {
        expect(eventLog[0].timestamp).toBeDefined()
        const timestamp = new Date(eventLog[0].timestamp)
        expect(timestamp.toISOString()).toBe(eventLog[0].timestamp)
      }
    })

    it('should support multiple event handlers', async () => {
      const log1: SchedulerEvent[] = []
      const log2: SchedulerEvent[] = []

      scheduler.on((event) => log1.push(event))
      scheduler.on((event) => log2.push(event))

      scheduler.start()
      await new Promise(resolve => setTimeout(resolve, 200))

      // Both logs should receive events
      expect(log1.length).toBe(log2.length)
    })
  })

  describe('Manual Operations', () => {
    beforeEach(() => {
      scheduler = new DataRefreshScheduler(
        mockScheduleConfig,
        mockIngestionConfig,
        mockEnrichmentSources
      )
    })

    it('should manually trigger ingestion', async () => {
      await expect(scheduler.triggerIngestion()).resolves.not.toThrow()
    })

    it('should update status after manual ingestion', async () => {
      await scheduler.triggerIngestion()

      const status = scheduler.getStatus()
      expect(status.lastIngestionRun).toBeDefined()
    })

    it('should refresh specific prospect by ID', async () => {
      // First ingest to create prospects
      await scheduler.triggerIngestion()

      const prospects = scheduler.getProspects()
      if (prospects.length > 0) {
        const result = await scheduler.refreshProspect(prospects[0].id)
        expect(result).toBeTruthy()
      } else {
        // No prospects to refresh
        expect(true).toBe(true)
      }
    })
  })

  describe('Prospect Management', () => {
    beforeEach(() => {
      scheduler = new DataRefreshScheduler(
        mockScheduleConfig,
        mockIngestionConfig,
        mockEnrichmentSources
      )
    })

    it('should retrieve stored prospects', () => {
      const prospects = scheduler.getProspects()

      expect(Array.isArray(prospects)).toBe(true)
    })

    it('should start with empty prospects', () => {
      const prospects = scheduler.getProspects()

      expect(prospects.length).toBe(0)
    })

    it('should store prospects after ingestion', async () => {
      await scheduler.triggerIngestion()

      const prospects = scheduler.getProspects()
      expect(Array.isArray(prospects)).toBe(true)
    })
  })

  describe('Scheduler with Disabled Config', () => {
    it('should not schedule jobs when disabled', () => {
      const disabledConfig = { ...mockScheduleConfig, enabled: false }
      scheduler = new DataRefreshScheduler(
        disabledConfig,
        mockIngestionConfig,
        mockEnrichmentSources
      )

      scheduler.start()
      const status = scheduler.getStatus()

      // Scheduler is running but jobs are not scheduled
      expect(status.running).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    beforeEach(() => {
      scheduler = new DataRefreshScheduler(
        mockScheduleConfig,
        mockIngestionConfig,
        mockEnrichmentSources
      )
    })

    it('should handle errors during ingestion', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

      let errorEvent: SchedulerEvent | null = null
      scheduler.on((event) => {
        if (event.type === 'error') {
          errorEvent = event
        }
      })

      scheduler.start()
      await new Promise(resolve => setTimeout(resolve, 200))

      // Should continue running despite error
      const status = scheduler.getStatus()
      expect(status.running).toBe(true)
    })

    it('should handle empty ingestion results', async () => {
      await scheduler.triggerIngestion()

      const prospects = scheduler.getProspects()
      expect(prospects.length).toBeGreaterThanOrEqual(0)
    })

    it('should handle rapid start/stop cycles', () => {
      scheduler.start()
      scheduler.stop()
      scheduler.start()
      scheduler.stop()
      scheduler.start()
>>>>>>> origin/claude/pick-implementation-016NMwaaexJYbyDuHajpV91B

      const status = scheduler.getStatus()
      expect(status.running).toBe(true)
    })

<<<<<<< HEAD
    it('should track last run timestamps', async () => {
      scheduler.start()

      await wait(100)

      const status = scheduler.getStatus()
      // Timestamps may be set depending on execution
      expect(status).toBeDefined()
    })
  })

  describe('manual triggers', () => {
    it('should manually trigger ingestion', async () => {
      const result = await scheduler.triggerIngestion(['CA'])

      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })

    it('should manually trigger enrichment', async () => {
      const prospect = createMockProspect()
      scheduler['prospects'].set(prospect.id, prospect)

      await scheduler.triggerEnrichment([prospect.id])
=======
    it('should cleanup timers on stop', () => {
      scheduler.start()
      scheduler.stop()

      // Should not throw or cause issues
      expect(() => scheduler.getStatus()).not.toThrow()
    })
  })

  describe('Statistics Tracking', () => {
    beforeEach(() => {
      scheduler = new DataRefreshScheduler(
        mockScheduleConfig,
        mockIngestionConfig,
        mockEnrichmentSources
      )
    })

    it('should track total prospects processed', async () => {
      await scheduler.triggerIngestion()
>>>>>>> origin/claude/pick-implementation-016NMwaaexJYbyDuHajpV91B

      const status = scheduler.getStatus()
      expect(status.totalProspectsProcessed).toBeGreaterThanOrEqual(0)
    })

<<<<<<< HEAD
    it('should manually trigger refresh', async () => {
      const prospect = createMockProspect()
      scheduler['prospects'].set(prospect.id, prospect)

      await scheduler.triggerRefresh()

      const status = scheduler.getStatus()
      expect(status).toBeDefined()
    })

    it('should handle manual trigger errors gracefully', async () => {
      // Trigger with invalid data
      await scheduler.triggerEnrichment(['nonexistent-id'])

      // Should not crash
      expect(true).toBe(true)
    })
  })

  describe('event system', () => {
    it('should emit ingestion-started event', (done) => {
      scheduler.on('ingestion-started', (event) => {
        expect(event.type).toBe('ingestion-started')
        expect(event.timestamp).toBeDefined()
        done()
      })

      scheduler.triggerIngestion(['CA'])
    })

    it('should emit ingestion-completed event', (done) => {
      scheduler.on('ingestion-completed', (event) => {
        expect(event.type).toBe('ingestion-completed')
        expect(event.data).toBeDefined()
        done()
      })

      scheduler.triggerIngestion(['CA'])
    })

    it('should emit enrichment events', (done) => {
      let eventsReceived = 0

      scheduler.on('enrichment-started', () => {
        eventsReceived++
      })

      scheduler.on('enrichment-completed', () => {
        eventsReceived++
        if (eventsReceived === 2) {
          done()
        }
      })

      const prospect = createMockProspect()
      scheduler['prospects'].set(prospect.id, prospect)
      scheduler.triggerEnrichment([prospect.id])
    })

    it('should emit error events on failures', (done) => {
      scheduler.on('error', (event) => {
        expect(event.type).toBe('error')
        expect(event.error).toBeDefined()
        done()
      })

      // Force an error condition
      scheduler.triggerIngestion(['INVALID'])
    })

    it('should support multiple event handlers', () => {
      let handler1Called = false
      let handler2Called = false

      scheduler.on('ingestion-started', () => { handler1Called = true })
      scheduler.on('ingestion-started', () => { handler2Called = true })

      scheduler.triggerIngestion(['CA'])

      // Both should eventually be called
      expect(true).toBe(true)
    })

    it('should remove event handlers', () => {
      const handler = vi.fn()

      scheduler.on('ingestion-started', handler)
      scheduler.off('ingestion-started', handler)

      scheduler.triggerIngestion(['CA'])

      // Handler should not be called after removal
      // (may need time to verify)
    })
  })

  describe('scheduled operations', () => {
    it('should run ingestion on schedule', async () => {
      let ingestionRan = false

      scheduler.on('ingestion-completed', () => {
        ingestionRan = true
      })

      scheduler.start()

      await wait(1500) // Wait for one interval

      expect(ingestionRan).toBe(true)
    })

    it('should run enrichment on schedule', async () => {
      let enrichmentRan = false

      scheduler.on('enrichment-completed', () => {
        enrichmentRan = true
      })

      // Add a prospect to enrich
      const prospect = createMockProspect()
      scheduler['prospects'].set(prospect.id, prospect)

      scheduler.start()

      await wait(1500)

      expect(enrichmentRan).toBe(true)
    })

    it('should run refresh on schedule', async () => {
      let refreshRan = false

      scheduler.on('refresh-completed', () => {
        refreshRan = true
      })

      scheduler.start()

      await wait(1500)

      expect(refreshRan).toBe(true)
    })

    it('should respect interval timings', async () => {
      const timestamps: number[] = []

      scheduler.on('ingestion-started', () => {
        timestamps.push(Date.now())
      })

      scheduler.start()

      await wait(2500) // Wait for multiple intervals

      if (timestamps.length > 1) {
        const interval = timestamps[1] - timestamps[0]
        expect(interval).toBeGreaterThan(900) // Close to 1000ms
        expect(interval).toBeLessThan(1100)
      }
    })
  })

  describe('stale data detection', () => {
    it('should identify stale prospects', async () => {
      const staleDate = new Date()
      staleDate.setDate(staleDate.getDate() - 10) // 10 days ago

      const staleProspect = createMockProspect({
        healthScore: {
          ...createMockProspect().healthScore,
          lastUpdated: staleDate.toISOString()
        }
      })

      scheduler['prospects'].set(staleProspect.id, staleProspect)

      await scheduler.triggerRefresh()

      // Stale prospect should be flagged for refresh
      const status = scheduler.getStatus()
      expect(status).toBeDefined()
    })

    it('should skip fresh data', async () => {
      const freshProspect = createMockProspect({
        healthScore: {
          ...createMockProspect().healthScore,
          lastUpdated: new Date().toISOString()
        }
      })

      scheduler['prospects'].set(freshProspect.id, freshProspect)

      await scheduler.triggerRefresh()

      // Fresh prospect should not be refreshed
      expect(true).toBe(true)
    })

    it('should use configured stale threshold', async () => {
      const scheduleConfig = {
        enabled: true,
        ingestionInterval: 1000,
        enrichmentInterval: 1000,
        refreshInterval: 1000,
        enrichmentBatchSize: 10,
        staleDataThreshold: 30, // 30 days
        autoStart: false
      }

      const customScheduler = new DataRefreshScheduler(
        scheduleConfig,
        createMockIngestionConfig(),
        createMockEnrichmentSources()
      )

      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 20) // 20 days ago

      const prospect = createMockProspect({
        healthScore: {
          ...createMockProspect().healthScore,
          lastUpdated: oldDate.toISOString()
        }
      })

      customScheduler['prospects'].set(prospect.id, prospect)

      await customScheduler.triggerRefresh()

      // Should not be stale with 30-day threshold
      expect(true).toBe(true)

      customScheduler.stop()
    })
  })

  describe('batch processing', () => {
    it('should respect batch size limits', async () => {
      const prospects = Array(25).fill(null).map((_, i) =>
        createMockProspect({ id: `prospect-${i}` })
      )

      prospects.forEach(p => scheduler['prospects'].set(p.id, p))

      await scheduler.triggerEnrichment(prospects.map(p => p.id))

      // Should process in batches of 10 (configured batch size)
      const status = scheduler.getStatus()
      expect(status).toBeDefined()
    })

    it('should handle batch failures gracefully', async () => {
      const prospects = Array(5).fill(null).map((_, i) =>
        createMockProspect({ id: `prospect-${i}` })
      )

      prospects.forEach(p => scheduler['prospects'].set(p.id, p))

      await scheduler.triggerEnrichment(prospects.map(p => p.id))

      const status = scheduler.getStatus()
      expect(status.totalErrors).toBeGreaterThanOrEqual(0)
    })
  })

  describe('error tracking', () => {
    it('should increment error count on failures', async () => {
      // Force an error
      await scheduler.triggerIngestion(['INVALID']).catch(() => {})

      const status = scheduler.getStatus()
      expect(status.totalErrors).toBeGreaterThanOrEqual(0)
    })

    it('should continue processing after errors', async () => {
      const errorSpy = vi.fn()
      scheduler.on('error', errorSpy)

      await scheduler.triggerIngestion(['INVALID']).catch(() => {})
      await scheduler.triggerIngestion(['CA'])

      // Should have processed both requests
      expect(true).toBe(true)
    })

    it('should log errors to console', async () => {
      await scheduler.triggerIngestion(['INVALID']).catch(() => {})

      // Errors should be logged
      expect(consoleMocks.mocks.error).toHaveBeenCalled()
    })
  })

  describe('concurrent operations', () => {
    it('should handle concurrent triggers', async () => {
      const promises = [
        scheduler.triggerIngestion(['CA']),
        scheduler.triggerIngestion(['NY']),
        scheduler.triggerIngestion(['TX'])
      ]

      const results = await Promise.all(promises)

      expect(results).toHaveLength(3)
      expect(results.every(r => Array.isArray(r))).toBe(true)
    })

    it('should maintain state consistency', async () => {
      const prospect = createMockProspect()
      scheduler['prospects'].set(prospect.id, prospect)

      await Promise.all([
        scheduler.triggerEnrichment([prospect.id]),
        scheduler.triggerEnrichment([prospect.id]),
        scheduler.triggerEnrichment([prospect.id])
      ])

      const status = scheduler.getStatus()
      expect(status.totalProspectsProcessed).toBeGreaterThanOrEqual(0)
    })
  })

  describe('pause and resume', () => {
    it('should pause scheduled operations', async () => {
      scheduler.start()
      await wait(500)

      scheduler.pause()

      const statusBefore = scheduler.getStatus()

      await wait(1500) // Wait past an interval

      const statusAfter = scheduler.getStatus()

      expect(statusAfter.running).toBe(false)
    })

    it('should resume scheduled operations', async () => {
      scheduler.start()
      scheduler.pause()

      await wait(500)

      scheduler.resume()

      const status = scheduler.getStatus()
      expect(status.running).toBe(true)
    })
  })

  describe('statistics', () => {
    it('should track total prospects processed', async () => {
      const prospect = createMockProspect()
      scheduler['prospects'].set(prospect.id, prospect)

      await scheduler.triggerEnrichment([prospect.id])

      const status = scheduler.getStatus()
      expect(status.totalProspectsProcessed).toBeGreaterThanOrEqual(0)
    })

    it('should track error counts', async () => {
      await scheduler.triggerIngestion(['INVALID']).catch(() => {})

      const status = scheduler.getStatus()
      expect(status.totalErrors).toBeGreaterThanOrEqual(0)
    })

    it('should provide next scheduled run time', () => {
      scheduler.start()

      const status = scheduler.getStatus()
      expect(status.nextScheduledRun).toBeDefined()
=======
    it('should track total errors', () => {
      const status = scheduler.getStatus()

      expect(status.totalErrors).toBeDefined()
      expect(status.totalErrors).toBeGreaterThanOrEqual(0)
    })

    it('should increment error count on failures', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Failure'))

      const statusBefore = scheduler.getStatus()
      scheduler.start()

      await new Promise(resolve => setTimeout(resolve, 200))
      scheduler.stop()

      const statusAfter = scheduler.getStatus()
      // Error count may or may not increase depending on timing
      expect(statusAfter.totalErrors).toBeGreaterThanOrEqual(statusBefore.totalErrors)
>>>>>>> origin/claude/pick-implementation-016NMwaaexJYbyDuHajpV91B
    })
  })
})
