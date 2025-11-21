// @ts-nocheck - Commented out playwright code
/**
 * New York UCC Portal Scraper
 *
 * Example scraper for New York State UCC filing portal using Playwright
 * Portal: https://appext20.dos.ny.gov/pls/ucc_public/web_search.main_frame
 *
 * NOTE: This is a reference implementation. You'll need to:
 * 1. Install Playwright: npm install -D playwright
 * 2. Respect the portal's robots.txt and terms of service
 * 3. Implement appropriate rate limiting
 * 4. Handle CAPTCHAs if present
 */

import type { UCCFiling } from '../types'

export interface ScraperConfig {
  headless: boolean
  timeout: number // milliseconds
  userAgent?: string
  proxyUrl?: string
}

export interface ScraperResult {
  success: boolean
  filings: UCCFiling[]
  errors: string[]
  metadata: {
    searchCriteria: Record<string, any>
    resultsCount: number
    scrapedCount: number
    timestamp: string
    processingTime: number
  }
}

/**
 * New York UCC Portal Scraper
 *
 * @example
 * ```typescript
 * const scraper = new NYUCCPortalScraper({
 *   headless: true,
 *   timeout: 30000
 * })
 *
 * const result = await scraper.searchByDebtorName('ACME Corporation')
 * console.log(`Found ${result.filings.length} filings`)
 * ```
 */
export class NYUCCPortalScraper {
  private config: ScraperConfig

  constructor(config: Partial<ScraperConfig> = {}) {
    this.config = {
      headless: config.headless ?? true,
      timeout: config.timeout ?? 30000,
      userAgent: config.userAgent,
      proxyUrl: config.proxyUrl
    }
  }

  /**
   * Search by debtor name
   */
  async searchByDebtorName(debtorName: string): Promise<ScraperResult> {
    const startTime = Date.now()
    const filings: UCCFiling[] = []
    const errors: string[] = []

    try {
      // Lazy load playwright only when needed
      const playwright = await this.loadPlaywright()
      if (!playwright) {
        throw new Error('Playwright not installed. Run: npm install -D playwright')
      }

      const { chromium } = playwright
      const browser = await chromium.launch({
        headless: this.config.headless,
        proxy: this.config.proxyUrl ? { server: this.config.proxyUrl } : undefined
      })

      const context = await browser.newContext({
        userAgent: this.config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      })

      const page = await context.newPage()
      page.setDefaultTimeout(this.config.timeout)

      try {
        // Navigate to search page
        await page.goto('https://appext20.dos.ny.gov/pls/ucc_public/web_search.main_frame')

        // Wait for search form
        await page.waitForSelector('input[name="p_debtor_name"]', { timeout: this.config.timeout })

        // Fill in debtor name
        await page.fill('input[name="p_debtor_name"]', debtorName)

        // Submit search
        await page.click('input[type="submit"]')

        // Wait for results
        await page.waitForLoadState('networkidle')

        // Check for "no results" message
        const noResults = await page.locator('text=No records found').count()
        if (noResults > 0) {
          return {
            success: true,
            filings: [],
            errors: [],
            metadata: {
              searchCriteria: { debtorName },
              resultsCount: 0,
              scrapedCount: 0,
              timestamp: new Date().toISOString(),
              processingTime: Date.now() - startTime
            }
          }
        }

        // Extract filings from results table
        const rows = await page.locator('table.results tr').all()

        for (let i = 1; i < rows.length; i++) {
          // Skip header row
          const row = rows[i]

          try {
            const cells = await row.locator('td').all()

            if (cells.length >= 6) {
              // Extract data from cells
              // NOTE: Cell positions may vary - adjust based on actual portal structure
              const filingNumber = await cells[0].textContent()
              const filingDate = await cells[1].textContent()
              const debtorName = await cells[2].textContent()
              const securedParty = await cells[3].textContent()
              const filingType = await cells[4].textContent()
              const status = await cells[5].textContent()

              // Parse and validate data
              if (filingNumber && filingDate && debtorName && securedParty) {
                const filing: UCCFiling = {
                  id: `ny-${filingNumber.trim()}`,
                  filingDate: this.parseDate(filingDate.trim()),
                  debtorName: debtorName.trim(),
                  securedParty: securedParty.trim(),
                  state: 'NY',
                  status: this.parseStatus(status?.trim() || ''),
                  filingType: filingType?.includes('UCC-3') ? 'UCC-3' : 'UCC-1'
                }

                filings.push(filing)
              }
            }
          } catch (error) {
            errors.push(`Error parsing row ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`)
          }
        }
      } finally {
        await browser.close()
      }

      return {
        success: errors.length === 0,
        filings,
        errors,
        metadata: {
          searchCriteria: { debtorName },
          resultsCount: filings.length,
          scrapedCount: filings.length,
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime
        }
      }
    } catch (error) {
      errors.push(`Scraper error: ${error instanceof Error ? error.message : 'Unknown error'}`)

      return {
        success: false,
        filings,
        errors,
        metadata: {
          searchCriteria: { debtorName },
          resultsCount: 0,
          scrapedCount: filings.length,
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime
        }
      }
    }
  }

  /**
   * Search by filing number
   */
  async searchByFilingNumber(filingNumber: string): Promise<ScraperResult> {
    const startTime = Date.now()
    const filings: UCCFiling[] = []
    const errors: string[] = []

    try {
      const playwright = await this.loadPlaywright()
      if (!playwright) {
        throw new Error('Playwright not installed. Run: npm install -D playwright')
      }

      const { chromium } = playwright
      const browser = await chromium.launch({ headless: this.config.headless })
      const page = await browser.newPage()

      try {
        await page.goto('https://appext20.dos.ny.gov/pls/ucc_public/web_search.main_frame')
        await page.fill('input[name="p_filing_number"]', filingNumber)
        await page.click('input[type="submit"]')
        await page.waitForLoadState('networkidle')

        // Extract filing details from detail page
        // Implementation similar to searchByDebtorName
        // ...

      } finally {
        await browser.close()
      }

      return {
        success: errors.length === 0,
        filings,
        errors,
        metadata: {
          searchCriteria: { filingNumber },
          resultsCount: filings.length,
          scrapedCount: filings.length,
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime
        }
      }
    } catch (error) {
      errors.push(`Scraper error: ${error instanceof Error ? error.message : 'Unknown error'}`)

      return {
        success: false,
        filings,
        errors,
        metadata: {
          searchCriteria: { filingNumber },
          resultsCount: 0,
          scrapedCount: 0,
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime
        }
      }
    }
  }

  /**
   * Search for lapsed filings within a date range
   */
  async searchLapsedFilings(startDate: Date, endDate: Date): Promise<ScraperResult> {
    const startTime = Date.now()
    const filings: UCCFiling[] = []
    const errors: string[] = []

    try {
      const playwright = await this.loadPlaywright()
      if (!playwright) {
        throw new Error('Playwright not installed. Run: npm install -D playwright')
      }

      // Implementation for date range search
      // This would navigate to the appropriate search form
      // and filter for lapsed filings

      return {
        success: errors.length === 0,
        filings,
        errors,
        metadata: {
          searchCriteria: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
          resultsCount: filings.length,
          scrapedCount: filings.length,
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime
        }
      }
    } catch (error) {
      errors.push(`Scraper error: ${error instanceof Error ? error.message : 'Unknown error'}`)

      return {
        success: false,
        filings,
        errors,
        metadata: {
          searchCriteria: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
          resultsCount: 0,
          scrapedCount: 0,
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime
        }
      }
    }
  }

  /**
   * Parse date from various formats
   */
  private parseDate(dateStr: string): string {
    // Common NY UCC portal date format: MM/DD/YYYY
    const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    if (match) {
      const [, month, day, year] = match
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }

    // Fallback to current date if parsing fails
    return new Date().toISOString().split('T')[0]
  }

  /**
   * Parse filing status
   */
  private parseStatus(statusStr: string): 'active' | 'terminated' | 'lapsed' {
    const lower = statusStr.toLowerCase()

    if (lower.includes('active') || lower.includes('filed')) {
      return 'active'
    } else if (lower.includes('terminated') || lower.includes('discharged')) {
      return 'terminated'
    } else if (lower.includes('lapsed') || lower.includes('expired')) {
      return 'lapsed'
    }

    // Default to active for unknown statuses
    return 'active'
  }

  /**
   * Lazy load playwright to avoid requiring it as a dependency
   */
  private async loadPlaywright(): Promise<typeof import('playwright') | null> {
    try {
      return await import('playwright')
    } catch {
      return null
    }
  }
}

/**
 * Example usage
 */
export async function exampleUsage() {
  const scraper = new NYUCCPortalScraper({
    headless: true,
    timeout: 30000
  })

  // Search by debtor name
  const result = await scraper.searchByDebtorName('ACME Corporation LLC')

  if (result.success) {
    console.log(`Found ${result.filings.length} filings`)
    result.filings.forEach(filing => {
      console.log(`- ${filing.id}: ${filing.debtorName} (${filing.filingDate})`)
    })
  } else {
    console.error('Scraping failed:', result.errors)
  }

  return result
}

/**
 * Rate-limited scraper wrapper
 */
export class RateLimitedNYUCCScraper {
  private scraper: NYUCCPortalScraper
  private requestQueue: Array<() => Promise<any>> = []
  private processing = false
  private requestsPerMinute: number
  private lastRequestTime = 0

  constructor(config: Partial<ScraperConfig> = {}, requestsPerMinute: number = 30) {
    this.scraper = new NYUCCPortalScraper(config)
    this.requestsPerMinute = requestsPerMinute
  }

  async searchByDebtorName(debtorName: string): Promise<ScraperResult> {
    return this.enqueue(() => this.scraper.searchByDebtorName(debtorName))
  }

  async searchByFilingNumber(filingNumber: string): Promise<ScraperResult> {
    return this.enqueue(() => this.scraper.searchByFilingNumber(filingNumber))
  }

  private async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await fn()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })

      if (!this.processing) {
        this.processQueue()
      }
    })
  }

  private async processQueue() {
    if (this.processing || this.requestQueue.length === 0) {
      return
    }

    this.processing = true

    while (this.requestQueue.length > 0) {
      const now = Date.now()
      const timeSinceLastRequest = now - this.lastRequestTime
      const minDelay = (60 * 1000) / this.requestsPerMinute

      if (timeSinceLastRequest < minDelay) {
        await this.delay(minDelay - timeSinceLastRequest)
      }

      const request = this.requestQueue.shift()
      if (request) {
        this.lastRequestTime = Date.now()
        await request()
      }
    }

    this.processing = false
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
