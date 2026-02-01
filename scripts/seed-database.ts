#!/usr/bin/env tsx
/**
 * Database Seed Script
 *
 * Seeds the database with sample data for development
 */

import { createInterface } from 'node:readline'
import { initDatabase, closeDatabase, createQueries } from '../apps/web/src/lib/database'

const sampleProspects = [
  {
    companyName: 'Acme Restaurant Group',
    industry: 'restaurant' as const,
    state: 'NY',
    priorityScore: 92,
    defaultDate: new Date('2024-01-15'),
    timeSinceDefault: 180,
    estimatedRevenue: 5000000
  },
  {
    companyName: 'BuildRight Construction',
    industry: 'construction' as const,
    state: 'CA',
    priorityScore: 88,
    defaultDate: new Date('2024-02-01'),
    timeSinceDefault: 165,
    estimatedRevenue: 8000000
  },
  {
    companyName: 'HealthPlus Medical Center',
    industry: 'healthcare' as const,
    state: 'TX',
    priorityScore: 85,
    defaultDate: new Date('2024-01-20'),
    timeSinceDefault: 175,
    estimatedRevenue: 12000000
  },
  {
    companyName: 'TechInnovate Solutions',
    industry: 'technology' as const,
    state: 'CA',
    priorityScore: 81,
    defaultDate: new Date('2024-03-01'),
    timeSinceDefault: 137,
    estimatedRevenue: 3500000
  },
  {
    companyName: 'Metro Retail Stores',
    industry: 'retail' as const,
    state: 'FL',
    priorityScore: 78,
    defaultDate: new Date('2024-02-15'),
    timeSinceDefault: 151,
    estimatedRevenue: 6500000
  }
]

async function main() {
  console.log('🌱 Seeding database with sample data...\n')

  try {
    // Initialize database
    const db = await initDatabase()
    const queries = createQueries(db)

    // Check if data already exists
    const existingStats = await queries.getProspectStats()
    if (existingStats.total > 0) {
      console.log(`⚠️  Database already contains ${existingStats.total} prospect(s)`)
      const readline = createInterface({
        input: process.stdin,
        output: process.stdout
      })

      const answer = await new Promise<string>((resolve) => {
        readline.question('Continue seeding? (y/N): ', resolve)
      })
      readline.close()

      if (answer.toLowerCase() !== 'y') {
        console.log('❌ Seeding cancelled')
        await closeDatabase()
        return
      }
    }

    console.log(`📝 Creating ${sampleProspects.length} sample prospects...\n`)

    for (const prospectData of sampleProspects) {
      try {
        // Create prospect
        const prospect = await queries.createProspect(prospectData)
        console.log(`✅ Created: ${prospect.company_name} (Score: ${prospect.priority_score})`)

        // Add UCC filing
        const filing = await queries.createUCCFiling({
          externalId: `${prospect.state}-2024-${Math.floor(Math.random() * 100000)}`,
          filingDate: prospectData.defaultDate,
          debtorName: prospectData.companyName,
          securedParty: 'First Capital MCA',
          state: prospectData.state,
          lienAmount: Math.floor(prospectData.estimatedRevenue * 0.05),
          status: 'lapsed',
          filingType: 'UCC-1',
          source: 'sample-data'
        })

        // Link filing to prospect
        await queries.linkUCCFilingToProspect(prospect.id, filing.id)

        // Add growth signals
        const signals = [
          {
            type: 'hiring',
            source: 'indeed',
            description: 'Posted 2 new job openings',
            confidence: 0.85,
            metadata: { positions: ['Manager', 'Server'] }
          },
          {
            type: 'expansion',
            source: 'news',
            description: 'Announced new location opening',
            confidence: 0.92,
            metadata: { location: 'Downtown' }
          }
        ]

        for (const signalData of signals) {
          await queries.createGrowthSignal({
            prospectId: prospect.id,
            type: signalData.type,
            source: signalData.source,
            description: signalData.description,
            detectedDate: new Date(),
            confidence: signalData.confidence,
            metadata: signalData.metadata
          })
        }

        console.log(`   - Added ${signals.length} growth signals\n`)
      } catch (error) {
        console.error(`❌ Failed to create ${prospectData.companyName}:`, error)
      }
    }

    // Show final stats
    console.log('📊 Final Statistics:')
    const finalStats = await queries.getProspectStats()
    console.log(`   - Total Prospects: ${finalStats.total}`)
    console.log(`   - Average Score: ${finalStats.avgScore.toFixed(1)}`)
    console.log(`   - By Status:`, finalStats.byStatus)
    console.log(`   - By Industry:`, finalStats.byIndustry)
    console.log('')

    await closeDatabase()
    console.log('🎉 Database seeded successfully!')
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    await closeDatabase()
    process.exit(1)
  }
}

main()
