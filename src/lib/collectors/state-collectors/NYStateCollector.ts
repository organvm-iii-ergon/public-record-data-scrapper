/**
 * New York State UCC Filing Collector
 *
 * Collects UCC filing data from the NY Department of State portal
 * Portal: https://appext20.dos.ny.gov/pls/ucc_public/web_search.main_frame
 *
 * Challenges:
 * - Frame-based Oracle PL/SQL interface
 * - HTML scraping required
 * - Rate limits: 30/min, 500/hour, 5000/day
 */

import { RateLimiter } from '../RateLimiter'
import type {
  StateCollector,
  UCCFiling,
  SearchResult,
  SearchParams,
  CollectionOptions,
  CollectionError,
  CollectionErrorType,
  ValidationResult,
  CollectorStatus
} from '../types'

/**
 * NY Portal Selectors
 * These selectors target the Oracle PL/SQL frame-based interface
 */
const NY_SELECTORS = {
  // Main frame elements
  searchFrame: 'frame[name="search"]',
  resultsFrame: 'frame[name="results"]',

  // Search form elements
  searchTypeSelect: 'select[name="search_type"]',
  searchInput: 'input[name="search_term"]',
  submitButton: 'input[type="submit"][value="Search"]',

  // Results table elements
  resultsTable: 'table.results',
  resultRow: 'tr.result-row',
  noResultsMessage: 'td.no-results',

  // Filing detail elements
  filingNumber: 'td.filing-number, span.filing-num',
  filingDate: 'td.filing-date, span.file-date',
  filingType: 'td.filing-type, span.file-type',
  status: 'td.status, span.status',
  expirationDate: 'td.expiration, span.exp-date',
  debtorName: 'td.debtor-name, span.debtor',
  securedPartyName: 'td.secured-party, span.secured',
  collateral: 'td.collateral, div.collateral-desc',
  detailsLink: 'a.details'
}

/**
 * NY State Collector Configuration
 */
interface NYCollectorConfig {
  portalUrl?: string
  timeout?: number
  retryAttempts?: number
  retryDelay?: number
}

/**
 * NY State Collector
 * Note: This is a mock implementation that simulates the collection process.
 * A production implementation would use Puppeteer or similar to scrape the actual portal.
 */
export class NYStateCollector implements StateCollector {
  private config: NYCollectorConfig
  private rateLimiter: RateLimiter
  private stats: {
    totalCollected: number
    totalErrors: number
    totalRequests: number
    lastCollectionTime?: string
    latencies: number[]
  }

  constructor(config: NYCollectorConfig = {}) {
    this.config = {
      portalUrl: config.portalUrl || 'https://appext20.dos.ny.gov/pls/ucc_public/web_search.main_frame',
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 2000
    }

    // NY rate limits: 30/min, 500/hour, 5000/day
    this.rateLimiter = new RateLimiter({
      requestsPerMinute: 30,
      requestsPerHour: 500,
      requestsPerDay: 5000
    })

    this.stats = {
      totalCollected: 0,
      totalErrors: 0,
      totalRequests: 0,
      latencies: []
    }
  }

  /**
   * Search for filings by business name
   */
  async searchByBusinessName(name: string): Promise<SearchResult> {
    await this.rateLimiter.acquire()

    const startTime = Date.now()

    try {
      // In production, this would:
      // 1. Launch Puppeteer browser
      // 2. Navigate to main_frame
      // 3. Switch to search frame
      // 4. Select "Business Name" search type
      // 5. Enter search term
      // 6. Submit form
      // 7. Switch to results frame
      // 8. Parse results table
      // 9. Extract filing data

      // Mock implementation
      const filings = await this.mockSearch(name, 'business')

      this.recordLatency(Date.now() - startTime)
      this.stats.totalCollected += filings.length
      this.stats.lastCollectionTime = new Date().toISOString()

      return {
        filings,
        total: filings.length,
        hasMore: false
      }
    } catch (error) {
      this.stats.totalErrors++
      throw this.handleError(error as Error, 'NETWORK')
    }
  }

  /**
   * Search for a specific filing by number
   */
  async searchByFilingNumber(number: string): Promise<UCCFiling | null> {
    await this.rateLimiter.acquire()

    const startTime = Date.now()

    try {
      // In production, this would:
      // 1. Navigate to portal
      // 2. Select "Filing Number" search type
      // 3. Enter filing number
      // 4. Submit and parse result

      const filing = await this.mockSearchByNumber(number)

      this.recordLatency(Date.now() - startTime)
      if (filing) {
        this.stats.totalCollected++
      }
      this.stats.lastCollectionTime = new Date().toISOString()

      return filing
    } catch (error) {
      this.stats.totalErrors++
      throw this.handleError(error as Error, 'NETWORK')
    }
  }

  /**
   * Get detailed information about a filing
   */
  async getFilingDetails(filingNumber: string): Promise<UCCFiling> {
    const filing = await this.searchByFilingNumber(filingNumber)

    if (!filing) {
      throw new Error(`Filing ${filingNumber} not found`)
    }

    return filing
  }

  /**
   * Collect new filings since a given date
   */
  async collectNewFilings(options: CollectionOptions): Promise<UCCFiling[]> {
    await this.rateLimiter.acquire()

    const startTime = Date.now()

    try {
      // In production, this would:
      // 1. Navigate to portal
      // 2. Select date range search
      // 3. Set date filters
      // 4. Paginate through results
      // 5. Collect all filings

      const filings = await this.mockCollectNew(options)

      this.recordLatency(Date.now() - startTime)
      this.stats.totalCollected += filings.length
      this.stats.lastCollectionTime = new Date().toISOString()

      return filings
    } catch (error) {
      this.stats.totalErrors++
      throw this.handleError(error as Error, 'NETWORK')
    }
  }

  /**
   * Validate a filing object
   */
  validateFiling(filing: UCCFiling): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Required fields
    if (!filing.filingNumber) {
      errors.push('Missing filing number')
    }

    if (!filing.filingDate) {
      errors.push('Missing filing date')
    }

    if (!filing.debtor?.name) {
      errors.push('Missing debtor name')
    }

    if (!filing.securedParty?.name) {
      errors.push('Missing secured party name')
    }

    if (!filing.collateral) {
      warnings.push('Missing collateral description')
    }

    // State validation
    if (filing.state !== 'NY') {
      errors.push(`Invalid state: ${filing.state}, expected NY`)
    }

    // Date validation
    if (filing.filingDate) {
      const filingDate = new Date(filing.filingDate)
      if (isNaN(filingDate.getTime())) {
        errors.push('Invalid filing date format')
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Get collector status and metrics
   */
  getStatus(): CollectorStatus {
    const rateLimitStats = this.rateLimiter.getStats()

    return {
      isHealthy: this.stats.totalRequests > 0 ? this.stats.totalErrors / this.stats.totalRequests < 0.1 : true,
      lastCollectionTime: this.stats.lastCollectionTime,
      totalCollected: this.stats.totalCollected,
      errorRate: this.stats.totalRequests > 0 ? this.stats.totalErrors / this.stats.totalRequests : 0,
      averageLatency: this.stats.latencies.length > 0
        ? this.stats.latencies.reduce((a, b) => a + b, 0) / this.stats.latencies.length
        : 0,
      rateLimitStats: {
        perMinute: rateLimitStats.perMinute,
        perHour: rateLimitStats.perHour,
        perDay: rateLimitStats.perDay
      }
    }
  }

  /**
   * Record latency for metrics
   */
  private recordLatency(latency: number): void {
    this.stats.latencies.push(latency)
    // Keep only last 100 latencies
    if (this.stats.latencies.length > 100) {
      this.stats.latencies.shift()
    }
    this.stats.totalRequests++
  }

  /**
   * Handle errors and convert to CollectionError
   */
  private handleError(error: Error, type: CollectionErrorType): CollectionError {
    const CollectionErrorClass = class extends Error {
      constructor(
        public state: string,
        public errorType: CollectionErrorType,
        public recoverable: boolean,
        message: string,
        public originalError?: Error
      ) {
        super(message)
        this.name = 'CollectionError'
      }
    }

    return new CollectionErrorClass(
      'NY',
      type,
      type === 'NETWORK' || type === 'TIMEOUT',
      error.message,
      error
    )
  }

  // ============================================
  // Mock methods (replace with real scraping in production)
  // ============================================

  private async mockSearch(query: string, type: 'business' | 'filing'): Promise<UCCFiling[]> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000))

    // Return mock data
    return [
      {
        filingNumber: 'NY-2024-001234',
        filingType: 'UCC-1',
        filingDate: '2024-01-15',
        expirationDate: '2029-01-15',
        status: 'active',
        state: 'NY',
        securedParty: {
          name: 'Example Bank NA',
          address: {
            street: '123 Main St',
            city: 'New York',
            state: 'NY',
            zipCode: '10001'
          }
        },
        debtor: {
          name: query,
          address: {
            street: '456 Business Ave',
            city: 'Albany',
            state: 'NY',
            zipCode: '12207'
          }
        },
        collateral: 'All assets, equipment, and inventory'
      }
    ]
  }

  private async mockSearchByNumber(filingNumber: string): Promise<UCCFiling | null> {
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000))

    if (!filingNumber.startsWith('NY-')) {
      return null
    }

    return {
      filingNumber,
      filingType: 'UCC-1',
      filingDate: '2024-01-15',
      expirationDate: '2029-01-15',
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
  }

  private async mockCollectNew(options: CollectionOptions): Promise<UCCFiling[]> {
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))

    const limit = options.limit || 10

    return Array.from({ length: Math.min(limit, 5) }, (_, i) => ({
      filingNumber: `NY-2024-${String(i + 1).padStart(6, '0')}`,
      filingType: 'UCC-1',
      filingDate: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'active' as const,
      state: 'NY',
      securedParty: {
        name: `Lender ${i + 1}`
      },
      debtor: {
        name: `Business ${i + 1}`
      },
      collateral: 'Equipment and inventory'
    }))
  }
}
