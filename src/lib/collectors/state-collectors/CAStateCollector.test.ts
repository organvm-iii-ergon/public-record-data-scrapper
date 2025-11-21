/**
 * Tests for CAStateCollector
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CAStateCollector } from './CAStateCollector'
import type { UCCFiling } from '../types'

describe('CAStateCollector', () => {
  let collector: CAStateCollector

  beforeEach(() => {
    collector = new CAStateCollector()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initialization', () => {
    it('should create collector with default configuration', () => {
      expect(collector).toBeDefined()
    })

    it('should accept custom configuration', () => {
      const customCollector = new CAStateCollector({
        timeout: 60000,
        apiKey: 'test-key',
        costPerRequest: 0.02
      })

      expect(customCollector).toBeDefined()
    })

    it('should initialize with healthy status', () => {
      const status = collector.getStatus()
      expect(status.isHealthy).toBe(true)
    })

    it('should start with zero cost', () => {
      const costStats = collector.getCostStats()
      expect(costStats.totalCost).toBe(0)
    })
  })

  describe('searchByBusinessName()', () => {
    it('should search for filings by business name', async () => {
      const searchPromise = collector.searchByBusinessName('Tech Corp')

      await vi.runAllTimersAsync()
      const result = await searchPromise

      expect(result).toBeDefined()
      expect(result.filings).toBeInstanceOf(Array)
      expect(result.total).toBeGreaterThanOrEqual(0)
    })

    it('should return filings with correct structure', async () => {
      const searchPromise = collector.searchByBusinessName('Tech Corp')
      await vi.runAllTimersAsync()
      const result = await searchPromise

      if (result.filings.length > 0) {
        const filing = result.filings[0]

        expect(filing).toHaveProperty('filingNumber')
        expect(filing).toHaveProperty('filingType')
        expect(filing).toHaveProperty('filingDate')
        expect(filing).toHaveProperty('status')
        expect(filing).toHaveProperty('state')
        expect(filing.state).toBe('CA')
      }
    })

    it('should track costs for searches', async () => {
      const searchPromise = collector.searchByBusinessName('Tech Corp')
      await vi.runAllTimersAsync()
      await searchPromise

      const costStats = collector.getCostStats()
      expect(costStats.totalCost).toBeGreaterThan(0)
      expect(costStats.totalRequests).toBeGreaterThan(0)
    })

    it('should update statistics after search', async () => {
      const searchPromise = collector.searchByBusinessName('Tech Corp')
      await vi.runAllTimersAsync()
      await searchPromise

      const status = collector.getStatus()
      expect(status.totalCollected).toBeGreaterThan(0)
      expect(status.lastCollectionTime).toBeDefined()
    })
  })

  describe('searchByFilingNumber()', () => {
    it('should search for filing by number', async () => {
      const searchPromise = collector.searchByFilingNumber('CA-2024-001234')
      await vi.runAllTimersAsync()
      const filing = await searchPromise

      expect(filing).toBeDefined()
      if (filing) {
        expect(filing.filingNumber).toBe('CA-2024-001234')
        expect(filing.state).toBe('CA')
      }
    })

    it('should return null for non-existent filing', async () => {
      const searchPromise = collector.searchByFilingNumber('INVALID-123')
      await vi.runAllTimersAsync()
      const filing = await searchPromise

      expect(filing).toBeNull()
    })

    it('should handle CA-prefixed filing numbers', async () => {
      const searchPromise = collector.searchByFilingNumber('CA-2024-999999')
      await vi.runAllTimersAsync()
      const filing = await searchPromise

      expect(filing).toBeDefined()
      if (filing) {
        expect(filing.filingNumber).toContain('CA-')
      }
    })

    it('should track costs for lookups', async () => {
      const beforeCost = collector.getCostStats().totalCost

      const searchPromise = collector.searchByFilingNumber('CA-2024-001234')
      await vi.runAllTimersAsync()
      await searchPromise

      const afterCost = collector.getCostStats().totalCost
      expect(afterCost).toBeGreaterThan(beforeCost)
    })
  })

  describe('getFilingDetails()', () => {
    it('should get detailed filing information', async () => {
      const detailsPromise = collector.getFilingDetails('CA-2024-001234')
      await vi.runAllTimersAsync()
      const filing = await detailsPromise

      expect(filing).toBeDefined()
      expect(filing.filingNumber).toBe('CA-2024-001234')
    })

    it('should throw error for non-existent filing', async () => {
      const detailsPromise = collector.getFilingDetails('INVALID-123')

      const testPromise = expect(detailsPromise).rejects.toThrow('not found')
      await vi.runAllTimersAsync()
      await testPromise
    })
  })

  describe('collectNewFilings()', () => {
    it('should collect filings with date filter', async () => {
      const since = new Date('2024-01-01')

      const collectPromise = collector.collectNewFilings({ since, limit: 10 })
      await vi.runAllTimersAsync()
      const filings = await collectPromise

      expect(filings).toBeInstanceOf(Array)
      expect(filings.length).toBeLessThanOrEqual(10)
    })

    it('should respect limit parameter', async () => {
      const collectPromise = collector.collectNewFilings({ limit: 3 })
      await vi.runAllTimersAsync()
      const filings = await collectPromise

      expect(filings.length).toBeLessThanOrEqual(3)
    })

    it('should return filings with valid structure', async () => {
      const collectPromise = collector.collectNewFilings({ limit: 5 })
      await vi.runAllTimersAsync()
      const filings = await collectPromise

      filings.forEach(filing => {
        expect(filing.state).toBe('CA')
        expect(filing.filingNumber).toContain('CA-')
        expect(filing.filingDate).toBeDefined()
        expect(filing.debtor).toBeDefined()
        expect(filing.securedParty).toBeDefined()
      })
    })

    it('should track costs for bulk collection', async () => {
      const collectPromise = collector.collectNewFilings({ limit: 5 })
      await vi.runAllTimersAsync()
      await collectPromise

      const costStats = collector.getCostStats()
      expect(costStats.totalCost).toBeGreaterThan(0)
    })

    it('should update collection statistics', async () => {
      const collectPromise = collector.collectNewFilings({ limit: 5 })
      await vi.runAllTimersAsync()
      const filings = await collectPromise

      const status = collector.getStatus()
      expect(status.totalCollected).toBeGreaterThanOrEqual(filings.length)
    })
  })

  describe('validateFiling()', () => {
    let validFiling: UCCFiling

    beforeEach(() => {
      validFiling = {
        filingNumber: 'CA-2024-001234',
        filingType: 'UCC-1',
        filingDate: '2024-01-15',
        status: 'active',
        state: 'CA',
        securedParty: {
          name: 'California Bank & Trust'
        },
        debtor: {
          name: 'Example Business Inc'
        },
        collateral: 'All assets'
      }
    })

    it('should validate correct filing', () => {
      const result = collector.validateFiling(validFiling)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing filing number', () => {
      const filing = { ...validFiling, filingNumber: '' }
      const result = collector.validateFiling(filing)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Missing filing number')
    })

    it('should detect missing filing date', () => {
      const filing = { ...validFiling, filingDate: '' }
      const result = collector.validateFiling(filing)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Missing filing date')
    })

    it('should detect missing debtor name', () => {
      const filing = { ...validFiling, debtor: { name: '' } }
      const result = collector.validateFiling(filing)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Missing debtor name')
    })

    it('should detect missing secured party name', () => {
      const filing = { ...validFiling, securedParty: { name: '' } }
      const result = collector.validateFiling(filing)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Missing secured party name')
    })

    it('should detect invalid state', () => {
      const filing = { ...validFiling, state: 'NY' }
      const result = collector.validateFiling(filing)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid state: NY, expected CA')
    })

    it('should detect invalid date format', () => {
      const filing = { ...validFiling, filingDate: 'invalid-date' }
      const result = collector.validateFiling(filing)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid filing date format')
    })

    it('should warn about missing collateral', () => {
      const filing = { ...validFiling, collateral: '' }
      const result = collector.validateFiling(filing)

      expect(result.warnings).toBeDefined()
      expect(result.warnings).toContain('Missing collateral description')
    })
  })

  describe('getStatus()', () => {
    it('should return collector status', () => {
      const status = collector.getStatus()

      expect(status).toHaveProperty('isHealthy')
      expect(status).toHaveProperty('totalCollected')
      expect(status).toHaveProperty('errorRate')
      expect(status).toHaveProperty('averageLatency')
    })

    it('should include rate limit stats', () => {
      const status = collector.getStatus()

      expect(status.rateLimitStats).toBeDefined()
      expect(status.rateLimitStats?.perMinute).toBeDefined()
      expect(status.rateLimitStats?.perHour).toBeDefined()
      expect(status.rateLimitStats?.perDay).toBeDefined()
    })

    it('should update lastCollectionTime after collection', async () => {
      const collectPromise = collector.collectNewFilings({ limit: 1 })
      await vi.runAllTimersAsync()
      await collectPromise

      const status = collector.getStatus()
      expect(status.lastCollectionTime).toBeDefined()
    })

    it('should track error rate', async () => {
      const searchPromise = collector.searchByFilingNumber('CA-2024-001234')
      await vi.runAllTimersAsync()
      await searchPromise

      const status = collector.getStatus()
      expect(status.errorRate).toBeGreaterThanOrEqual(0)
      expect(status.errorRate).toBeLessThanOrEqual(1)
    })

    it('should calculate average latency', async () => {
      const promises = [
        collector.searchByFilingNumber('CA-2024-001234'),
        collector.searchByFilingNumber('CA-2024-005678')
      ]

      await vi.runAllTimersAsync()
      await Promise.all(promises)

      const status = collector.getStatus()
      expect(status.averageLatency).toBeGreaterThan(0)
    })
  })

  describe('getCostStats()', () => {
    it('should return cost statistics', () => {
      const costStats = collector.getCostStats()

      expect(costStats).toHaveProperty('totalCost')
      expect(costStats).toHaveProperty('totalRequests')
      expect(costStats).toHaveProperty('costPerRequest')
      expect(costStats).toHaveProperty('averageCostPerFiling')
    })

    it('should track total cost', async () => {
      const searchPromise = collector.searchByBusinessName('Test Corp')
      await vi.runAllTimersAsync()
      await searchPromise

      const costStats = collector.getCostStats()
      expect(costStats.totalCost).toBeGreaterThan(0)
    })

    it('should track request count', async () => {
      const promises = [
        collector.searchByFilingNumber('CA-2024-001234'),
        collector.searchByFilingNumber('CA-2024-005678')
      ]

      await vi.runAllTimersAsync()
      await Promise.all(promises)

      const costStats = collector.getCostStats()
      expect(costStats.totalRequests).toBeGreaterThanOrEqual(2)
    })

    it('should calculate average cost per filing', async () => {
      const collectPromise = collector.collectNewFilings({ limit: 5 })
      await vi.runAllTimersAsync()
      await collectPromise

      const costStats = collector.getCostStats()
      if (costStats.totalCost > 0) {
        expect(costStats.averageCostPerFiling).toBeGreaterThan(0)
      }
    })

    it('should use configured cost per request', () => {
      const customCollector = new CAStateCollector({ costPerRequest: 0.02 })
      const costStats = customCollector.getCostStats()

      expect(costStats.costPerRequest).toBe(0.02)
    })
  })

  describe('rate limiting integration', () => {
    it('should respect CA rate limits (60/min)', () => {
      const status = collector.getStatus()

      expect(status.rateLimitStats?.perMinute.limit).toBe(60)
    })

    it('should respect CA rate limits (1200/hour)', () => {
      const status = collector.getStatus()

      expect(status.rateLimitStats?.perHour.limit).toBe(1200)
    })

    it('should respect CA rate limits (12000/day)', () => {
      const status = collector.getStatus()

      expect(status.rateLimitStats?.perDay.limit).toBe(12000)
    })

    it('should track rate limit consumption', async () => {
      const searches = []

      for (let i = 0; i < 3; i++) {
        searches.push(collector.searchByBusinessName(`Company ${i}`))
      }

      await vi.runAllTimersAsync()
      await Promise.all(searches)

      const status = collector.getStatus()
      expect(status.rateLimitStats?.perMinute.current).toBeGreaterThan(0)
    })
  })

  describe('cost management', () => {
    it('should increment cost with each API request', async () => {
      const beforeCost = collector.getCostStats().totalCost

      const searchPromise = collector.searchByBusinessName('Test Corp')
      await vi.runAllTimersAsync()
      await searchPromise

      const afterCost = collector.getCostStats().totalCost
      expect(afterCost).toBeGreaterThan(beforeCost)
    })

    it('should track cumulative cost across multiple operations', async () => {
      const operations = [
        collector.searchByBusinessName('Corp 1'),
        collector.searchByFilingNumber('CA-2024-001234'),
        collector.collectNewFilings({ limit: 2 })
      ]

      await vi.runAllTimersAsync()
      await Promise.all(operations)

      const costStats = collector.getCostStats()
      expect(costStats.totalCost).toBeGreaterThan(0.01) // At least 3 requests
    })
  })

  describe('OAuth2 authentication (mocked)', () => {
    it('should initialize without requiring immediate auth', () => {
      const newCollector = new CAStateCollector({
        apiKey: 'test-key',
        clientId: 'test-client',
        clientSecret: 'test-secret'
      })

      expect(newCollector).toBeDefined()
    })

    it('should handle authentication during API calls', async () => {
      const customCollector = new CAStateCollector({
        apiKey: 'test-key'
      })

      const searchPromise = customCollector.searchByBusinessName('Test')
      await vi.runAllTimersAsync()

      // Should not throw authentication errors
      await expect(searchPromise).resolves.toBeDefined()
    })
  })
})
