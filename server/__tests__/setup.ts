import { beforeAll, afterAll, afterEach } from 'vitest'
import { database } from '../database/connection'

// Test database setup
beforeAll(async () => {
  // Connect to test database
  const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL

  if (!testDbUrl) {
    throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set for tests')
  }

  try {
    await database.connect()
    console.log('✓ Test database connected')
  } catch (error) {
    console.error('Failed to connect to test database:', error)
    throw error
  }
})

// Clean up after each test
afterEach(async () => {
  // Clean up test data after each test
  // This ensures tests don't interfere with each other
  const tables = [
    'audit_logs',
    'usage_tracking',
    'enrichment_logs',
    'ingestion_logs',
    'data_ingestion_logs',
    'portfolio_health_scores',
    'growth_signals',
    'health_scores',
    'prospect_ucc_filings',
    'prospects',
    'portfolio_companies',
    'competitors',
    'ucc_filings',
    'users',
    'data_sources'
  ]

  for (const table of tables) {
    try {
      await database.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`)
    } catch (error) {
      const code = (error as { code?: string }).code
      if (code === '42P01') {
        continue
      }
      console.error('Failed to clean up test data:', error)
    }
  }
})

// Tear down after all tests
afterAll(async () => {
  try {
    await database.disconnect()
    console.log('✓ Test database disconnected')
  } catch (error) {
    console.error('Failed to disconnect from test database:', error)
  }
})
