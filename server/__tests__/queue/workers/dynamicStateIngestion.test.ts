import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  stateIngestionRegistry,
  NonRetryableIngestionError
} from '../../../queue/stateIngestionRegistry'
import { resolveCollectorForJob } from '../../../queue/workers/ingestionWorker'
import {
  resolveStateIngestionStrategyChain,
  resolvePrimaryIngestionStrategy,
  registerStateStrategyProfile
} from '../../../queue/queues'
import { stateCollectorFactory } from '../../../../apps/web/src/lib/collectors/StateCollectorFactory'
import type { StateCollector, UCCFiling } from '../../../../apps/web/src/lib/collectors/types'

describe('Dynamic Multi-State Ingestion Pipeline (#483)', () => {
  const createMockCollector = (overrides: Partial<StateCollector> = {}): StateCollector => ({
    searchByBusinessName: vi.fn().mockResolvedValue({ filings: [], total: 0 }),
    searchByFilingNumber: vi.fn().mockResolvedValue(null),
    getFilingDetails: vi.fn().mockResolvedValue({} as UCCFiling),
    collectNewFilings: vi.fn().mockResolvedValue([]),
    validateFiling: vi.fn().mockReturnValue({ valid: true, errors: [] }),
    getStatus: vi.fn().mockReturnValue({ healthy: true, latency: 10 }),
    ...overrides
  })

  beforeEach(() => {
    stateIngestionRegistry.registerDefaults()
  })

  afterEach(() => {
    stateIngestionRegistry.registerDefaults()
  })

  it('resolves built-in state sources dynamically without hardcoded switches', () => {
    const states = stateIngestionRegistry.getRegisteredStates()
    expect(states).toContain('CA')
    expect(states).toContain('TX')
    expect(states).toContain('FL')
    expect(states).toContain('NY')
    expect(states).toContain('NJ')

    expect(stateIngestionRegistry.getStrategiesForState('CA')).toEqual(['api'])
    expect(stateIngestionRegistry.getStrategiesForState('TX')).toEqual(['bulk'])
    expect(stateIngestionRegistry.getStrategiesForState('FL')).toEqual(['vendor'])
    expect(stateIngestionRegistry.getStrategiesForState('NY')).toEqual(['scrape'])
    expect(stateIngestionRegistry.getStrategiesForState('NJ')).toEqual(['scrape'])
  })

  it('allows registering a dynamic state source at runtime and resolving it via the ingestion pipeline', () => {
    const mockILCollector = createMockCollector()

    // Register a new state dynamically
    stateIngestionRegistry.register({
      state: 'IL',
      strategy: 'scrape',
      createCollector: () => mockILCollector,
      isReady: () => true
    })

    // Queues strategy chain dynamically resolves the new state
    const strategies = resolveStateIngestionStrategyChain('IL')
    expect(strategies).toEqual(['scrape'])
    expect(resolvePrimaryIngestionStrategy('IL')).toBe('scrape')

    // Ingestion worker resolves the dynamic collector without code change
    const collector = resolveCollectorForJob('IL', 'scrape')
    expect(collector).toBe(mockILCollector)
  })

  it('enforces fail-closed semantics when dynamic collector is not ready', () => {
    const mockPACollector = createMockCollector()

    stateIngestionRegistry.register({
      state: 'PA',
      strategy: 'api',
      createCollector: () => mockPACollector,
      isReady: () => false,
      notReadyMessage: 'PA API collector is not ready: missing credentials'
    })

    expect(() => resolveCollectorForJob('PA', 'api')).toThrow(NonRetryableIngestionError)
    expect(() => resolveCollectorForJob('PA', 'api')).toThrow(
      'PA API collector is not ready: missing credentials'
    )
  })

  it('enforces fail-closed semantics when dynamic collector factory returns null', () => {
    stateIngestionRegistry.register({
      state: 'OH',
      strategy: 'bulk',
      createCollector: () => null,
      notConfiguredMessage: 'OH bulk subscription is not configured'
    })

    expect(() => resolveCollectorForJob('OH', 'bulk')).toThrow(NonRetryableIngestionError)
    expect(() => resolveCollectorForJob('OH', 'bulk')).toThrow(
      'OH bulk subscription is not configured'
    )
  })

  it('dynamically falls back to StateCollectorFactory when registered in the factory', () => {
    const mockGACollector = createMockCollector()

    // Register state GA in StateCollectorFactory
    stateCollectorFactory.registerDynamicState(
      {
        code: 'GA',
        name: 'Georgia',
        accessMethods: ['scrape'],
        activeMethod: 'scrape',
        hasApi: false,
        hasBulk: false,
        requiresVendor: false,
        costPer1000Queries: { api: null, bulk: null, vendor: null, scrape: 0 }
      },
      () => mockGACollector
    )

    // Strategy chain resolves through factory
    const strategies = resolveStateIngestionStrategyChain('GA')
    expect(strategies).toEqual(['scrape'])

    // Collector is dynamically resolved by the worker through the factory fallback
    const resolved = resolveCollectorForJob('GA', 'scrape')
    expect(resolved).toBeDefined()
  })

  it('fails with standard error for completely unconfigured states or strategies', () => {
    expect(() => resolveCollectorForJob('ZZ', 'api')).toThrow(
      'No production ingestion collector is implemented for ZZ using api.'
    )
    expect(() => resolveCollectorForJob('ZZ', undefined as unknown as string)).toThrow(
      'No production ingestion strategy is configured for ZZ.'
    )
  })

  it('supports unregistering dynamic state sources cleanly', () => {
    stateIngestionRegistry.register({
      state: 'MI',
      strategy: 'scrape',
      createCollector: () => createMockCollector(),
      isReady: () => true
    })

    expect(stateIngestionRegistry.hasRegistration('MI', 'scrape')).toBe(true)

    stateIngestionRegistry.unregister('MI', 'scrape')
    expect(stateIngestionRegistry.hasRegistration('MI', 'scrape')).toBe(false)
  })

  it('supports manual registration of strategy profiles in queues.ts', () => {
    registerStateStrategyProfile('NC', ['api', 'scrape'])
    const chain = resolveStateIngestionStrategyChain('NC')
    expect(chain).toEqual(['api', 'scrape'])
    expect(resolvePrimaryIngestionStrategy('NC')).toBe('api')
  })
})
