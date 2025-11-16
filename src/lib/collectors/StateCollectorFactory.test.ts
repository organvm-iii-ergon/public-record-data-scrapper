/**
 * Tests for StateCollectorFactory
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { StateCollectorFactory, stateCollectorFactory, getCollectorForState, hasCollectorForState } from './StateCollectorFactory'
import { NYStateCollector } from './state-collectors/NYStateCollector'

describe('StateCollectorFactory', () => {
  let factory: StateCollectorFactory

  beforeEach(() => {
    factory = new StateCollectorFactory()
  })

  describe('initialization', () => {
    it('should create factory with default config', () => {
      expect(factory).toBeDefined()
    })

    it('should accept custom configuration', () => {
      const customFactory = new StateCollectorFactory({
        cacheCollectors: false,
        lazyLoad: false
      })

      expect(customFactory).toBeDefined()
    })

    it('should start with empty registry', () => {
      const stats = factory.getStats()
      expect(stats.cached).toBe(0)
    })
  })

  describe('getCollector()', () => {
    it('should return collector for implemented state', () => {
      const collector = factory.getCollector('NY')

      expect(collector).toBeDefined()
      expect(collector).toBeInstanceOf(NYStateCollector)
    })

    it('should return undefined for unimplemented state', () => {
      const collector = factory.getCollector('TX')

      expect(collector).toBeUndefined()
    })

    it('should handle case-insensitive state codes', () => {
      const upper = factory.getCollector('NY')
      const lower = factory.getCollector('ny')
      const mixed = factory.getCollector('Ny')

      expect(upper).toBeDefined()
      expect(lower).toBeDefined()
      expect(mixed).toBeDefined()
    })

    it('should cache collectors by default', () => {
      const first = factory.getCollector('NY')
      const second = factory.getCollector('NY')

      expect(first).toBe(second) // Same instance
    })

    it('should not cache when caching disabled', () => {
      const noCacheFactory = new StateCollectorFactory({ cacheCollectors: false })

      const first = noCacheFactory.getCollector('NY')
      const second = noCacheFactory.getCollector('NY')

      expect(first).not.toBe(second) // Different instances
    })

    it('should not lazy load when disabled', () => {
      const noLazyFactory = new StateCollectorFactory({ lazyLoad: false })

      const collector = noLazyFactory.getCollector('NY')

      expect(collector).toBeUndefined() // Not created automatically
    })
  })

  describe('getCollectors()', () => {
    it('should return multiple collectors', () => {
      const collectors = factory.getCollectors(['NY'])

      expect(collectors.size).toBe(1)
      expect(collectors.has('NY')).toBe(true)
    })

    it('should skip unimplemented states', () => {
      const collectors = factory.getCollectors(['NY', 'CA', 'TX'])

      expect(collectors.size).toBe(2)
      expect(collectors.has('NY')).toBe(true)
      expect(collectors.has('CA')).toBe(true)
      expect(collectors.has('TX')).toBe(false)
    })

    it('should return empty map for no states', () => {
      const collectors = factory.getCollectors([])

      expect(collectors.size).toBe(0)
    })

    it('should handle duplicate state codes', () => {
      const collectors = factory.getCollectors(['NY', 'NY', 'NY'])

      expect(collectors.size).toBe(1)
    })

    it('should normalize state codes to uppercase', () => {
      const collectors = factory.getCollectors(['ny', 'Ny', 'NY'])

      expect(collectors.has('NY')).toBe(true)
    })
  })

  describe('getAllCollectors()', () => {
    it('should return all implemented collectors', () => {
      const collectors = factory.getAllCollectors()

      expect(collectors.size).toBe(2) // NY and CA implemented
      expect(collectors.has('NY')).toBe(true)
      expect(collectors.has('CA')).toBe(true)
    })

    it('should return map of collectors', () => {
      const collectors = factory.getAllCollectors()

      expect(collectors).toBeInstanceOf(Map)
    })
  })

  describe('hasCollector()', () => {
    it('should return true for implemented state', () => {
      expect(factory.hasCollector('NY')).toBe(true)
      expect(factory.hasCollector('CA')).toBe(true)
    })

    it('should return false for unimplemented state', () => {
      expect(factory.hasCollector('TX')).toBe(false)
      expect(factory.hasCollector('FL')).toBe(false)
    })

    it('should handle case-insensitive codes', () => {
      expect(factory.hasCollector('ny')).toBe(true)
      expect(factory.hasCollector('Ny')).toBe(true)
      expect(factory.hasCollector('NY')).toBe(true)
      expect(factory.hasCollector('ca')).toBe(true)
      expect(factory.hasCollector('Ca')).toBe(true)
      expect(factory.hasCollector('CA')).toBe(true)
    })
  })

  describe('getImplementedStates()', () => {
    it('should return list of implemented states', () => {
      const implemented = factory.getImplementedStates()

      expect(implemented).toBeInstanceOf(Array)
      expect(implemented).toContain('NY')
      expect(implemented.length).toBeGreaterThan(0)
    })

    it('should return uppercase state codes', () => {
      const implemented = factory.getImplementedStates()

      implemented.forEach(code => {
        expect(code).toBe(code.toUpperCase())
        expect(code.length).toBe(2)
      })
    })
  })

  describe('getPendingStates()', () => {
    it('should return list of pending states', () => {
      const pending = factory.getPendingStates()

      expect(pending).toBeInstanceOf(Array)
      expect(pending.length).toBeGreaterThan(0)
    })

    it('should not include implemented states', () => {
      const pending = factory.getPendingStates()
      const implemented = factory.getImplementedStates()

      implemented.forEach(state => {
        expect(pending).not.toContain(state)
      })
    })

    it('should include all US states eventually', () => {
      const implemented = factory.getImplementedStates()
      const pending = factory.getPendingStates()

      expect(implemented.length + pending.length).toBe(51) // 50 states + DC
    })
  })

  describe('clearCache()', () => {
    it('should clear cached collectors', () => {
      // Create and cache a collector
      factory.getCollector('NY')

      let stats = factory.getStats()
      expect(stats.cached).toBe(1)

      // Clear cache
      factory.clearCache()

      stats = factory.getStats()
      expect(stats.cached).toBe(0)
    })

    it('should allow re-creation after clear', () => {
      const first = factory.getCollector('NY')
      factory.clearCache()
      const second = factory.getCollector('NY')

      expect(first).not.toBe(second) // Different instances after clear
    })
  })

  describe('getStats()', () => {
    it('should return comprehensive statistics', () => {
      const stats = factory.getStats()

      expect(stats).toHaveProperty('total')
      expect(stats).toHaveProperty('implemented')
      expect(stats).toHaveProperty('pending')
      expect(stats).toHaveProperty('cached')
      expect(stats).toHaveProperty('implementedStates')
      expect(stats).toHaveProperty('pendingStates')
      expect(stats).toHaveProperty('cachedStates')
    })

    it('should count total states correctly', () => {
      const stats = factory.getStats()

      expect(stats.total).toBe(51) // 50 states + DC
    })

    it('should track implemented states', () => {
      const stats = factory.getStats()

      expect(stats.implemented).toBe(2) // NY and CA
      expect(stats.implementedStates).toContain('NY')
      expect(stats.implementedStates).toContain('CA')
    })

    it('should track pending states', () => {
      const stats = factory.getStats()

      expect(stats.pending).toBe(49) // 51 - 2
      expect(stats.pendingStates.length).toBe(49)
    })

    it('should track cached states', () => {
      factory.getCollector('NY')

      const stats = factory.getStats()

      expect(stats.cached).toBe(1)
      expect(stats.cachedStates).toContain('NY')
    })

    it('should update after caching multiple collectors', () => {
      factory.getCollector('NY')

      const stats = factory.getStats()

      expect(stats.cached).toBeGreaterThan(0)
    })
  })

  describe('singleton instance', () => {
    it('should export singleton instance', () => {
      expect(stateCollectorFactory).toBeDefined()
      expect(stateCollectorFactory).toBeInstanceOf(StateCollectorFactory)
    })

    it('should be usable singleton', () => {
      const collector = stateCollectorFactory.getCollector('NY')

      expect(collector).toBeDefined()
    })
  })

  describe('helper functions', () => {
    it('should provide getCollectorForState helper', () => {
      const collector = getCollectorForState('NY')

      expect(collector).toBeDefined()
      expect(collector).toBeInstanceOf(NYStateCollector)
    })

    it('should provide hasCollectorForState helper', () => {
      expect(hasCollectorForState('NY')).toBe(true)
      expect(hasCollectorForState('CA')).toBe(true)
      expect(hasCollectorForState('TX')).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle invalid state codes gracefully', () => {
      const collector = factory.getCollector('INVALID')

      expect(collector).toBeUndefined()
    })

    it('should handle empty string', () => {
      const collector = factory.getCollector('')

      expect(collector).toBeUndefined()
    })

    it('should handle numeric codes', () => {
      const collector = factory.getCollector('12')

      expect(collector).toBeUndefined()
    })

    it('should handle too-long codes', () => {
      const collector = factory.getCollector('NEWYORK')

      expect(collector).toBeUndefined()
    })
  })

  describe('future expansion', () => {
    it('should have California collector implemented', () => {
      const implemented = factory.getImplementedStates()

      expect(implemented).toContain('CA')
      expect(factory.hasCollector('CA')).toBe(true)
    })

    it('should be ready for Texas collector', () => {
      const pending = factory.getPendingStates()

      expect(pending).toContain('TX')
    })

    it('should be ready for Florida collector', () => {
      const pending = factory.getPendingStates()

      expect(pending).toContain('FL')
    })

    it('should be ready for Illinois collector', () => {
      const pending = factory.getPendingStates()

      expect(pending).toContain('IL')
    })

    it('should track implementation progress', () => {
      const stats = factory.getStats()
      const progress = (stats.implemented / stats.total) * 100

      expect(progress).toBeGreaterThan(0)
      expect(progress).toBeLessThanOrEqual(100)
    })
  })
})
