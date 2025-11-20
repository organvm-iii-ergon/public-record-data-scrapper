/**
 * Tests for StateAgentFactory
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { StateAgentFactory, STATE_CONFIGS, stateAgentFactory } from './StateAgentFactory'

describe('StateAgentFactory', () => {
  let factory: StateAgentFactory

  beforeEach(() => {
    factory = new StateAgentFactory()
  })

  describe('STATE_CONFIGS', () => {
    it('should have all 50 states + DC configured', () => {
      expect(STATE_CONFIGS.length).toBeGreaterThanOrEqual(50)
    })

    it('should have unique state codes', () => {
      const stateCodes = STATE_CONFIGS.map(c => c.stateCode)
      const uniqueCodes = new Set(stateCodes)
      expect(uniqueCodes.size).toBe(stateCodes.length)
    })

    it('should have valid portal URLs', () => {
      STATE_CONFIGS.forEach(config => {
        expect(config.portalUrl).toMatch(/^https?:\/\//)
      })
    })

    it('should have valid rate limits', () => {
      STATE_CONFIGS.forEach(config => {
        expect(config.rateLimit.requestsPerMinute).toBeGreaterThan(0)
        expect(config.rateLimit.requestsPerHour).toBeGreaterThan(0)
        expect(config.rateLimit.requestsPerDay).toBeGreaterThan(0)
      })
    })

    it('should include major states (NY, CA, TX, FL, IL)', () => {
      const stateCodes = STATE_CONFIGS.map(c => c.stateCode)
      expect(stateCodes).toContain('NY')
      expect(stateCodes).toContain('CA')
      expect(stateCodes).toContain('TX')
      expect(stateCodes).toContain('FL')
      expect(stateCodes).toContain('IL')
    })

    it('should have valid data formats', () => {
      const validFormats = ['json', 'xml', 'csv', 'html']
      STATE_CONFIGS.forEach(config => {
        expect(validFormats).toContain(config.dataFormat)
      })
    })

    it('should have valid update frequencies', () => {
      const validFrequencies = ['realtime', 'hourly', 'daily', 'weekly']
      STATE_CONFIGS.forEach(config => {
        expect(validFrequencies).toContain(config.updateFrequency)
      })
    })
  })

  describe('createAllStateAgents()', () => {
    it('should create agents for all configured states', () => {
      const registry = factory.createAllStateAgents()
      expect(Object.keys(registry).length).toBe(STATE_CONFIGS.length)
    })

    it('should create agents with correct state codes as keys', () => {
      const registry = factory.createAllStateAgents()
      STATE_CONFIGS.forEach(config => {
        expect(registry[config.stateCode]).toBeDefined()
      })
    })

    it('should create StateAgent instances', () => {
      const registry = factory.createAllStateAgents()
      const nyAgent = registry['NY']
      expect(nyAgent).toBeDefined()
      expect(nyAgent['role']).toBe('state-collector')
    })

    it('should populate internal registry', () => {
      factory.createAllStateAgents()
      expect(factory.getAgentCount()).toBe(STATE_CONFIGS.length)
    })

    it('should populate the internal registry', () => {
      const registry1 = factory.createAllStateAgents()
      const registry2 = factory.getAllAgents()
      expect(registry1).not.toBe(registry2) // Different objects
      expect(Object.keys(registry1).length).toBe(Object.keys(registry2).length)
    })
  })

  describe('createStateAgents()', () => {
    it('should create agents for specific states', () => {
      const stateCodes = ['NY', 'CA', 'TX']
      const registry = factory.createStateAgents(stateCodes)
      expect(Object.keys(registry).length).toBe(3)
      expect(registry['NY']).toBeDefined()
      expect(registry['CA']).toBeDefined()
      expect(registry['TX']).toBeDefined()
    })

    it('should handle single state', () => {
      const registry = factory.createStateAgents(['FL'])
      expect(Object.keys(registry).length).toBe(1)
      expect(registry['FL']).toBeDefined()
    })

    it('should ignore invalid state codes', () => {
      const registry = factory.createStateAgents(['NY', 'INVALID', 'CA'])
      expect(Object.keys(registry).length).toBe(2)
      expect(registry['NY']).toBeDefined()
      expect(registry['CA']).toBeDefined()
      expect(registry['INVALID']).toBeUndefined()
    })

    it('should handle empty array', () => {
      const registry = factory.createStateAgents([])
      expect(Object.keys(registry).length).toBe(0)
    })

    it('should add agents to internal registry', () => {
      factory.createStateAgents(['NY', 'CA'])
      expect(factory.getAgentCount()).toBe(2)
    })

    it('should not duplicate agents in registry', () => {
      factory.createStateAgents(['NY'])
      factory.createStateAgents(['NY', 'CA'])
      expect(factory.getAgentCount()).toBe(2) // NY, CA (not 3)
    })
  })

  describe('getAgent()', () => {
    beforeEach(() => {
      factory.createStateAgents(['NY', 'CA', 'TX'])
    })

    it('should retrieve specific agent by state code', () => {
      const agent = factory.getAgent('NY')
      expect(agent).toBeDefined()
      expect(agent?.['customId']).toBe('state-agent-ny')
    })

    it('should return undefined for non-existent state', () => {
      const agent = factory.getAgent('ZZ')
      expect(agent).toBeUndefined()
    })

    it('should return undefined for non-registered state', () => {
      const agent = factory.getAgent('FL')
      expect(agent).toBeUndefined()
    })
  })

  describe('getAllAgents()', () => {
    it('should return copy of registry', () => {
      factory.createStateAgents(['NY', 'CA'])
      const registry1 = factory.getAllAgents()
      const registry2 = factory.getAllAgents()
      expect(registry1).not.toBe(registry2) // Different objects
      expect(registry1).toEqual(registry2) // Same content
    })

    it('should return empty object initially', () => {
      const registry = factory.getAllAgents()
      expect(Object.keys(registry).length).toBe(0)
    })

    it('should return all registered agents', () => {
      factory.createAllStateAgents()
      const registry = factory.getAllAgents()
      expect(Object.keys(registry).length).toBe(STATE_CONFIGS.length)
    })
  })

  describe('getAgentsByRegion()', () => {
    beforeEach(() => {
      factory.createAllStateAgents()
    })

    it('should return northeast region agents', () => {
      const agents = factory.getAgentsByRegion('northeast')
      expect(agents['NY']).toBeDefined()
      expect(agents['NJ']).toBeDefined()
      expect(agents['PA']).toBeDefined()
      expect(agents['MA']).toBeDefined()
      expect(agents['CT']).toBeDefined()
    })

    it('should return south region agents', () => {
      const agents = factory.getAgentsByRegion('south')
      expect(agents['FL']).toBeDefined()
      expect(agents['TX']).toBeDefined()
      expect(agents['GA']).toBeDefined()
      expect(agents['NC']).toBeDefined()
      expect(agents['VA']).toBeDefined()
    })

    it('should return midwest region agents', () => {
      const agents = factory.getAgentsByRegion('midwest')
      expect(agents['IL']).toBeDefined()
      expect(agents['OH']).toBeDefined()
      expect(agents['MI']).toBeDefined()
      expect(agents['IN']).toBeDefined()
      expect(agents['WI']).toBeDefined()
    })

    it('should return west region agents', () => {
      const agents = factory.getAgentsByRegion('west')
      expect(agents['CA']).toBeDefined()
      expect(agents['WA']).toBeDefined()
      expect(agents['OR']).toBeDefined()
      expect(agents['AZ']).toBeDefined()
      expect(agents['NV']).toBeDefined()
    })

    it('should not include non-registered states in region', () => {
      factory.clear()
      factory.createStateAgents(['NY', 'CA'])

      const northeast = factory.getAgentsByRegion('northeast')
      expect(northeast['NY']).toBeDefined()
      expect(northeast['NJ']).toBeUndefined() // Not registered
    })

    it('should return empty for region with no registered agents', () => {
      factory.clear()
      const agents = factory.getAgentsByRegion('west')
      expect(Object.keys(agents).length).toBe(0)
    })
  })

  describe('getAgentCount()', () => {
    it('should return 0 initially', () => {
      expect(factory.getAgentCount()).toBe(0)
    })

    it('should return correct count after creation', () => {
      factory.createStateAgents(['NY', 'CA', 'TX'])
      expect(factory.getAgentCount()).toBe(3)
    })

    it('should return count of all agents', () => {
      factory.createAllStateAgents()
      expect(factory.getAgentCount()).toBe(STATE_CONFIGS.length)
    })

    it('should update count after clearing', () => {
      factory.createStateAgents(['NY', 'CA'])
      factory.clear()
      expect(factory.getAgentCount()).toBe(0)
    })
  })

  describe('clear()', () => {
    it('should remove all agents', () => {
      factory.createAllStateAgents()
      expect(factory.getAgentCount()).toBeGreaterThan(0)
      factory.clear()
      expect(factory.getAgentCount()).toBe(0)
    })

    it('should make registry empty', () => {
      factory.createStateAgents(['NY', 'CA'])
      factory.clear()
      const registry = factory.getAllAgents()
      expect(Object.keys(registry).length).toBe(0)
    })

    it('should allow recreation after clear', () => {
      factory.createStateAgents(['NY'])
      factory.clear()
      factory.createStateAgents(['CA'])
      expect(factory.getAgentCount()).toBe(1)
      expect(factory.getAgent('CA')).toBeDefined()
      expect(factory.getAgent('NY')).toBeUndefined()
    })
  })

  describe('singleton instance', () => {
    it('should export singleton instance', () => {
      expect(stateAgentFactory).toBeDefined()
      expect(stateAgentFactory).toBeInstanceOf(StateAgentFactory)
    })

    it('should be usable singleton', () => {
      stateAgentFactory.clear() // Clean up from other tests
      stateAgentFactory.createStateAgents(['NY'])
      expect(stateAgentFactory.getAgentCount()).toBe(1)
      stateAgentFactory.clear() // Clean up
    })
  })

  describe('agent configuration integrity', () => {
    it('should create agents with correct configurations', () => {
      factory.createAllStateAgents()
      const nyAgent = factory.getAgent('NY')
      const config = nyAgent?.getConfig()

      expect(config?.stateCode).toBe('NY')
      expect(config?.stateName).toBe('New York')
      expect(config?.dataFormat).toBeDefined()
    })

    it('should preserve rate limits in agent configs', () => {
      factory.createStateAgents(['CA'])
      const caAgent = factory.getAgent('CA')
      const config = caAgent?.getConfig()

      expect(config?.rateLimit).toBeDefined()
      expect(config?.rateLimit.requestsPerMinute).toBeGreaterThan(0)
    })

    it('should preserve business hours if configured', () => {
      factory.createStateAgents(['NY'])
      const nyAgent = factory.getAgent('NY')
      const config = nyAgent?.getConfig()

      if (config?.businessHours) {
        expect(config.businessHours.timezone).toBeDefined()
        expect(config.businessHours.start).toBeDefined()
        expect(config.businessHours.end).toBeDefined()
      }
    })
  })

  describe('edge cases', () => {
    it('should handle case-sensitive state codes', () => {
      factory.createStateAgents(['NY'])
      expect(factory.getAgent('NY')).toBeDefined()
      expect(factory.getAgent('ny')).toBeUndefined()
      expect(factory.getAgent('Ny')).toBeUndefined()
    })

    it('should handle duplicate state codes in creation', () => {
      const registry = factory.createStateAgents(['NY', 'NY', 'CA'])
      expect(Object.keys(registry).length).toBe(2)
    })

    it('should handle large batch creation', () => {
      const allStateCodes = STATE_CONFIGS.map(c => c.stateCode)
      const registry = factory.createStateAgents(allStateCodes)
      expect(Object.keys(registry).length).toBe(STATE_CONFIGS.length)
    })
  })
})
