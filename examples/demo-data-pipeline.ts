/**
 * Data Pipeline Demo Script
 *
 * Demonstrates the data ingestion and enrichment pipeline
 * Run with: npx tsx demo-data-pipeline.ts
 */

import {
  DataIngestionService,
  DataEnrichmentService,
  DataRefreshScheduler,
  defaultIngestionConfig,
  defaultEnrichmentSources,
  defaultScheduleConfig
} from './src/lib/services'

async function main() {
  console.log('='.repeat(80))
  console.log('UCC-MCA Intelligence Platform - Data Pipeline Demo')
  console.log('='.repeat(80))
  console.log()

  // ============================================================================
  // Demo 1: Data Ingestion
  // ============================================================================
  console.log('📥 Demo 1: Data Ingestion Service')
  console.log('-'.repeat(80))

  const ingestionService = new DataIngestionService(defaultIngestionConfig)

  console.log('Configuration:')
  console.log(`  - Sources: ${defaultIngestionConfig.sources.length}`)
  console.log(`  - States: ${defaultIngestionConfig.states.join(', ')}`)
  console.log(`  - Batch Size: ${defaultIngestionConfig.batchSize}`)
  console.log(`  - Retry Attempts: ${defaultIngestionConfig.retryAttempts}`)
  console.log()

  console.log('Ingesting data...')
  const ingestionResults = await ingestionService.ingestData(['NY', 'CA'])

  ingestionResults.forEach(result => {
    console.log(`\n  Source: ${result.metadata.source}`)
    console.log(`  Status: ${result.success ? '✓ Success' : '✗ Failed'}`)
    console.log(`  Records: ${result.metadata.recordCount}`)
    console.log(`  Time: ${result.metadata.processingTime}ms`)
    if (result.errors.length > 0) {
      console.log(`  Errors:`)
      result.errors.forEach(err => console.log(`    - ${err}`))
    }
  })

  const stats = ingestionService.getStatistics(ingestionResults)
  console.log('\nIngestion Statistics:')
  console.log(`  Total Records: ${stats.totalRecords}`)
  console.log(`  Success Rate: ${stats.successRate.toFixed(2)}%`)
  console.log(`  Avg Processing Time: ${stats.avgProcessingTime.toFixed(0)}ms`)
  console.log(`  Errors: ${stats.errorCount}`)

  // ============================================================================
  // Demo 2: Data Enrichment
  // ============================================================================
  console.log('\n\n📊 Demo 2: Data Enrichment Service')
  console.log('-'.repeat(80))

  const enrichmentService = new DataEnrichmentService(defaultEnrichmentSources)

  // Create a sample UCC filing
  const sampleFiling = {
    id: 'demo-ucc-001',
    filingDate: '2021-06-15',
    debtorName: 'Apex Restaurant Group LLC',
    securedParty: 'Capital Finance Corp',
    state: 'NY',
    lienAmount: 250000,
    status: 'lapsed' as const,
    filingType: 'UCC-1' as const
  }

  console.log('Sample UCC Filing:')
  console.log(`  Company: ${sampleFiling.debtorName}`)
  console.log(`  State: ${sampleFiling.state}`)
  console.log(`  Filing Date: ${sampleFiling.filingDate}`)
  console.log(`  Lien Amount: $${sampleFiling.lienAmount.toLocaleString()}`)
  console.log()

  console.log('Enriching prospect...')
  const { prospect, result } = await enrichmentService.enrichProspect(sampleFiling)

  console.log(`\nEnrichment Result:`)
  console.log(`  Success: ${result.success ? '✓' : '✗'}`)
  console.log(`  Confidence: ${(result.confidence * 100).toFixed(1)}%`)
  console.log(`  Fields Enriched: ${result.enrichedFields.join(', ')}`)
  if (result.errors.length > 0) {
    console.log(`  Errors:`)
    result.errors.forEach(err => console.log(`    - ${err}`))
  }

  console.log(`\nEnriched Prospect:`)
  console.log(`  ID: ${prospect.id}`)
  console.log(`  Company: ${prospect.companyName}`)
  console.log(`  Industry: ${prospect.industry}`)
  console.log(`  Priority Score: ${prospect.priorityScore}/100`)
  console.log(`  Health Grade: ${prospect.healthScore.grade}`)
  console.log(`  Health Score: ${prospect.healthScore.score}/100`)
  console.log(`  Growth Signals: ${prospect.growthSignals.length}`)
  if (prospect.estimatedRevenue) {
    console.log(`  Est. Revenue: $${prospect.estimatedRevenue.toLocaleString()}`)
  }
  console.log(`  Narrative: ${prospect.narrative}`)

  if (prospect.growthSignals.length > 0) {
    console.log(`\n  Growth Signals:`)
    prospect.growthSignals.forEach(signal => {
      console.log(`    - [${signal.type}] ${signal.description}`)
      console.log(`      Date: ${signal.detectedDate}, Score: ${signal.score}, Confidence: ${(signal.confidence * 100).toFixed(0)}%`)
    })
  }

  // ============================================================================
  // Demo 3: Batch Enrichment
  // ============================================================================
  console.log('\n\n🔄 Demo 3: Batch Enrichment')
  console.log('-'.repeat(80))

  const batchFilings = [
    {
      id: 'demo-ucc-002',
      filingDate: '2020-03-10',
      debtorName: 'Summit Construction Co',
      securedParty: 'Business Lending LLC',
      state: 'CA',
      lienAmount: 500000,
      status: 'lapsed' as const,
      filingType: 'UCC-1' as const
    },
    {
      id: 'demo-ucc-003',
      filingDate: '2019-11-22',
      debtorName: 'Premier Healthcare Services',
      securedParty: 'MCA Direct',
      state: 'TX',
      lienAmount: 350000,
      status: 'lapsed' as const,
      filingType: 'UCC-1' as const
    }
  ]

  console.log(`Enriching ${batchFilings.length} prospects in batch...`)
  const { prospects, results } = await enrichmentService.enrichProspects(batchFilings, 2)

  console.log(`\nBatch Results:`)
  console.log(`  Total Processed: ${results.length}`)
  console.log(`  Successful: ${results.filter(r => r.success).length}`)
  console.log(`  Failed: ${results.filter(r => !r.success).length}`)
  console.log(`  Avg Confidence: ${((results.reduce((sum, r) => sum + r.confidence, 0) / results.length) * 100).toFixed(1)}%`)

  prospects.forEach((p, i) => {
    console.log(`\n  Prospect ${i + 1}:`)
    console.log(`    Company: ${p.companyName}`)
    console.log(`    Industry: ${p.industry}`)
    console.log(`    Priority: ${p.priorityScore}/100`)
    console.log(`    Health: ${p.healthScore.grade} (${p.healthScore.score}/100)`)
  })

  // ============================================================================
  // Demo 4: Data Refresh Scheduler
  // ============================================================================
  console.log('\n\n⏰ Demo 4: Data Refresh Scheduler')
  console.log('-'.repeat(80))

  const scheduler = new DataRefreshScheduler(
    {
      ...defaultScheduleConfig,
      enabled: true,
      autoStart: false,
      ingestionInterval: 60000, // 1 minute for demo
      enrichmentInterval: 30000, // 30 seconds for demo
      refreshInterval: 30000 // 30 seconds for demo
    },
    defaultIngestionConfig,
    defaultEnrichmentSources
  )

  console.log('Scheduler Configuration:')
  console.log(`  Enabled: ${defaultScheduleConfig.enabled}`)
  console.log(`  Ingestion Interval: ${defaultScheduleConfig.ingestionInterval / 1000}s`)
  console.log(`  Enrichment Interval: ${defaultScheduleConfig.enrichmentInterval / 1000}s`)
  console.log(`  Refresh Interval: ${defaultScheduleConfig.refreshInterval / 1000}s`)
  console.log(`  Stale Threshold: ${defaultScheduleConfig.staleDataThreshold} days`)
  console.log()

  // Subscribe to events
  const unsubscribe = scheduler.on((event) => {
    console.log(`  [${event.type}] ${event.timestamp}`)
    if (event.data) {
      console.log(`    Data:`, JSON.stringify(event.data, null, 2))
    }
    if (event.error) {
      console.log(`    Error: ${event.error}`)
    }
  })

  console.log('Triggering manual ingestion...')
  await scheduler.triggerIngestion()

  const status = scheduler.getStatus()
  console.log('\nScheduler Status:')
  console.log(`  Running: ${status.running}`)
  console.log(`  Last Ingestion: ${status.lastIngestionRun || 'Never'}`)
  console.log(`  Prospects Processed: ${status.totalProspectsProcessed}`)
  console.log(`  Errors: ${status.totalErrors}`)

  const allProspects = scheduler.getProspects()
  console.log(`\nProspects in Scheduler:`)
  console.log(`  Total: ${allProspects.length}`)
  if (allProspects.length > 0) {
    console.log(`  Sample:`)
    allProspects.slice(0, 3).forEach(p => {
      console.log(`    - ${p.companyName} (${p.state}) - Priority: ${p.priorityScore}`)
    })
  }

  // Cleanup
  unsubscribe()
  scheduler.stop()

  // ============================================================================
  // Summary
  // ============================================================================
  console.log('\n\n' + '='.repeat(80))
  console.log('Demo Complete!')
  console.log('='.repeat(80))
  console.log()
  console.log('Key Takeaways:')
  console.log('  ✓ Data ingestion from multiple sources')
  console.log('  ✓ Comprehensive data enrichment (growth signals, health scores, revenue)')
  console.log('  ✓ Batch processing with error handling')
  console.log('  ✓ Scheduled refresh operations')
  console.log('  ✓ Real-time event monitoring')
  console.log()
  console.log('Next Steps:')
  console.log('  1. Configure real data sources in .env')
  console.log('  2. Implement actual scrapers for state portals')
  console.log('  3. Integrate ML models for revenue estimation')
  console.log('  4. Set up database for persistence')
  console.log('  5. Deploy scheduler as background service')
  console.log()
}

// Run the demo
main().catch(error => {
  console.error('Demo failed:', error)
  process.exit(1)
})
