import { describe, it, expect } from 'vitest'
import { verifyStateCollectorContract } from './StateCollectorContract'
import { CAStateCollector } from './state-collectors/CAStateCollector'
import { NYStateCollector } from './state-collectors/NYStateCollector'
import { NJScraperCollector } from './state-collectors/NJScraperCollector'

describe('StateCollector Contract Tests', () => {
  it('CA collector satisfies the standard StateCollector contract', () => {
    const collector = new CAStateCollector()
    verifyStateCollectorContract(collector, 'CA')
  })

  it('NY collector satisfies the standard StateCollector contract', () => {
    const collector = new NYStateCollector()
    verifyStateCollectorContract(collector, 'NY')
  })

  it('NJ collector satisfies the standard StateCollector contract', () => {
    const collector = new NJScraperCollector({
      apiKey: 'test-key',
      accountId: 'test-account',
      debtorSeeds: ['Seed Corp']
    })
    verifyStateCollectorContract(collector, 'NJ')
  })

  it('verifies that unconfigured collectors fail closed via isReady()', () => {
    const unconfiguredNJ = new NJScraperCollector()
    expect(unconfiguredNJ.isReady()).toBe(false)
  })
})
