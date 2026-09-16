import type { StateCollector } from '../../apps/web/src/lib/collectors/types'
import { createCAApiCollector } from '../../apps/web/src/lib/collectors/state-collectors/CAApiCollector'
import { createTXBulkCollector } from '../../apps/web/src/lib/collectors/state-collectors/TXBulkCollector'
import { createFLVendorCollector } from '../../apps/web/src/lib/collectors/state-collectors/FLVendorCollector'
import { createNYScraperCollector } from '../../apps/web/src/lib/collectors/state-collectors/NYScraperCollector'
import { createNJScraperCollector } from '../../apps/web/src/lib/collectors/state-collectors/NJScraperCollector'
import { stateCollectorFactory } from '../../apps/web/src/lib/collectors/StateCollectorFactory'

export type IngestionStrategy = 'api' | 'bulk' | 'vendor' | 'scrape'

export interface StateSourceRegistration {
  state: string
  strategy: IngestionStrategy
  createCollector: () => StateCollector | null | undefined
  isReady?: (collector: StateCollector) => boolean
  notReadyMessage?: string
  notConfiguredMessage?: string
}

export class NonRetryableIngestionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NonRetryableIngestionError'
  }
}

/**
 * Dynamic registry for multi-state UCC-1 ingestion sources.
 * Replaces hardcoded switch ladders with dynamic, extensible state source providers.
 */
export class StateIngestionRegistry {
  private sources: Map<string, StateSourceRegistration> = new Map()

  constructor() {
    this.registerDefaults()
  }

  private buildKey(state: string, strategy: IngestionStrategy): string {
    return `${state.trim().toUpperCase()}:${strategy.trim().toLowerCase()}`
  }

  /**
   * Register default built-in state sources.
   */
  registerDefaults(): void {
    this.sources.clear()

    // CA: API
    this.register({
      state: 'CA',
      strategy: 'api',
      createCollector: () => createCAApiCollector(),
      notConfiguredMessage: 'CA API collector is not configured in this environment.'
    })

    // TX: Bulk
    this.register({
      state: 'TX',
      strategy: 'bulk',
      createCollector: () => createTXBulkCollector(),
      notConfiguredMessage: 'TX bulk collector is not configured in this environment.'
    })

    // FL: Vendor (gated on active contract)
    this.register({
      state: 'FL',
      strategy: 'vendor',
      createCollector: () => createFLVendorCollector(),
      isReady: (collector) =>
        'isReady' in collector &&
        typeof (collector as unknown as { isReady: () => boolean }).isReady === 'function'
          ? (collector as unknown as { isReady: () => boolean }).isReady()
          : true,
      notReadyMessage: 'FL vendor collector is not ready because the contract is not active.'
    })

    // NY: Scraper (gated on debtor seeds)
    this.register({
      state: 'NY',
      strategy: 'scrape',
      createCollector: () => createNYScraperCollector(),
      isReady: (collector) =>
        'isReady' in collector &&
        typeof (collector as unknown as { isReady: () => boolean }).isReady === 'function'
          ? (collector as unknown as { isReady: () => boolean }).isReady()
          : true,
      notReadyMessage:
        'NY scraper collector is not ready because no debtor seeds are configured (set NY_UCC_DEBTOR_SEEDS).'
    })

    // NJ: Scraper (gated on credentials + debtor seeds)
    this.register({
      state: 'NJ',
      strategy: 'scrape',
      createCollector: () => createNJScraperCollector(),
      isReady: (collector) =>
        'isReady' in collector &&
        typeof (collector as unknown as { isReady: () => boolean }).isReady === 'function'
          ? (collector as unknown as { isReady: () => boolean }).isReady()
          : true,
      notReadyMessage:
        'NJ scraper collector is not ready because credentials or debtor seeds are not configured.'
    })
  }

  /**
   * Register or override a state source dynamically at runtime.
   */
  register(registration: StateSourceRegistration): void {
    const key = this.buildKey(registration.state, registration.strategy)
    this.sources.set(key, {
      ...registration,
      state: registration.state.trim().toUpperCase(),
      strategy: registration.strategy.trim().toLowerCase() as IngestionStrategy
    })
  }

  /**
   * Unregister a state source.
   */
  unregister(state: string, strategy: IngestionStrategy): boolean {
    const key = this.buildKey(state, strategy)
    return this.sources.delete(key)
  }

  /**
   * Get registration for a state and strategy.
   */
  getRegistration(state: string, strategy: IngestionStrategy): StateSourceRegistration | undefined {
    return this.sources.get(this.buildKey(state, strategy))
  }

  /**
   * Check if a state source is registered.
   */
  hasRegistration(state: string, strategy: IngestionStrategy): boolean {
    return this.sources.has(this.buildKey(state, strategy))
  }

  /**
   * Get all registered state codes.
   */
  getRegisteredStates(): string[] {
    const states = new Set<string>()
    for (const reg of this.sources.values()) {
      states.add(reg.state)
    }
    return Array.from(states)
  }

  /**
   * Get all strategies registered for a state.
   */
  getStrategiesForState(state: string): IngestionStrategy[] {
    const normalized = state.trim().toUpperCase()
    const strategies: IngestionStrategy[] = []
    for (const reg of this.sources.values()) {
      if (reg.state === normalized) {
        strategies.push(reg.strategy)
      }
    }
    return strategies
  }

  /**
   * Dynamically resolve a StateCollector for a given state and strategy.
   * Checks registry registrations first, then falls back to StateCollectorFactory.
   * Throws NonRetryableIngestionError when not configured or not ready.
   */
  resolveCollector(state: string, strategy: IngestionStrategy | undefined | null): StateCollector {
    const normalizedState = state.trim().toUpperCase()

    if (!strategy) {
      throw new NonRetryableIngestionError(
        `No production ingestion strategy is configured for ${normalizedState}.`
      )
    }

    const reg = this.getRegistration(normalizedState, strategy)
    if (reg) {
      const collector = reg.createCollector()
      if (!collector) {
        throw new NonRetryableIngestionError(
          reg.notConfiguredMessage ??
            reg.notReadyMessage ??
            `${normalizedState} ${strategy} collector is not configured in this environment.`
        )
      }

      if (reg.isReady && !reg.isReady(collector)) {
        throw new NonRetryableIngestionError(
          reg.notReadyMessage ??
            `${normalizedState} ${strategy} collector is not ready in this environment.`
        )
      }

      return collector
    }

    // Dynamic fallback to StateCollectorFactory
    if (stateCollectorFactory.hasCollector(normalizedState)) {
      const collector = stateCollectorFactory.getCollectorByMethod(
        normalizedState,
        strategy as import('../../apps/web/src/lib/collectors/StateCollectorFactory').AccessMethod
      )
      if (collector) {
        const hasIsReady =
          'isReady' in collector &&
          typeof (collector as unknown as { isReady: () => boolean }).isReady === 'function'
        if (hasIsReady && !(collector as unknown as { isReady: () => boolean }).isReady()) {
          throw new NonRetryableIngestionError(
            `${normalizedState} ${strategy} collector is not ready.`
          )
        }
        return collector
      }
    }

    throw new NonRetryableIngestionError(
      `No production ingestion collector is implemented for ${normalizedState} using ${strategy}.`
    )
  }
}

export const stateIngestionRegistry = new StateIngestionRegistry()
