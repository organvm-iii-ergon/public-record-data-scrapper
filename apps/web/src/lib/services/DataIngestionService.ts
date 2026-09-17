/**
 * Data Ingestion Service
 *
 * Handles fetching UCC filing data from various sources including:
 * - State UCC filing portals
 * - Public records databases
 * - External data providers
 */

import { UCCFiling } from '@public-records/core'
import { retry, CircuitBreaker } from '../utils/retry'

export interface DataSource {
  id: string
  name: string
  type: 'state-portal' | 'api' | 'database'
  endpoint: string
  apiKey?: string
  rateLimit: number // requests per minute
}

export interface IngestionConfig {
  sources: DataSource[]
  batchSize: number
  retryAttempts: number
  retryDelay: number // milliseconds
  states: string[] // States to scrape
}

export interface IngestionResult {
  success: boolean
  filings: UCCFiling[]
  errors: string[]
  metadata: {
    source: string
    timestamp: string
    recordCount: number
    processingTime: number
  }
}

/**
 * Raw API response item from external UCC data sources
 * Handles various field naming conventions (snake_case and camelCase)
 */
interface RawUCCFilingData {
  id?: string
  filing_date?: string
  filingDate?: string
  debtor_name?: string
  debtorName?: string
  secured_party?: string
  securedParty?: string
  lien_amount?: number
  lienAmount?: number
  status?: string
  filing_type?: string
  filingType?: string
}

export class DataIngestionService {
  private config: IngestionConfig
  private requestCounts: Map<string, number[]> = new Map()
  private circuitBreakers: Map<string, CircuitBreaker> = new Map()

  constructor(config: IngestionConfig) {
    this.config = config
  }

  /**
   * Get or create circuit breaker for a source
   */
  private getCircuitBreaker(sourceId: string): CircuitBreaker {
    if (!this.circuitBreakers.has(sourceId)) {
      this.circuitBreakers.set(sourceId, new CircuitBreaker(5, 60000))
    }
    return this.circuitBreakers.get(sourceId)!
  }

  /**
   * Ingest UCC filing data from all configured sources
   */
  async ingestData(states?: string[]): Promise<IngestionResult[]> {
    const targetStates = states || this.config.states
    const results: IngestionResult[] = []

    for (const source of this.config.sources) {
      try {
        const result = await this.ingestFromSource(source, targetStates)
        results.push(result)
      } catch (error) {
        console.error(`Failed to ingest from ${source.name}:`, error)
        results.push({
          success: false,
          filings: [],
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          metadata: {
            source: source.name,
            timestamp: new Date().toISOString(),
            recordCount: 0,
            processingTime: 0
          }
        })
      }
    }

    return results
  }

  /**
   * Ingest data from a specific source
   */
  private async ingestFromSource(source: DataSource, states: string[]): Promise<IngestionResult> {
    const startTime = Date.now()
    const filings: UCCFiling[] = []
    const errors: string[] = []

    for (const state of states) {
      try {
        // Check rate limit
        await this.checkRateLimit(source)

        // Fetch data based on source type
        let stateFilings: UCCFiling[] = []

        switch (source.type) {
          case 'state-portal':
            stateFilings = await this.scrapeStatePortal(source, state)
            break
          case 'api':
            stateFilings = await this.fetchFromAPI(source, state)
            break
          case 'database':
            stateFilings = await this.queryDatabase(source, state)
            break
        }

        filings.push(...stateFilings)
      } catch (error) {
        const errorMsg = `Error ingesting ${state} from ${source.name}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
        errors.push(errorMsg)
        console.error(errorMsg)
      }
    }

    return {
      success: errors.length === 0,
      filings,
      errors,
      metadata: {
        source: source.name,
        timestamp: new Date().toISOString(),
        recordCount: filings.length,
        processingTime: Date.now() - startTime
      }
    }
  }

  /**
   * Scrape UCC filings from state portal
   */
  private async scrapeStatePortal(source: DataSource, state: string): Promise<UCCFiling[]> {
    // In a real implementation, this would use a headless browser (Playwright/Puppeteer)
    // to scrape state UCC filing portals

    // For now, we'll simulate the scraping with a delay
    await this.delay(1000)

    // Placeholder implementation - would be replaced with actual scraping logic
    console.log(`Scraping ${state} from ${source.endpoint}`)

    // This would return actual scraped data
    return []
  }

  /**
   * Fetch UCC filings from external API with retry logic
   */
  private async fetchFromAPI(source: DataSource, state: string): Promise<UCCFiling[]> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (source.apiKey) {
      headers['Authorization'] = `Bearer ${source.apiKey}`
    }

    const url = `${source.endpoint}/filings?state=${state}&status=lapsed`

    // Use circuit breaker and retry logic
    const circuitBreaker = this.getCircuitBreaker(source.id)

    return await circuitBreaker.execute(async () => {
      return await retry(
        async () => {
          const response = await fetch(url, {
            method: 'GET',
            headers,
            signal: AbortSignal.timeout(30000) // 30 second timeout
          })

          if (!response.ok) {
            const error = new Error(`HTTP error! status: ${response.status}`)

            // Don't retry client errors (4xx except 429)
            if (response.status >= 400 && response.status < 500 && response.status !== 429) {
              throw error
            }

            throw error
          }

          const data = await response.json()
          return this.transformAPIResponse(data, state)
        },
        {
          maxAttempts: this.config.retryAttempts,
          baseDelay: this.config.retryDelay,
          exponentialBackoff: true,
          onRetry: (attempt, error) => {
            console.log(`Retry ${attempt} for ${source.name} - ${state}: ${error.message}`)
          }
        }
      )
    })
  }

  /**
   * Query UCC filings from database
   */
  private async queryDatabase(source: DataSource, state: string): Promise<UCCFiling[]> {
    // Placeholder for database query implementation
    // Would use a database client (e.g., Prisma, TypeORM) to query UCC filing data
    console.log(`Querying database for ${state} filings`)

    return []
  }

  /**
   * Transform API response to UCCFiling format
   */
  private transformAPIResponse(data: unknown, state: string): UCCFiling[] {
    // Transform external API response to our UCCFiling type
    if (!Array.isArray(data)) {
      return []
    }

    return (data as RawUCCFilingData[]).map((item) => ({
      id: item.id || `ucc-${Date.now()}-${Math.random()}`,
      filingDate: item.filing_date || item.filingDate || new Date().toISOString().split('T')[0],
      debtorName: item.debtor_name || item.debtorName || '',
      securedParty: item.secured_party || item.securedParty || '',
      state: state,
      lienAmount: item.lien_amount || item.lienAmount,
      status:
        item.status === 'active'
          ? 'active'
          : item.status === 'terminated'
            ? 'terminated'
            : 'lapsed',
      filingType: item.filing_type === 'UCC-3' ? 'UCC-3' : 'UCC-1'
    }))
  }

  /**
   * Check and enforce rate limiting
   */
  private async checkRateLimit(source: DataSource): Promise<void> {
    const now = Date.now()
    const windowMs = 60000 // 1 minute

    if (!this.requestCounts.has(source.id)) {
      this.requestCounts.set(source.id, [])
    }

    const timestamps = this.requestCounts.get(source.id)!

    // Remove timestamps outside the window
    const recentTimestamps = timestamps.filter((ts) => now - ts < windowMs)

    if (recentTimestamps.length >= source.rateLimit) {
      // Calculate delay needed
      const oldestTimestamp = recentTimestamps[0]
      const delayMs = windowMs - (now - oldestTimestamp)

      console.log(`Rate limit reached for ${source.name}. Waiting ${delayMs}ms...`)
      await this.delay(delayMs)
    }

    // Add current timestamp
    recentTimestamps.push(now)
    this.requestCounts.set(source.id, recentTimestamps)
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Find lapsed UCC filings (potential defaults)
   */
  async findLapsedFilings(
    minDaysLapsed: number = 1095 // 3 years default
  ): Promise<UCCFiling[]> {
    const results = await this.ingestData()
    const allFilings = results.flatMap((r) => r.filings)

    const now = new Date()

    return allFilings.filter((filing) => {
      if (filing.status !== 'lapsed') return false

      const filingDate = new Date(filing.filingDate)
      const daysSinceFiling = (now.getTime() - filingDate.getTime()) / (1000 * 60 * 60 * 24)

      return daysSinceFiling >= minDaysLapsed
    })
  }

  /**
   * Get ingestion statistics
   */
  getStatistics(results: IngestionResult[]): {
    totalRecords: number
    successRate: number
    avgProcessingTime: number
    errorCount: number
  } {
    const totalRecords = results.reduce((sum, r) => sum + r.metadata.recordCount, 0)
    const successCount = results.filter((r) => r.success).length
    const successRate = results.length > 0 ? (successCount / results.length) * 100 : 0
    const avgProcessingTime =
      results.length > 0
        ? results.reduce((sum, r) => sum + r.metadata.processingTime, 0) / results.length
        : 0
    const errorCount = results.reduce((sum, r) => sum + r.errors.length, 0)

    return {
      totalRecords,
      successRate,
      avgProcessingTime,
      errorCount
    }
  }
}

/**
 * Default configuration for data ingestion
 */
export const defaultIngestionConfig: IngestionConfig = {
  sources: [
    {
      id: 'demo-api',
      name: 'Demo UCC API',
      type: 'api',
      endpoint: 'https://api.example.com/ucc', // Placeholder
      rateLimit: 60 // 60 requests per minute
    }
  ],
  batchSize: 100,
  retryAttempts: 3,
  retryDelay: 2000,
  states: ['NY', 'CA', 'TX', 'FL', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI']
}
