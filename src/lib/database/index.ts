/**
 * Database Module
 *
 * Central export for all database functionality
 */

// Client
export {
  DatabaseClient,
  getDatabase,
  initDatabase,
  closeDatabase,
  type DatabaseConfig,
  type QueryOptions
} from './client'

// Migrations
export {
  MigrationManager,
  runMigrations,
  getMigrationStatus,
  type Migration,
  type MigrationResult
} from './migrations'

// Queries
export {
  DatabaseQueries,
  createQueries,
  type ProspectRow,
  type UCCFilingRow,
  type GrowthSignalRow
} from './queries'

// Default export
export { default } from './client'
