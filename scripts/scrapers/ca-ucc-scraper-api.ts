/**
 * California UCC Filing Scraper - API Implementation
 *
 * Uses commercial UCC data API for reliable, legal data access
 *
 * Recommended production approach:
 * - Legal and compliant
 * - Reliable and fast
 * - No anti-bot issues
 * - Covers all states
 *
 * Commercial API providers:
 * - UCC Plus: https://uccplus.com/api
 * - Secretary of State Direct: https://www.sosdirect.com/
 * - CorporationWiki: https://www.corporationwiki.com/
 * - Bloomberg API (enterprise)
 *
 * Cost: ~$100-500/month depending on volume
 */

import { BaseScraper, ScraperConfig, ScraperResult, UCCFiling } from './base-scraper'

interface APIConfig {
  apiKey: string
  endpoint: string
  provider: 'uccplus' | 'sosdirect' | 'custom'
}

export class CaliforniaUCCScraperAPI extends BaseScraper {
  private apiConfig: APIConfig

  constructor(apiConfig?: Partial<APIConfig>) {
    const config: ScraperConfig = {
      state: 'CA',
      baseUrl: '', // Not used for API
      rateLimit: 60, // API can handle more requests
      timeout: 10000,
      retryAttempts: 3
    }
    super(config)

    // Load API configuration
    this.apiConfig = {
      apiKey: apiConfig?.apiKey || process.env.UCC_API_KEY || '',
      endpoint: apiConfig?.endpoint || process.env.UCC_API_ENDPOINT || 'https://api.uccplus.com/v1',
      provider: apiConfig?.provider ?? 'uccplus'
    }

    if (!this.apiConfig.apiKey) {
      this.log('warn', 'No API key configured. Set UCC_API_KEY environment variable.')
    }
  }

  /**
   * Search for UCC filings using commercial API
   */
  async search(companyName: string): Promise<ScraperResult> {
    if (!this.validateSearch(companyName)) {
      return {
        success: false,
        error: 'Invalid company name',
        timestamp: new Date().toISOString()
      }
    }

    if (!this.apiConfig.apiKey) {
      return {
        success: false,
        error: 'API key not configured. Set UCC_API_KEY environment variable.',
        timestamp: new Date().toISOString()
      }
    }

    this.log('info', 'Starting CA UCC search (API)', {
      companyName,
      provider: this.apiConfig.provider
    })

    try {
      const { result: filings, retryCount } = await this.retryWithBackoff(
        () => this.executeSearch(companyName),
        `CA UCC API search for "${companyName}"`
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
      this.log('error', 'CA UCC API search failed', { error: errorMessage, companyName })

      return {
        success: false,
        error: errorMessage,
        searchUrl: this.getManualSearchUrl(companyName),
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Execute API search
   */
  private async executeSearch(companyName: string): Promise<UCCFiling[]> {
    const delayMs = (60 * 1000) / this.config.rateLimit
    await this.sleep(delayMs)

    const url = `${this.apiConfig.endpoint}/search`

    this.log('info', 'Calling UCC API', { url, companyName })

    // API request body (format varies by provider)
    const requestBody = {
      query: {
        debtor_name: companyName,
        state: 'CA'
      },
      options: {
        include_terminated: true,
        include_lapsed: true,
        max_results: 100
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiConfig.apiKey}`,
        'User-Agent': 'UCC-Intelligence-Platform/1.0'
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(this.config.timeout)
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid API key')
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded')
      } else {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }
    }

    const data = await response.json()

    // Map API response to our UCCFiling format
    // NOTE: This mapping depends on the specific API provider
    const filings = this.mapAPIResponse(data)

    // Validate filings
    const { validatedFilings, validationErrors } = this.validateFilings(filings)

    if (validationErrors.length > 0) {
      this.log('warn', 'Some API filings had validation errors', {
        errorCount: validationErrors.length
      })
    }

    this.log('info', 'CA UCC API search completed', {
      filingCount: validatedFilings.length
    })

    return validatedFilings
  }

  /**
   * Map API response to UCCFiling format
   * NOTE: This is provider-specific and needs customization
   */
  private mapAPIResponse(data: unknown): Partial<UCCFiling>[] {
    // Example mapping for generic API response
    const response = data as { results?: unknown; filings?: unknown }
    const filings = Array.isArray(response?.results)
      ? response.results
      : Array.isArray(response?.filings)
        ? response.filings
        : []

    const toStringValue = (value: unknown): string => {
      if (typeof value === 'string') return value
      if (typeof value === 'number') return String(value)
      return ''
    }

    return filings.map((item) => {
      const record = (typeof item === 'object' && item !== null ? item : {}) as Record<
        string,
        unknown
      >
      // Parse filing date
      let filingDate = ''
      const filingDateValue = record.filing_date ?? record.filingDate
      if (filingDateValue) {
        const date = new Date(toStringValue(filingDateValue))
        filingDate = date.toISOString().split('T')[0]
      }

      // Map status
      let status: 'active' | 'terminated' | 'lapsed' = 'lapsed'
      const apiStatus = toStringValue(record.status).toLowerCase()
      if (apiStatus.includes('active')) status = 'active'
      else if (apiStatus.includes('terminated')) status = 'terminated'
      else status = 'lapsed'

      // Map filing type
      let filingType: 'UCC-1' | 'UCC-3' = 'UCC-1'
      const apiType = toStringValue(record.filing_type ?? record.type).toUpperCase()
      if (apiType.includes('UCC-3') || apiType.includes('UCC3')) {
        filingType = 'UCC-3'
      }

      return {
        filingNumber: toStringValue(record.filing_number ?? record.filingNumber ?? record.id),
        debtorName: toStringValue(record.debtor_name ?? record.debtorName ?? record.debtor),
        securedParty: toStringValue(record.secured_party ?? record.securedParty ?? record.creditor),
        filingDate,
        collateral:
          toStringValue(record.collateral ?? record.collateral_description) || 'Not specified',
        status,
        filingType
      }
    })
  }

  /**
   * Get manual search URL (for reference)
   */
  getManualSearchUrl(companyName: string): string {
    const encoded = encodeURIComponent(companyName)
    return `https://bizfileonline.sos.ca.gov/search/business?SearchText=${encoded}`
  }
}

/**
 * Helper to create California API scraper instance
 */
export function createCAAPIScraper(apiConfig?: Partial<APIConfig>): CaliforniaUCCScraperAPI {
  return new CaliforniaUCCScraperAPI(apiConfig)
}
