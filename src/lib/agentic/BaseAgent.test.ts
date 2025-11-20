/**
 * BaseAgent Tests
 * 
 * Tests for the BaseAgent class functionality including:
 * - Agent initialization
 * - Finding creation
 * - Improvement creation
 * - Analysis assembly
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { BaseAgent } from './BaseAgent'
import { AgentAnalysis, SystemContext, Finding, ImprovementSuggestion } from './types'

// Concrete implementation for testing
class TestAgent extends BaseAgent {
  constructor() {
    super('data-analyzer', 'Test Agent', ['test-capability-1', 'test-capability-2'])
  }

  async analyze(context: SystemContext): Promise<AgentAnalysis> {
    const findings: Finding[] = []
    const improvements: ImprovementSuggestion[] = []

    // Simple test analysis
    if (context.prospects.length === 0) {
      findings.push(this.createFinding(
        'data-quality',
        'warning',
        'No prospects found',
        { count: 0 }
      ))
    }

    if (findings.length > 0) {
      improvements.push(this.createImprovement(
        'data-quality',
        'high',
        'Add test data',
        'Add some test prospects',
        'No data available',
        'Improve testing coverage',
        true,
        90
      ))
    }

    return this.createAnalysis(findings, improvements)
  }
}

describe('BaseAgent', () => {
  let agent: TestAgent
  let mockContext: SystemContext

  beforeEach(() => {
    agent = new TestAgent()
    mockContext = {
      prospects: [],
      competitors: [],
      portfolio: [],
      userActions: [],
      performanceMetrics: {
        avgResponseTime: 500,
        errorRate: 0.01,
        userSatisfactionScore: 8,
        dataFreshnessScore: 90
      },
      timestamp: new Date().toISOString()
    }
  })

  describe('Agent Initialization', () => {
    it('should initialize with correct properties', () => {
      expect(agent.id).toBeDefined()
      expect(agent.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
      expect(agent.role).toBe('data-analyzer')
      expect(agent.name).toBe('Test Agent')
      expect(agent.capabilities).toEqual(['test-capability-1', 'test-capability-2'])
    })

    it('should generate unique IDs for different agents', () => {
      const agent2 = new TestAgent()
      expect(agent.id).not.toBe(agent2.id)
    })
  })

  describe('Finding Creation', () => {
    it('should create finding with correct structure', () => {
      const finding = agent['createFinding'](
        'data-quality',
        'warning',
        'Test finding',
        { test: 'data' }
      )

      expect(finding).toMatchObject({
        id: expect.any(String),
        category: 'data-quality',
        severity: 'warning',
        description: 'Test finding',
        evidence: { test: 'data' }
      })
    })

    it('should generate unique IDs for findings', () => {
      const finding1 = agent['createFinding']('data-quality', 'info', 'Finding 1', {})
      const finding2 = agent['createFinding']('data-quality', 'info', 'Finding 2', {})
      expect(finding1.id).not.toBe(finding2.id)
    })

    it('should support all severity levels', () => {
      const severities = ['info', 'warning', 'critical'] as const
      severities.forEach(severity => {
        const finding = agent['createFinding']('data-quality', severity, 'Test', {})
        expect(finding.severity).toBe(severity)
      })
    })
  })

  describe('Improvement Creation', () => {
    it('should create improvement with required fields', () => {
      const improvement = agent['createImprovement'](
        'performance',
        'high',
        'Test Improvement',
        'Description of improvement',
        'Reasoning for improvement',
        'Expected impact',
        true,
        85
      )

      expect(improvement).toMatchObject({
        id: expect.any(String),
        category: 'performance',
        priority: 'high',
        title: 'Test Improvement',
        description: 'Description of improvement',
        reasoning: 'Reasoning for improvement',
        estimatedImpact: 'Expected impact',
        automatable: true,
        safetyScore: 85
      })
    })

    it('should create improvement with implementation plan', () => {
      const improvement = agent['createImprovement'](
        'security',
        'critical',
        'Security Fix',
        'Fix security issue',
        'Security vulnerability detected',
        'Improved security',
        false,
        60,
        {
          steps: ['Step 1', 'Step 2'],
          risks: ['Risk 1'],
          rollbackPlan: ['Rollback step'],
          validationCriteria: ['Criteria 1']
        }
      )

      expect(improvement.implementation).toEqual({
        steps: ['Step 1', 'Step 2'],
        risks: ['Risk 1'],
        rollbackPlan: ['Rollback step'],
        validationCriteria: ['Criteria 1']
      })
    })

    it('should support all priority levels', () => {
      const priorities = ['critical', 'high', 'medium', 'low'] as const
      priorities.forEach(priority => {
        const improvement = agent['createImprovement'](
          'data-quality',
          priority,
          'Test',
          'Desc',
          'Reason',
          'Impact',
          true,
          80
        )
        expect(improvement.priority).toBe(priority)
      })
    })

    it('should validate safety score bounds', () => {
      const lowScore = agent['createImprovement'](
        'data-quality',
        'high',
        'Low Safety',
        'Desc',
        'Reason',
        'Impact',
        true,
        0
      )
      expect(lowScore.safetyScore).toBe(0)

      const highScore = agent['createImprovement'](
        'data-quality',
        'high',
        'High Safety',
        'Desc',
        'Reason',
        'Impact',
        true,
        100
      )
      expect(highScore.safetyScore).toBe(100)
    })
  })

  describe('Analysis Assembly', () => {
    it('should create complete analysis structure', async () => {
      const analysis = await agent.analyze(mockContext)

      expect(analysis).toMatchObject({
        agentId: agent.id,
        agentRole: 'data-analyzer',
        findings: expect.any(Array),
        improvements: expect.any(Array),
        timestamp: expect.any(String)
      })
    })

    it('should include timestamp in ISO format', async () => {
      const analysis = await agent.analyze(mockContext)
      expect(() => new Date(analysis.timestamp)).not.toThrow()
      expect(analysis.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it('should detect issues in empty context', async () => {
      const analysis = await agent.analyze(mockContext)
      expect(analysis.findings.length).toBeGreaterThan(0)
      expect(analysis.improvements.length).toBeGreaterThan(0)
    })

    it('should handle context with data', async () => {
      mockContext.prospects = [
        { companyName: 'Test Company', state: 'CA' }
      ]
      const analysis = await agent.analyze(mockContext)
      expect(analysis.findings.length).toBe(0)
      expect(analysis.improvements.length).toBe(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle null evidence in findings', () => {
      const finding = agent['createFinding']('data-quality', 'info', 'Test', null)
      expect(finding.evidence).toBeNull()
    })

    it('should handle undefined implementation plan', () => {
      const improvement = agent['createImprovement'](
        'data-quality',
        'low',
        'Test',
        'Desc',
        'Reason',
        'Impact',
        true,
        75
      )
      expect(improvement.implementation).toBeUndefined()
    })

    it('should handle empty capabilities array', () => {
      const emptyAgent = new (class extends BaseAgent {
        constructor() {
          super('optimizer', 'Empty Agent', [])
        }
        async analyze(): Promise<AgentAnalysis> {
          return this.createAnalysis([], [])
        }
      })()
      expect(emptyAgent.capabilities).toEqual([])
    })
  })
})
