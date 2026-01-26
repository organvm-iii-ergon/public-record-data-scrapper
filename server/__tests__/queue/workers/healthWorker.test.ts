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

describeConditional('Health Score Worker', () => {
  let consoleSpy: MockInstance
  let consoleErrorSpy: MockInstance

  beforeEach(() => {
    vi.clearAllMocks()
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    // Default mock behavior
    mocks.mockDatabaseQuery.mockResolvedValue([])
  })

  afterEach(() => {
    consoleSpy.mockRestore()
    consoleErrorSpy.mockRestore()
    vi.resetModules()
  })

  describe('createHealthWorker', () => {
    it('should create worker with correct queue name', async () => {
      const { createHealthWorker } = await import('../../../queue/workers/healthWorker')

      const worker = createHealthWorker()

      expect(worker.name).toBe('health-scores')
    })

    it('should connect to Redis', async () => {
      const { createHealthWorker } = await import('../../../queue/workers/healthWorker')

      createHealthWorker()

      expect(mocks.mockRedisConnect).toHaveBeenCalled()
    })

    it('should configure worker with concurrency 3', async () => {
      const { createHealthWorker } = await import('../../../queue/workers/healthWorker')

      const worker = createHealthWorker()

      expect(worker.opts).toMatchObject({
        concurrency: 3
      })
    })

    it('should configure rate limiter to 30 jobs per minute', async () => {
      const { createHealthWorker } = await import('../../../queue/workers/healthWorker')

      const worker = createHealthWorker()

      expect(worker.opts).toMatchObject({
        limiter: {
          max: 30,
          duration: 60000
        }
      })
    })

    it('should register all event handlers', async () => {
      const { createHealthWorker } = await import('../../../queue/workers/healthWorker')

      createHealthWorker()

      expect(mocks.mockWorkerOn).toHaveBeenCalledWith('completed', expect.any(Function))
      expect(mocks.mockWorkerOn).toHaveBeenCalledWith('failed', expect.any(Function))
      expect(mocks.mockWorkerOn).toHaveBeenCalledWith('error', expect.any(Function))
    })

    it('should log worker started message', async () => {
      const { createHealthWorker } = await import('../../../queue/workers/healthWorker')

      createHealthWorker()

      expect(consoleSpy).toHaveBeenCalledWith('✓ Health score worker started')
    })
  })

  describe('processHealthScore', () => {
    it('should skip if no companies need updates', async () => {
      mocks.mockDatabaseQuery.mockResolvedValue([])

      const { createHealthWorker } = await import('../../../queue/workers/healthWorker')

      const worker = createHealthWorker()
      const mockJob = {
        id: 'test-job-1',
        data: {},
        updateProgress: mocks.mockUpdateProgress
      }

      await worker.processor(mockJob)

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Health Score Worker] No companies need health score updates'
      )
    })

    it('should fetch single company when portfolioCompanyId provided', async () => {
      mocks.mockDatabaseQuery.mockResolvedValueOnce([
        { id: 'company-1', company_name: 'Test Corp' }
      ])

      const { createHealthWorker } = await import('../../../queue/workers/healthWorker')

      const worker = createHealthWorker()
      const mockJob = {
        id: 'test-job-1',
        data: { portfolioCompanyId: 'company-1' },
        updateProgress: mocks.mockUpdateProgress
      }

      await worker.processor(mockJob)

      expect(mocks.mockDatabaseQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        ['company-1']
      )
    })

    it('should batch process when no specific company ID', async () => {
      mocks.mockDatabaseQuery.mockResolvedValueOnce([
        { id: 'company-1', company_name: 'Corp A' },
        { id: 'company-2', company_name: 'Corp B' }
      ])

      const { createHealthWorker } = await import('../../../queue/workers/healthWorker')

      const worker = createHealthWorker()
      const mockJob = {
        id: 'test-job-1',
        data: { batchSize: 50 },
        updateProgress: mocks.mockUpdateProgress
      }

      await worker.processor(mockJob)

      expect(mocks.mockDatabaseQuery).toHaveBeenCalledWith(
        expect.stringContaining("INTERVAL '12 hours'"),
        [50]
      )
    })

    it('should use default batchSize of 50', async () => {
      mocks.mockDatabaseQuery.mockResolvedValue([])

      const { createHealthWorker } = await import('../../../queue/workers/healthWorker')

      const worker = createHealthWorker()
      const mockJob = {
        id: 'test-job-1',
        data: {},
        updateProgress: mocks.mockUpdateProgress
      }

      await worker.processor(mockJob)

      expect(mocks.mockDatabaseQuery).toHaveBeenCalledWith(expect.any(String), [50])
    })

    it('should update progress as companies are processed', async () => {
      mocks.mockDatabaseQuery
        .mockResolvedValueOnce([
          { id: 'company-1', company_name: 'Corp A' },
          { id: 'company-2', company_name: 'Corp B' }
        ])
        .mockResolvedValue([]) // For growth signals and previous scores

      const { createHealthWorker } = await import('../../../queue/workers/healthWorker')

      const worker = createHealthWorker()
      const mockJob = {
        id: 'test-job-1',
        data: {},
        updateProgress: mocks.mockUpdateProgress
      }

      await worker.processor(mockJob)

      expect(mocks.mockUpdateProgress).toHaveBeenCalledWith(0)
      expect(mocks.mockUpdateProgress).toHaveBeenCalledWith(50)
      expect(mocks.mockUpdateProgress).toHaveBeenCalledWith(100)
    })

    it('should log each company update', async () => {
      mocks.mockDatabaseQuery
        .mockResolvedValueOnce([{ id: 'company-1', company_name: 'Test Corp' }])
        .mockResolvedValue([])

      const { createHealthWorker } = await import('../../../queue/workers/healthWorker')

      const worker = createHealthWorker()
      const mockJob = {
        id: 'test-job-1',
        data: {},
        updateProgress: mocks.mockUpdateProgress
      }

      await worker.processor(mockJob)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[Health Score Worker\] Updated Test Corp: \d+ \([A-F]\) - 1\/1/)
      )
    })

    it('should continue processing after individual company errors', async () => {
      mocks.mockDatabaseQuery
        .mockResolvedValueOnce([
          { id: 'company-1', company_name: 'Corp A' },
          { id: 'company-2', company_name: 'Corp B' }
        ])
        // First company fails
        .mockRejectedValueOnce(new Error('DB error'))
        // Second company succeeds
        .mockResolvedValue([])

      const { createHealthWorker } = await import('../../../queue/workers/healthWorker')

      const worker = createHealthWorker()
      const mockJob = {
        id: 'test-job-1',
        data: {},
        updateProgress: mocks.mockUpdateProgress
      }

      await worker.processor(mockJob)

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Health Score Worker] Failed to process Corp A:',
        expect.any(Error)
      )
      // Should still complete
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[Health Score Worker\] Completed \d+ health score calculations/)
      )
    })
  })

  describe('calculateHealthScore', () => {
    it('should calculate base score of 70', async () => {
      mocks.mockDatabaseQuery
        .mockResolvedValueOnce([{ id: 'company-1', company_name: 'Test Corp' }])
        .mockResolvedValueOnce([]) // growth signals
        .mockResolvedValueOnce([{ count: '0' }]) // violations
        .mockResolvedValueOnce([]) // previous scores
        .mockResolvedValue([]) // updates

      const { createHealthWorker } = await import('../../../queue/workers/healthWorker')

      const worker = createHealthWorker()
      const mockJob = {
        id: 'test-job-1',
        data: {},
        updateProgress: mocks.mockUpdateProgress
      }

      await worker.processor(mockJob)

      // Check UPDATE was called with base score of 70
      const updateCall = mocks.mockDatabaseQuery.mock.calls.find((call) =>
        call[0].includes('UPDATE portfolio_companies')
      )
      expect(updateCall).toBeDefined()
      expect(updateCall?.[1]?.[1]).toBe(70) // score
    })

    it('should add points for growth signals (max +20)', async () => {
      mocks.mockDatabaseQuery
        .mockResolvedValueOnce([{ id: 'company-1', company_name: 'Test Corp' }])
        .mockResolvedValueOnce([
          { count: '5', type: 'revenue_growth' },
          { count: '10', type: 'expansion' }
        ]) // 15 signals = +30, but capped at +20
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([])
        .mockResolvedValue([])

      const { createHealthWorker } = await import('../../../queue/workers/healthWorker')

      const worker = createHealthWorker()
      const mockJob = {
        id: 'test-job-1',
        data: {},
        updateProgress: mocks.mockUpdateProgress
      }

      await worker.processor(mockJob)

      const updateCall = mocks.mockDatabaseQuery.mock.calls.find((call) =>
        call[0].includes('UPDATE portfolio_companies')
      )
      // 70 base + 20 (capped) = 90
      expect(updateCall?.[1]?.[1]).toBe(90)
    })

    it('should deduct points for violations (max -30)', async () => {
      mocks.mockDatabaseQuery
        .mockResolvedValueOnce([{ id: 'company-1', company_name: 'Test Corp' }])
        .mockResolvedValueOnce([]) // no signals
        .mockResolvedValueOnce([{ count: '10' }]) // 10 violations = -50, capped at -30
        .mockResolvedValueOnce([])
        .mockResolvedValue([])

      const { createHealthWorker } = await import('../../../queue/workers/healthWorker')

      const worker = createHealthWorker()
      const mockJob = {
        id: 'test-job-1',
        data: {},
        updateProgress: mocks.mockUpdateProgress
      }

      await worker.processor(mockJob)

      const updateCall = mocks.mockDatabaseQuery.mock.calls.find((call) =>
        call[0].includes('UPDATE portfolio_companies')
      )
      // 70 base - 30 (capped) = 40
      expect(updateCall?.[1]?.[1]).toBe(40)
    })

    it('should clamp score between 0 and 100', async () => {
      mocks.mockDatabaseQuery
        .mockResolvedValueOnce([{ id: 'company-1', company_name: 'Test Corp' }])
        .mockResolvedValueOnce([{ count: '20', type: 'growth' }]) // +40 uncapped
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([])
        .mockResolvedValue([])

      const { createHealthWorker } = await import('../../../queue/workers/healthWorker')

      const worker = createHealthWorker()
      const mockJob = {
        id: 'test-job-1',
        data: {},
        updateProgress: mocks.mockUpdateProgress
      }

      await worker.processor(mockJob)

      const updateCall = mocks.mockDatabaseQuery.mock.calls.find((call) =>
        call[0].includes('UPDATE portfolio_companies')
      )
      // Should not exceed 100
      expect(updateCall?.[1]?.[1]).toBeLessThanOrEqual(100)
    })

    it('should assign grade A for score >= 90', async () => {
      mocks.mockDatabaseQuery
        .mockResolvedValueOnce([{ id: 'company-1', company_name: 'Test Corp' }])
        .mockResolvedValueOnce([{ count: '10', type: 'growth' }]) // +20
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([])
        .mockResolvedValue([])

      const { createHealthWorker } = await import('../../../queue/workers/healthWorker')

      const worker = createHealthWorker()
      const mockJob = {
        id: 'test-job-1',
        data: {},
        updateProgress: mocks.mockUpdateProgress
      }

      await worker.processor(mockJob)

      const updateCall = mocks.mockDatabaseQuery.mock.calls.find((call) =>
        call[0].includes('UPDATE portfolio_companies')
      )
      expect(updateCall?.[1]?.[2]).toBe('A') // grade
    })

    it('should assign grade B for score 80-89', async () => {
      mocks.mockDatabaseQuery
        .mockResolvedValueOnce([{ id: 'company-1', company_name: 'Test Corp' }])
        .mockResolvedValueOnce([{ count: '5', type: 'growth' }]) // +10 -> 80
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([])
        .mockResolvedValue([])

      const { createHealthWorker } = await import('../../../queue/workers/healthWorker')

      const worker = createHealthWorker()
      const mockJob = {
        id: 'test-job-1',
        data: {},
        updateProgress: mocks.mockUpdateProgress
      }

      await worker.processor(mockJob)

      const updateCall = mocks.mockDatabaseQuery.mock.calls.find((call) =>
        call[0].includes('UPDATE portfolio_companies')
      )
      expect(updateCall?.[1]?.[2]).toBe('B')
    })

    it('should assign grade C for score 70-79', async () => {
      mocks.mockDatabaseQuery
        .mockResolvedValueOnce([{ id: 'company-1', company_name: 'Test Corp' }])
        .mockResolvedValueOnce([]) // base 70
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([])
        .mockResolvedValue([])

      const { createHealthWorker } = await import('../../../queue/workers/healthWorker')

      const worker = createHealthWorker()
      const mockJob = {
        id: 'test-job-1',
        data: {},
        updateProgress: mocks.mockUpdateProgress
      }

      await worker.processor(mockJob)

      const updateCall = mocks.mockDatabaseQuery.mock.calls.find((call) =>
        call[0].includes('UPDATE portfolio_companies')
      )
      expect(updateCall?.[1]?.[2]).toBe('C')
    })

    it('should assign grade D for score 60-69', async () => {
      mocks.mockDatabaseQuery
        .mockResolvedValueOnce([{ id: 'company-1', company_name: 'Test Corp' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: '2' }]) // -10 -> 60
        .mockResolvedValueOnce([])
        .mockResolvedValue([])

      const { createHealthWorker } = await import('../../../queue/workers/healthWorker')

      const worker = createHealthWorker()
      const mockJob = {
        id: 'test-job-1',
        data: {},
        updateProgress: mocks.mockUpdateProgress
      }

      await worker.processor(mockJob)

      const updateCall = mocks.mockDatabaseQuery.mock.calls.find((call) =>
        call[0].includes('UPDATE portfolio_companies')
      )
      expect(updateCall?.[1]?.[2]).toBe('D')
    })

    it('should assign grade F for score < 60', async () => {
      mocks.mockDatabaseQuery
        .mockResolvedValueOnce([{ id: 'company-1', company_name: 'Test Corp' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: '3' }]) // -15 -> 55
        .mockResolvedValueOnce([])
        .mockResolvedValue([])

      const { createHealthWorker } = await import('../../../queue/workers/healthWorker')

      const worker = createHealthWorker()
      const mockJob = {
        id: 'test-job-1',
        data: {},
        updateProgress: mocks.mockUpdateProgress
      }

      await worker.processor(mockJob)

      const updateCall = mocks.mockDatabaseQuery.mock.calls.find((call) =>
        call[0].includes('UPDATE portfolio_companies')
      )
      expect(updateCall?.[1]?.[2]).toBe('F')
    })

    it('should determine improving trend when score > avg + 5', async () => {
      mocks.mockDatabaseQuery
        .mockResolvedValueOnce([{ id: 'company-1', company_name: 'Test Corp' }])
        .mockResolvedValueOnce([{ count: '10', type: 'growth' }]) // +20 -> 90
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ score: 75 }, { score: 70 }, { score: 72 }]) // avg = 72.33
        .mockResolvedValue([])

      const { createHealthWorker } = await import('../../../queue/workers/healthWorker')

      const worker = createHealthWorker()
      const mockJob = {
        id: 'test-job-1',
        data: {},
        updateProgress: mocks.mockUpdateProgress
      }

      await worker.processor(mockJob)

      const updateCall = mocks.mockDatabaseQuery.mock.calls.find((call) =>
        call[0].includes('UPDATE portfolio_companies')
      )
      expect(updateCall?.[1]?.[3]).toBe('improving')
    })

    it('should determine declining trend when score < avg - 5', async () => {
      mocks.mockDatabaseQuery
        .mockResolvedValueOnce([{ id: 'company-1', company_name: 'Test Corp' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: '3' }]) // -15 -> 55
        .mockResolvedValueOnce([{ score: 75 }, { score: 70 }]) // avg = 72.5
        .mockResolvedValue([])

      const { createHealthWorker } = await import('../../../queue/workers/healthWorker')

      const worker = createHealthWorker()
      const mockJob = {
        id: 'test-job-1',
        data: {},
        updateProgress: mocks.mockUpdateProgress
      }

      await worker.processor(mockJob)

      const updateCall = mocks.mockDatabaseQuery.mock.calls.find((call) =>
        call[0].includes('UPDATE portfolio_companies')
      )
      expect(updateCall?.[1]?.[3]).toBe('declining')
    })

    it('should determine stable trend when score is within +/-5 of avg', async () => {
      mocks.mockDatabaseQuery
        .mockResolvedValueOnce([{ id: 'company-1', company_name: 'Test Corp' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ score: 70 }, { score: 72 }]) // avg = 71, score = 70
        .mockResolvedValue([])

      const { createHealthWorker } = await import('../../../queue/workers/healthWorker')

      const worker = createHealthWorker()
      const mockJob = {
        id: 'test-job-1',
        data: {},
        updateProgress: mocks.mockUpdateProgress
      }

      await worker.processor(mockJob)

      const updateCall = mocks.mockDatabaseQuery.mock.calls.find((call) =>
        call[0].includes('UPDATE portfolio_companies')
      )
      expect(updateCall?.[1]?.[3]).toBe('stable')
    })

    it('should use stable trend for new companies (< 2 previous scores)', async () => {
      mocks.mockDatabaseQuery
        .mockResolvedValueOnce([{ id: 'company-1', company_name: 'Test Corp' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ score: 70 }]) // Only 1 previous score
        .mockResolvedValue([])

      const { createHealthWorker } = await import('../../../queue/workers/healthWorker')

      const worker = createHealthWorker()
      const mockJob = {
        id: 'test-job-1',
        data: {},
        updateProgress: mocks.mockUpdateProgress
      }

      await worker.processor(mockJob)

      const updateCall = mocks.mockDatabaseQuery.mock.calls.find((call) =>
        call[0].includes('UPDATE portfolio_companies')
      )
      expect(updateCall?.[1]?.[3]).toBe('stable')
    })

    it('should insert historical health score record', async () => {
      mocks.mockDatabaseQuery
        .mockResolvedValueOnce([{ id: 'company-1', company_name: 'Test Corp' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([])
        .mockResolvedValue([])

      const { createHealthWorker } = await import('../../../queue/workers/healthWorker')

      const worker = createHealthWorker()
      const mockJob = {
        id: 'test-job-1',
        data: {},
        updateProgress: mocks.mockUpdateProgress
      }

      await worker.processor(mockJob)

      const insertCall = mocks.mockDatabaseQuery.mock.calls.find((call) =>
        call[0].includes('INSERT INTO health_scores')
      )
      expect(insertCall).toBeDefined()
      expect(insertCall?.[1]).toContain('company-1')
    })
  })

  describe('event handlers', () => {
    it('completed handler should log job ID', async () => {
      const { createHealthWorker } = await import('../../../queue/workers/healthWorker')

      createHealthWorker()

      const completedHandler = mocks.mockWorkerOn.mock.calls.find(
        (call) => call[0] === 'completed'
      )?.[1]

      completedHandler({ id: 'job-123' })

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Health Score Worker] Job job-123 completed successfully'
      )
    })

    it('failed handler should log job ID and error', async () => {
      const { createHealthWorker } = await import('../../../queue/workers/healthWorker')

      createHealthWorker()

      const failedHandler = mocks.mockWorkerOn.mock.calls.find((call) => call[0] === 'failed')?.[1]

      failedHandler({ id: 'job-456' }, new Error('Calculation error'))

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Health Score Worker] Job job-456 failed:',
        'Calculation error'
      )
    })

    it('error handler should log worker error', async () => {
      const { createHealthWorker } = await import('../../../queue/workers/healthWorker')

      createHealthWorker()

      const errorHandler = mocks.mockWorkerOn.mock.calls.find((call) => call[0] === 'error')?.[1]

      errorHandler(new Error('Worker crashed'))

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Health Score Worker] Worker error:',
        expect.any(Error)
      )
    })
  })
})

// Dependency check test
describe('Health Worker Tests - Dependency Check', () => {
  it.skipIf(!bullmqAvailable)('should run when bullmq is installed', () => {
    expect(true).toBe(true)
  })

  it.skipIf(bullmqAvailable)('skips tests because bullmq is not installed', () => {
    console.log('Health worker tests skipped: bullmq package not installed')
    expect(true).toBe(true)
  })
})
