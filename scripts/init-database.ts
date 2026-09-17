#!/usr/bin/env tsx
/**
 * Database Initialization Script
 *
 * Initializes database connection, runs migrations, and optionally seeds data
 */

import {
  initDatabase,
  runMigrations,
  closeDatabase,
  createQueries
} from '../apps/web/src/lib/database'

async function main() {
  console.log('🔧 Initializing database...\n')

  try {
    // Initialize database connection
    console.log('📡 Connecting to database...')
    const db = await initDatabase()
    console.log('✅ Connected successfully\n')

    // Check health
    console.log('🏥 Running health check...')
    const healthy = await db.healthCheck()
    if (!healthy) {
      throw new Error('Database health check failed')
    }
    console.log('✅ Database is healthy\n')

    // Get connection stats
    const stats = db.getStats()
    console.log('📊 Connection Stats:')
    console.log(`   - Pool Size: ${stats.poolSize}`)
    console.log(`   - Active: ${stats.activeConnections}`)
    console.log(`   - Idle: ${stats.idleConnections}`)
    console.log(`   - Waiting: ${stats.waitingClients}\n`)

    // Run migrations
    console.log('🔄 Running migrations...')
    const migrationResult = await runMigrations(db)

    if (migrationResult.success) {
      console.log(`✅ Applied ${migrationResult.migrations.length} migration(s)`)
      migrationResult.migrations.forEach((m) => {
        console.log(`   - ${m.id}_${m.name}`)
      })
      console.log('')
    } else {
      console.error('❌ Migration failed:')
      migrationResult.errors.forEach((err) => console.error(`   - ${err}`))
      process.exit(1)
    }

    // Test queries
    console.log('🔍 Testing queries...')
    const queries = createQueries(db)

    // Get stats
    const prospectStats = await queries.getProspectStats()
    console.log('✅ Query test successful')
    console.log(`   - Total Prospects: ${prospectStats.total}`)
    console.log(`   - Average Score: ${prospectStats.avgScore.toFixed(1)}`)

    if (prospectStats.byStatus) {
      console.log('   - By Status:', prospectStats.byStatus)
    }
    console.log('')

    // Close connection
    console.log('🔌 Closing connection...')
    await closeDatabase()
    console.log('✅ Connection closed\n')

    console.log('🎉 Database initialization complete!')
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error)
    await closeDatabase()
    process.exit(1)
  }
}

main()
