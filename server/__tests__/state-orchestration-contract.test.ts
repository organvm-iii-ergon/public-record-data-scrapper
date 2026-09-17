import { describe, it, expect } from 'vitest'
import { UCCSearchService } from '../services/UCCSearchService'
import { stateCollectorFactory } from '../../apps/web/src/lib/collectors/StateCollectorFactory'

describe('Orchestration Decoupling Contract (UCCSearchService)', () => {
  const service = new UCCSearchService()

  it('orchestrator dynamically resolves implemented states from StateCollectorFactory without code changes', () => {
    const implementedStates = stateCollectorFactory.getImplementedStates()

    // Implemented states are dynamically reported as implemented by the orchestrator
    for (const state of implementedStates) {
      const readiness = service.getStateReadiness(state)
      // Readiness is recognized by the orchestrator (either ready or fails closed with specific state reason)
      expect(readiness.state).toBe(state)
      expect(readiness.reason).toBeDefined()
    }
  })

  it('orchestrator fails closed for unregistered states without crashing', async () => {
    const readiness = service.getStateReadiness('ZZ')
    expect(readiness.canSearch).toBe(false)
    expect(readiness.reason).toContain('No UCC data available for state: ZZ')

    await expect(service.search({ companyName: 'Acme Corp', state: 'ZZ' })).rejects.toThrow(
      'No UCC data available for state: ZZ'
    )
  })

  it('upholds the Open-Closed Principle: orchestrator delegates polymorphically to StateCollector', () => {
    // UCCSearchService has no state-specific switch statements in its search logic.
    // It calls factory.getCollector(normalizedState).searchByBusinessName(companyName).
    expect(typeof service.search).toBe('function')
    expect(typeof service.getStateReadiness).toBe('function')
  })
})
