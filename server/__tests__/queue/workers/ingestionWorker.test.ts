/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi, MockInstance } from 'vitest'

// Check if bullmq is available
let bullmqAvailable = false
try {
  require.resolve('bullmq')
  bullmqAvailable = true
} catch {
  bullmqAvailable = false
}

const describeConditional = bullmqAvailable ? describe : describe.skip

// Hoisted mocks
const mocks = vi.hoisted(() => {
  const mockWorkerOn = vi.fn()
  const mockUpdateProgress = vi.fn().mockResolvedValue(undefined)

  class MockWorker {
    name: string
    processor: (job: any) => Promise<void>
    opts: Record<string, unknown>
    on = mockWorkerOn

    constructor(
      name: string,
      processor: (job: any) => Promise<void>,
      opts: Record<string, unknown>
    ) {
      this.name = name
      this.processor = processor
      this.opts = opts
    }
  }

  return {
    MockWorker,
    mockWorkerOn,
    mockUpdateProgress,
    mockDatabaseQuery: vi.fn(),
    mockRedisConnect: vi.fn().mockReturnValue({ client: {}, subscriber: {} })
  }
})

vi.mock('bullmq', () => ({
  Worker: mocks.MockWorker
}))

vi.mock('../../../queue/connection', () => ({
  redisConnection: {
    connect: mocks.mockRedisConnect
  }
}))

vi.mock('../../../database/connection', () => ({
  database: {
    query: mocks.mockDatabaseQuery
  }
}))

describeConditional('Ingestion Worker', () => {
  let consoleSpy: MockInstance
  let consoleErrorSpy: MockInstance

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.mockDatabaseQuery.mockResolvedValue([])
  })

  afterEach(() => {
    consoleSpy.mockRestore()
    consoleErrorSpy.mockRestore()
    vi.useRealTimers()
    vi.resetModules()
  })

  describe('createIngestionWorker', () => {
    it('should create worker with correct queue name', async () => {
      const { createIngestionWorker } = await import('../../../queue/workers/ingestionWorker')

      const worker = createIngestionWorker()

      expect(worker.name).toBe('ucc-ingestion')
    })

    it('should connect to Redis', async () => {
      const { createIngestionWorker } = await import('../../../queue/workers/ingestionWorker')

      createIngestionWorker()

      expect(mocks.mockRedisConnect).toHaveBeenCalled()
    })

    it('should configure worker with concurrency 2', async () => {
      const { createIngestionWorker } = await import('../../../queue/workers/ingestionWorker')

      const worker = createIngestionWorker()

      expect(worker.opts).toMatchObject({
        concurrency: 2
      })
    })

    it('should configure rate limiter to 10 jobs per minute', async () => {
      const { createIngestionWorker } = await import('../../../queue/workers/ingestionWorker')

      const worker = createIngestionWorker()

      expect(worker.opts).toMatchObject({
        limiter: {
          max: 10,
          duration: 60000
        }
      })
    })

    it('should register completed event handler', async () => {
      const { createIngestionWorker } = await import('../../../queue/workers/ingestionWorker')

      createIngestionWorker()

      expect(mocks.mockWorkerOn).toHaveBeenCalledWith('completed', expect.any(Function))
    })

    it('should register failed event handler', async () => {
      const { createIngestionWorker } = await import('../../../queue/workers/ingestionWorker')

      createIngestionWorker()

      expect(mocks.mockWorkerOn).toHaveBeenCalledWith('failed', expect.any(Function))
    })

    it('should register error event handler', async () => {
      const { createIngestionWorker } = await import('../../../queue/workers/ingestionWorker')

      createIngestionWorker()

      expect(mocks.mockWorkerOn).toHaveBeenCalledWith('error', expect.any(Function))
    })

    it('should log worker started message', async () => {
      const { createIngestionWorker } = await import('../../../queue/workers/ingestionWorker')

      createIngestionWorker()

      expect(consoleSpy).toHaveBeenCalledWith('✓ Ingestion worker started')
    })
  })

  describe('processIngestion', () => {
    it('should update progress from 0 to 100', async () => {
      const { createIngestionWorker } = await import('../../../queue/workers/ingestionWorker')

      const worker = createIngestionWorker()
      const mockJob = {
        id: 'test-job-1',
        data: { state: 'NY', batchSize: 1000 },
        updateProgress: mocks.mockUpdateProgress
      }

      const processPromise = worker.processor(mockJob)
      await vi.runAllTimersAsync()
      await processPromise

      // Check progress updates: 0, 25, 50, 75, 100
      expect(mocks.mockUpdateProgress).toHaveBeenCalledWith(0)
      expect(mocks.mockUpdateProgress).toHaveBeenCalledWith(25)
      expect(mocks.mockUpdateProgress).toHaveBeenCalledWith(50)
      expect(mocks.mockUpdateProgress).toHaveBeenCalledWith(75)
      expect(mocks.mockUpdateProgress).toHaveBeenCalledWith(100)
    })

    it('should log start message with state', async () => {
      const { createIngestionWorker } = await import('../../../queue/workers/ingestionWorker')

      const worker = createIngestionWorker()
      const mockJob = {
        id: 'test-job-1',
        data: { state: 'CA' },
        updateProgress: mocks.mockUpdateProgress
      }

      const processPromise = worker.processor(mockJob)
      await vi.runAllTimersAsync()
      await processPromise

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Ingestion Worker] Starting UCC ingestion for state: CA'
      )
    })

    it('should insert success log into database', async () => {
      const { createIngestionWorker } = await import('../../../queue/workers/ingestionWorker')

      const worker = createIngestionWorker()
      const mockJob = {
        id: 'test-job-1',
        data: { state: 'TX', batchSize: 500 },
        updateProgress: mocks.mockUpdateProgress
      }

      const processPromise = worker.processor(mockJob)
      await vi.runAllTimersAsync()
      await processPromise

      expect(mocks.mockDatabaseQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO data_ingestion_logs'),
        expect.arrayContaining([
          'ucc_tx',
          'success',
          expect.any(Number),
          expect.stringContaining('"state":"TX"')
        ])
      )
    })

    it('should use default batchSize of 1000', async () => {
      const { createIngestionWorker } = await import('../../../queue/workers/ingestionWorker')

      const worker = createIngestionWorker()
      const mockJob = {
        id: 'test-job-1',
        data: { state: 'FL' },
        updateProgress: mocks.mockUpdateProgress
      }

      const processPromise = worker.processor(mockJob)
      await vi.runAllTimersAsync()
      await processPromise

      expect(mocks.mockDatabaseQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.any(String),
          'success',
          expect.any(Number),
          expect.stringContaining('"batchSize":1000')
        ])
      )
    })

    it('should include date range in metadata', async () => {
      const { createIngestionWorker } = await import('../../../queue/workers/ingestionWorker')

      const worker = createIngestionWorker()
      const mockJob = {
        id: 'test-job-1',
        data: { state: 'NY', startDate: '2024-01-01', endDate: '2024-01-31' },
        updateProgress: mocks.mockUpdateProgress
      }

      const processPromise = worker.processor(mockJob)
      await vi.runAllTimersAsync()
      await processPromise

      expect(mocks.mockDatabaseQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.any(String),
          'success',
          expect.any(Number),
          expect.stringContaining('"startDate":"2024-01-01"')
        ])
      )
    })

    it('should handle errors and log failure', async () => {
      mocks.mockDatabaseQuery
        .mockRejectedValueOnce(new Error('DB connection failed'))
        .mockResolvedValue([])

      const { createIngestionWorker } = await import('../../../queue/workers/ingestionWorker')

      const worker = createIngestionWorker()
      const mockJob = {
        id: 'test-job-1',
        data: { state: 'OH' },
        updateProgress: mocks.mockUpdateProgress
      }

      // Start processing and attach error handler immediately
      const processPromise = worker.processor(mockJob).catch((e) => e)
      await vi.runAllTimersAsync()
      const error = await processPromise

      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe('DB connection failed')
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Ingestion Worker] Error processing OH:',
        expect.any(Error)
      )
    })

    it('should insert failure log on error', async () => {
      mocks.mockDatabaseQuery
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValue([])

      const { createIngestionWorker } = await import('../../../queue/workers/ingestionWorker')

      const worker = createIngestionWorker()
      const mockJob = {
        id: 'test-job-1',
        data: { state: 'PA' },
        updateProgress: mocks.mockUpdateProgress
      }

      // Start processing and attach error handler immediately
      const processPromise = worker.processor(mockJob).catch((e) => e)
      await vi.runAllTimersAsync()
      const error = await processPromise

      expect(error).toBeInstanceOf(Error)
      expect(mocks.mockDatabaseQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO data_ingestion_logs'),
        expect.arrayContaining(['ucc_pa', 'failed', 'Database error'])
      )
    })

    it('should generate mock filings count between 50 and 150', async () => {
      const { createIngestionWorker } = await import('../../../queue/workers/ingestionWorker')

      const worker = createIngestionWorker()
      const mockJob = {
        id: 'test-job-1',
        data: { state: 'GA' },
        updateProgress: mocks.mockUpdateProgress
      }

      const processPromise = worker.processor(mockJob)
      await vi.runAllTimersAsync()
      await processPromise

      const insertCall = mocks.mockDatabaseQuery.mock.calls.find((call) =>
        call[0].includes('INSERT INTO data_ingestion_logs')
      )
      const recordsProcessed = insertCall?.[1]?.[2]

      expect(recordsProcessed).toBeGreaterThanOrEqual(50)
      expect(recordsProcessed).toBeLessThan(150)
    })
  })

  describe('event handlers', () => {
    it('completed handler should log job ID', async () => {
      const { createIngestionWorker } = await import('../../../queue/workers/ingestionWorker')

      createIngestionWorker()

      const completedHandler = mocks.mockWorkerOn.mock.calls.find(
        (call) => call[0] === 'completed'
      )?.[1]

      completedHandler({ id: 'job-123' })

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Ingestion Worker] Job job-123 completed successfully'
      )
    })

    it('failed handler should log job ID and error', async () => {
      const { createIngestionWorker } = await import('../../../queue/workers/ingestionWorker')

      createIngestionWorker()

      const failedHandler = mocks.mockWorkerOn.mock.calls.find((call) => call[0] === 'failed')?.[1]

      failedHandler({ id: 'job-456' }, new Error('Processing failed'))

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Ingestion Worker] Job job-456 failed:',
        'Processing failed'
      )
    })

    it('failed handler should handle null job', async () => {
      const { createIngestionWorker } = await import('../../../queue/workers/ingestionWorker')

      createIngestionWorker()

      const failedHandler = mocks.mockWorkerOn.mock.calls.find((call) => call[0] === 'failed')?.[1]

      failedHandler(null, new Error('Unknown error'))

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Ingestion Worker] Job undefined failed:',
        'Unknown error'
      )
    })

    it('error handler should log worker error', async () => {
      const { createIngestionWorker } = await import('../../../queue/workers/ingestionWorker')

      createIngestionWorker()

      const errorHandler = mocks.mockWorkerOn.mock.calls.find((call) => call[0] === 'error')?.[1]

      errorHandler(new Error('Worker crashed'))

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Ingestion Worker] Worker error:',
        expect.any(Error)
      )
    })
  })
})

// Dependency check test
describe('Ingestion Worker Tests - Dependency Check', () => {
  it.skipIf(!bullmqAvailable)('should run when bullmq is installed', () => {
    expect(true).toBe(true)
  })

  it.skipIf(bullmqAvailable)('skips tests because bullmq is not installed', () => {
    console.log('Ingestion worker tests skipped: bullmq package not installed')
    expect(true).toBe(true)
  })
})
