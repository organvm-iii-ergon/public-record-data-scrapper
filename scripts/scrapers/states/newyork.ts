/**
 * New York UCC Scraper
 *
 * Scrapes UCC filing data from New York Department of State
 * Uses Playwright for real web scraping with anti-detection measures
 * This is a wrapper around the NYUCCPortalScraper to maintain consistency
 */

import { BaseScraper, ScraperResult, UCCFiling } from '../base-scraper'
import { NYUCCPortalScraper } from '../../../apps/web/src/lib/scrapers/NYUCCPortalScraper'

export class NewYorkScraper extends BaseScraper {
  private nyPortalScraper: NYUCCPortalScraper

  constructor(options: { headless?: boolean; keepPageOpenOnFailure?: boolean } = {}) {
    super({
      state: 'NY',
      baseUrl: 'https://appext20.dos.ny.gov/pls/ucc_public/web_search.inhouse_search',
      rateLimit: 5, // 5 requests per minute
      timeout: 30000,
      retryAttempts: 2
    })

    this.nyPortalScraper = new NYUCCPortalScraper({
      headless: options.headless ?? true,
      timeout: 30000,
      keepPageOpenOnFailure: options.keepPageOpenOnFailure ?? false
    })
  }

  /**
   * Search for UCC filings in New York
   */
  async search(companyName: string): Promise<ScraperResult> {
    if (!this.validateSearch(companyName)) {
      this.log('error', 'Invalid company name provided', { companyName })
      return {
        success: false,
        error: 'Invalid company name',
        timestamp: new Date().toISOString()
      }
    }

    this.log('info', 'Starting NY UCC search', { companyName })

    // Rate limiting - wait 12 seconds between requests (5 per minute)
    await this.sleep(12000)

    const searchUrl = this.getManualSearchUrl(companyName)

    try {
      const { result, retryCount } = await this.retryWithBackoff(async () => {
        return await this.performSearch(companyName, searchUrl)
      }, `NY UCC search for ${companyName}`)

      this.log('info', 'NY UCC search completed successfully', {
        companyName,
        filingCount: result.filings?.length || 0,
        retryCount
      })

      return {
        ...result,
        retryCount
      }
    } catch (error) {
      this.log('error', 'NY UCC search failed after all retries', {
        companyName,
        error: error instanceof Error ? error.message : String(error)
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        searchUrl,
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Perform the actual search using NYUCCPortalScraper
   */
  private async performSearch(companyName: string, searchUrl: string): Promise<ScraperResult> {
    try {
      this.log('info', 'Using NYUCCPortalScraper for search', { companyName })

      const nyResult = await this.nyPortalScraper.searchByDebtorName(companyName)

      // Convert NY scraper result format to our standard format
      const convertedFilings: UCCFiling[] = (nyResult.filings || []).map((filing) => ({
        filingNumber: filing.id.replace('ny-', ''),
        debtorName: filing.debtorName,
        securedParty: filing.securedParty,
        filingDate: filing.filingDate,
        collateral: '', // NY scraper doesn't provide collateral field
        status: filing.status,
        filingType: filing.filingType
      }))

      // Validate the converted filings
      const { validatedFilings, validationErrors } = this.validateFilings(convertedFilings)

      if (validationErrors.length > 0) {
        this.log('warn', 'Some filings had validation errors', {
          companyName,
          errorCount: validationErrors.length,
          errors: validationErrors
        })
      }

      this.log('info', 'NY filings converted and validated', {
        companyName,
        rawCount: convertedFilings.length,
        validCount: validatedFilings.length,
        errorCount: validationErrors.length
      })

      return {
        success: nyResult.success,
        filings: validatedFilings,
        error: nyResult.errors.length > 0 ? nyResult.errors.join('; ') : undefined,
        searchUrl,
        timestamp: new Date().toISOString(),
        parsingErrors: validationErrors.length > 0 ? validationErrors : undefined
      }
    } catch (error) {
      this.log('error', 'NYUCCPortalScraper failed', {
        companyName,
        error: error instanceof Error ? error.message : String(error)
      })

      throw error
    }
  }

  async captureDiagnostics(
    outputDir: string,
    baseName: string
  ): Promise<{ screenshotPath?: string; htmlPath?: string }> {
    return this.nyPortalScraper.captureDiagnostics(outputDir, baseName)
  }

  async closeBrowser(): Promise<void> {
    await this.nyPortalScraper.closeBrowser()
  }

  /**
   * Get manual search URL for New York
   */
  getManualSearchUrl(companyName: string): string {
    const encoded = encodeURIComponent(companyName)
    return `https://appext20.dos.ny.gov/pls/ucc_public/web_search.inhouse_search?p_name=${encoded}`
  }
}
