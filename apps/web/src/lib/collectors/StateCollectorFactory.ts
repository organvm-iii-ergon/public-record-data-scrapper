/**
 * State Collector Factory
 *
 * Factory pattern for creating and managing state-specific UCC filing collectors.
 * Supports lazy loading, caching, and batch operations.
 */

import type { StateCollector } from './types'
import { NYStateCollector } from './state-collectors/NYStateCollector'
import { CAStateCollector } from './state-collectors/CAStateCollector'

/**
 * State collector registry
 * Maps state codes to their collector instances
 */
type StateCollectorRegistry = Map<string, StateCollector>

/**
 * State collector factory configuration
 */
interface FactoryConfig {
  cacheCollectors?: boolean // Cache collector instances (default: true)
  lazyLoad?: boolean // Create collectors on-demand (default: true)
}

/**
 * State Collector Factory
 * Creates and manages state-specific collectors
 */
export class StateCollectorFactory {
  private registry: StateCollectorRegistry = new Map()
  private config: Required<FactoryConfig>

  constructor(config: FactoryConfig = {}) {
    this.config = {
      cacheCollectors: config.cacheCollectors ?? true,
      lazyLoad: config.lazyLoad ?? true
    }
  }

  /**
   * Get collector for a specific state
   * Creates collector if it doesn't exist (lazy loading)
   */
  getCollector(stateCode: string): StateCollector | undefined {
    const normalizedCode = stateCode.toUpperCase()

    // Check cache first
    if (this.config.cacheCollectors && this.registry.has(normalizedCode)) {
      return this.registry.get(normalizedCode)
    }

    // Create collector if lazy loading is enabled
    if (this.config.lazyLoad) {
      const collector = this.createCollector(normalizedCode)
      if (collector && this.config.cacheCollectors) {
        this.registry.set(normalizedCode, collector)
      }
      return collector
    }

    return undefined
  }

  /**
   * Get multiple collectors by state codes
   */
  getCollectors(stateCodes: string[]): Map<string, StateCollector> {
    const collectors = new Map<string, StateCollector>()

    for (const code of stateCodes) {
      const collector = this.getCollector(code)
      if (collector) {
        collectors.set(code.toUpperCase(), collector)
      }
    }

    return collectors
  }

  /**
   * Get all implemented collectors
   */
  getAllCollectors(): Map<string, StateCollector> {
    const implementedStates = this.getImplementedStates()
    return this.getCollectors(implementedStates)
  }

  /**
   * Check if a state has an implemented collector
   */
  hasCollector(stateCode: string): boolean {
    const normalizedCode = stateCode.toUpperCase()
    return this.getImplementedStates().includes(normalizedCode)
  }

  /**
   * Get list of states with implemented collectors
   */
  getImplementedStates(): string[] {
    return [
      'NY', // New York - Implemented
      'CA' // California - Implemented
      // 'TX', // Texas - Pending
      // 'FL', // Florida - Pending
      // 'IL', // Illinois - Pending
    ]
  }

  /**
   * Get list of states without collectors (pending implementation)
   */
  getPendingStates(): string[] {
    const allStates = this.getAllStatesCodes()
    const implemented = this.getImplementedStates()
    return allStates.filter((state) => !implemented.includes(state))
  }

  /**
   * Clear all cached collectors
   */
  clearCache(): void {
    this.registry.clear()
  }

  /**
   * Get collector statistics
   */
  getStats() {
    const implemented = this.getImplementedStates()
    const pending = this.getPendingStates()
    const cached = Array.from(this.registry.keys())

    return {
      total: this.getAllStatesCodes().length,
      implemented: implemented.length,
      pending: pending.length,
      cached: cached.length,
      implementedStates: implemented,
      pendingStates: pending,
      cachedStates: cached
    }
  }

  /**
   * Create a collector instance for a specific state
   * @private
   */
  private createCollector(stateCode: string): StateCollector | undefined {
    switch (stateCode) {
      case 'NY':
        return new NYStateCollector()

      case 'CA':
        return new CAStateCollector()

      // Texas - To be implemented
      // case 'TX':
      //   return new TXStateCollector()

      // Florida - To be implemented
      // case 'FL':
      //   return new FLStateCollector()

      // Illinois - To be implemented
      // case 'IL':
      //   return new ILStateCollector()

      default:
        return undefined
    }
  }

  /**
   * Get all US state codes (50 states + DC)
   * @private
   */
  private getAllStatesCodes(): string[] {
    return [
      'AL',
      'AK',
      'AZ',
      'AR',
      'CA',
      'CO',
      'CT',
      'DE',
      'FL',
      'GA',
      'HI',
      'ID',
      'IL',
      'IN',
      'IA',
      'KS',
      'KY',
      'LA',
      'ME',
      'MD',
      'MA',
      'MI',
      'MN',
      'MS',
      'MO',
      'MT',
      'NE',
      'NV',
      'NH',
      'NJ',
      'NM',
      'NY',
      'NC',
      'ND',
      'OH',
      'OK',
      'OR',
      'PA',
      'RI',
      'SC',
      'SD',
      'TN',
      'TX',
      'UT',
      'VT',
      'VA',
      'WA',
      'WV',
      'WI',
      'WY',
      'DC'
    ]
  }
}

/**
 * Singleton factory instance
 */
export const stateCollectorFactory = new StateCollectorFactory()

/**
 * Helper function to get a collector for a state
 */
export function getCollectorForState(stateCode: string): StateCollector | undefined {
  return stateCollectorFactory.getCollector(stateCode)
}

/**
 * Helper function to check if a state has a collector
 */
export function hasCollectorForState(stateCode: string): boolean {
  return stateCollectorFactory.hasCollector(stateCode)
}
