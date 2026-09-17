/**
 * Florida UCC Filing Scraper - Mock Implementation
 *
 * Scrapes UCC filing data from Florida Division of Corporations
 * Currently generates sample data - extend with Puppeteer or API for real data
 */

import { BaseScraper, ScraperConfig, ScraperResult, UCCFiling } from './base-scraper'

export class FloridaUCCScraper extends BaseScraper {
  constructor() {
    const config: ScraperConfig = {
      state: 'FL',
      baseUrl: 'https://search.sunbiz.org/Inquiry/CorporationSearch/ByName',
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

    this.log('info', 'Starting FL UCC search', { companyName })

    try {
      const { result: filings, retryCount } = await this.retryWithBackoff(
        () => this.executeSearch(companyName),
        `FL UCC search for "${companyName}"`
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
      this.log('error', 'FL UCC search failed', { error: errorMessage, companyName })

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

    this.log('info', 'Executing FL UCC search (mock implementation)', { companyName })
    await this.sleep(1000)

    const mockFilings: UCCFiling[] = [
      {
        filingNumber: `FL-2024-${Math.floor(Math.random() * 100000)}`,
        debtorName: companyName,
        securedParty: 'Sunshine State Lending',
        filingDate: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        collateral: 'Accounts receivable and inventory',
        status: 'lapsed',
        filingType: 'UCC-1'
      },
      {
        filingNumber: `FL-2023-${Math.floor(Math.random() * 100000)}`,
        debtorName: companyName,
        securedParty: 'Miami Capital Group',
        filingDate: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        collateral: 'Equipment and fixtures',
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

    this.log('info', 'FL UCC search completed', {
      filingCount: validatedFilings.length
    })

    return validatedFilings
  }

  getManualSearchUrl(companyName: string): string {
    const encoded = encodeURIComponent(companyName)
    return `${this.config.baseUrl}?SearchName=${encoded}`
  }
}

export function createFLScraper(): FloridaUCCScraper {
  return new FloridaUCCScraper()
}
