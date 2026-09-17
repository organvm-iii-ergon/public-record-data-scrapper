/**
 * New York UCC Filing Scraper - Mock Implementation
 *
 * Scrapes UCC filing data from New York Department of State
 * Currently generates sample data - extend with Puppeteer or API for real data
 */

import { BaseScraper, ScraperConfig, ScraperResult, UCCFiling } from './base-scraper'

export class NewYorkUCCScraper extends BaseScraper {
  constructor() {
    const config: ScraperConfig = {
      state: 'NY',
      baseUrl: 'https://appext20.dos.ny.gov/pls/ucc_public/web_search.main_frame',
      rateLimit: 30,
      timeout: 30000,
      retryAttempts: 3
    }
    super(config)
  }

  async search(companyName: string): Promise<ScraperResult> {
    if (!this.validateSearch(companyName)) {
      return {
        success: false,
        error: 'Invalid company name',
        timestamp: new Date().toISOString()
      }
    }

    this.log('info', 'Starting NY UCC search', { companyName })

    try {
      const { result: filings, retryCount } = await this.retryWithBackoff(
        () => this.executeSearch(companyName),
        `NY UCC search for "${companyName}"`
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
      this.log('error', 'NY UCC search failed', { error: errorMessage, companyName })

      return {
        success: false,
        error: errorMessage,
        searchUrl: this.getManualSearchUrl(companyName),
        timestamp: new Date().toISOString()
      }
    }
  }

  private async executeSearch(companyName: string): Promise<UCCFiling[]> {
    const delayMs = (60 * 1000) / this.config.rateLimit
    await this.sleep(delayMs)

    this.log('info', 'Executing NY UCC search (mock implementation)', { companyName })
    await this.sleep(1000)

    const mockFilings: UCCFiling[] = [
      {
        filingNumber: `NY-2024-${Math.floor(Math.random() * 100000)}`,
        debtorName: companyName,
        securedParty: 'Empire State Capital',
        filingDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        collateral: 'All assets',
        status: 'lapsed',
        filingType: 'UCC-1'
      },
      {
        filingNumber: `NY-2023-${Math.floor(Math.random() * 100000)}`,
        debtorName: companyName,
        securedParty: 'Manhattan MCA Partners',
        filingDate: new Date(Date.now() - 500 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        collateral: 'Equipment and accounts receivable',
        status: 'lapsed',
        filingType: 'UCC-1'
      }
    ]

    const { validatedFilings, validationErrors } = this.validateFilings(mockFilings)

    if (validationErrors.length > 0) {
      this.log('warn', 'Some filings had validation errors', {
        errorCount: validationErrors.length,
        errors: validationErrors
      })
    }

    this.log('info', 'NY UCC search completed', {
      filingCount: validatedFilings.length
    })

    return validatedFilings
  }

  getManualSearchUrl(companyName: string): string {
    const encoded = encodeURIComponent(companyName)
    return `${this.config.baseUrl}?search=${encoded}`
  }
}

export function createNYScraper(): NewYorkUCCScraper {
  return new NewYorkUCCScraper()
}
