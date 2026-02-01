/**
 * California State UCC Filing Collector
 *
 * Collects UCC filing data from the California Secretary of State API
 * API: https://bizfileonline.sos.ca.gov/api
 *
 * Challenges:
 * - OAuth2 authentication required
 * - High cost: $0.01 per request
 * - Large volume: 5-10 million records
 * - Rate limits: 60/min, 1200/hour, 12000/day
 */

import { RateLimiter } from '../RateLimiter'
import type {
  StateCollector,
  UCCFiling,
  SearchResult,
  CollectionOptions,
  CollectionErrorType,
  ValidationResult,
  CollectorStatus
} from '../types'

/**
 * CA API Configuration
 */
interface CAAPIConfig {
  baseUrl?: string
  apiKey?: string
  clientId?: string
  clientSecret?: string
  timeout?: number
  retryAttempts?: number
  costPerRequest?: number
}

/**
 * OAuth2 Token Response
 */
interface OAuth2Token {
  accessToken: string
  tokenType: string
  expiresIn: number
  refreshToken?: string
  expiresAt: number // Computed
}

/**
 * California State Collector
 * Note: This is a mock implementation. Production would require:
 * - Real OAuth2 flow
 * - Actual API integration
 * - Cost tracking and budget management
 */
export class CAStateCollector implements StateCollector {
  private config: Required<CAAPIConfig>
  private rateLimiter: RateLimiter
  private stats: {
    totalCollected: number
    totalErrors: number
    totalRequests: number
    totalCost: number
    lastCollectionTime?: string
    latencies: number[]
  }
  private token?: OAuth2Token

  constructor(config: CAAPIConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'https://bizfileonline.sos.ca.gov/api/v1',
      apiKey: config.apiKey || '',
      clientId: config.clientId || '',
      clientSecret: config.clientSecret || '',
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 3,
      costPerRequest: config.costPerRequest || 0.01 // $0.01 per request
    }

    // CA rate limits: 60/min, 1200/hour, 12000/day
    this.rateLimiter = new RateLimiter({
      requestsPerMinute: 60,
      requestsPerHour: 1200,
      requestsPerDay: 12000
    })

    this.stats = {
      totalCollected: 0,
      totalErrors: 0,
      totalRequests: 0,
      totalCost: 0,
      latencies: []
    }
  }

  /**
   * Authenticate with OAuth2 and get access token
   * @private
   */
  private async authenticate(): Promise<void> {
    // Check if token is still valid
    if (this.token && this.token.expiresAt > Date.now()) {
      return
    }

    // In production, this would:
    // 1. Exchange client credentials for access token
    // 2. Store token with expiration
    // 3. Auto-refresh before expiration

    // Mock implementation
    this.token = {
      accessToken: 'mock-access-token',
      tokenType: 'Bearer',
      expiresIn: 3600,
      expiresAt: Date.now() + 3600 * 1000
    }
  }

  /**
   * Make authenticated API request
   * @private
   */
  private async apiRequest<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
    void endpoint
    void params
    await this.rateLimiter.acquire()
    await this.authenticate()

    // In production, this would:
    // 1. Add OAuth2 Bearer token to headers
    // 2. Make HTTP request
    // 3. Handle rate limiting
    // 4. Retry on failures
    // 5. Track costs

    this.stats.totalRequests++
    this.stats.totalCost += this.config.costPerRequest

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300))

    return {} as T
  }

  /**
   * Search for filings by business name
   */
  async searchByBusinessName(name: string): Promise<SearchResult> {
    const startTime = Date.now()

    try {
      // In production, this would call the real API
      const mockFilings = await this.mockSearchByBusinessName(name)

      this.recordLatency(Date.now() - startTime)
      this.stats.totalCollected += mockFilings.length
      this.stats.lastCollectionTime = new Date().toISOString()

      return {
        filings: mockFilings,
        total: mockFilings.length,
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
    const startTime = Date.now()

    try {
      const filing = await this.mockSearchByFilingNumber(number)

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
    const startTime = Date.now()

    try {
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
    if (filing.state !== 'CA') {
      errors.push(`Invalid state: ${filing.state}, expected CA`)
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
      isHealthy:
        this.stats.totalRequests > 0
          ? this.stats.totalErrors / this.stats.totalRequests < 0.1
          : true,
      lastCollectionTime: this.stats.lastCollectionTime,
      totalCollected: this.stats.totalCollected,
      errorRate:
        this.stats.totalRequests > 0 ? this.stats.totalErrors / this.stats.totalRequests : 0,
      averageLatency:
        this.stats.latencies.length > 0
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
   * Get cost statistics
   */
  getCostStats() {
    return {
      totalCost: this.stats.totalCost,
      totalRequests: this.stats.totalRequests,
      costPerRequest: this.config.costPerRequest,
      averageCostPerFiling:
        this.stats.totalCollected > 0 ? this.stats.totalCost / this.stats.totalCollected : 0
    }
  }

  /**
   * Record latency for metrics
   * @private
   */
  private recordLatency(latency: number): void {
    this.stats.latencies.push(latency)
    if (this.stats.latencies.length > 100) {
      this.stats.latencies.shift()
    }
  }

  /**
   * Handle errors and convert to CollectionError
   * @private
   */
  private handleError(error: Error, type: CollectionErrorType): Error {
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
      'CA',
      type,
      type === 'NETWORK' || type === 'TIMEOUT',
      error.message,
      error
    )
  }

  // ============================================
  // Mock methods (replace with real API calls in production)
  // ============================================

  private async mockSearchByBusinessName(name: string): Promise<UCCFiling[]> {
    await this.apiRequest('/search', { query: name, type: 'business_name' })

    return [
      {
        filingNumber: 'CA-2024-001234',
        filingType: 'UCC-1',
        filingDate: '2024-01-15',
        expirationDate: '2029-01-15',
        status: 'active',
        state: 'CA',
        securedParty: {
          name: 'California Bank & Trust',
          address: {
            street: '555 Montgomery St',
            city: 'San Francisco',
            state: 'CA',
            zipCode: '94111'
          }
        },
        debtor: {
          name: name,
          address: {
            street: '123 Tech Blvd',
            city: 'San Jose',
            state: 'CA',
            zipCode: '95110'
          }
        },
        collateral: 'All assets, equipment, inventory, and accounts receivable'
      }
    ]
  }

  private async mockSearchByFilingNumber(filingNumber: string): Promise<UCCFiling | null> {
    await this.apiRequest('/filing', { filingNumber })

    if (!filingNumber.startsWith('CA-')) {
      return null
    }

    return {
      filingNumber,
      filingType: 'UCC-1',
      filingDate: '2024-01-15',
      expirationDate: '2029-01-15',
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
  }

  private async mockCollectNew(options: CollectionOptions): Promise<UCCFiling[]> {
    const limit = options.limit || 10

    await this.apiRequest('/filings', {
      since: options.since?.toISOString(),
      limit
    })

    return Array.from({ length: Math.min(limit, 5) }, (_, i) => ({
      filingNumber: `CA-2024-${String(i + 1).padStart(6, '0')}`,
      filingType: 'UCC-1',
      filingDate: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'active' as const,
      state: 'CA',
      securedParty: {
        name: `CA Lender ${i + 1}`
      },
      debtor: {
        name: `CA Business ${i + 1}`
      },
      collateral: 'Equipment, inventory, and accounts receivable'
    }))
  }
}
