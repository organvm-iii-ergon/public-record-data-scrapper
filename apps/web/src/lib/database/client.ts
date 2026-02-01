/**
 * Database Client with Connection Pooling
 *
 * This module re-exports the canonical DatabaseClient from @public-records/core
 * with app-specific logging integration.
 *
 * For new code, prefer importing directly from @public-records/core/database
 */

import {
  DatabaseClient as CoreDatabaseClient,
  getDatabase as getCoreDatabase,
  initDatabase as initCoreDatabase,
  closeDatabase as closeCoreDatabase,
  resetDatabaseClient,
  type DatabaseConfig,
  type QueryOptions,
  type QueryMetrics,
  type DatabaseLogger
} from '@public-records/core/database'
import { logger } from '../logging/logger'

// Create an adapter that wraps our logger to match the DatabaseLogger interface
const loggerAdapter: DatabaseLogger = {
  error: (message: string, meta?: Record<string, unknown>) => logger.error(message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => logger.warn(message, meta),
  info: (message: string, meta?: Record<string, unknown>) => logger.info(message, meta),
  debug: (message: string, meta?: Record<string, unknown>) => logger.debug(message, meta)
}

// Re-export the core types and classes
export {
  CoreDatabaseClient as DatabaseClient,
  type DatabaseConfig,
  type QueryOptions,
  type QueryMetrics,
  type DatabaseLogger
}

/**
 * Get database client instance with app-specific logger
 */
export function getDatabase(config?: DatabaseConfig): CoreDatabaseClient {
  return getCoreDatabase(config, loggerAdapter)
}

/**
 * Initialize database with app-specific logger
 */
export function initDatabase(config: DatabaseConfig): CoreDatabaseClient {
  return initCoreDatabase(config, loggerAdapter)
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  await closeCoreDatabase()
}

/**
 * Reset database client (for testing)
 */
export { resetDatabaseClient }
