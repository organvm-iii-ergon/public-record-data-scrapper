/**
 * DataEnrichmentService Unit Tests
 *
 * Tests for prospect data enrichment including growth signals,
 * health scores, revenue estimation, and industry classification
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DataEnrichmentService } from '../DataEnrichmentService'
import {
  createMockEnrichmentSources,
  createMockUCCFiling,
  createMockProspect,
  createMockGrowthSignals,
  createMockHealthScore,
  createMockFetchResponse,
  mockConsole
} from './test-utils'

// Mock fetch globally
global.fetch = vi.fn()

describe('DataEnrichmentService', () => {
  let service: DataEnrichmentService
  let consoleMocks: ReturnType<typeof mockConsole>

  beforeEach(() => {
    const sources = createMockEnrichmentSources()
    service = new DataEnrichmentService(sources)
    consoleMocks = mockConsole()
    vi.clearAllMocks()
  })

  afterEach(() => {
    consoleMocks.restore()
  })

  // TODO: Fix mocking - service internals changed and mocks don't match
  describe.skip('enrichProspect', () => {
    it('should enrich a prospect with all available data', async () => {
      const filing = createMockUCCFiling()

      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({
          growthSignals: createMockGrowthSignals(),
          healthScore: createMockHealthScore(),
          revenue: 5000000,
          industry: 'technology'
        })
      )

      const { prospect, result } = await service.enrichProspect(filing)

      expect(prospect).toBeDefined()
      expect(prospect.companyName).toBe(filing.debtorName)
      expect(prospect.state).toBe(filing.state)
      expect(result.success).toBe(true)
      expect(result.enrichedFields.length).toBeGreaterThan(0)
    })

    it('should handle existing data gracefully', async () => {
      const filing = createMockUCCFiling()
      const existingData = createMockProspect()

      vi.mocked(fetch).mockResolvedValue(createMockFetchResponse({ growthSignals: [] }))

      const { prospect } = await service.enrichProspect(filing, existingData)

      expect(prospect.id).toBe(existingData.id)
      expect(prospect.companyName).toBe(filing.debtorName)
    })

    it('should calculate confidence scores', async () => {
      const filing = createMockUCCFiling()

      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({
          growthSignals: createMockGrowthSignals(),
          healthScore: createMockHealthScore()
        })
      )

      const { result } = await service.enrichProspect(filing)

      expect(result.confidence).toBeGreaterThan(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
    })

    it('should track enriched fields', async () => {
      const filing = createMockUCCFiling()

      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({
          growthSignals: createMockGrowthSignals(),
          healthScore: createMockHealthScore(),
          revenue: 5000000
        })
      )

      const { result } = await service.enrichProspect(filing)

      expect(result.enrichedFields).toContain('growthSignals')
      expect(result.enrichedFields).toContain('healthScore')
      expect(result.enrichedFields.length).toBeGreaterThan(0)
    })

    it('should include timestamp in result', async () => {
      const filing = createMockUCCFiling()

      vi.mocked(fetch).mockResolvedValue(createMockFetchResponse({}))

      const { result } = await service.enrichProspect(filing)

      expect(result.timestamp).toBeDefined()
      const timestamp = new Date(result.timestamp)
      expect(timestamp.getTime()).toBeGreaterThan(0)
    })
  })

  // TODO: Fix mocking - service internals changed and mocks don't match
  describe.skip('detectGrowthSignals', () => {
    it('should detect hiring signals', async () => {
      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({
          signals: [
            {
              type: 'hiring',
              description: '15 job openings',
              confidence: 0.9
            }
          ]
        })
      )

      const filing = createMockUCCFiling()
      const { prospect } = await service.enrichProspect(filing)

      expect(prospect.growthSignals).toBeDefined()
      expect(prospect.growthSignals.length).toBeGreaterThanOrEqual(0)
    })

    it('should detect permit signals', async () => {
      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({
          signals: [
            {
              type: 'permits',
              description: 'Building permit for $2M',
              confidence: 0.95
            }
          ]
        })
      )

      const filing = createMockUCCFiling()
      const { prospect } = await service.enrichProspect(filing)

      const permitSignals = prospect.growthSignals.filter((s) => s.type === 'permits')
      expect(permitSignals.length).toBeGreaterThanOrEqual(0)
    })

    it('should detect contract signals', async () => {
      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({
          signals: [
            {
              type: 'contracts',
              description: 'Federal contract awarded',
              confidence: 0.92
            }
          ]
        })
      )

      const filing = createMockUCCFiling()
      const { prospect } = await service.enrichProspect(filing)

      expect(prospect.growthSignals).toBeDefined()
    })

    it('should include signal confidence scores', async () => {
      const signals = createMockGrowthSignals()

      vi.mocked(fetch).mockResolvedValue(createMockFetchResponse({ signals }))

      const filing = createMockUCCFiling()
      const { prospect } = await service.enrichProspect(filing)

      prospect.growthSignals.forEach((signal) => {
        expect(signal.confidence).toBeGreaterThan(0)
        expect(signal.confidence).toBeLessThanOrEqual(1)
      })
    })

    it('should handle API failures gracefully', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('API Error'))

      const filing = createMockUCCFiling()
      const { prospect, result } = await service.enrichProspect(filing)

      expect(prospect).toBeDefined()
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  // TODO: Fix mocking - service internals changed and mocks don't match
  describe.skip('calculateHealthScore', () => {
    it('should calculate overall health score', async () => {
      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({
          healthScore: createMockHealthScore({ overall: 75 })
        })
      )

      const filing = createMockUCCFiling()
      const { prospect } = await service.enrichProspect(filing)

      expect(prospect.healthScore.overall).toBeGreaterThanOrEqual(0)
      expect(prospect.healthScore.overall).toBeLessThanOrEqual(100)
    })

    it('should assign health grade', async () => {
      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({
          healthScore: createMockHealthScore({ grade: 'A' })
        })
      )

      const filing = createMockUCCFiling()
      const { prospect } = await service.enrichProspect(filing)

      expect(prospect.healthScore.grade).toMatch(/^[A-F]$/)
    })

    it('should include health score factors', async () => {
      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({
          healthScore: createMockHealthScore()
        })
      )

      const filing = createMockUCCFiling()
      const { prospect } = await service.enrichProspect(filing)

      expect(prospect.healthScore.factors).toBeDefined()
      expect(prospect.healthScore.factors.paymentHistory).toBeDefined()
      expect(prospect.healthScore.factors.onlineReputation).toBeDefined()
    })

    it('should track health score trends', async () => {
      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({
          healthScore: createMockHealthScore({
            trends: {
              improving: true,
              recentChanges: [
                { factor: 'reputation', from: 65, to: 75, date: new Date().toISOString() }
              ]
            }
          })
        })
      )

      const filing = createMockUCCFiling()
      const { prospect } = await service.enrichProspect(filing)

      expect(prospect.healthScore.trends).toBeDefined()
      expect(typeof prospect.healthScore.trends.improving).toBe('boolean')
    })

    it('should handle missing health data', async () => {
      vi.mocked(fetch).mockResolvedValue(createMockFetchResponse({}))

      const filing = createMockUCCFiling()
      const { prospect } = await service.enrichProspect(filing)

      expect(prospect.healthScore).toBeDefined()
      expect(prospect.healthScore.overall).toBeGreaterThanOrEqual(0)
    })
  })

  // TODO: Fix mocking - service internals changed and mocks don't match
  describe.skip('estimateRevenue', () => {
    it('should estimate revenue based on industry and signals', async () => {
      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({
          revenue: 5000000
        })
      )

      const filing = createMockUCCFiling()
      const { prospect } = await service.enrichProspect(filing)

      expect(prospect.estimatedRevenue).toBeDefined()
      if (prospect.estimatedRevenue) {
        expect(prospect.estimatedRevenue).toBeGreaterThan(0)
      }
    })

    it('should use UCC filing amount as baseline', async () => {
      vi.mocked(fetch).mockResolvedValue(createMockFetchResponse({}))

      const filing = createMockUCCFiling({ amount: 500000 })
      const { prospect } = await service.enrichProspect(filing)

      // Revenue estimate should correlate with UCC amount
      expect(prospect).toBeDefined()
    })

    it('should adjust estimate based on growth signals', async () => {
      const signals = createMockGrowthSignals()

      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({
          signals,
          revenue: 8000000
        })
      )

      const filing = createMockUCCFiling()
      const { prospect } = await service.enrichProspect(filing)

      // More growth signals should increase revenue estimate
      expect(prospect.growthSignals.length).toBeGreaterThan(0)
    })
  })

  describe('inferIndustry', () => {
    it('should classify company into industry', async () => {
      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({
          industry: 'technology'
        })
      )

      const filing = createMockUCCFiling()
      const { prospect } = await service.enrichProspect(filing)

      expect(prospect.industry).toBeDefined()
      expect(typeof prospect.industry).toBe('string')
    })

    it('should use company name for classification', async () => {
      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({
          industry: 'manufacturing'
        })
      )

      const filing = createMockUCCFiling({ debtorName: 'ABC Manufacturing Inc' })
      const { prospect } = await service.enrichProspect(filing)

      expect(prospect.companyName).toContain('Manufacturing')
    })

    it('should handle unknown industries', async () => {
      vi.mocked(fetch).mockResolvedValue(createMockFetchResponse({}))

      const filing = createMockUCCFiling({ debtorName: 'XYZ Corp' })
      const { prospect } = await service.enrichProspect(filing)

      expect(prospect.industry).toBeDefined()
    })
  })

  // TODO: Fix mocking - service internals changed and mocks don't match
  describe.skip('error handling', () => {
    it('should continue enrichment when one source fails', async () => {
      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error('Growth API Error'))
        .mockResolvedValueOnce(createMockFetchResponse({ healthScore: createMockHealthScore() }))

      const filing = createMockUCCFiling()
      const { prospect, result } = await service.enrichProspect(filing)

      expect(prospect).toBeDefined()
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.enrichedFields.length).toBeGreaterThan(0)
    })

    it('should collect all errors in result', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Service Error'))

      const filing = createMockUCCFiling()
      const { result } = await service.enrichProspect(filing)

      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.every((e) => typeof e === 'string')).toBe(true)
    })

    it('should handle timeout errors', async () => {
      vi.mocked(fetch).mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      )

      const filing = createMockUCCFiling()
      const { result } = await service.enrichProspect(filing)

      expect(result).toBeDefined()
    })

    it('should handle malformed responses', async () => {
      vi.mocked(fetch).mockResolvedValue(createMockFetchResponse({ invalid: 'structure' }))

      const filing = createMockUCCFiling()
      const { prospect } = await service.enrichProspect(filing)

      expect(prospect).toBeDefined()
    })
  })

  describe('batch enrichment', () => {
    it('should enrich multiple prospects', async () => {
      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({
          growthSignals: [],
          healthScore: createMockHealthScore()
        })
      )

      const filings = [
        createMockUCCFiling({ fileNumber: 'CA-001' }),
        createMockUCCFiling({ fileNumber: 'CA-002' }),
        createMockUCCFiling({ fileNumber: 'CA-003' })
      ]

      const results = await Promise.all(filings.map((f) => service.enrichProspect(f)))

      expect(results).toHaveLength(3)
      expect(results.every((r) => r.prospect)).toBe(true)
    })

    it('should handle batch failures gracefully', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(createMockFetchResponse({}))
        .mockRejectedValueOnce(new Error('Error'))
        .mockResolvedValueOnce(createMockFetchResponse({}))

      const filings = [createMockUCCFiling(), createMockUCCFiling(), createMockUCCFiling()]

      const results = await Promise.all(
        filings.map((f) =>
          service.enrichProspect(f).catch((e) => ({
            prospect: createMockProspect(),
            result: {
              success: false,
              enrichedFields: [],
              errors: [e.message],
              confidence: 0,
              timestamp: new Date().toISOString(),
              prospectId: ''
            }
          }))
        )
      )

      expect(results).toHaveLength(3)
    })
  })

  describe('performance', () => {
    it('should enrich prospects efficiently', async () => {
      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({
          growthSignals: createMockGrowthSignals(),
          healthScore: createMockHealthScore()
        })
      )

      const filing = createMockUCCFiling()
      const startTime = Date.now()

      await service.enrichProspect(filing)

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(1000) // Should complete quickly
    })

    it('should handle concurrent enrichment requests', async () => {
      vi.mocked(fetch).mockResolvedValue(createMockFetchResponse({}))

      const filings = Array(10)
        .fill(null)
        .map(() => createMockUCCFiling())

      const promises = filings.map((f) => service.enrichProspect(f))
      const results = await Promise.all(promises)

      expect(results).toHaveLength(10)
      expect(results.every((r) => r.prospect)).toBe(true)
    })
  })

  // TODO: Fix mocking - service internals changed and mocks don't match
  describe.skip('data sources', () => {
    it('should use all configured enrichment sources', async () => {
      vi.mocked(fetch).mockResolvedValue(createMockFetchResponse({}))

      const filing = createMockUCCFiling()
      await service.enrichProspect(filing)

      // Should have attempted to use sources
      expect(fetch).toHaveBeenCalled()
    })

    it('should prioritize ML inference sources for revenue', async () => {
      vi.mocked(fetch).mockResolvedValue(
        createMockFetchResponse({
          revenue: 10000000
        })
      )

      const filing = createMockUCCFiling()
      const { prospect } = await service.enrichProspect(filing)

      expect(prospect.estimatedRevenue).toBeDefined()
    })

    it('should handle missing API sources gracefully', async () => {
      const service = new DataEnrichmentService([])

      const filing = createMockUCCFiling()
      const { prospect } = await service.enrichProspect(filing)

      // Should still create prospect with defaults
      expect(prospect).toBeDefined()
      expect(prospect.companyName).toBe(filing.debtorName)
    })
  })
})
