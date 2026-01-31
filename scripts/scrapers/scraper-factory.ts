/**
 * Scraper Factory
 *
 * Centralized factory for creating UCC scrapers with different implementations
 *
 * Three implementation options:
 * 1. MOCK: Fast, free, demonstrates architecture (default)
 * 2. PUPPETEER: Real web scraping, free but complex
 * 3. API: Commercial service, reliable and legal (recommended for production)
 */

import { BaseScraper } from './base-scraper'
import { CaliforniaUCCScraper } from './ca-ucc-scraper'
import { CaliforniaUCCScraperPuppeteer } from './ca-ucc-scraper-puppeteer'
import { CaliforniaUCCScraperAPI } from './ca-ucc-scraper-api'
import { TexasUCCScraper } from './tx-ucc-scraper'
import { FloridaUCCScraper } from './fl-ucc-scraper'
import { NewYorkUCCScraper } from './ny-ucc-scraper'
import { IllinoisUCCScraper } from './il-ucc-scraper'
import { existsSync } from 'fs'
import { join } from 'path'

export type ScraperImplementation = 'mock' | 'puppeteer' | 'api'
export type SupportedState = 'CA' | 'TX' | 'FL' | 'NY' | 'IL'

export interface ScraperFactoryConfig {
  implementation?: ScraperImplementation
  apiKey?: string
  apiEndpoint?: string
}

/**
 * Scraper Factory
 */
export class ScraperFactory {
  private static defaultImplementation: ScraperImplementation =
    (process.env.SCRAPER_IMPLEMENTATION as ScraperImplementation) || 'mock'

  /**
   * Create a scraper for a specific state
   */
  static create(state: SupportedState, config?: ScraperFactoryConfig): BaseScraper {
    const implementation = config?.implementation || this.defaultImplementation

    console.log(`[ScraperFactory] Creating ${state} scraper with ${implementation} implementation`)

    switch (state) {
      case 'CA':
        return this.createCAScraper(implementation, config)

      case 'TX':
        return this.createTXScraper(implementation, config)

      case 'FL':
        return this.createFLScraper(implementation, config)

      case 'NY':
        return this.createNYScraper(implementation, config)

      case 'IL':
        return this.createILScraper(implementation, config)

      default:
        throw new Error(`Scraper not implemented for state: ${state}`)
    }
  }

  /**
   * Create California scraper
   */
  private static createCAScraper(
    implementation: ScraperImplementation,
    config?: ScraperFactoryConfig
  ): BaseScraper {
    switch (implementation) {
      case 'mock':
        return new CaliforniaUCCScraper()

      case 'puppeteer':
        return new CaliforniaUCCScraperPuppeteer()

      case 'api':
        return new CaliforniaUCCScraperAPI({
          apiKey: config?.apiKey || process.env.UCC_API_KEY,
          endpoint: config?.apiEndpoint || process.env.UCC_API_ENDPOINT
        })

      default:
        throw new Error(`Unknown implementation: ${implementation}`)
    }
  }

  /**
   * Create Texas scraper
   */
  private static createTXScraper(
    implementation: ScraperImplementation,
    config?: ScraperFactoryConfig
  ): BaseScraper {
    switch (implementation) {
      case 'mock':
        return new TexasUCCScraper()

      case 'puppeteer':
        throw new Error('Puppeteer implementation not yet available for TX')

      case 'api':
        return new CaliforniaUCCScraperAPI({
          apiKey: config?.apiKey || process.env.UCC_API_KEY,
          endpoint: config?.apiEndpoint || process.env.UCC_API_ENDPOINT
        })

      default:
        throw new Error(`Unknown implementation: ${implementation}`)
    }
  }

  /**
   * Create Florida scraper
   */
  private static createFLScraper(
    implementation: ScraperImplementation,
    config?: ScraperFactoryConfig
  ): BaseScraper {
    switch (implementation) {
      case 'mock':
        return new FloridaUCCScraper()

      case 'puppeteer':
        throw new Error('Puppeteer implementation not yet available for FL')

      case 'api':
        return new CaliforniaUCCScraperAPI({
          apiKey: config?.apiKey || process.env.UCC_API_KEY,
          endpoint: config?.apiEndpoint || process.env.UCC_API_ENDPOINT
        })

      default:
        throw new Error(`Unknown implementation: ${implementation}`)
    }
  }

  /**
   * Create New York scraper
   */
  private static createNYScraper(
    implementation: ScraperImplementation,
    config?: ScraperFactoryConfig
  ): BaseScraper {
    switch (implementation) {
      case 'mock':
        return new NewYorkUCCScraper()

      case 'puppeteer':
        throw new Error('Puppeteer implementation not yet available for NY')

      case 'api':
        return new CaliforniaUCCScraperAPI({
          apiKey: config?.apiKey || process.env.UCC_API_KEY,
          endpoint: config?.apiEndpoint || process.env.UCC_API_ENDPOINT
        })

      default:
        throw new Error(`Unknown implementation: ${implementation}`)
    }
  }

  /**
   * Create Illinois scraper
   */
  private static createILScraper(
    implementation: ScraperImplementation,
    config?: ScraperFactoryConfig
  ): BaseScraper {
    switch (implementation) {
      case 'mock':
        return new IllinoisUCCScraper()

      case 'puppeteer':
        throw new Error('Puppeteer implementation not yet available for IL')

      case 'api':
        return new CaliforniaUCCScraperAPI({
          apiKey: config?.apiKey || process.env.UCC_API_KEY,
          endpoint: config?.apiEndpoint || process.env.UCC_API_ENDPOINT
        })

      default:
        throw new Error(`Unknown implementation: ${implementation}`)
    }
  }

  /**
   * Get recommended implementation based on environment
   */
  static getRecommendedImplementation(): ScraperImplementation {
    // If API key is configured, recommend API
    if (process.env.UCC_API_KEY) {
      return 'api'
    }

    // If in production, recommend API (even if not configured yet)
    if (process.env.NODE_ENV === 'production') {
      return 'api'
    }

    // For development, use mock by default
    return 'mock'
  }

  /**
   * Check if implementation is available
   */
  static isImplementationAvailable(implementation: ScraperImplementation): {
    available: boolean
    reason?: string
  } {
    switch (implementation) {
      case 'mock':
        return { available: true }

      case 'puppeteer':
        // Check if Puppeteer is installed
        if (existsSync(join(process.cwd(), 'node_modules', 'puppeteer', 'package.json'))) {
          return { available: true }
        }
        return {
          available: false,
          reason:
            'Puppeteer not installed. Run: npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth'
        }

      case 'api':
        if (!process.env.UCC_API_KEY) {
          return {
            available: false,
            reason: 'API key not configured. Set UCC_API_KEY environment variable.'
          }
        }
        return { available: true }

      default:
        return {
          available: false,
          reason: `Unknown implementation: ${implementation}`
        }
    }
  }
}

/**
 * Helper functions for common use cases
 */

export function createScraper(state: SupportedState, config?: ScraperFactoryConfig): BaseScraper {
  return ScraperFactory.create(state, config)
}

export function createMockScraper(state: SupportedState): BaseScraper {
  return ScraperFactory.create(state, { implementation: 'mock' })
}

export function createPuppeteerScraper(state: SupportedState): BaseScraper {
  return ScraperFactory.create(state, { implementation: 'puppeteer' })
}

export function createAPIScraper(state: SupportedState, apiKey?: string): BaseScraper {
  return ScraperFactory.create(state, {
    implementation: 'api',
    apiKey: apiKey || process.env.UCC_API_KEY
  })
}
