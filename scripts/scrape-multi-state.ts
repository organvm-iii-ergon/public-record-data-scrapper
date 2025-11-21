#!/usr/bin/env tsx
/**
 * Multi-State UCC Scraper
 *
 * Scrapes UCC filings from multiple states and stores in database
 * Demonstrates concurrent multi-state data collection
 *
 * Usage:
 *   npm run scrape:multi                    # All 5 states (CA, TX, FL, NY, IL)
 *   npm run scrape:multi CA TX              # Specific states only
 *   SCRAPER_IMPLEMENTATION=api npm run scrape:multi  # Use API instead of mock
 */

import { createScraper, ScraperFactory, ScraperImplementation, SupportedState } from './scrapers/scraper-factory'
import { initDatabase, getDatabase, createQueries, closeDatabase } from '../src/lib/database'
import chalk from 'chalk'

// State-specific sample companies
const COMPANIES_BY_STATE: Record<SupportedState, Array<{ name: string; industry: 'restaurant' | 'retail' | 'construction' | 'technology' | 'healthcare' | 'services'; estimatedRevenue: number }>> = {
  CA: [
    { name: 'Golden State Restaurant Group', industry: 'restaurant', estimatedRevenue: 2500000 },
    { name: 'Bay Area Retail Co', industry: 'retail', estimatedRevenue: 1800000 }
  ],
  TX: [
    { name: 'Lone Star Steakhouse Inc', industry: 'restaurant', estimatedRevenue: 3200000 },
    { name: 'Houston Construction Partners', industry: 'construction', estimatedRevenue: 4500000 }
  ],
  FL: [
    { name: 'Sunshine Medical Clinic', industry: 'healthcare', estimatedRevenue: 2800000 },
    { name: 'Miami Beach Retail LLC', industry: 'retail', estimatedRevenue: 1500000 }
  ],
  NY: [
    { name: 'Manhattan Tech Services', industry: 'technology', estimatedRevenue: 3500000 },
    { name: 'Brooklyn Restaurant Group', industry: 'restaurant', estimatedRevenue: 2200000 }
  ],
  IL: [
    { name: 'Chicago Construction Co', industry: 'construction', estimatedRevenue: 5000000 },
    { name: 'Windy City Services LLC', industry: 'services', estimatedRevenue: 1900000 }
  ]
}

// All supported states
const ALL_STATES: SupportedState[] = ['CA', 'TX', 'FL', 'NY', 'IL']

interface StateCollectionResult {
  state: SupportedState
  success: boolean
  prospectsCreated: number
  filingsStored: number
  error?: string
  duration: number
}

async function scrapeState(
  state: SupportedState,
  implementation: ScraperImplementation,
  queries: ReturnType<typeof createQueries>
): Promise<StateCollectionResult> {
  const startTime = Date.now()

  try {
    console.log(chalk.bold(`\n📍 ${state} - Starting collection...`))

    const scraper = createScraper(state, { implementation })
    const companies = COMPANIES_BY_STATE[state]

    let prospectsCreated = 0
    let filingsStored = 0

    for (const company of companies) {
      console.log(chalk.cyan(`   🔎 Searching: ${company.name}`))

      const result = await scraper.search(company.name)

      if (!result.success) {
        console.log(chalk.yellow(`   ⚠️  Search failed: ${result.error}`))
        continue
      }

      const filings = result.filings || []
      if (filings.length === 0) {
        console.log(chalk.gray('   ℹ️  No filings found'))
        continue
      }

      console.log(chalk.green(`   ✅ Found ${filings.length} filing(s)`))

      // Calculate priority score
      const mostRecentFiling = filings[0]
      const filingDate = new Date(mostRecentFiling.filingDate)
      const timeSinceDefault = Math.floor((Date.now() - filingDate.getTime()) / (1000 * 60 * 60 * 24))
      const priorityScore = Math.min(100, Math.floor((timeSinceDefault / 14) + 50))

      // Create prospect
      const prospect = await queries.createProspect({
        companyName: company.name,
        industry: company.industry,
        state,
        priorityScore,
        defaultDate: filingDate,
        timeSinceDefault,
        estimatedRevenue: company.estimatedRevenue
      })

      prospectsCreated++

      // Store filings
      for (const filing of filings) {
        const uccFiling = await queries.createUCCFiling({
          externalId: filing.filingNumber,
          filingDate: new Date(filing.filingDate),
          debtorName: filing.debtorName,
          securedParty: filing.securedParty,
          state,
          lienAmount: Math.floor(company.estimatedRevenue * 0.05),
          status: filing.status,
          filingType: filing.filingType,
          source: `${state.toLowerCase()}-scraper`
        })

        await queries.linkUCCFilingToProspect(prospect.id, uccFiling.id)
        filingsStored++
      }

      // Add growth signal
      await queries.createGrowthSignal({
        prospectId: prospect.id,
        type: 'hiring',
        source: 'automated',
        description: 'Identified through automated screening',
        detectedDate: new Date(),
        confidence: 0.80,
        metadata: { state, implementation }
      })
    }

    // Close browser if using Puppeteer
    if (implementation === 'puppeteer' && 'close' in scraper) {
      await (scraper as any).close()
    }

    const duration = Date.now() - startTime
    console.log(chalk.green(`✅ ${state} complete: ${prospectsCreated} prospects, ${filingsStored} filings (${(duration / 1000).toFixed(1)}s)`))

    return {
      state,
      success: true,
      prospectsCreated,
      filingsStored,
      duration
    }

  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.log(chalk.red(`❌ ${state} failed: ${errorMessage}`))

    return {
      state,
      success: false,
      prospectsCreated: 0,
      filingsStored: 0,
      error: errorMessage,
      duration
    }
  }
}

async function main() {
  console.log(chalk.bold.blue('\n🌎 Multi-State UCC Filing Scraper\n'))

  // Parse command line arguments for specific states
  const args = process.argv.slice(2)
  const requestedStates = args.length > 0
    ? args.filter(arg => ALL_STATES.includes(arg as SupportedState)) as SupportedState[]
    : ALL_STATES

  if (requestedStates.length === 0) {
    console.log(chalk.red('❌ No valid states specified'))
    console.log(chalk.yellow(`   Valid states: ${ALL_STATES.join(', ')}`))
    process.exit(1)
  }

  // Determine scraper implementation
  const implementation = (process.env.SCRAPER_IMPLEMENTATION as ScraperImplementation) ||
    ScraperFactory.getRecommendedImplementation()

  // Check availability
  const availability = ScraperFactory.isImplementationAvailable(implementation)
  if (!availability.available) {
    console.log(chalk.red(`\n❌ ${implementation.toUpperCase()} implementation not available:`))
    console.log(chalk.yellow(`   ${availability.reason}\n`))
    process.exit(1)
  }

  console.log(chalk.cyan(`📌 Using ${implementation.toUpperCase()} implementation`))
  console.log(chalk.cyan(`📊 Collecting from ${requestedStates.length} state(s): ${requestedStates.join(', ')}\n`))

  try {
    // Initialize database
    console.log(chalk.cyan('📡 Connecting to database...'))
    const db = await initDatabase()
    const queries = createQueries(db)
    console.log(chalk.green('✅ Database connected\n'))

    const overallStartTime = Date.now()

    // Scrape all states concurrently
    const results = await Promise.all(
      requestedStates.map(state => scrapeState(state, implementation, queries))
    )

    const overallDuration = Date.now() - overallStartTime

    // Summary
    console.log(chalk.bold.blue('\n\n📊 Collection Summary\n'))

    const successfulStates = results.filter(r => r.success)
    const failedStates = results.filter(r => !r.success)

    console.log(chalk.cyan(`   States Processed: ${results.length}`))
    console.log(chalk.green(`   Successful: ${successfulStates.length}`))
    if (failedStates.length > 0) {
      console.log(chalk.red(`   Failed: ${failedStates.length}`))
    }
    console.log(chalk.cyan(`   Total Duration: ${(overallDuration / 1000).toFixed(1)}s\n`))

    // Per-state results
    console.log(chalk.bold('📍 By State:\n'))
    results.forEach(result => {
      if (result.success) {
        console.log(chalk.green(`   ✅ ${result.state}: ${result.prospectsCreated} prospects, ${result.filingsStored} filings (${(result.duration / 1000).toFixed(1)}s)`))
      } else {
        console.log(chalk.red(`   ❌ ${result.state}: ${result.error}`))
      }
    })

    // Totals
    const totalProspects = results.reduce((sum, r) => sum + r.prospectsCreated, 0)
    const totalFilings = results.reduce((sum, r) => sum + r.filingsStored, 0)

    console.log(chalk.bold('\n🎯 Totals:\n'))
    console.log(chalk.cyan(`   Prospects Created: ${totalProspects}`))
    console.log(chalk.cyan(`   UCC Filings Stored: ${totalFilings}`))

    // Database stats
    const stats = await queries.getProspectStats()
    console.log(chalk.bold('\n📈 Database Statistics:\n'))
    console.log(chalk.cyan(`   Total Prospects: ${stats.total}`))
    console.log(chalk.cyan(`   Average Score: ${stats.avgScore.toFixed(1)}`))
    console.log(chalk.cyan(`   By State: ${JSON.stringify(stats.byState)}`))
    console.log(chalk.cyan(`   By Industry: ${JSON.stringify(stats.byIndustry)}`))

    // Close database
    await closeDatabase()

    console.log(chalk.green('\n✅ Multi-state collection complete!\n'))
    console.log(chalk.gray('💡 Tip: Set VITE_USE_MOCK_DATA=false in .env to view data in UI\n'))

  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error)
    await closeDatabase()
    process.exit(1)
  }
}

main()
