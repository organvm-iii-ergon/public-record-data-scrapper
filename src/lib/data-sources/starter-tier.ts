/**
 * Starter Tier Data Sources
 *
 * Implementation of commercial data sources for Starter tier:
 * - D&B Direct (Dun & Bradstreet)
 * - Google Places API
 * - Clearbit
 *
 * Note: These require API keys to be configured in environment variables
 */

import { BaseDataSource, DataSourceResponse } from './base-source'

/**
 * D&B Direct API - Business credit and company information
 */
export class DnBSource extends BaseDataSource {
  private apiKey: string

  constructor() {
    super({
      name: 'dnb',
      tier: 'starter',
      cost: 0.5,
      timeout: 15000,
      retryAttempts: 2,
      retryDelay: 2000
    })

    this.apiKey = process.env.DNB_API_KEY || ''
  }

  async fetchData(query: Record<string, unknown>): Promise<DataSourceResponse> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'D&B API key not configured',
        source: this.config.name,
        timestamp: new Date().toISOString(),
        responseTime: 0
      }
    }

    return this.executeFetch(async () => {
      const companyName = typeof query.companyName === 'string' ? query.companyName : ''
      const state = typeof query.state === 'string' ? query.state : ''

      // D&B Direct API endpoint (example - actual endpoint may differ)
      const searchUrl = 'https://plus.dnb.com/v1/data/duns'

      const response = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: companyName,
          state: state
        })
      })

      if (!response.ok) {
        throw new Error(`D&B API error: ${response.statusText}`)
      }

      const data = await response.json()

      return {
        dunsNumber: data.dunsNumber || null,
        businessName: data.businessName || null,
        creditRating: data.rating || null,
        yearStarted: data.yearStarted || null,
        employeeCount: data.employeeCount || null,
        annualRevenue: data.annualRevenue || null,
        companyName,
        state
      }
    }, query)
  }

  protected validateQuery(query: Record<string, unknown>): boolean {
    return typeof query.companyName === 'string' && query.companyName.length > 0
  }
}

/**
 * Google Places API - Business location and review data
 */
export class GooglePlacesSource extends BaseDataSource {
  private apiKey: string

  constructor() {
    super({
      name: 'google-places',
      tier: 'starter',
      cost: 0.02,
      timeout: 10000,
      retryAttempts: 3,
      retryDelay: 1000
    })

    this.apiKey = process.env.GOOGLE_PLACES_API_KEY || ''
  }

  async fetchData(query: Record<string, unknown>): Promise<DataSourceResponse> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'Google Places API key not configured',
        source: this.config.name,
        timestamp: new Date().toISOString(),
        responseTime: 0
      }
    }

    return this.executeFetch(async () => {
      const companyName = typeof query.companyName === 'string' ? query.companyName : ''
      const state = typeof query.state === 'string' ? query.state : ''

      // Google Places Text Search API
      const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(companyName + ' ' + state)}&key=${this.apiKey}`

      const response = await fetch(searchUrl)

      if (!response.ok) {
        throw new Error(`Google Places API error: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.status !== 'OK') {
        throw new Error(`Google Places API error: ${data.status}`)
      }

      const place = data.results?.[0]

      return {
        placeId: place?.place_id || null,
        name: place?.name || null,
        address: place?.formatted_address || null,
        rating: place?.rating || null,
        reviewCount: place?.user_ratings_total || null,
        isOpen: place?.opening_hours?.open_now || null,
        types: place?.types || [],
        companyName,
        state
      }
    }, query)
  }

  protected validateQuery(query: Record<string, unknown>): boolean {
    return typeof query.companyName === 'string' && query.companyName.length > 0
  }
}

/**
 * Clearbit API - Company enrichment data
 */
export class ClearbitSource extends BaseDataSource {
  private apiKey: string

  constructor() {
    super({
      name: 'clearbit',
      tier: 'starter',
      cost: 1.0,
      timeout: 10000,
      retryAttempts: 2,
      retryDelay: 2000
    })

    this.apiKey = process.env.CLEARBIT_API_KEY || ''
  }

  async fetchData(query: Record<string, unknown>): Promise<DataSourceResponse> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'Clearbit API key not configured',
        source: this.config.name,
        timestamp: new Date().toISOString(),
        responseTime: 0
      }
    }

    return this.executeFetch(async () => {
      const companyName = typeof query.companyName === 'string' ? query.companyName : ''
      const domain = typeof query.domain === 'string' ? query.domain : ''

      // Clearbit Company API
      const searchParam = domain || companyName
      const searchUrl = `https://company.clearbit.com/v2/companies/find?name=${encodeURIComponent(searchParam)}`

      const response = await fetch(searchUrl, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`
        }
      })

      if (!response.ok) {
        throw new Error(`Clearbit API error: ${response.statusText}`)
      }

      const data = await response.json()

      return {
        id: data.id || null,
        name: data.name || null,
        domain: data.domain || null,
        description: data.description || null,
        category: data.category || null,
        industry: data.industry || null,
        employeeCount: data.metrics?.employees || null,
        estimatedRevenue: data.metrics?.estimatedAnnualRevenue || null,
        founded: data.foundedYear || null,
        location: data.location || null,
        techStack: data.tech || [],
        companyName
      }
    }, query)
  }

  protected validateQuery(query: Record<string, unknown>): boolean {
    return typeof query.companyName === 'string' || typeof query.domain === 'string'
  }
}
