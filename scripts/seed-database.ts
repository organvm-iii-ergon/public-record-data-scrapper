#!/usr/bin/env tsx
/**
 * Database Seed Script
 *
 * Seeds the database with comprehensive sample data for development.
 * Uses database/seed.sql for the actual data insertion.
 *
 * Usage:
 *   npm run seed           # Run seed with prompts
 *   npm run seed -- --yes  # Skip confirmation prompts
 *   npm run seed -- --force # Drop and recreate all data
 */

import { createInterface } from 'node:readline'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load environment variables
const dotenv = await import('dotenv')
dotenv.config({ path: join(__dirname, '..', '.env.sandbox') })
dotenv.config({ path: join(__dirname, '..', '.env') })

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ucc_mca'

interface SeedStats {
  organizations: number
  users: number
  contacts: number
  prospects: number
  ucc_filings: number
  deals: number
  deal_documents: number
  communications: number
  audit_logs: number
  consent_records: number
  portfolio_companies: number
  growth_signals: number
  health_scores: number
  competitors: number
}

async function getTableCounts(client: pg.Client): Promise<SeedStats> {
  const tables = [
    'organizations',
    'users',
    'contacts',
    'prospects',
    'ucc_filings',
    'deals',
    'deal_documents',
    'communications',
    'audit_logs',
    'consent_records',
    'portfolio_companies',
    'growth_signals',
    'health_scores',
    'competitors'
  ]

  const stats: Record<string, number> = {}

  for (const table of tables) {
    try {
      const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`)
      stats[table] = parseInt(result.rows[0].count, 10)
    } catch {
      stats[table] = 0
    }
  }

  return stats as SeedStats
}

async function confirm(message: string): Promise<boolean> {
  const args = process.argv.slice(2)
  if (args.includes('--yes') || args.includes('-y')) {
    return true
  }

  const readline = createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise((resolve) => {
    readline.question(`${message} (y/N): `, (answer) => {
      readline.close()
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes')
    })
  })
}

async function clearExistingData(client: pg.Client): Promise<void> {
  console.log('\n🗑️  Clearing existing data...')

  // Disable triggers temporarily to allow audit log deletion
  await client.query('SET session_replication_role = replica')

  // Delete in order to respect foreign key constraints
  const tables = [
    'communication_events',
    'communications',
    'follow_up_reminders',
    'communication_templates',
    'compliance_alerts',
    'consent_records',
    'dnc_list',
    'disclosures',
    'deal_stage_history',
    'deal_documents',
    'deals',
    'lenders',
    'deal_stages',
    'contact_activities',
    'prospect_contacts',
    'contacts',
    'portfolio_health_scores',
    'portfolio_companies',
    'health_scores',
    'growth_signals',
    'prospect_ucc_filings',
    'ucc_filings',
    'enrichment_logs',
    'ingestion_logs',
    'prospects',
    'api_keys',
    'user_permissions',
    'users',
    'audit_logs',
    'organizations',
    'competitors'
  ]

  for (const table of tables) {
    try {
      await client.query(`DELETE FROM ${table}`)
      console.log(`   ✓ Cleared ${table}`)
    } catch {
      // Table might not exist
    }
  }

  // Re-enable triggers
  await client.query('SET session_replication_role = DEFAULT')
}

async function runSeedSQL(client: pg.Client): Promise<void> {
  console.log('\n📝 Running seed SQL...')

  const seedPath = join(__dirname, '..', 'database', 'seed.sql')
  const seedSQL = readFileSync(seedPath, 'utf-8')

  await client.query(seedSQL)
}

async function main() {
  console.log('🌱 MCA Platform - Database Seed Script')
  console.log('━'.repeat(50))
  console.log(`Database: ${DATABASE_URL.replace(/:[^@]+@/, ':***@')}`)
  console.log('')

  const args = process.argv.slice(2)
  const forceMode = args.includes('--force') || args.includes('-f')

  // Connect to database
  const client = new pg.Client({ connectionString: DATABASE_URL })

  try {
    await client.connect()
    console.log('✓ Connected to database')

    // Check existing data
    const beforeStats = await getTableCounts(client)
    const hasExistingData = Object.values(beforeStats).some((count) => count > 0)

    if (hasExistingData) {
      console.log('\n📊 Current data:')
      console.log(`   Organizations: ${beforeStats.organizations}`)
      console.log(`   Users: ${beforeStats.users}`)
      console.log(`   Contacts: ${beforeStats.contacts}`)
      console.log(`   Prospects: ${beforeStats.prospects}`)
      console.log(`   Deals: ${beforeStats.deals}`)

      if (forceMode) {
        console.log('\n⚠️  Force mode enabled - will clear existing data')
        await clearExistingData(client)
      } else {
        const shouldContinue = await confirm('\n⚠️  Database has existing data. Clear and reseed?')
        if (!shouldContinue) {
          console.log('❌ Seeding cancelled')
          await client.end()
          process.exit(0)
        }
        await clearExistingData(client)
      }
    }

    // Run seed SQL
    await runSeedSQL(client)

    // Show final stats
    const afterStats = await getTableCounts(client)

    console.log('\n📊 Seed Results:')
    console.log('━'.repeat(50))
    console.log(`   Organizations:      ${afterStats.organizations}`)
    console.log(`   Users:              ${afterStats.users}`)
    console.log(`   Contacts:           ${afterStats.contacts}`)
    console.log(`   Prospects:          ${afterStats.prospects}`)
    console.log(`   UCC Filings:        ${afterStats.ucc_filings}`)
    console.log(`   Deals:              ${afterStats.deals}`)
    console.log(`   Deal Documents:     ${afterStats.deal_documents}`)
    console.log(`   Communications:     ${afterStats.communications}`)
    console.log(`   Audit Logs:         ${afterStats.audit_logs}`)
    console.log(`   Consent Records:    ${afterStats.consent_records}`)
    console.log(`   Portfolio Companies:${afterStats.portfolio_companies}`)
    console.log(`   Growth Signals:     ${afterStats.growth_signals}`)
    console.log(`   Health Scores:      ${afterStats.health_scores}`)
    console.log(`   Competitors:        ${afterStats.competitors}`)
    console.log('━'.repeat(50))

    console.log('\n🎉 Database seeded successfully!')
    console.log('')
    console.log('Next steps:')
    console.log('  npm run dev:full    # Start the full platform')
    console.log('  open http://localhost:5173')
    console.log('')
  } catch (error) {
    console.error('\n❌ Seeding failed:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
