#!/usr/bin/env tsx
/**
 * Scrape and Store Script
 *
 * Scrapes UCC filings from California and stores them in the database
 * Demonstrates the complete data flow: scrape → store → display
 *
 * Usage:
 *   npm run scrape:ca                    # Use default (mock)
 *   SCRAPER_IMPLEMENTATION=mock npm run scrape:ca
 *   SCRAPER_IMPLEMENTATION=puppeteer npm run scrape:ca
 *   SCRAPER_IMPLEMENTATION=api npm run scrape:ca
 */

import { createScraper, ScraperFactory, ScraperImplementation } from './scrapers/scraper-factory'
import { initDatabase, getDatabase, createQueries, closeDatabase } from '../src/lib/database'
import chalk from 'chalk'

// Sample companies to scrape
const SAMPLE_COMPANIES = [
  { name: 'Golden State Restaurant Group', industry: 'restaurant' as const, estimatedRevenue: 2500000 },
  { name: 'Bay Area Retail Co', industry: 'retail' as const, estimatedRevenue: 1800000 },
  { name: 'Pacific Construction LLC', industry: 'construction' as const, estimatedRevenue: 3200000 },
  { name: 'Silicon Valley Tech Services', industry: 'technology' as const, estimatedRevenue: 1500000 },
  { name: 'California Healthcare Partners', industry: 'healthcare' as const, estimatedRevenue: 4500000 }
]

async function main() {
  console.log(chalk.bold.blue('\n🔍 UCC Filing Scraper - California\n'))

  // Determine scraper implementation
  const implementation = (process.env.SCRAPER_IMPLEMENTATION as ScraperImplementation) ||
    ScraperFactory.getRecommendedImplementation()

  // Check if implementation is available
  const availability = ScraperFactory.isImplementationAvailable(implementation)
  if (!availability.available) {
    console.log(chalk.red(`\n❌ ${implementation.toUpperCase()} implementation not available:`))
    console.log(chalk.yellow(`   ${availability.reason}\n`))
    process.exit(1)
  }

  console.log(chalk.cyan(`📌 Using ${implementation.toUpperCase()} implementation\n`))

  try {
    // Initialize database
    console.log(chalk.cyan('📡 Connecting to database...'))
    const db = await initDatabase()
    const queries = createQueries(db)
    console.log(chalk.green('✅ Database connected\n'))

    // Initialize scraper using factory
    const scraper = createScraper('CA', { implementation })
    console.log(chalk.cyan(`🤖 Initialized California UCC scraper (${implementation})\n`))

    let totalFilings = 0
    let totalProspects = 0

    // Scrape each company
    for (const company of SAMPLE_COMPANIES) {
      console.log(chalk.bold(`\n📋 Processing: ${company.name}`))
      console.log(chalk.gray(`   Industry: ${company.industry}`))

      // Scrape UCC filings
      console.log(chalk.cyan('   🔎 Scraping UCC filings...'))
      const result = await scraper.search(company.name)

      if (!result.success) {
        console.log(chalk.red(`   ❌ Scraping failed: ${result.error}`))
        continue
      }

      const filings = result.filings || []
      console.log(chalk.green(`   ✅ Found ${filings.length} UCC filing(s)`))

      if (filings.length === 0) {
        console.log(chalk.yellow('   ⚠️  No filings to store'))
        continue
      }

      // Calculate priority score based on filings
      const mostRecentFiling = filings[0]
      const filingDate = new Date(mostRecentFiling.filingDate)
      const timeSinceDefault = Math.floor((Date.now() - filingDate.getTime()) / (1000 * 60 * 60 * 24))
      const priorityScore = Math.min(100, Math.floor((timeSinceDefault / 14) + 50))

      // Create prospect in database
      console.log(chalk.cyan('   💾 Storing in database...'))

      try {
        const prospect = await queries.createProspect({
          companyName: company.name,
          industry: company.industry,
          state: 'CA',
          priorityScore,
          defaultDate: filingDate,
          timeSinceDefault,
          estimatedRevenue: company.estimatedRevenue
        })

        console.log(chalk.green(`   ✅ Created prospect (ID: ${prospect.id})`))
        totalProspects++

        // Store each UCC filing
        for (const filing of filings) {
          const uccFiling = await queries.createUCCFiling({
            externalId: filing.filingNumber,
            filingDate: new Date(filing.filingDate),
            debtorName: filing.debtorName,
            securedParty: filing.securedParty,
            state: 'CA',
            lienAmount: Math.floor(company.estimatedRevenue * 0.05), // Estimate 5% of revenue
            status: filing.status,
            filingType: filing.filingType,
            source: 'ca-scraper'
          })

          // Link filing to prospect
          await queries.linkUCCFilingToProspect(prospect.id, uccFiling.id)
          totalFilings++
        }

        console.log(chalk.green(`   ✅ Stored ${filings.length} filing(s)`))

        // Add sample growth signal
        await queries.createGrowthSignal({
          prospectId: prospect.id,
          type: 'hiring',
          source: 'indeed',
          description: 'Posted new job openings',
          detectedDate: new Date(),
          confidence: 0.85,
          metadata: { source: 'automated-scraper' }
        })

        console.log(chalk.green('   ✅ Added growth signal'))

      } catch (dbError) {
        console.log(chalk.red(`   ❌ Database error: ${dbError instanceof Error ? dbError.message : dbError}`))
      }
    }

    // Summary
    console.log(chalk.bold.blue('\n\n📊 Summary\n'))
    console.log(chalk.cyan(`   Prospects Created: ${totalProspects}`))
    console.log(chalk.cyan(`   UCC Filings Stored: ${totalFilings}`))

    // Show database stats
    const stats = await queries.getProspectStats()
    console.log(chalk.bold('\n📈 Database Statistics:'))
    console.log(chalk.cyan(`   Total Prospects: ${stats.total}`))
    console.log(chalk.cyan(`   Average Score: ${stats.avgScore.toFixed(1)}`))
    console.log(chalk.cyan(`   By Industry: ${JSON.stringify(stats.byIndustry)}`))

    // Close database
    await closeDatabase()

    // Close browser if using Puppeteer
    if (implementation === 'puppeteer' && 'close' in scraper) {
      console.log(chalk.cyan('\n🔒 Closing browser...'))
      await (scraper as any).close()
    }

    console.log(chalk.green('\n✅ Complete! Data is ready to view in the UI.\n'))
    console.log(chalk.gray('💡 Tip: Set VITE_USE_MOCK_DATA=false in .env to use database data\n'))

  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error)
    await closeDatabase()
    process.exit(1)
  }
}

main()
