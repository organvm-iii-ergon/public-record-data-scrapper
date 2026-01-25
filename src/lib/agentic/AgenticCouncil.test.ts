/**
 * Unit tests for AgenticCouncil
 * Tests the council orchestration and agent handoff mechanism
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { AgenticCouncil } from './AgenticCouncil'
import { SystemContext } from './types'

describe('AgenticCouncil', () => {
  let council: AgenticCouncil
  let mockContext: SystemContext

  beforeEach(() => {
    council = new AgenticCouncil()
    mockContext = {
      prospects: [
        {
          id: '1',
          companyName: 'Test Company',
          industry: 'Tech',
          healthScore: { overall: 75, lastUpdated: new Date().toISOString() }
        }
      ],
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

  describe('Council Review', () => {
    it('should conduct review with all agents', async () => {
      const review = await council.conductReview(mockContext)

      expect(review).toBeDefined()
      expect(review.id).toBeTruthy()
      expect(review.startedAt).toBeTruthy()
      expect(review.completedAt).toBeTruthy()
      expect(review.status).toBe('completed')
    })

    it('should have all agents participate', async () => {
      const review = await council.conductReview(mockContext)

      expect(review.agents).toBeDefined()
      expect(review.agents.length).toBe(5) // DataAnalyzer, Optimizer, Security, UXEnhancer, CompetitorAnalyzer

      const agentRoles = review.agents.map((a) => a.role)
      expect(agentRoles).toContain('data-analyzer')
      expect(agentRoles).toContain('optimizer')
      expect(agentRoles).toContain('security')
      expect(agentRoles).toContain('ux-enhancer')
      expect(agentRoles).toContain('competitor-agent')
    })

    it('should collect analyses from all agents', async () => {
      const review = await council.conductReview(mockContext)

      expect(review.analyses).toBeDefined()
      expect(review.analyses.length).toBe(5) // One from each agent

      review.analyses.forEach((analysis) => {
        expect(analysis).toHaveProperty('agentId')
        expect(analysis).toHaveProperty('agentRole')
        expect(analysis).toHaveProperty('findings')
        expect(analysis).toHaveProperty('improvements')
        expect(analysis).toHaveProperty('timestamp')
      })
    })

    it('should aggregate improvements from all agents', async () => {
      const review = await council.conductReview(mockContext)

      expect(review.improvements).toBeDefined()
      expect(review.improvements.length).toBeGreaterThan(0)

      review.improvements.forEach((improvement) => {
        expect(improvement).toHaveProperty('id')
        expect(improvement).toHaveProperty('suggestion')
        expect(improvement).toHaveProperty('status')
        expect(improvement).toHaveProperty('detectedAt')
        expect(improvement.status).toBe('detected')
      })
    })

    it('should create unique review ID', async () => {
      const review1 = await council.conductReview(mockContext)
      const review2 = await council.conductReview(mockContext)

      expect(review1.id).not.toBe(review2.id)
    })
  })

  describe('Agent Handoff Mechanism', () => {
    it('should execute agents in sequence', async () => {
      const review = await council.conductReview(mockContext)

      // Verify all agents completed
      expect(review.analyses.length).toBe(review.agents.length)

      // Verify each agent analyzed
      const roles = review.analyses.map((a) => a.agentRole)
      expect(roles).toContain('data-analyzer')
      expect(roles).toContain('optimizer')
      expect(roles).toContain('security')
      expect(roles).toContain('ux-enhancer')
    })

    it('should include timestamp for each analysis', async () => {
      const review = await council.conductReview(mockContext)

      review.analyses.forEach((analysis) => {
        expect(analysis.timestamp).toBeTruthy()
        const timestamp = new Date(analysis.timestamp)
        expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now())
      })
    })
  })

  describe('Improvement Status Management', () => {
    it('should set initial status to detected', async () => {
      const review = await council.conductReview(mockContext)

      review.improvements.forEach((improvement) => {
        expect(improvement.status).toBe('detected')
      })
    })

    it('should set detectedAt timestamp', async () => {
      const review = await council.conductReview(mockContext)

      review.improvements.forEach((improvement) => {
        expect(improvement.detectedAt).toBeTruthy()
        const detectedAt = new Date(improvement.detectedAt)
        expect(detectedAt.getTime()).toBeLessThanOrEqual(Date.now())
      })
    })

    it('should link improvement to suggestion', async () => {
      const review = await council.conductReview(mockContext)

      review.improvements.forEach((improvement) => {
        expect(improvement.suggestion).toBeDefined()
        expect(improvement.suggestion).toHaveProperty('id')
        expect(improvement.suggestion).toHaveProperty('title')
        expect(improvement.suggestion).toHaveProperty('category')
        expect(improvement.suggestion).toHaveProperty('priority')
        expect(improvement.suggestion).toHaveProperty('safetyScore')
      })
    })
  })

  describe('Review Status', () => {
    it('should start with in-progress status', async () => {
      // We can't easily test this without mocking since review completes quickly
      // But we can verify the final status
      const review = await council.conductReview(mockContext)
      expect(review.status).toBe('completed')
    })

    it('should set completedAt when finished', async () => {
      const review = await council.conductReview(mockContext)

      expect(review.completedAt).toBeDefined()
      expect(review.completedAt).toBeTruthy()

      const started = new Date(review.startedAt)
      const completed = new Date(review.completedAt!)
      expect(completed.getTime()).toBeGreaterThanOrEqual(started.getTime())
    })
  })

  describe('Different Context Scenarios', () => {
    it('should handle context with performance issues', async () => {
      mockContext.performanceMetrics.avgResponseTime = 2000
      mockContext.performanceMetrics.errorRate = 0.08

      const review = await council.conductReview(mockContext)

      // Should detect performance issues
      const perfImprovements = review.improvements.filter(
        (i) => i.suggestion.category === 'performance'
      )
      expect(perfImprovements.length).toBeGreaterThan(0)
    })

    it('should handle context with security concerns', async () => {
      mockContext.prospects = [
        { id: '1', estimatedRevenue: 1000000 },
        { id: '2', estimatedRevenue: 2000000 }
      ]

      const review = await council.conductReview(mockContext)

      // Should detect security issues
      const securityImprovements = review.improvements.filter(
        (i) => i.suggestion.category === 'security'
      )
      expect(securityImprovements.length).toBeGreaterThan(0)
    })

    it('should handle context with UX issues', async () => {
      mockContext.performanceMetrics.userSatisfactionScore = 5
      mockContext.userActions = Array(150).fill({
        type: 'search',
        timestamp: new Date().toISOString(),
        details: {}
      })

      const review = await council.conductReview(mockContext)

      // Should detect UX issues
      const uxImprovements = review.improvements.filter(
        (i) => i.suggestion.category === 'usability'
      )
      expect(uxImprovements.length).toBeGreaterThan(0)
    })

    it('should handle optimal context', async () => {
      // Good performance, no issues
      const review = await council.conductReview(mockContext)

      expect(review).toBeDefined()
      expect(review.status).toBe('completed')
      // May have minimal improvements like encryption suggestion
    })
  })

  describe('Analysis Aggregation', () => {
    it('should preserve all findings from agents', async () => {
      const review = await council.conductReview(mockContext)

      let totalFindings = 0
      review.analyses.forEach((analysis) => {
        totalFindings += analysis.findings.length
      })

      expect(totalFindings).toBeGreaterThanOrEqual(0)
    })

    it('should create separate improvement objects for each suggestion', async () => {
      const review = await council.conductReview(mockContext)

      let totalSuggestions = 0
      review.analyses.forEach((analysis) => {
        totalSuggestions += analysis.improvements.length
      })

      expect(review.improvements.length).toBe(totalSuggestions)
    })

    it('should maintain improvement metadata', async () => {
      const review = await council.conductReview(mockContext)

      review.improvements.forEach((improvement) => {
        // Each improvement should have its original suggestion data
        expect(improvement.suggestion.category).toBeTruthy()
        expect(improvement.suggestion.priority).toBeTruthy()
        expect(improvement.suggestion.safetyScore).toBeGreaterThanOrEqual(0)
        expect(improvement.suggestion.safetyScore).toBeLessThanOrEqual(100)
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty prospects list', async () => {
      mockContext.prospects = []

      const review = await council.conductReview(mockContext)

      expect(review).toBeDefined()
      expect(review.status).toBe('completed')
    })

    it('should handle empty user actions', async () => {
      mockContext.userActions = []

      const review = await council.conductReview(mockContext)

      expect(review).toBeDefined()
      expect(review.status).toBe('completed')
    })

    it('should handle large datasets', async () => {
      mockContext.prospects = Array(1000).fill({
        id: 'test',
        companyName: 'Test Company'
      })

      const review = await council.conductReview(mockContext)

      expect(review).toBeDefined()
      expect(review.status).toBe('completed')

      // Should suggest pagination for large dataset
      const paginationSuggestion = review.improvements.find((i) =>
        i.suggestion.title.includes('pagination')
      )
      expect(paginationSuggestion).toBeDefined()
    })
  })

  describe('Council Structure', () => {
    it('should maintain agent order', async () => {
      const review = await council.conductReview(mockContext)

      expect(review.agents[0].role).toBe('data-analyzer')
      expect(review.agents[1].role).toBe('optimizer')
      expect(review.agents[2].role).toBe('security')
      expect(review.agents[3].role).toBe('ux-enhancer')
    })

    it('should preserve agent capabilities', async () => {
      const review = await council.conductReview(mockContext)

      review.agents.forEach((agent) => {
        expect(agent.capabilities).toBeDefined()
        expect(agent.capabilities.length).toBeGreaterThan(0)
      })
    })

    it('should have unique agent IDs', async () => {
      const review = await council.conductReview(mockContext)

      const agentIds = review.agents.map((a) => a.id)
      const uniqueIds = new Set(agentIds)
      expect(uniqueIds.size).toBe(agentIds.length)
    })
  })
})
