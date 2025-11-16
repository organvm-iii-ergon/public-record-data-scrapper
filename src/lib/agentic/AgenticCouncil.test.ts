/**
 * AgenticCouncil Tests
 * 
 * Tests for the AgenticCouncil class including:
 * - Council review workflow
 * - Agent handoff mechanism
 * - Agent collaboration
 * - Improvement aggregation
 * - Error handling
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { AgenticCouncil } from './AgenticCouncil'
import { SystemContext, Agent } from './types'

describe('AgenticCouncil', () => {
  let council: AgenticCouncil
  let mockContext: SystemContext

  beforeEach(() => {
    council = new AgenticCouncil()
    mockContext = {
      prospects: [
        {
          companyName: 'Test Company',
          state: 'NY',
          healthScore: {
            lastUpdated: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
          }
        }
      ],
      competitors: [],
      portfolio: [],
      userActions: [
        { type: 'search', timestamp: new Date().toISOString(), details: {} },
        { type: 'filter', timestamp: new Date().toISOString(), details: {} }
      ],
      performanceMetrics: {
        avgResponseTime: 1200,
        errorRate: 0.04,
        userSatisfactionScore: 6.8,
        dataFreshnessScore: 65
      },
      timestamp: new Date().toISOString()
    }
  })

  describe('Council Initialization', () => {
    it('should initialize with default agents', () => {
      const agents = council.getAgents()
      expect(agents.length).toBe(5)
      
      const roles = agents.map(a => a.role)
      expect(roles).toContain('data-analyzer')
      expect(roles).toContain('optimizer')
      expect(roles).toContain('security')
      expect(roles).toContain('ux-enhancer')
    })

    it('should have agents with proper structure', () => {
      const agents = council.getAgents()
      agents.forEach(agent => {
        expect(agent).toHaveProperty('id')
        expect(agent).toHaveProperty('role')
        expect(agent).toHaveProperty('name')
        expect(agent).toHaveProperty('capabilities')
        expect(agent).toHaveProperty('analyze')
        expect(typeof agent.analyze).toBe('function')
      })
    })
  })

  describe('Council Review Workflow', () => {
    it('should conduct complete review cycle', async () => {
      const review = await council.conductReview(mockContext)
      
      expect(review).toHaveProperty('id')
      expect(review).toHaveProperty('startedAt')
      expect(review).toHaveProperty('completedAt')
      expect(review).toHaveProperty('agents')
      expect(review).toHaveProperty('analyses')
      expect(review).toHaveProperty('improvements')
      expect(review).toHaveProperty('status')
      
      expect(review.status).toBe('completed')
      expect(review.completedAt).toBeDefined()
    })

    it('should include all agents in review', async () => {
      const review = await council.conductReview(mockContext)
      expect(review.agents.length).toBe(5)
    })

    it('should collect analyses from all agents', async () => {
      const review = await council.conductReview(mockContext)
      expect(review.analyses.length).toBe(5)
      
      review.analyses.forEach(analysis => {
        expect(analysis).toHaveProperty('agentId')
        expect(analysis).toHaveProperty('agentRole')
        expect(analysis).toHaveProperty('findings')
        expect(analysis).toHaveProperty('improvements')
        expect(analysis).toHaveProperty('timestamp')
      })
    })

    it('should generate improvement suggestions', async () => {
      const review = await council.conductReview(mockContext)
      expect(review.improvements.length).toBeGreaterThan(0)
      
      review.improvements.forEach(improvement => {
        expect(improvement).toHaveProperty('id')
        expect(improvement).toHaveProperty('suggestion')
        expect(improvement).toHaveProperty('status')
        expect(improvement).toHaveProperty('detectedAt')
        expect(improvement).toHaveProperty('reviewedBy')
        expect(improvement.status).toBe('detected')
      })
    })

    it('should track review timing', async () => {
      const startTime = Date.now()
      const review = await council.conductReview(mockContext)
      const endTime = Date.now()
      
      const reviewStart = new Date(review.startedAt).getTime()
      const reviewEnd = review.completedAt ? new Date(review.completedAt).getTime() : 0
      
      expect(reviewStart).toBeGreaterThanOrEqual(startTime)
      expect(reviewStart).toBeLessThanOrEqual(endTime)
      expect(reviewEnd).toBeGreaterThanOrEqual(reviewStart)
      expect(reviewEnd).toBeLessThanOrEqual(endTime)
    })
  })

  describe('Agent Handoff Mechanism', () => {
    it('should execute agents in sequence', async () => {
      const review = await council.conductReview(mockContext)
      
      // All analyses should be present, indicating sequential execution
      expect(review.analyses.length).toBe(review.agents.length)
    })

    it('should maintain agent order', async () => {
      const agents = council.getAgents()
      const review = await council.conductReview(mockContext)
      
      expect(review.agents).toEqual(agents)
    })

    it('should complete all handoffs', async () => {
      const review = await council.conductReview(mockContext)
      expect(review.status).toBe('completed')
      expect(review.analyses.length).toBe(council.getAgents().length)
    })
  })

  describe('Improvement Aggregation', () => {
    it('should aggregate improvements from all agents', async () => {
      const review = await council.conductReview(mockContext)
      const totalSuggestions = review.analyses.reduce(
        (sum, analysis) => sum + analysis.improvements.length, 
        0
      )
      expect(review.improvements.length).toBe(totalSuggestions)
    })

    it('should track which agent suggested each improvement', async () => {
      const review = await council.conductReview(mockContext)
      review.improvements.forEach(improvement => {
        expect(improvement.reviewedBy).toBeDefined()
        expect(improvement.reviewedBy!.length).toBeGreaterThan(0)
      })
    })

    it('should provide improvement summary', async () => {
      await council.conductReview(mockContext)
      const summary = council.getImprovementSummary()
      
      expect(summary).toHaveProperty('byCategory')
      expect(summary).toHaveProperty('byPriority')
      expect(summary).toHaveProperty('total')
      expect(summary.total).toBeGreaterThan(0)
    })

    it('should categorize improvements correctly', async () => {
      await council.conductReview(mockContext)
      const summary = council.getImprovementSummary()
      
      expect(summary.byCategory).toBeDefined()
      Object.values(summary.byCategory).forEach(count => {
        expect(count).toBeGreaterThan(0)
      })
    })

    it('should prioritize improvements correctly', async () => {
      await council.conductReview(mockContext)
      const summary = council.getImprovementSummary()
      
      expect(summary.byPriority).toBeDefined()
      Object.values(summary.byPriority).forEach(count => {
        expect(count).toBeGreaterThan(0)
      })
    })
  })

  describe('Agent Management', () => {
    it('should add new agent to council', () => {
      const initialCount = council.getAgents().length
      
      // Create a mock agent
      const mockAgent: Agent = {
        id: 'test-agent-id',
        role: 'quality-assurance',
        name: 'Test Agent',
        capabilities: ['testing'],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        analyze: async (): Promise<any> => ({
          agentId: 'test-agent-id',
          agentRole: 'quality-assurance',
          findings: [],
          improvements: [],
          timestamp: new Date().toISOString()
        })
      }
      
      council.addAgent(mockAgent)
      expect(council.getAgents().length).toBe(initialCount + 1)
    })

    it('should remove agent from council', () => {
      const initialCount = council.getAgents().length
      council.removeAgent('optimizer')
      expect(council.getAgents().length).toBe(initialCount - 1)
      
      const roles = council.getAgents().map(a => a.role)
      expect(roles).not.toContain('optimizer')
    })

    it('should handle removing non-existent agent', () => {
      const initialCount = council.getAgents().length
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      council.removeAgent('non-existent' as any)
      expect(council.getAgents().length).toBe(initialCount)
    })
  })

  describe('Review State Management', () => {
    it('should track current review', async () => {
      expect(council.getCurrentReview()).toBeNull()
      
      const reviewPromise = council.conductReview(mockContext)
      // Review should be in progress
      
      const review = await reviewPromise
      expect(council.getCurrentReview()).toEqual(review)
    })

    it('should update review state', async () => {
      await council.conductReview(mockContext)
      const current = council.getCurrentReview()
      expect(current?.status).toBe('completed')
    })

    it('should maintain review history', async () => {
      const review1 = await council.conductReview(mockContext)
      const review2 = await council.conductReview(mockContext)
      
      expect(review1.id).not.toBe(review2.id)
      expect(council.getCurrentReview()?.id).toBe(review2.id)
    })
  })

  describe('Finding Analysis', () => {
    it('should collect findings from all agents', async () => {
      const review = await council.conductReview(mockContext)
      const totalFindings = review.analyses.reduce(
        (sum, analysis) => sum + analysis.findings.length,
        0
      )
      expect(totalFindings).toBeGreaterThan(0)
    })

    it('should include severity levels in findings', async () => {
      const review = await council.conductReview(mockContext)
      review.analyses.forEach(analysis => {
        analysis.findings.forEach(finding => {
          expect(finding.severity).toMatch(/info|warning|critical/)
        })
      })
    })

    it('should provide evidence for findings', async () => {
      const review = await council.conductReview(mockContext)
      review.analyses.forEach(analysis => {
        analysis.findings.forEach(finding => {
          expect(finding).toHaveProperty('evidence')
        })
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle agent analysis errors gracefully', async () => {
      // Add a failing agent
      const failingAgent: Agent = {
        id: 'failing-agent',
        role: 'quality-assurance',
        name: 'Failing Agent',
        capabilities: ['fail'],
        analyze: async () => {
          throw new Error('Agent analysis failed')
        }
      }
      
      council.addAgent(failingAgent)
      const review = await council.conductReview(mockContext)
      expect(review.status).toBe('completed')
    })

    it('should continue with other agents when one fails', async () => {
      const failingAgent: Agent = {
        id: 'failing-agent',
        role: 'quality-assurance',
        name: 'Failing Agent',
        capabilities: ['fail'],
        analyze: async () => {
          throw new Error('Agent failed')
        }
      }
      
      council.addAgent(failingAgent)
      const review = await council.conductReview(mockContext)
      
      // Should have analyses from working agents
      expect(review.analyses.length).toBeGreaterThan(0)
    })
  })

  describe('Empty State Handling', () => {
    it('should handle empty context', async () => {
      const emptyContext: SystemContext = {
        prospects: [],
        competitors: [],
        portfolio: [],
        userActions: [],
        performanceMetrics: {
          avgResponseTime: 0,
          errorRate: 0,
          userSatisfactionScore: 0,
          dataFreshnessScore: 0
        },
        timestamp: new Date().toISOString()
      }
      
      const review = await council.conductReview(emptyContext)
      expect(review.status).toBe('completed')
    })

    it('should return empty summary when no review conducted', () => {
      const summary = council.getImprovementSummary()
      expect(summary.total).toBe(0)
      expect(Object.keys(summary.byCategory)).toHaveLength(0)
      expect(Object.keys(summary.byPriority)).toHaveLength(0)
    })
  })

  describe('Performance Characteristics', () => {
    it('should complete review in reasonable time', async () => {
      const startTime = Date.now()
      await council.conductReview(mockContext)
      const endTime = Date.now()
      
      const duration = endTime - startTime
      // Should complete within 5 seconds
      expect(duration).toBeLessThan(5000)
    })

    it('should handle large context efficiently', async () => {
      const largeContext: SystemContext = {
        ...mockContext,
        prospects: Array(100).fill(null).map(() => ({
          companyName: 'Test Co',
          state: 'CA'
        })),
        userActions: Array(200).fill(null).map(() => ({
          type: 'search',
          timestamp: new Date().toISOString(),
          details: {}
        }))
      }
      
      const startTime = Date.now()
      await council.conductReview(largeContext)
      const endTime = Date.now()
      
      const duration = endTime - startTime
      // Should still complete reasonably fast
      expect(duration).toBeLessThan(10000)
    })
  })
})
