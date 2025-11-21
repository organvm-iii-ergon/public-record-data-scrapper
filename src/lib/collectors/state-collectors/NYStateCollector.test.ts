/**
 * Tests for NYStateCollector
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NYStateCollector } from './NYStateCollector'
import type { UCCFiling } from '../types'

describe('NYStateCollector', () => {
  let collector: NYStateCollector

  beforeEach(() => {
    collector = new NYStateCollector()
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
      const customCollector = new NYStateCollector({
        timeout: 60000,
        retryAttempts: 5
      })

      expect(customCollector).toBeDefined()
    })

    it('should initialize with healthy status', () => {
      const status = collector.getStatus()
      expect(status.isHealthy).toBe(true)
    })
  })

  describe('searchByBusinessName()', () => {
    it('should search for filings by business name', async () => {
      const searchPromise = collector.searchByBusinessName('Example Corp')

      // Fast-forward timers to resolve mock delays
      await vi.runAllTimersAsync()

      const result = await searchPromise

      expect(result).toBeDefined()
      expect(result.filings).toBeInstanceOf(Array)
      expect(result.total).toBeGreaterThanOrEqual(0)
      expect(typeof result.hasMore).toBe('boolean')
    })

    it('should return filings with correct structure', async () => {
      const searchPromise = collector.searchByBusinessName('Example Corp')
      await vi.runAllTimersAsync()
      const result = await searchPromise

      if (result.filings.length > 0) {
        const filing = result.filings[0]

        expect(filing).toHaveProperty('filingNumber')
        expect(filing).toHaveProperty('filingType')
        expect(filing).toHaveProperty('filingDate')
        expect(filing).toHaveProperty('status')
        expect(filing).toHaveProperty('state')
        expect(filing).toHaveProperty('debtor')
        expect(filing).toHaveProperty('securedParty')
        expect(filing.state).toBe('NY')
      }
    })

    it('should respect rate limits', async () => {
      const searches = []

      // Make 3 concurrent searches
      for (let i = 0; i < 3; i++) {
        searches.push(collector.searchByBusinessName(`Company ${i}`))
      }

      await vi.runAllTimersAsync()
      await Promise.all(searches)

      const status = collector.getStatus()
      expect(status.totalCollected).toBeGreaterThan(0)
    })

    it('should update statistics after search', async () => {
      const searchPromise = collector.searchByBusinessName('Test Corp')
      await vi.runAllTimersAsync()
      await searchPromise

      const status = collector.getStatus()
      expect(status.totalCollected).toBeGreaterThan(0)
      expect(status.lastCollectionTime).toBeDefined()
    })
  })

  describe('searchByFilingNumber()', () => {
    it('should search for filing by number', async () => {
      const searchPromise = collector.searchByFilingNumber('NY-2024-001234')
      await vi.runAllTimersAsync()
      const filing = await searchPromise

      expect(filing).toBeDefined()
      if (filing) {
        expect(filing.filingNumber).toBe('NY-2024-001234')
        expect(filing.state).toBe('NY')
      }
    })

    it('should return null for non-existent filing', async () => {
      const searchPromise = collector.searchByFilingNumber('INVALID-123')
      await vi.runAllTimersAsync()
      const filing = await searchPromise

      expect(filing).toBeNull()
    })

    it('should handle NY-prefixed filing numbers', async () => {
      const searchPromise = collector.searchByFilingNumber('NY-2024-999999')
      await vi.runAllTimersAsync()
      const filing = await searchPromise

      expect(filing).toBeDefined()
      if (filing) {
        expect(filing.filingNumber).toContain('NY-')
      }
    })
  })

  describe('getFilingDetails()', () => {
    it('should get detailed filing information', async () => {
      const detailsPromise = collector.getFilingDetails('NY-2024-001234')
      await vi.runAllTimersAsync()
      const filing = await detailsPromise

      expect(filing).toBeDefined()
      expect(filing.filingNumber).toBe('NY-2024-001234')
    })

    it('should throw error for non-existent filing', async () => {
      const detailsPromise = collector.getFilingDetails('INVALID-123')

      // Run timers and expect rejection simultaneously
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
        expect(filing.state).toBe('NY')
        expect(filing.filingNumber).toContain('NY-')
        expect(filing.filingDate).toBeDefined()
        expect(filing.debtor).toBeDefined()
        expect(filing.securedParty).toBeDefined()
      })
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
        filingNumber: 'NY-2024-001234',
        filingType: 'UCC-1',
        filingDate: '2024-01-15',
        status: 'active',
        state: 'NY',
        securedParty: {
          name: 'Example Bank NA'
        },
        debtor: {
          name: 'Example Business LLC'
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
      const filing = { ...validFiling, state: 'CA' }
      const result = collector.validateFiling(filing)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid state: CA, expected NY')
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
      // Make successful request
      const successPromise = collector.searchByFilingNumber('NY-2024-001234')
      await vi.runAllTimersAsync()
      await successPromise

      const status = collector.getStatus()
      expect(status.errorRate).toBeGreaterThanOrEqual(0)
      expect(status.errorRate).toBeLessThanOrEqual(1)
    })

    it('should calculate average latency', async () => {
      // Make a few requests
      const promises = [
        collector.searchByFilingNumber('NY-2024-001234'),
        collector.searchByFilingNumber('NY-2024-005678')
      ]

      await vi.runAllTimersAsync()
      await Promise.all(promises)

      const status = collector.getStatus()
      expect(status.averageLatency).toBeGreaterThan(0)
    })
  })

  describe('rate limiting integration', () => {
    it('should respect NY rate limits (30/min)', async () => {
      const status = collector.getStatus()

      expect(status.rateLimitStats?.perMinute.limit).toBe(30)
    })

    it('should respect NY rate limits (500/hour)', async () => {
      const status = collector.getStatus()

      expect(status.rateLimitStats?.perHour.limit).toBe(500)
    })

    it('should respect NY rate limits (5000/day)', async () => {
      const status = collector.getStatus()

      expect(status.rateLimitStats?.perDay.limit).toBe(5000)
    })

    it('should track rate limit consumption', async () => {
      const searches = []

      // Make 3 searches
      for (let i = 0; i < 3; i++) {
        searches.push(collector.searchByBusinessName(`Company ${i}`))
      }

      await vi.runAllTimersAsync()
      await Promise.all(searches)

      const status = collector.getStatus()
      expect(status.rateLimitStats?.perMinute.current).toBeGreaterThan(0)
    })
  })
})
