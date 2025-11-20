/**
 * Agentic Forces - Demonstration Script
 * 
 * This script demonstrates the autonomous improvement capabilities
 * by running a council review and showing the analysis results.
 */

import { AgenticEngine } from './src/lib/agentic/AgenticEngine'
import { SystemContext } from './src/lib/agentic/types'
import { Prospect, HealthGrade, ProspectStatus } from './src/lib/types'
import { v4 as uuidv4 } from 'uuid'

// Create sample system context
const sampleContext: SystemContext = {
  prospects: Array(50).fill(null).map((_, i): Prospect => ({
    id: `prospect-${i}`,
    companyName: `Company ${i}`,
    industry: 'restaurant',
    state: 'CA',
    priorityScore: Math.random() * 100,
    estimatedRevenue: i % 3 === 0 ? undefined : 500000 + Math.random() * 1000000,
    healthScore: {
      grade: 'B' as HealthGrade,
      score: 75,
      lastUpdated: i % 4 === 0 
        ? new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() // 10 days old
        : new Date().toISOString(),
      sentimentTrend: 'stable',
      reviewCount: 45,
      avgSentiment: 0.7,
      violationCount: 2
    },
    growthSignals: i % 5 === 0 ? [] : [
      { 
        id: uuidv4(),
        type: 'hiring', 
        description: 'Hiring new staff', 
        detectedDate: new Date().toISOString(), 
        score: 70, 
        confidence: 0.8 
      }
    ],
    uccFilings: [],
    defaultDate: new Date().toISOString(),
    timeSinceDefault: 30,
    status: 'new' as ProspectStatus,
    narrative: 'Sample prospect'
  })),
  competitors: [],
  portfolio: [],
  userActions: [
    { type: 'search', timestamp: new Date().toISOString(), details: {} },
    { type: 'filter', timestamp: new Date().toISOString(), details: {} },
    { type: 'claim', timestamp: new Date().toISOString(), details: {} },
    { type: 'export', timestamp: new Date().toISOString(), details: {} },
  ],
  performanceMetrics: {
    avgResponseTime: 1200, // Slow response time
    errorRate: 0.03,
    userSatisfactionScore: 6.5, // Below target
    dataFreshnessScore: 70
  },
  timestamp: new Date().toISOString()
}

async function runDemo() {
  console.log('🚀 Agentic Forces Demonstration\n')
  console.log('='.repeat(80))
  console.log('\n📊 System Context:')
  console.log(`   - Prospects: ${sampleContext.prospects.length}`)
  console.log(`   - User Actions: ${sampleContext.userActions.length}`)
  console.log(`   - Avg Response Time: ${sampleContext.performanceMetrics.avgResponseTime}ms`)
  console.log(`   - User Satisfaction: ${sampleContext.performanceMetrics.userSatisfactionScore}/10`)
  console.log('\n' + '='.repeat(80))

  // Create agentic engine
  const engine = new AgenticEngine({
    enabled: true,
    autonomousExecutionEnabled: true, // Enable for demo
    safetyThreshold: 75,
    maxDailyImprovements: 5,
    reviewRequired: ['security'],
    enabledAgents: ['data-analyzer', 'optimizer', 'security', 'ux-enhancer']
  })

  console.log('\n🤖 Running Autonomous Improvement Cycle...\n')

  try {
    // Run autonomous cycle
    const result = await engine.runAutonomousCycle(sampleContext)

    console.log('\n' + '='.repeat(80))
    console.log('\n📋 Council Review Results:\n')

    // Display findings by agent
    result.review.analyses.forEach(analysis => {
      const agent = result.review.agents.find(a => a.id === analysis.agentId)
      console.log(`\n🔍 ${agent?.name || 'Unknown Agent'} (${analysis.agentRole}):`)
      
      if (analysis.findings.length > 0) {
        console.log('   Findings:')
        analysis.findings.forEach(finding => {
          const icon = finding.severity === 'critical' ? '🔴' : finding.severity === 'warning' ? '🟡' : '🔵'
          console.log(`   ${icon} [${finding.severity.toUpperCase()}] ${finding.description}`)
        })
      } else {
        console.log('   ✅ No issues found')
      }

      if (analysis.improvements.length > 0) {
        console.log('   Improvements Suggested:')
        analysis.improvements.forEach(imp => {
          const priorityIcon = imp.priority === 'critical' ? '🔴' : imp.priority === 'high' ? '🟠' : imp.priority === 'medium' ? '🟡' : '🟢'
          console.log(`   ${priorityIcon} [${imp.priority.toUpperCase()}] ${imp.title}`)
          console.log(`      Safety Score: ${imp.safetyScore}/100`)
          console.log(`      Automatable: ${imp.automatable ? '✅ Yes' : '❌ No'}`)
        })
      }
    })

    console.log('\n' + '='.repeat(80))
    console.log('\n💡 Improvement Summary:\n')
    console.log(`   Total Improvements Detected: ${result.review.improvements.length}`)
    console.log(`   Executed Automatically: ${result.executedImprovements.length}`)
    console.log(`   Pending Review: ${result.pendingImprovements.length}`)

    if (result.executedImprovements.length > 0) {
      console.log('\n✅ Executed Improvements:')
      result.executedImprovements.forEach(imp => {
        console.log(`   - ${imp.suggestion.title}`)
        if (imp.result) {
          console.log(`     Result: ${imp.result.feedback}`)
        }
      })
    }

    if (result.pendingImprovements.length > 0) {
      console.log('\n⏳ Pending Improvements (require review):')
      result.pendingImprovements.forEach(imp => {
        console.log(`   - ${imp.suggestion.title}`)
        console.log(`     Reason: ${imp.suggestion.safetyScore < engine.getConfig().safetyThreshold ? 'Safety score too low' : 'Category requires review'}`)
      })
    }

    // Display system health
    console.log('\n' + '='.repeat(80))
    const health = engine.getSystemHealth()
    console.log('\n📊 System Health Metrics:\n')
    console.log(`   Total Improvements: ${health.totalImprovements}`)
    console.log(`   Implemented: ${health.implemented}`)
    console.log(`   Pending: ${health.pending}`)
    console.log(`   Success Rate: ${health.successRate.toFixed(1)}%`)
    console.log(`   Average Safety Score: ${health.avgSafetyScore.toFixed(1)}/100`)

    console.log('\n' + '='.repeat(80))
    console.log('\n✨ Demonstration Complete!\n')
    console.log('The agentic system has successfully:')
    console.log('  ✅ Analyzed the system across multiple dimensions')
    console.log('  ✅ Detected improvement opportunities')
    console.log('  ✅ Executed safe improvements autonomously')
    console.log('  ✅ Flagged risky improvements for manual review')
    console.log('  ✅ Maintained detailed audit trail and metrics')
    console.log('\n' + '='.repeat(80))

  } catch (error) {
    console.error('\n❌ Error during demonstration:', error)
  }
}

// Run the demo
runDemo().catch(console.error)
