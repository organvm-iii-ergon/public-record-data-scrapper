/**
 * Data Enrichment Pipeline Demo
 *
 * This demo shows how to use the new enrichment agents to fetch
 * and enrich prospect data from multiple sources.
 */

import {
  EnrichmentOrchestratorAgent,
  DataAcquisitionAgent,
  MonitoringAgent,
  ScraperAgent,
  DataNormalizationAgent
} from './src/lib/agentic'
import { usageTracker } from './src/lib/subscription/usage-tracker'

async function demoEnrichment() {
  console.log('=== Data Enrichment Pipeline Demo ===\n')

  // Initialize the orchestrator
  const orchestrator = new EnrichmentOrchestratorAgent()

  // Set up a demo user with free tier
  const userId = 'demo-user-123'
  usageTracker.setUserTier(userId, 'free')

  console.log('1. Checking user quota...')
  const monitoringAgent = new MonitoringAgent()
  const quotaCheck = await monitoringAgent.executeTask({
    type: 'check-quota',
    payload: { userId }
  })
  console.log('   Quota status:', JSON.stringify(quotaCheck.data, null, 2))

  console.log('\n2. Enriching prospect data...')
  const enrichmentResult = await orchestrator.executeTask({
    type: 'enrich-prospect',
    payload: {
      companyName: 'Acme Corporation',
      state: 'CA',
      tier: 'free',
      userId
    }
  })

  if (enrichmentResult.success) {
    console.log('   Enrichment successful!')
    console.log('   Sources used:', enrichmentResult.data?.sources)
    console.log('   Total cost: $' + enrichmentResult.data?.cost)
    console.log('   Response time:', enrichmentResult.data?.responseTime + 'ms')
    console.log('\n   Progress stages:')
    enrichmentResult.data?.progress?.forEach((stage: { stage: string; status: string }) => {
      console.log(`   - ${stage.stage}: ${stage.status}`)
    })
  } else {
    console.log('   Enrichment failed:', enrichmentResult.error)
  }

  console.log('\n3. Checking updated usage...')
  const usageStats = await monitoringAgent.executeTask({
    type: 'get-usage',
    payload: { userId, period: 'monthly' }
  })
  console.log('   Usage stats:', JSON.stringify(usageStats.data, null, 2))

  console.log('\n4. Testing individual agents...')

  // Test data acquisition
  console.log('\n   a) Data Acquisition Agent:')
  const dataAgent = new DataAcquisitionAgent()
  const dataResult = await dataAgent.executeTask({
    type: 'check-source-status',
    payload: { source: 'sec-edgar' }
  })
  console.log('      SEC EDGAR status:', JSON.stringify(dataResult.data, null, 2))

  // Test scraper
  console.log('\n   b) Scraper Agent:')
  const scraperAgent = new ScraperAgent()
  const statesResult = await scraperAgent.executeTask({
    type: 'list-available-states',
    payload: {}
  })
  console.log('      Available states:', statesResult.data?.states)

  // Test normalization
  console.log('\n   c) Data Normalization Agent:')
  const normAgent = new DataNormalizationAgent()
  const normalizeResult = await normAgent.executeTask({
    type: 'normalize-company-name',
    payload: { name: 'acme corporation, llc' }
  })
  console.log('      Original:', normalizeResult.data?.original)
  console.log('      Normalized:', normalizeResult.data?.normalized)

  console.log('\n=== Demo Complete ===')
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  demoEnrichment().catch(console.error)
}

export { demoEnrichment }
