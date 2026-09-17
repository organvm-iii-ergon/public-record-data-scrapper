/**
 * California UCC Filing Scraper
 *
 * Scrapes UCC filing data from California Secretary of State
 * Note: This is a simplified implementation for demonstration
 */

import { BaseScraper, ScraperConfig, ScraperResult, UCCFiling } from './base-scraper'

export class CaliforniaUCCScraper extends BaseScraper {
  constructor() {
    const config: ScraperConfig = {
      state: 'CA',
      baseUrl: 'https://bizfileonline.sos.ca.gov/search/business',
      rateLimit: 30, // 30 requests per minute
      timeout: 30000,
      retryAttempts: 3
    }
    super(config)
  }

  /**
   * Search for UCC filings in California
   */
  async search(companyName: string): Promise<ScraperResult> {
    if (!this.validateSearch(companyName)) {
      return {
        success: false,
        error: 'Invalid company name',
        timestamp: new Date().toISOString()
      }
    }

    this.log('info', 'Starting CA UCC search', { companyName })

    try {
      const { result: filings, retryCount } = await this.retryWithBackoff(
        () => this.executeSearch(companyName),
        `CA UCC search for "${companyName}"`
      )

      return {
        success: true,
        filings,
        searchUrl: this.getManualSearchUrl(companyName),
        timestamp: new Date().toISOString(),
        retryCount
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log('error', 'CA UCC search failed', { error: errorMessage, companyName })

      return {
        success: false,
        error: errorMessage,
        searchUrl: this.getManualSearchUrl(companyName),
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Execute the actual search
   * This is a simplified mock implementation - in production, this would use Puppeteer or API calls
   */
  private async executeSearch(companyName: string): Promise<UCCFiling[]> {
    // Rate limiting
    const delayMs = (60 * 1000) / this.config.rateLimit
    await this.sleep(delayMs)

    // In a real implementation, this would:
    // 1. Use Puppeteer to navigate to the CA SOS website
    // 2. Fill out the search form
    // 3. Parse the results table
    // 4. Extract filing details

    // For now, return mock data to demonstrate the flow
    this.log('info', 'Executing CA UCC search (mock implementation)', { companyName })

    // Simulate network delay
    await this.sleep(1000)

    // Mock filings for demonstration
    const mockFilings: UCCFiling[] = [
      {
        filingNumber: `CA-2024-${Math.floor(Math.random() * 100000)}`,
        debtorName: companyName,
        securedParty: 'First Capital MCA',
        filingDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        collateral: 'All assets including accounts receivable',
        status: 'lapsed',
        filingType: 'UCC-1'
      },
      {
        filingNumber: `CA-2023-${Math.floor(Math.random() * 100000)}`,
        debtorName: companyName,
        securedParty: 'Business Lending LLC',
        filingDate: new Date(Date.now() - 450 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        collateral: 'Equipment and inventory',
        status: 'lapsed',
        filingType: 'UCC-1'
      }
    ]

    // Validate filings
    const { validatedFilings, validationErrors } = this.validateFilings(mockFilings)

    if (validationErrors.length > 0) {
      this.log('warn', 'Some filings had validation errors', {
        errorCount: validationErrors.length,
        errors: validationErrors
      })
    }

    this.log('info', 'CA UCC search completed', {
      filingCount: validatedFilings.length,
      validationErrorCount: validationErrors.length
    })

    return validatedFilings
  }

  /**
   * Get manual search URL for user verification
   */
  getManualSearchUrl(companyName: string): string {
    const encoded = encodeURIComponent(companyName)
    return `${this.config.baseUrl}?SearchText=${encoded}&SearchType=BUSINESS_NAME`
  }
}

/**
 * Helper to create California scraper instance
 */
export function createCAScraper(): CaliforniaUCCScraper {
  return new CaliforniaUCCScraper()
}
