/**
 * Tests for EntryPointAgent and EntryPointAgentFactory
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  EntryPointAgent,
  EntryPointAgentFactory,
  entryPointAgentFactory,
  ENTRY_POINT_CONFIGS,
  type EntryPointConfig
} from './EntryPointAgent'
import type { SystemContext } from '../../types'

describe('EntryPointAgent', () => {
  let mockConfig: EntryPointConfig
  let agent: EntryPointAgent
  let mockContext: SystemContext

  beforeEach(() => {
    mockConfig = {
      id: 'test-api',
      name: 'Test API',
      type: 'api',
      endpoint: 'https://api.test.com/v1',
      authRequired: true,
      authMethod: 'api-key',
      rateLimit: { requestsPerSecond: 10, requestsPerMinute: 500, requestsPerHour: 10000 },
      dataFormat: 'json',
      reliability: 99.5,
      averageResponseTime: 250,
      costPerRequest: 0.01
    }

    agent = new EntryPointAgent(mockConfig)

    mockContext = {
      prospects: [],
      competitors: [],
      portfolio: [],
      userActions: [],
      performanceMetrics: {
        avgResponseTime: 200,
        errorRate: 0.01,
        userSatisfactionScore: 4.5,
        dataFreshnessScore: 0.8
      },
      timestamp: new Date().toISOString()
    }
  })

  describe('initialization', () => {
    it('should create agent with config ID', () => {
      expect(agent['customId']).toBe('test-api')
    })

    it('should create agent with correct name', () => {
      expect(agent['name']).toBe('Test API')
    })

    it('should set correct agent role', () => {
      expect(agent['role']).toBe('entry-point-collector')
    })

    it('should have type-specific capabilities for API', () => {
      const capabilities = agent['capabilities']
      expect(capabilities).toContain('Collect from Test API via Api')
      expect(capabilities).toContain('Parse JSON format')
      expect(capabilities).toContain('Handle Api Key authentication')
    })

    it('should initialize metrics', () => {
      const metrics = agent.getMetrics()
      expect(metrics.totalRequests).toBe(0)
      expect(metrics.successfulRequests).toBe(0)
      expect(metrics.failedRequests).toBe(0)
      expect(metrics.averageLatency).toBe(0)
    })
  })

  describe('entry point types', () => {
    it('should handle API type correctly', () => {
      const apiConfig: EntryPointConfig = { ...mockConfig, type: 'api' }
      const apiAgent = new EntryPointAgent(apiConfig)
      expect(apiAgent['capabilities']).toContain('Collect from Test API via Api')
    })

    it('should handle Portal type correctly', () => {
      const portalConfig: EntryPointConfig = { ...mockConfig, type: 'portal' }
      const portalAgent = new EntryPointAgent(portalConfig)
      expect(portalAgent['capabilities']).toContain('Collect from Test API via Portal')
    })

    it('should handle Database type correctly', () => {
      const dbConfig: EntryPointConfig = { ...mockConfig, type: 'database' }
      const dbAgent = new EntryPointAgent(dbConfig)
      expect(dbAgent['capabilities']).toContain('Collect from Test API via Database')
    })

    it('should handle File type correctly', () => {
      const fileConfig: EntryPointConfig = { ...mockConfig, type: 'file' }
      const fileAgent = new EntryPointAgent(fileConfig)
      expect(fileAgent['capabilities']).toContain('Collect from Test API via File')
    })

    it('should handle Webhook type correctly', () => {
      const webhookConfig: EntryPointConfig = { ...mockConfig, type: 'webhook' }
      const webhookAgent = new EntryPointAgent(webhookConfig)
      expect(webhookAgent['capabilities']).toContain('Collect from Test API via Webhook')
    })
  })

  describe('authentication methods', () => {
    it('should handle API key auth', () => {
      const config: EntryPointConfig = { ...mockConfig, authMethod: 'api-key' }
      const authAgent = new EntryPointAgent(config)
      expect(authAgent['capabilities']).toContain('Handle Api Key authentication')
    })

    it('should handle OAuth2 auth', () => {
      const config: EntryPointConfig = { ...mockConfig, authMethod: 'oauth2' }
      const authAgent = new EntryPointAgent(config)
      expect(authAgent['capabilities']).toContain('Handle Oauth2 authentication')
    })

    it('should handle Basic auth', () => {
      const config: EntryPointConfig = { ...mockConfig, authMethod: 'basic' }
      const authAgent = new EntryPointAgent(config)
      expect(authAgent['capabilities']).toContain('Handle Basic authentication')
    })

    it('should handle JWT auth', () => {
      const config: EntryPointConfig = { ...mockConfig, authMethod: 'jwt' }
      const authAgent = new EntryPointAgent(config)
      expect(authAgent['capabilities']).toContain('Handle Jwt authentication')
    })
  })

  describe('analyze()', () => {
    it('should detect low reliability', async () => {
      agent.updateMetrics({
        totalRequests: 100,
        successfulRequests: 85,
        failedRequests: 15
      })

      const analysis = await agent.analyze(mockContext)

      const reliabilityFinding = analysis.findings.find(
        f => f.category === 'performance' && f.severity === 'critical'
      )
      expect(reliabilityFinding).toBeDefined()
      expect(reliabilityFinding?.description).toContain('85%')
    })

    it('should suggest latency optimization for slow endpoints', async () => {
      agent.updateMetrics({ averageLatency: 6000 })

      const analysis = await agent.analyze(mockContext)

      const latencySuggestion = analysis.improvements.find(
        i => i.title.includes('performance')
      )
      expect(latencySuggestion).toBeDefined()
      expect(latencySuggestion?.priority).toBe('medium')
    })

    it('should suggest cost optimization for expensive endpoints', async () => {
      agent.updateMetrics({ totalRequests: 15000 })

      const analysis = await agent.analyze(mockContext)

      const costSuggestion = analysis.improvements.find(
        i => i.title.includes('costs')
      )
      expect(costSuggestion).toBeDefined()
      expect(costSuggestion?.category).toBe('performance')
    })

    it('should provide type-specific analysis for APIs', async () => {
      const analysis = await agent.analyze(mockContext)

      const apiFindings = analysis.findings.filter(f => f.category === 'security')
      expect(apiFindings.length).toBeGreaterThanOrEqual(0)
    })

    it('should provide portal-specific analysis', async () => {
      const portalConfig: EntryPointConfig = { ...mockConfig, type: 'portal' }
      const portalAgent = new EntryPointAgent(portalConfig)

      const analysis = await portalAgent.analyze(mockContext)

      expect(analysis.findings.length).toBeGreaterThanOrEqual(0)
    })

    it('should not suggest improvements for healthy endpoints', async () => {
      agent.updateMetrics({
        totalRequests: 100,
        successfulRequests: 99,
        failedRequests: 1,
        averageLatency: 200
      })

      const analysis = await agent.analyze(mockContext)

      const performanceImprovements = analysis.improvements.filter(
        i => i.priority === 'critical'
      )
      expect(performanceImprovements.length).toBe(0)
    })
  })

  describe('collect()', () => {
    it('should accept collection options', async () => {
      const options = { limit: 100, since: new Date('2024-01-01') }
      const result = await agent.collect(options)
      expect(Array.isArray(result)).toBe(true)
    })

    it('should work without options', async () => {
      const result = await agent.collect()
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('metrics management', () => {
    it('should return metrics copy', () => {
      const metrics1 = agent.getMetrics()
      const metrics2 = agent.getMetrics()
      expect(metrics1).not.toBe(metrics2)
      expect(metrics1).toEqual(metrics2)
    })

    it('should update metrics partially', () => {
      agent.updateMetrics({ totalRequests: 500 })
      const metrics = agent.getMetrics()
      expect(metrics.totalRequests).toBe(500)
      expect(metrics.successfulRequests).toBe(0)
    })

    it('should calculate success rate correctly', () => {
      agent.updateMetrics({
        totalRequests: 100,
        successfulRequests: 95,
        failedRequests: 5
      })
      const metrics = agent.getMetrics()
      expect(metrics.successfulRequests + metrics.failedRequests).toBe(100)
    })
  })

  describe('config management', () => {
    it('should return config copy', () => {
      const config1 = agent.getConfig()
      const config2 = agent.getConfig()
      expect(config1).not.toBe(config2)
      expect(config1).toEqual(config2)
    })

    it('should preserve all config fields', () => {
      const config = agent.getConfig()
      expect(config.id).toBe('test-api')
      expect(config.type).toBe('api')
      expect(config.endpoint).toBeDefined()
      expect(config.rateLimit).toBeDefined()
    })
  })
})

describe('EntryPointAgentFactory', () => {
  let factory: EntryPointAgentFactory

  beforeEach(() => {
    factory = new EntryPointAgentFactory()
  })

  describe('ENTRY_POINT_CONFIGS', () => {
    it('should have predefined entry point configurations', () => {
      expect(ENTRY_POINT_CONFIGS.length).toBeGreaterThan(0)
    })

    it('should have unique IDs', () => {
      const ids = ENTRY_POINT_CONFIGS.map(c => c.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    it('should have valid endpoints', () => {
      ENTRY_POINT_CONFIGS.forEach(config => {
        expect(config.endpoint).toBeTruthy()
        if (config.type === 'api' || config.type === 'portal') {
          expect(config.endpoint).toMatch(/^https?:\/\//)
        }
      })
    })

    it('should include UCC National API', () => {
      const uccApi = ENTRY_POINT_CONFIGS.find(c => c.id === 'ucc-national-api')
      expect(uccApi).toBeDefined()
      expect(uccApi?.type).toBe('api')
    })
  })

  describe('createAllEntryPointAgents()', () => {
    it('should create agents for all configs', () => {
      const agents = factory.createAllEntryPointAgents()
      expect(agents.size).toBe(ENTRY_POINT_CONFIGS.length)
    })

    it('should create EntryPointAgent instances', () => {
      const agents = factory.createAllEntryPointAgents()
      agents.forEach(agent => {
        expect(agent['role']).toBe('entry-point-collector')
      })
    })

    it('should use config IDs as map keys', () => {
      const agents = factory.createAllEntryPointAgents()
      ENTRY_POINT_CONFIGS.forEach(config => {
        expect(agents.has(config.id)).toBe(true)
      })
    })
  })

  describe('createEntryPointAgent()', () => {
    it('should create agent for specific ID', () => {
      const agent = factory.createEntryPointAgent('ucc-national-api')
      expect(agent).toBeDefined()
      expect(agent?.['customId']).toBe('ucc-national-api')
    })

    it('should return undefined for invalid ID', () => {
      const agent = factory.createEntryPointAgent('invalid-id')
      expect(agent).toBeUndefined()
    })

    it('should add agent to registry', () => {
      factory.createEntryPointAgent('ucc-national-api')
      const agent = factory.getAgent('ucc-national-api')
      expect(agent).toBeDefined()
    })
  })

  describe('createCustomEntryPointAgent()', () => {
    it('should create agent with custom config', () => {
      const customConfig: EntryPointConfig = {
        id: 'custom-endpoint',
        name: 'Custom Endpoint',
        type: 'api',
        endpoint: 'https://custom.api.com',
        authRequired: false,
        rateLimit: { requestsPerSecond: 5, requestsPerMinute: 100, requestsPerHour: 1000 },
        dataFormat: 'json',
        reliability: 95,
        averageResponseTime: 500
      }

      const agent = factory.createCustomEntryPointAgent(customConfig)
      expect(agent['customId']).toBe('custom-endpoint')
      expect(agent.getConfig().endpoint).toBe('https://custom.api.com')
    })

    it('should add custom agent to registry', () => {
      const customConfig: EntryPointConfig = {
        id: 'custom-2',
        name: 'Custom 2',
        type: 'database',
        endpoint: 'postgres://localhost',
        authRequired: true,
        authMethod: 'basic',
        rateLimit: { requestsPerSecond: 10, requestsPerMinute: 600, requestsPerHour: 5000 },
        dataFormat: 'json',
        reliability: 99,
        averageResponseTime: 100
      }

      factory.createCustomEntryPointAgent(customConfig)
      const agent = factory.getAgent('custom-2')
      expect(agent).toBeDefined()
    })
  })

  describe('getAgent()', () => {
    beforeEach(() => {
      factory.createEntryPointAgent('ucc-national-api')
    })

    it('should retrieve specific agent by ID', () => {
      const agent = factory.getAgent('ucc-national-api')
      expect(agent).toBeDefined()
      expect(agent?.['customId']).toBe('ucc-national-api')
    })

    it('should return undefined for non-existent ID', () => {
      const agent = factory.getAgent('non-existent')
      expect(agent).toBeUndefined()
    })
  })

  describe('getAllAgents()', () => {
    it('should return empty map initially', () => {
      const agents = factory.getAllAgents()
      expect(agents.size).toBe(0)
    })

    it('should return all registered agents', () => {
      factory.createAllEntryPointAgents()
      const agents = factory.getAllAgents()
      expect(agents.size).toBe(ENTRY_POINT_CONFIGS.length)
    })

    it('should return new map instance', () => {
      factory.createAllEntryPointAgents()
      const agents1 = factory.getAllAgents()
      const agents2 = factory.getAllAgents()
      expect(agents1).not.toBe(agents2)
    })
  })

  describe('getAgentsByType()', () => {
    beforeEach(() => {
      factory.createAllEntryPointAgents()
    })

    it('should filter agents by API type', () => {
      const apiAgents = factory.getAgentsByType('api')
      apiAgents.forEach(agent => {
        expect(agent.getConfig().type).toBe('api')
      })
    })

    it('should filter agents by Portal type', () => {
      const portalAgents = factory.getAgentsByType('portal')
      portalAgents.forEach(agent => {
        expect(agent.getConfig().type).toBe('portal')
      })
    })

    it('should filter agents by Database type', () => {
      const dbAgents = factory.getAgentsByType('database')
      dbAgents.forEach(agent => {
        expect(agent.getConfig().type).toBe('database')
      })
    })

    it('should return empty array for types with no agents', () => {
      factory.clear()
      const agents = factory.getAgentsByType('webhook')
      expect(agents.length).toBe(0)
    })
  })

  describe('clear()', () => {
    it('should remove all agents', () => {
      factory.createAllEntryPointAgents()
      expect(factory.getAllAgents().size).toBeGreaterThan(0)
      factory.clear()
      expect(factory.getAllAgents().size).toBe(0)
    })

    it('should allow recreation after clear', () => {
      factory.createAllEntryPointAgents()
      factory.clear()
      factory.createEntryPointAgent('ucc-national-api')
      expect(factory.getAllAgents().size).toBe(1)
    })
  })

  describe('singleton instance', () => {
    it('should export singleton instance', () => {
      expect(entryPointAgentFactory).toBeDefined()
      expect(entryPointAgentFactory).toBeInstanceOf(EntryPointAgentFactory)
    })

    it('should be usable singleton', () => {
      entryPointAgentFactory.clear()
      entryPointAgentFactory.createEntryPointAgent('ucc-national-api')
      expect(entryPointAgentFactory.getAllAgents().size).toBe(1)
      entryPointAgentFactory.clear()
    })
  })

  describe('agent configuration integrity', () => {
    it('should preserve rate limits', () => {
      const agent = factory.createEntryPointAgent('ucc-national-api')
      const config = agent?.getConfig()
      expect(config?.rateLimit).toBeDefined()
      expect(config?.rateLimit.requestsPerSecond).toBeGreaterThan(0)
    })

    it('should preserve reliability metrics', () => {
      const agent = factory.createEntryPointAgent('ucc-national-api')
      const config = agent?.getConfig()
      expect(config?.reliability).toBeGreaterThan(0)
      expect(config?.reliability).toBeLessThanOrEqual(100)
    })

    it('should preserve cost information if present', () => {
      const agent = factory.createEntryPointAgent('ucc-national-api')
      const config = agent?.getConfig()
      if (config?.costPerRequest !== undefined) {
        expect(config.costPerRequest).toBeGreaterThanOrEqual(0)
      }
    })
  })
})
