/**
 * State Collector Contract Test Suite
 *
 * Provides a standardized contract test suite that any StateCollector implementation
 * must satisfy. This guarantees that all state adapters adhere to the identical contract,
 * allowing the orchestration layer to consume them interchangeably without code changes.
 */

import { expect } from 'vitest'
import type { StateCollector, UCCFiling } from './types'

export function verifyStateCollectorContract(
  collector: StateCollector,
  expectedState: string
): void {
  // 1. Structural Interface Conformance
  expect(typeof collector.searchByBusinessName).toBe('function')
  expect(typeof collector.searchByFilingNumber).toBe('function')
  expect(typeof collector.getFilingDetails).toBe('function')
  expect(typeof collector.collectNewFilings).toBe('function')
  expect(typeof collector.validateFiling).toBe('function')
  expect(typeof collector.getStatus).toBe('function')

  // 2. Status Contract
  const status = collector.getStatus()
  expect(typeof status.isHealthy).toBe('boolean')
  expect(typeof status.totalCollected).toBe('number')
  expect(typeof status.errorRate).toBe('number')
  expect(typeof status.averageLatency).toBe('number')

  // 3. Schema Validation Contract
  const validFiling: UCCFiling = {
    filingNumber: `${expectedState}-2026-9999`,
    filingType: 'UCC-1',
    filingDate: '2026-03-01',
    status: 'active',
    state: expectedState,
    debtor: { name: 'Acme Test Corp', organizationType: 'organization' },
    securedParty: { name: 'Funder Capital Inc', organizationType: 'organization' },
    collateral: 'All inventory and equipment.'
  }

  const validResult = collector.validateFiling(validFiling)
  expect(validResult.valid).toBe(true)
  expect(validResult.errors.length).toBe(0)

  // Missing required fields must fail validation
  const invalidFiling: Partial<UCCFiling> = {
    filingType: 'UCC-1',
    collateral: 'Inventory'
  }

  const invalidResult = collector.validateFiling(invalidFiling as UCCFiling)
  expect(invalidResult.valid).toBe(false)
  expect(invalidResult.errors.length).toBeGreaterThan(0)
}
