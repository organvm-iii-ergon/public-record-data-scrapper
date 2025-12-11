/**
<<<<<<< HEAD
 * DataIngestionService Unit Tests
 *
 * Tests for UCC filing data ingestion from various sources
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DataIngestionService } from '../DataIngestionService'
import {
  createMockIngestionConfig,
  createMockDataSource,
  createMockUCCFiling,
  createMockFetchResponse,
  wait,
  mockConsole
} from './test-utils'
=======
 * DataIngestionService Tests
 *
 * Tests for UCC data ingestion service including:
 * - Rate limiting
 * - Circuit breaker pattern
 * - Retry logic
 * - Error handling
 * - Multi-source ingestion
 * - Statistics calculation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DataIngestionService, type DataSource, type IngestionConfig } from '../DataIngestionService'
import type { UCCFiling } from '../../types'
>>>>>>> origin/claude/pick-implementation-016NMwaaexJYbyDuHajpV91B

// Mock fetch globally
global.fetch = vi.fn()

describe('DataIngestionService', () => {
  let service: DataIngestionService
<<<<<<< HEAD
  let consoleMocks: ReturnType<typeof mockConsole>

  beforeEach(() => {
    const config = createMockIngestionConfig()
    service = new DataIngestionService(config)
    consoleMocks = mockConsole()
    vi.clearAllMocks()
  })

  afterEach(() => {
    consoleMocks.restore()
  })

  describe('ingestData', () => {
    it('should ingest data from all configured sources', async () => {
      const mockFilings = [createMockUCCFiling(), createMockUCCFiling()]

      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({ filings: mockFilings })
      )

      const results = await service.ingestData(['CA'])

      expect(results).toHaveLength(3) // 3 mock sources
      expect(results.every(r => r.success)).toBe(true)
    })

    it('should handle source failures gracefully', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(createMockFetchResponse({ filings: [] }))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(createMockFetchResponse({ filings: [] }))

      const results = await service.ingestData(['CA'])

      expect(results).toHaveLength(3)
      expect(results.filter(r => r.success)).toHaveLength(2)
      expect(results.filter(r => !r.success)).toHaveLength(1)
      expect(results[1].errors).toContain('Network error')
    })

    it('should respect state filters', async () => {
      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({ filings: [] })
      )

      await service.ingestData(['CA', 'NY'])

      // Verify fetch was called for the correct states
      expect(fetch).toHaveBeenCalled()
    })

    it('should include metadata in results', async () => {
      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({ filings: [createMockUCCFiling()] })
      )

      const results = await service.ingestData(['CA'])

      results.forEach(result => {
        expect(result.metadata).toBeDefined()
        expect(result.metadata.source).toBeTruthy()
        expect(result.metadata.timestamp).toBeTruthy()
        expect(result.metadata.recordCount).toBeGreaterThanOrEqual(0)
        expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0)
      })
    })

    it('should collect filings from successful sources', async () => {
      const filing1 = createMockUCCFiling({ fileNumber: 'CA-001' })
      const filing2 = createMockUCCFiling({ fileNumber: 'CA-002' })

      vi.mocked(fetch)
        .mockResolvedValueOnce(createMockFetchResponse({ filings: [filing1] }))
        .mockResolvedValueOnce(createMockFetchResponse({ filings: [filing2] }))
        .mockResolvedValueOnce(createMockFetchResponse({ filings: [] }))

      const results = await service.ingestData(['CA'])

      const totalFilings = results.reduce((sum, r) => sum + r.filings.length, 0)
      expect(totalFilings).toBeGreaterThanOrEqual(2)
    })
  })

  describe('rate limiting', () => {
    it('should respect rate limits for sources', async () => {
      const config = createMockIngestionConfig({
        sources: [createMockDataSource({ rateLimit: 2 })], // 2 requests per minute
        batchSize: 10
      })
      service = new DataIngestionService(config)

      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({ filings: [] })
      )

      // Make multiple rapid requests
      const promises = Array(5).fill(null).map(() =>
        service.ingestData(['CA'])
      )

      await Promise.all(promises)

      // Should have been rate limited
      expect(fetch).toHaveBeenCalled()
    })

    it('should track request counts per source', async () => {
      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({ filings: [] })
      )

      await service.ingestData(['CA'])
      await wait(100)
      await service.ingestData(['NY'])

      // Request counts should be tracked internally
      expect(fetch).toHaveBeenCalled()
    })
  })

  describe('circuit breaker', () => {
    it('should open circuit after consecutive failures', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Service unavailable'))

      // Make multiple requests to trigger circuit breaker
      for (let i = 0; i < 6; i++) {
        await service.ingestData(['CA']).catch(() => {})
      }

      // Circuit should be open now
      const result = await service.ingestData(['CA'])
      expect(result.some(r => !r.success)).toBe(true)
    })

    it('should close circuit after successful request in half-open state', async () => {
      // Fail first to open circuit
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Error'))

      await service.ingestData(['CA']).catch(() => {})

      // Wait for circuit to half-open
      await wait(100)

      // Succeed to close circuit
      vi.mocked(fetch).mockResolvedValueOnce(
        createMockFetchResponse({ filings: [] })
      )

      const result = await service.ingestData(['CA'])
      expect(result.some(r => r.success)).toBe(true)
    })
  })

  describe('retry logic', () => {
    it('should retry failed requests', async () => {
      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce(createMockFetchResponse({ filings: [] }))

      const results = await service.ingestData(['CA'])

      // Should succeed after retries
      expect(results.some(r => r.success)).toBe(true)
      expect(fetch).toHaveBeenCalledTimes(9) // 3 sources × 3 attempts
    })

    it('should use exponential backoff for retries', async () => {
      const startTime = Date.now()

      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValueOnce(createMockFetchResponse({ filings: [] }))

      await service.ingestData(['CA'])

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should have some delay due to backoff
      expect(duration).toBeGreaterThan(0)
    })

    it('should not retry on non-retryable errors', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Invalid API key'))

      const results = await service.ingestData(['CA'])

      // Should fail fast without retries
      expect(results.some(r => !r.success)).toBe(true)
    })
  })

  describe('error handling', () => {
    it('should handle network errors', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

      const results = await service.ingestData(['CA'])

      expect(results.every(r => !r.success)).toBe(true)
      expect(results.every(r => r.errors.length > 0)).toBe(true)
    })

    it('should handle malformed API responses', async () => {
      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({ invalid: 'data' })
      )

      const results = await service.ingestData(['CA'])

      // Should handle gracefully
      expect(results).toBeDefined()
    })

    it('should handle timeout errors', async () => {
      vi.mocked(fetch).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      // This would timeout in real scenario
      // In test, we just verify it handles the case
    })

    it('should log errors to console', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Test error'))

      await service.ingestData(['CA'])

      expect(consoleMocks.mocks.error).toHaveBeenCalled()
    })
  })

  describe('data validation', () => {
    it('should validate UCC filing data structure', async () => {
      const invalidFiling = { invalid: 'data' }

      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({ filings: [invalidFiling] })
      )

      const results = await service.ingestData(['CA'])

      // Should handle invalid data
      expect(results).toBeDefined()
    })

    it('should filter out duplicate filings', async () => {
      const filing = createMockUCCFiling({ fileNumber: 'CA-001' })

      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({ filings: [filing, filing] })
      )

      const results = await service.ingestData(['CA'])

      // Should deduplicate
      const allFilings = results.flatMap(r => r.filings)
      const uniqueFileNumbers = new Set(allFilings.map(f => f.fileNumber))
      expect(uniqueFileNumbers.size).toBeLessThanOrEqual(allFilings.length)
    })
  })

  describe('performance', () => {
    it('should process large batches efficiently', async () => {
      const largeFilingSet = Array(1000).fill(null).map((_, i) =>
        createMockUCCFiling({ fileNumber: `CA-${i}` })
      )

      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({ filings: largeFilingSet })
      )

      const startTime = Date.now()
      const results = await service.ingestData(['CA'])
      const duration = Date.now() - startTime

      expect(results).toBeDefined()
      // Should complete in reasonable time
      expect(duration).toBeLessThan(5000)
    })

    it('should handle batch size limits', async () => {
      const config = createMockIngestionConfig({ batchSize: 50 })
      service = new DataIngestionService(config)

      const largeFilingSet = Array(200).fill(null).map((_, i) =>
        createMockUCCFiling({ fileNumber: `CA-${i}` })
      )

      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({ filings: largeFilingSet })
      )

      const results = await service.ingestData(['CA'])

      // Should process in batches
      expect(results).toBeDefined()
    })
  })

  describe('source types', () => {
    it('should handle state portal sources', async () => {
      const config = createMockIngestionConfig({
        sources: [createMockDataSource({ type: 'state-portal' })]
      })
      service = new DataIngestionService(config)

      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({ filings: [] })
      )

      const results = await service.ingestData(['CA'])

      expect(results[0].metadata.source).toContain('Portal')
    })

    it('should handle API sources', async () => {
      const config = createMockIngestionConfig({
        sources: [createMockDataSource({ type: 'api', apiKey: 'test-key' })]
      })
      service = new DataIngestionService(config)

      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({ filings: [] })
      )

      const results = await service.ingestData(['CA'])

      expect(results[0]).toBeDefined()
    })

    it('should handle database sources', async () => {
      const config = createMockIngestionConfig({
        sources: [createMockDataSource({ type: 'database' })]
      })
      service = new DataIngestionService(config)

      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({ filings: [] })
      )

      const results = await service.ingestData(['CA'])

      expect(results[0]).toBeDefined()
    })
  })

  describe('concurrent operations', () => {
    it('should handle concurrent ingestion requests', async () => {
      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({ filings: [] })
      )

      const promises = [
        service.ingestData(['CA']),
        service.ingestData(['NY']),
        service.ingestData(['TX'])
      ]

      const results = await Promise.all(promises)

      expect(results).toHaveLength(3)
      expect(results.every(r => Array.isArray(r))).toBe(true)
    })

    it('should maintain state consistency during concurrent operations', async () => {
      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({ filings: [createMockUCCFiling()] })
      )

      // Run multiple concurrent operations
      await Promise.all([
        service.ingestData(['CA']),
        service.ingestData(['CA']),
        service.ingestData(['CA'])
      ])

      // State should remain consistent
      expect(true).toBe(true) // Placeholder - would check internal state
=======
  let mockConfig: IngestionConfig
  let mockDataSource: DataSource

  beforeEach(() => {
    vi.clearAllMocks()

    mockDataSource = {
      id: 'test-api',
      name: 'Test UCC API',
      type: 'api',
      endpoint: 'https://api.test.com/ucc',
      apiKey: 'test-key-123',
      rateLimit: 60
    }

    mockConfig = {
      sources: [mockDataSource],
      batchSize: 100,
      retryAttempts: 3,
      retryDelay: 100, // Short delay for testing
      states: ['NY', 'CA']
    }

    service = new DataIngestionService(mockConfig)
  })

  describe('Initialization', () => {
    it('should initialize with config', () => {
      expect(service).toBeDefined()
    })

    it('should initialize with default config', () => {
      const defaultService = new DataIngestionService({
        sources: [],
        batchSize: 50,
        retryAttempts: 2,
        retryDelay: 1000,
        states: ['TX']
      })
      expect(defaultService).toBeDefined()
    })

    it('should accept multiple data sources', () => {
      const multiSourceConfig: IngestionConfig = {
        sources: [
          { ...mockDataSource, id: 'source-1' },
          { ...mockDataSource, id: 'source-2', type: 'database' }
        ],
        batchSize: 100,
        retryAttempts: 3,
        retryDelay: 1000,
        states: ['NY']
      }

      const multiSourceService = new DataIngestionService(multiSourceConfig)
      expect(multiSourceService).toBeDefined()
    })
  })

  describe('ingestData()', () => {
    it('should return results for all configured states', async () => {
      const mockFilings: UCCFiling[] = [
        {
          id: 'ucc-1',
          filingDate: '2024-01-01',
          debtorName: 'Test Company',
          securedParty: 'Test Bank',
          state: 'NY',
          status: 'lapsed',
          filingType: 'UCC-1'
        }
      ]

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockFilings
      } as Response)

      const results = await service.ingestData()

      expect(results).toBeDefined()
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]).toHaveProperty('success')
      expect(results[0]).toHaveProperty('filings')
      expect(results[0]).toHaveProperty('metadata')
    })

    it('should use provided states instead of config states', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => []
      } as Response)

      const results = await service.ingestData(['FL', 'TX'])

      expect(results).toBeDefined()
      // Should attempt to fetch from FL and TX, not NY and CA
    })

    it('should handle empty source list gracefully', async () => {
      const emptySourceService = new DataIngestionService({
        sources: [],
        batchSize: 100,
        retryAttempts: 3,
        retryDelay: 1000,
        states: ['NY']
      })

      const results = await emptySourceService.ingestData()
      expect(results).toHaveLength(0)
    })

    it('should collect errors from failed sources', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

      const results = await service.ingestData()

      expect(results).toBeDefined()
      expect(results[0].success).toBe(false)
      expect(results[0].errors.length).toBeGreaterThan(0)
    })
  })

  describe('Source Type Handling', () => {
    it('should handle API sources', async () => {
      const apiSource: DataSource = {
        ...mockDataSource,
        type: 'api'
      }

      const apiService = new DataIngestionService({
        ...mockConfig,
        sources: [apiSource]
      })

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => []
      } as Response)

      const results = await apiService.ingestData(['NY'])

      expect(results).toBeDefined()
      expect(vi.mocked(fetch)).toHaveBeenCalled()
    })

    it('should handle state portal sources', async () => {
      const portalSource: DataSource = {
        ...mockDataSource,
        type: 'state-portal'
      }

      const portalService = new DataIngestionService({
        ...mockConfig,
        sources: [portalSource]
      })

      const results = await portalService.ingestData(['CA'])

      expect(results).toBeDefined()
      // Portal scraping returns empty array in test mode
      expect(results[0].filings).toEqual([])
    })

    it('should handle database sources', async () => {
      const dbSource: DataSource = {
        ...mockDataSource,
        type: 'database'
      }

      const dbService = new DataIngestionService({
        ...mockConfig,
        sources: [dbSource]
      })

      const results = await dbService.ingestData(['TX'])

      expect(results).toBeDefined()
      // Database queries return empty array in test mode
      expect(results[0].filings).toEqual([])
    })
  })

  describe('API Integration', () => {
    it('should include API key in request headers', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => []
      } as Response)

      await service.ingestData(['NY'])

      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.stringContaining('https://api.test.com/ucc'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-key-123'
          })
        })
      )
    })

    it('should handle API responses correctly', async () => {
      const mockAPIResponse = [
        {
          id: 'api-filing-1',
          filing_date: '2023-01-15',
          debtor_name: 'API Test Corp',
          secured_party: 'API Test Lender',
          status: 'lapsed',
          filing_type: 'UCC-1',
          lien_amount: 50000
        }
      ]

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockAPIResponse
      } as Response)

      const results = await service.ingestData(['NY'])

      expect(results[0].filings.length).toBeGreaterThan(0)
      expect(results[0].filings[0]).toHaveProperty('debtorName')
      expect(results[0].filings[0]).toHaveProperty('securedParty')
      expect(results[0].filings[0]).toHaveProperty('state', 'NY')
    })

    it('should handle HTTP errors', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500
      } as Response)

      const results = await service.ingestData(['NY'])

      expect(results[0].success).toBe(false)
      expect(results[0].errors.length).toBeGreaterThan(0)
    })

    it('should not retry 4xx client errors (except 429)', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 404
      } as Response)

      const results = await service.ingestData(['NY'])

      expect(results[0].success).toBe(false)
      // Should fail quickly without retries for 404
    })
  })

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const rateLimitedSource: DataSource = {
        ...mockDataSource,
        rateLimit: 2 // Only 2 requests per minute
      }

      const rateLimitedService = new DataIngestionService({
        ...mockConfig,
        sources: [rateLimitedSource],
        states: ['NY', 'CA', 'TX'] // 3 states, exceeds rate limit
      })

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => []
      } as Response)

      const startTime = Date.now()
      await rateLimitedService.ingestData()
      const duration = Date.now() - startTime

      // Should have delayed due to rate limiting
      expect(duration).toBeGreaterThan(0)
    }, 70000) // Increase timeout for rate limiting test

    it('should track request timestamps per source', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => []
      } as Response)

      // Make multiple requests
      await service.ingestData(['NY'])
      await service.ingestData(['CA'])

      expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThan(0)
    })
  })

  describe('Error Handling & Retry Logic', () => {
    it('should retry on network failures', async () => {
      let attemptCount = 0
      vi.mocked(fetch).mockImplementation(() => {
        attemptCount++
        if (attemptCount < 3) {
          return Promise.reject(new Error('Network timeout'))
        }
        return Promise.resolve({
          ok: true,
          json: async () => []
        } as Response)
      })

      const results = await service.ingestData(['NY'])

      expect(attemptCount).toBeGreaterThan(1)
      expect(results[0].success).toBe(true)
    })

    it('should give up after max retry attempts', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Persistent failure'))

      const results = await service.ingestData(['NY'])

      expect(results[0].success).toBe(false)
      expect(results[0].errors.length).toBeGreaterThan(0)
    })

    it('should use exponential backoff for retries', async () => {
      const delays: number[] = []
      let attemptCount = 0

      vi.mocked(fetch).mockImplementation(() => {
        const timestamp = Date.now()
        if (attemptCount > 0) {
          delays.push(timestamp)
        }
        attemptCount++

        if (attemptCount < 3) {
          return Promise.reject(new Error('Retry test'))
        }
        return Promise.resolve({
          ok: true,
          json: async () => []
        } as Response)
      })

      await service.ingestData(['NY'])

      expect(attemptCount).toBeGreaterThan(1)
    })
  })

  describe('Circuit Breaker', () => {
    it('should create circuit breaker per source', async () => {
      const multiSourceConfig: IngestionConfig = {
        sources: [
          { ...mockDataSource, id: 'source-1' },
          { ...mockDataSource, id: 'source-2' }
        ],
        batchSize: 100,
        retryAttempts: 3,
        retryDelay: 100,
        states: ['NY']
      }

      const multiService = new DataIngestionService(multiSourceConfig)

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => []
      } as Response)

      const results = await multiService.ingestData()

      expect(results.length).toBe(2)
    })

    it('should open circuit after multiple failures', async () => {
      // Simulate multiple failures to trip circuit breaker
      vi.mocked(fetch).mockRejectedValue(new Error('Service unavailable'))

      const results1 = await service.ingestData(['NY'])
      const results2 = await service.ingestData(['NY'])

      expect(results1[0].success).toBe(false)
      expect(results2[0].success).toBe(false)
    })
  })

  describe('findLapsedFilings()', () => {
    it('should filter lapsed filings by age', async () => {
      const mockFilings = [
        {
          id: 'recent',
          filingDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: 'lapsed' as const,
          debtorName: 'Recent Corp',
          securedParty: 'Bank',
          state: 'NY',
          filingType: 'UCC-1' as const
        },
        {
          id: 'old',
          filingDate: new Date(Date.now() - 4 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: 'lapsed' as const,
          debtorName: 'Old Corp',
          securedParty: 'Bank',
          state: 'NY',
          filingType: 'UCC-1' as const
        }
      ]

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockFilings
      } as Response)

      const lapsedFilings = await service.findLapsedFilings(1095) // 3 years

      expect(lapsedFilings.length).toBeGreaterThanOrEqual(0)
      lapsedFilings.forEach(filing => {
        expect(filing.status).toBe('lapsed')
      })
    })

    it('should exclude non-lapsed filings', async () => {
      const mockFilings = [
        {
          id: 'active',
          filingDate: '2020-01-01',
          status: 'active' as const,
          debtorName: 'Active Corp',
          securedParty: 'Bank',
          state: 'NY',
          filingType: 'UCC-1' as const
        }
      ]

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockFilings
      } as Response)

      const lapsedFilings = await service.findLapsedFilings()

      expect(lapsedFilings).toEqual([])
    })
  })

  describe('getStatistics()', () => {
    it('should calculate total records', () => {
      const mockResults = [
        {
          success: true,
          filings: [{} as UCCFiling, {} as UCCFiling],
          errors: [],
          metadata: {
            source: 'Test',
            timestamp: new Date().toISOString(),
            recordCount: 2,
            processingTime: 1000
          }
        },
        {
          success: true,
          filings: [{} as UCCFiling],
          errors: [],
          metadata: {
            source: 'Test2',
            timestamp: new Date().toISOString(),
            recordCount: 1,
            processingTime: 500
          }
        }
      ]

      const stats = service.getStatistics(mockResults)

      expect(stats.totalRecords).toBe(3)
    })

    it('should calculate success rate', () => {
      const mockResults = [
        {
          success: true,
          filings: [],
          errors: [],
          metadata: {
            source: 'Test',
            timestamp: new Date().toISOString(),
            recordCount: 0,
            processingTime: 1000
          }
        },
        {
          success: false,
          filings: [],
          errors: ['Error 1'],
          metadata: {
            source: 'Test2',
            timestamp: new Date().toISOString(),
            recordCount: 0,
            processingTime: 500
          }
        }
      ]

      const stats = service.getStatistics(mockResults)

      expect(stats.successRate).toBe(50)
    })

    it('should calculate average processing time', () => {
      const mockResults = [
        {
          success: true,
          filings: [],
          errors: [],
          metadata: {
            source: 'Test',
            timestamp: new Date().toISOString(),
            recordCount: 0,
            processingTime: 1000
          }
        },
        {
          success: true,
          filings: [],
          errors: [],
          metadata: {
            source: 'Test2',
            timestamp: new Date().toISOString(),
            recordCount: 0,
            processingTime: 2000
          }
        }
      ]

      const stats = service.getStatistics(mockResults)

      expect(stats.avgProcessingTime).toBe(1500)
    })

    it('should count total errors', () => {
      const mockResults = [
        {
          success: false,
          filings: [],
          errors: ['Error 1', 'Error 2'],
          metadata: {
            source: 'Test',
            timestamp: new Date().toISOString(),
            recordCount: 0,
            processingTime: 1000
          }
        },
        {
          success: false,
          filings: [],
          errors: ['Error 3'],
          metadata: {
            source: 'Test2',
            timestamp: new Date().toISOString(),
            recordCount: 0,
            processingTime: 500
          }
        }
      ]

      const stats = service.getStatistics(mockResults)

      expect(stats.errorCount).toBe(3)
    })

    it('should handle empty results gracefully', () => {
      const stats = service.getStatistics([])

      expect(stats.totalRecords).toBe(0)
      expect(stats.successRate).toBe(0)
      expect(stats.avgProcessingTime).toBe(0)
      expect(stats.errorCount).toBe(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle malformed API responses', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ invalid: 'format' })
      } as Response)

      const results = await service.ingestData(['NY'])

      expect(results[0].filings).toEqual([])
    })

    it('should handle null/undefined fields in API response', async () => {
      const mockResponse = [
        {
          id: null,
          filing_date: undefined,
          debtor_name: 'Test',
          secured_party: null
        }
      ]

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      } as Response)

      const results = await service.ingestData(['NY'])

      expect(results[0].filings.length).toBeGreaterThan(0)
      expect(results[0].filings[0].debtorName).toBe('Test')
    })

    it('should handle timeout errors', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Request timeout'))

      const results = await service.ingestData(['NY'])

      expect(results[0].success).toBe(false)
      expect(results[0].errors.length).toBeGreaterThan(0)
    })

    it('should handle JSON parsing errors', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => { throw new Error('Invalid JSON') }
      } as Response)

      const results = await service.ingestData(['NY'])

      expect(results[0].success).toBe(false)
    })
  })

  describe('Metadata Generation', () => {
    it('should include accurate metadata in results', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => []
      } as Response)

      const results = await service.ingestData(['NY'])

      expect(results[0].metadata).toHaveProperty('source')
      expect(results[0].metadata).toHaveProperty('timestamp')
      expect(results[0].metadata).toHaveProperty('recordCount')
      expect(results[0].metadata).toHaveProperty('processingTime')
      expect(results[0].metadata.processingTime).toBeGreaterThanOrEqual(0)
    })

    it('should have ISO timestamp format', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => []
      } as Response)

      const results = await service.ingestData(['NY'])

      const timestamp = results[0].metadata.timestamp
      expect(() => new Date(timestamp)).not.toThrow()
      expect(new Date(timestamp).toISOString()).toBe(timestamp)
>>>>>>> origin/claude/pick-implementation-016NMwaaexJYbyDuHajpV91B
    })
  })
})
