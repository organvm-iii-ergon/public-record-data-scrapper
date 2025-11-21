/**
 * Illinois UCC Filing Scraper - Mock Implementation
 *
 * Scrapes UCC filing data from Illinois Secretary of State
 * Currently generates sample data - extend with Puppeteer or API for real data
 */

import { BaseScraper, ScraperConfig, ScraperResult, UCCFiling } from './base-scraper'

export class IllinoisUCCScraper extends BaseScraper {
  constructor() {
    const config: ScraperConfig = {
      state: 'IL',
      baseUrl: 'https://www.ilsos.gov/corporatellc/',
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

    this.log('info', 'Starting IL UCC search', { companyName })

    try {
      const { result: filings, retryCount } = await this.retryWithBackoff(
        () => this.executeSearch(companyName),
        `IL UCC search for "${companyName}"`
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
      this.log('error', 'IL UCC search failed', { error: errorMessage, companyName })

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

    this.log('info', 'Executing IL UCC search (mock implementation)', { companyName })
    await this.sleep(1000)

    const mockFilings: UCCFiling[] = [
      {
        filingNumber: `IL-2024-${Math.floor(Math.random() * 100000)}`,
        debtorName: companyName,
        securedParty: 'Chicago Business Lending',
        filingDate: new Date(Date.now() - 220 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        collateral: 'Business assets and receivables',
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

    this.log('info', 'IL UCC search completed', {
      filingCount: validatedFilings.length
    })

    return validatedFilings
  }

  getManualSearchUrl(companyName: string): string {
    const encoded = encodeURIComponent(companyName)
    return `${this.config.baseUrl}?SearchName=${encoded}`
  }
}

export function createILScraper(): IllinoisUCCScraper {
  return new IllinoisUCCScraper()
}
