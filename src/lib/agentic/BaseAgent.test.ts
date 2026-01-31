/**
 * Unit tests for BaseAgent class
 * Tests the foundational agent implementation that all specialized agents extend
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { BaseAgent } from './BaseAgent'
import { AgentAnalysis, SystemContext, Finding, ImprovementSuggestion } from './types'

// Create a concrete implementation for testing
class TestAgent extends BaseAgent {
  constructor() {
    super('data-analyzer', 'Test Agent', ['Test capability 1', 'Test capability 2'])
  }

  async analyze(context: SystemContext): Promise<AgentAnalysis> {
    void context
    const findings = [this.createFinding('data-quality', 'warning', 'Test finding', { test: true })]
    const improvements = [
      this.createImprovement(
        'data-quality',
        'high',
        'Test improvement',
        'Test description',
        'Test reasoning',
        'Test impact',
        true,
        85
      )
    ]
    return this.createAnalysis(findings, improvements)
  }

  // Public test helpers to access protected methods
  public testCreateFinding(
    category: ImprovementSuggestion['category'],
    severity: Finding['severity'],
    description: string,
    evidence: unknown
  ): Finding {
    return this.createFinding(category, severity, description, evidence)
  }

  public testCreateImprovement(
    category: ImprovementSuggestion['category'],
    priority: ImprovementSuggestion['priority'],
    title: string,
    description: string,
    reasoning: string,
    estimatedImpact: string,
    automatable: boolean,
    safetyScore: number,
    implementation?: ImprovementSuggestion['implementation']
  ): ImprovementSuggestion {
    return this.createImprovement(
      category,
      priority,
      title,
      description,
      reasoning,
      estimatedImpact,
      automatable,
      safetyScore,
      implementation
    )
  }

  public testCreateAnalysis(
    findings: Finding[],
    improvements: ImprovementSuggestion[]
  ): AgentAnalysis {
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
        avgResponseTime: 100,
        errorRate: 0.01,
        userSatisfactionScore: 8,
        dataFreshnessScore: 85
      },
      timestamp: new Date().toISOString()
    }
  })

  describe('Constructor', () => {
    it('should create an agent with valid properties', () => {
      expect(agent).toBeDefined()
      expect(agent.id).toBeTruthy()
      expect(agent.role).toBe('data-analyzer')
      expect(agent.name).toBe('Test Agent')
      expect(agent.capabilities).toHaveLength(2)
      expect(agent.capabilities).toContain('Test capability 1')
    })

    it('should generate unique IDs for different agents', () => {
      const agent1 = new TestAgent()
      const agent2 = new TestAgent()
      expect(agent1.id).not.toBe(agent2.id)
    })
  })

  describe('createFinding', () => {
    it('should create a finding with all required fields', () => {
      const finding = agent.testCreateFinding('security', 'critical', 'Test security issue', {
        vulnerability: 'XSS'
      })

      expect(finding).toMatchObject({
        category: 'security',
        severity: 'critical',
        description: 'Test security issue',
        evidence: { vulnerability: 'XSS' }
      })
      expect(finding.id).toBeTruthy()
    })

    it('should generate unique IDs for different findings', () => {
      const finding1 = agent.testCreateFinding('data-quality', 'info', 'Issue 1', {})
      const finding2 = agent.testCreateFinding('data-quality', 'info', 'Issue 2', {})
      expect(finding1.id).not.toBe(finding2.id)
    })
  })

  describe('createImprovement', () => {
    it('should create an improvement suggestion with all required fields', () => {
      const improvement = agent.testCreateImprovement(
        'performance',
        'high',
        'Optimize queries',
        'Add database indexes',
        'Slow query performance detected',
        'Reduce query time by 50%',
        true,
        90
      )

      expect(improvement).toMatchObject({
        category: 'performance',
        priority: 'high',
        title: 'Optimize queries',
        description: 'Add database indexes',
        reasoning: 'Slow query performance detected',
        estimatedImpact: 'Reduce query time by 50%',
        automatable: true,
        safetyScore: 90
      })
      expect(improvement.id).toBeTruthy()
    })

    it('should create an improvement with implementation plan', () => {
      const implementation = {
        steps: ['Step 1', 'Step 2'],
        risks: ['Risk 1'],
        rollbackPlan: ['Rollback step'],
        validationCriteria: ['Criteria 1']
      }

      const improvement = agent.testCreateImprovement(
        'usability',
        'medium',
        'UI Enhancement',
        'Improve navigation',
        'User feedback',
        'Better UX',
        true,
        85,
        implementation
      )

      expect(improvement.implementation).toEqual(implementation)
    })

    it('should handle improvements without implementation plan', () => {
      const improvement = agent.testCreateImprovement(
        'feature-enhancement',
        'low',
        'Add feature',
        'New feature description',
        'Nice to have',
        'Enhanced functionality',
        false,
        70
      )

      expect(improvement.implementation).toBeUndefined()
    })
  })

  describe('createAnalysis', () => {
    it('should create an analysis with findings and improvements', () => {
      const findings: Finding[] = [
        agent.testCreateFinding('data-quality', 'warning', 'Data issue', {})
      ]
      const improvements: ImprovementSuggestion[] = [
        agent.testCreateImprovement(
          'data-quality',
          'high',
          'Fix data',
          'Description',
          'Reasoning',
          'Impact',
          true,
          80
        )
      ]

      const analysis = agent.testCreateAnalysis(findings, improvements)

      expect(analysis).toMatchObject({
        agentId: agent.id,
        agentRole: agent.role,
        findings,
        improvements
      })
      expect(analysis.timestamp).toBeTruthy()
      expect(new Date(analysis.timestamp).getTime()).toBeLessThanOrEqual(Date.now())
    })

    it('should handle empty findings and improvements', () => {
      const analysis = agent.testCreateAnalysis([], [])

      expect(analysis.findings).toHaveLength(0)
      expect(analysis.improvements).toHaveLength(0)
      expect(analysis.agentId).toBe(agent.id)
    })
  })

  describe('analyze', () => {
    it('should perform analysis and return results', async () => {
      const result = await agent.analyze(mockContext)

      expect(result).toBeDefined()
      expect(result.agentId).toBe(agent.id)
      expect(result.agentRole).toBe('data-analyzer')
      expect(result.findings).toHaveLength(1)
      expect(result.improvements).toHaveLength(1)
      expect(result.timestamp).toBeTruthy()
    })

    it('should return analysis with correct structure', async () => {
      const result = await agent.analyze(mockContext)

      expect(result.findings[0]).toHaveProperty('id')
      expect(result.findings[0]).toHaveProperty('category')
      expect(result.findings[0]).toHaveProperty('severity')
      expect(result.findings[0]).toHaveProperty('description')

      expect(result.improvements[0]).toHaveProperty('id')
      expect(result.improvements[0]).toHaveProperty('title')
      expect(result.improvements[0]).toHaveProperty('safetyScore')
    })
  })
})
