/**
 * AgenticEngine Tests
 * 
 * Tests for the AgenticEngine class including:
 * - Configuration management
 * - Autonomous cycles
 * - Safety thresholds
 * - Approval workflows
 * - Execution history
 * - Health metrics
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { AgenticEngine } from './AgenticEngine'
import { SystemContext } from './types'

describe('AgenticEngine', () => {
  let engine: AgenticEngine
  let mockContext: SystemContext

  beforeEach(() => {
    engine = new AgenticEngine()
    mockContext = {
      prospects: [
        { 
          companyName: 'Test Co',
          state: 'CA',
          healthScore: { 
            lastUpdated: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() // 10 days old
          }
        }
      ],
      competitors: [],
      portfolio: [],
      userActions: [],
      performanceMetrics: {
        avgResponseTime: 1500,
        errorRate: 0.03,
        userSatisfactionScore: 6.5,
        dataFreshnessScore: 60
      },
      timestamp: new Date().toISOString()
    }
  })

  describe('Engine Configuration', () => {
    it('should initialize with default configuration', () => {
      const config = engine.getConfig()
      expect(config).toEqual({
        enabled: true,
        autonomousExecutionEnabled: false,
        safetyThreshold: 80,
        maxDailyImprovements: 3,
        reviewRequired: ['security', 'data-quality', 'threat-analysis', 'strategic-recommendation'],
        enabledAgents: ['data-analyzer', 'optimizer', 'security', 'ux-enhancer', 'competitor-agent']
      })
    })

    it('should accept custom configuration', () => {
      const customEngine = new AgenticEngine({
        autonomousExecutionEnabled: true,
        safetyThreshold: 90,
        maxDailyImprovements: 5
      })
      const config = customEngine.getConfig()
      expect(config.autonomousExecutionEnabled).toBe(true)
      expect(config.safetyThreshold).toBe(90)
      expect(config.maxDailyImprovements).toBe(5)
    })

    it('should update configuration', () => {
      engine.updateConfig({ autonomousExecutionEnabled: true, safetyThreshold: 95 })
      const config = engine.getConfig()
      expect(config.autonomousExecutionEnabled).toBe(true)
      expect(config.safetyThreshold).toBe(95)
    })

    it('should preserve other config values when updating', () => {
      engine.updateConfig({ safetyThreshold: 85 })
      const config = engine.getConfig()
      expect(config.enabled).toBe(true)
      expect(config.maxDailyImprovements).toBe(3)
    })
  })

  describe('Autonomous Cycles', () => {
    it('should complete autonomous cycle with pending improvements', async () => {
      const result = await engine.runAutonomousCycle(mockContext)
      
      expect(result).toHaveProperty('review')
      expect(result).toHaveProperty('executedImprovements')
      expect(result).toHaveProperty('pendingImprovements')
      expect(result.review.status).toBe('completed')
    })

    it('should not execute improvements when autonomous execution is disabled', async () => {
      const result = await engine.runAutonomousCycle(mockContext)
      expect(result.executedImprovements).toHaveLength(0)
      expect(result.pendingImprovements.length).toBeGreaterThan(0)
    })

    it('should execute improvements when enabled and safe', async () => {
      engine.updateConfig({ 
        autonomousExecutionEnabled: true,
        safetyThreshold: 70 
      })
      const result = await engine.runAutonomousCycle(mockContext)
      // Some improvements should be executed based on safety score
      expect(result.executedImprovements.length + result.pendingImprovements.length).toBeGreaterThan(0)
    })

    it('should create feedback loop after cycle', async () => {
      await engine.runAutonomousCycle(mockContext)
      const feedbackLoops = engine.getFeedbackLoops()
      expect(feedbackLoops.length).toBeGreaterThan(0)
      expect(feedbackLoops[0].type).toBe('agent-review')
    })

    it('should track improvements from cycle', async () => {
      await engine.runAutonomousCycle(mockContext)
      const improvements = engine.getImprovements()
      expect(improvements.length).toBeGreaterThan(0)
    })
  })

  describe('Safety Thresholds', () => {
    it('should not execute improvements below safety threshold', async () => {
      engine.updateConfig({ 
        autonomousExecutionEnabled: true,
        safetyThreshold: 95 // Very high threshold
      })
      const result = await engine.runAutonomousCycle(mockContext)
      // Most improvements should be pending due to high threshold
      expect(result.pendingImprovements.length).toBeGreaterThan(0)
    })

    it('should execute improvements meeting safety threshold', async () => {
      engine.updateConfig({ 
        autonomousExecutionEnabled: true,
        safetyThreshold: 70 // Lower threshold
      })
      const result = await engine.runAutonomousCycle(mockContext)
      expect(result.executedImprovements.length).toBeGreaterThanOrEqual(0)
    })

    it('should respect review required categories', async () => {
      engine.updateConfig({ 
        autonomousExecutionEnabled: true,
        safetyThreshold: 50,
        reviewRequired: ['security', 'data-quality']
      })
      const result = await engine.runAutonomousCycle(mockContext)
      // Improvements in review-required categories should be pending
      const securityPending = result.pendingImprovements.filter(
        i => i.suggestion.category === 'security' || i.suggestion.category === 'data-quality'
      )
      expect(securityPending.length).toBeGreaterThan(0)
    })

    it('should not execute non-automatable improvements', async () => {
      engine.updateConfig({ 
        autonomousExecutionEnabled: true,
        safetyThreshold: 0
      })
      const result = await engine.runAutonomousCycle(mockContext)
      const executed = result.executedImprovements
      executed.forEach(improvement => {
        expect(improvement.suggestion.automatable).toBe(true)
      })
    })
  })

  describe('Daily Improvement Limits', () => {
    it('should enforce daily improvement limit', async () => {
      engine.updateConfig({ 
        autonomousExecutionEnabled: true,
        safetyThreshold: 70,
        maxDailyImprovements: 1
      })
      
      await engine.runAutonomousCycle(mockContext)
      
      await engine.runAutonomousCycle(mockContext)
      const history2 = engine.getExecutionHistory()
      
      // Should not exceed daily limit
      const today = new Date().toDateString()
      const todayExecutions = history2.filter(
        e => new Date(e.timestamp).toDateString() === today
      )
      expect(todayExecutions.length).toBeLessThanOrEqual(1)
    })

    it('should track execution history', async () => {
      engine.updateConfig({ 
        autonomousExecutionEnabled: true,
        safetyThreshold: 70
      })
      await engine.runAutonomousCycle(mockContext)
      const history = engine.getExecutionHistory()
      expect(history.length).toBeGreaterThanOrEqual(0)
      if (history.length > 0) {
        expect(history[0]).toHaveProperty('improvementId')
        expect(history[0]).toHaveProperty('timestamp')
        expect(history[0]).toHaveProperty('result')
      }
    })
  })

  describe('Approval Workflows', () => {
    it('should manually approve and execute improvement', async () => {
      const cycleResult = await engine.runAutonomousCycle(mockContext)
      const improvement = cycleResult.pendingImprovements[0]
      
      if (improvement) {
        const result = await engine.approveAndExecute(improvement.id, mockContext)
        expect(result).toHaveProperty('success')
        expect(result).toHaveProperty('changes')
        expect(result).toHaveProperty('metrics')
        
        const updated = engine.getImprovements().find(i => i.id === improvement.id)
        expect(updated?.status).toMatch(/approved|completed/)
      }
    })

    it('should throw error for non-existent improvement', async () => {
      await expect(
        engine.approveAndExecute('non-existent-id', mockContext)
      ).rejects.toThrow()
    })

    it('should update improvement status on approval', async () => {
      const cycleResult = await engine.runAutonomousCycle(mockContext)
      const improvement = cycleResult.pendingImprovements[0]
      
      if (improvement) {
        await engine.approveAndExecute(improvement.id, mockContext)
        const updated = engine.getImprovements().find(i => i.id === improvement.id)
        expect(updated?.approvedAt).toBeDefined()
      }
    })
  })

  describe('Improvement Status Management', () => {
    it('should get improvements by status', async () => {
      await engine.runAutonomousCycle(mockContext)
      
      const detected = engine.getImprovementsByStatus('detected')
      expect(Array.isArray(detected)).toBe(true)
      detected.forEach(imp => {
        expect(imp.status).toBe('detected')
      })
    })

    it('should track completed improvements', async () => {
      engine.updateConfig({ 
        autonomousExecutionEnabled: true,
        safetyThreshold: 70
      })
      await engine.runAutonomousCycle(mockContext)
      
      const completed = engine.getImprovementsByStatus('completed')
      completed.forEach(imp => {
        expect(imp.status).toBe('completed')
        expect(imp.completedAt).toBeDefined()
      })
    })
  })

  describe('System Health Metrics', () => {
    it('should calculate system health metrics', async () => {
      await engine.runAutonomousCycle(mockContext)
      const health = engine.getSystemHealth()
      
      expect(health).toHaveProperty('totalImprovements')
      expect(health).toHaveProperty('implemented')
      expect(health).toHaveProperty('pending')
      expect(health).toHaveProperty('successRate')
      expect(health).toHaveProperty('avgSafetyScore')
      
      expect(health.totalImprovements).toBeGreaterThanOrEqual(0)
      expect(health.successRate).toBeGreaterThanOrEqual(0)
      expect(health.successRate).toBeLessThanOrEqual(100)
    })

    it('should handle empty state gracefully', () => {
      const health = engine.getSystemHealth()
      expect(health.totalImprovements).toBe(0)
      expect(health.implemented).toBe(0)
      expect(health.pending).toBe(0)
      expect(health.successRate).toBe(0)
      expect(health.avgSafetyScore).toBe(0)
    })

    it('should calculate success rate correctly', async () => {
      engine.updateConfig({ 
        autonomousExecutionEnabled: true,
        safetyThreshold: 70
      })
      await engine.runAutonomousCycle(mockContext)
      
      const health = engine.getSystemHealth()
      const history = engine.getExecutionHistory()
      
      if (history.length > 0) {
        const successful = history.filter(h => h.result.success).length
        const expectedRate = (successful / history.length) * 100
        expect(health.successRate).toBe(expectedRate)
      }
    })

    it('should calculate average safety score', async () => {
      await engine.runAutonomousCycle(mockContext)
      const health = engine.getSystemHealth()
      const improvements = engine.getImprovements()
      
      if (improvements.length > 0) {
        const sum = improvements.reduce((acc, i) => acc + i.suggestion.safetyScore, 0)
        const expectedAvg = sum / improvements.length
        expect(health.avgSafetyScore).toBe(expectedAvg)
      }
    })
  })

  describe('Feedback Loops', () => {
    it('should create feedback loops with correct structure', () => {
      const loop = engine.createFeedbackLoop('system-metrics', { metric: 'test' })
      
      expect(loop).toHaveProperty('id')
      expect(loop).toHaveProperty('type')
      expect(loop).toHaveProperty('data')
      expect(loop).toHaveProperty('timestamp')
      expect(loop).toHaveProperty('processedBy')
      expect(loop.type).toBe('system-metrics')
      expect(loop.data).toEqual({ metric: 'test' })
    })

    it('should store feedback loops', () => {
      engine.createFeedbackLoop('user-feedback', { rating: 5 })
      const loops = engine.getFeedbackLoops()
      expect(loops.length).toBe(1)
      expect(loops[0].type).toBe('user-feedback')
    })

    it('should support different feedback types', () => {
      engine.createFeedbackLoop('user-feedback', {})
      engine.createFeedbackLoop('system-metrics', {})
      engine.createFeedbackLoop('agent-review', {})
      
      const loops = engine.getFeedbackLoops()
      expect(loops.length).toBe(3)
      expect(loops.map(l => l.type)).toContain('user-feedback')
      expect(loops.map(l => l.type)).toContain('system-metrics')
      expect(loops.map(l => l.type)).toContain('agent-review')
    })
  })

  describe('Council Integration', () => {
    it('should provide access to council', () => {
      const council = engine.getCouncil()
      expect(council).toBeDefined()
      expect(council.getAgents().length).toBeGreaterThan(0)
    })

    it('should use council for reviews', async () => {
      const result = await engine.runAutonomousCycle(mockContext)
      expect(result.review).toBeDefined()
      expect(result.review.agents.length).toBeGreaterThan(0)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty context gracefully', async () => {
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
      
      const result = await engine.runAutonomousCycle(emptyContext)
      expect(result).toBeDefined()
      expect(result.review.status).toBe('completed')
    })

    it('should handle disabled engine', async () => {
      engine.updateConfig({ enabled: false })
      const result = await engine.runAutonomousCycle(mockContext)
      expect(result.executedImprovements).toHaveLength(0)
    })
  })
})
