/**
 * Database Client with Connection Pooling
 *
 * Provides a robust PostgreSQL client with:
 * - Connection pooling (PgBouncer compatible)
 * - Query timeout handling
 * - Automatic retry logic
 * - Query logging and metrics
 * - Transaction support
 */

import { Pool, PoolClient, PoolConfig, QueryResult, QueryResultRow } from 'pg'
import { logger } from '../logging/logger'

export interface DatabaseConfig extends PoolConfig {
  host: string
  port: number
  database: string
  user: string
  password: string
  // Connection pooling
  max?: number // Maximum pool size
  min?: number // Minimum pool size
  idleTimeoutMillis?: number
  connectionTimeoutMillis?: number
  // Query settings
  statement_timeout?: number // Query timeout in ms
  query_timeout?: number
  // SSL settings
  ssl?:
    | boolean
    | {
        rejectUnauthorized?: boolean
        ca?: string
        key?: string
        cert?: string
      }
}

export interface QueryOptions {
  timeout?: number
  retries?: number
  logQuery?: boolean
  name?: string // For prepared statements
}

export interface QueryMetrics {
  query: string
  duration: number
  rows: number
  timestamp: string
  error?: string
}

export class DatabaseClient {
  private pool: Pool
  private metrics: QueryMetrics[] = []
  private maxMetricsSize = 1000 // Keep last 1000 queries

  constructor(config: DatabaseConfig) {
    const poolConfig: PoolConfig = {
      host: config.host || process.env.DB_HOST || 'localhost',
      port: config.port || parseInt(process.env.DB_PORT || '5432'),
      database: config.database || process.env.DB_NAME || 'ucc_mca_db',
      user: config.user || process.env.DB_USER || 'postgres',
      password: config.password || process.env.DB_PASSWORD || '',
      max: config.max || 20, // Default: 20 connections
      min: config.min || 2, // Default: 2 idle connections
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 10000,
      statement_timeout: config.statement_timeout || 30000, // 30 second timeout
      query_timeout: config.query_timeout || 30000,
      ssl: config.ssl || false,
      // Logging
      log: (msg) => logger.debug('PostgreSQL:', msg)
    }

    this.pool = new Pool(poolConfig)

    // Handle pool errors
    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err)
    })

    // Handle pool connection
    this.pool.on('connect', (client) => {
      void client
      logger.debug('New client connected to database')
    })

    // Handle pool removal
    this.pool.on('remove', () => {
      logger.debug('Client removed from pool')
    })

    logger.info('Database client initialized', {
      host: poolConfig.host,
      database: poolConfig.database,
      maxConnections: poolConfig.max
    })
  }

  /**
   * Execute a query
   */
  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: Array<unknown>,
    options?: QueryOptions
  ): Promise<QueryResult<T>> {
    const startTime = Date.now()
    const retries = options?.retries || 1
    let lastError: Error | null = null

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        if (options?.logQuery !== false) {
          logger.debug('Executing query', {
            query: text,
            params: params,
            attempt: attempt + 1
          })
        }

        const result = await this.pool.query<T>(text, params)

        const duration = Date.now() - startTime

        // Record metrics
        this.recordMetrics({
          query: text,
          duration,
          rows: result.rowCount || 0,
          timestamp: new Date().toISOString()
        })

        logger.debug('Query completed', {
          duration: `${duration}ms`,
          rows: result.rowCount
        })

        return result
      } catch (error) {
        lastError = error as Error
        const duration = Date.now() - startTime

        logger.error('Query failed', {
          query: text,
          error: lastError.message,
          duration: `${duration}ms`,
          attempt: attempt + 1
        })

        // Record error metrics
        this.recordMetrics({
          query: text,
          duration,
          rows: 0,
          timestamp: new Date().toISOString(),
          error: lastError.message
        })

        // Don't retry on certain errors
        if (this.isNonRetryableError(lastError)) {
          break
        }

        // Wait before retry
        if (attempt < retries - 1) {
          await this.sleep(Math.pow(2, attempt) * 100) // Exponential backoff
        }
      }
    }

    throw lastError
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()

    try {
      await client.query('BEGIN')
      logger.debug('Transaction started')

      const result = await callback(client)

      await client.query('COMMIT')
      logger.debug('Transaction committed')

      return result
    } catch (error) {
      await client.query('ROLLBACK')
      logger.error('Transaction rolled back', { error })
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * Get a client from the pool (for manual transaction control)
   */
  async getClient(): Promise<PoolClient> {
    return await this.pool.connect()
  }

  /**
   * Test database connection
   */
  async ping(): Promise<boolean> {
    try {
      await this.query('SELECT 1 as ping')
      return true
    } catch (error) {
      logger.error('Database ping failed', { error })
      return false
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount
    }
  }

  /**
   * Get query metrics
   */
  getMetrics(): QueryMetrics[] {
    return [...this.metrics]
  }

  /**
   * Get average query duration
   */
  getAverageQueryDuration(): number {
    if (this.metrics.length === 0) return 0

    const total = this.metrics.reduce((sum, m) => sum + m.duration, 0)
    return total / this.metrics.length
  }

  /**
   * Get slow queries (above threshold)
   */
  getSlowQueries(thresholdMs: number = 1000): QueryMetrics[] {
    return this.metrics.filter((m) => m.duration > thresholdMs)
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.metrics = []
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    logger.info('Closing database connection pool')
    await this.pool.end()
  }

  /**
   * Record query metrics
   */
  private recordMetrics(metrics: QueryMetrics): void {
    this.metrics.push(metrics)

    // Trim metrics if exceeding max size
    if (this.metrics.length > this.maxMetricsSize) {
      this.metrics.shift()
    }
  }

  /**
   * Check if error is non-retryable
   */
  private isNonRetryableError(error: Error): boolean {
    const nonRetryableErrors = [
      'syntax error',
      'permission denied',
      'relation does not exist',
      'column does not exist',
      'duplicate key value',
      'violates foreign key constraint',
      'violates not-null constraint',
      'invalid input syntax'
    ]

    return nonRetryableErrors.some((msg) => error.message.toLowerCase().includes(msg))
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// Singleton instance
let dbClient: DatabaseClient | null = null

/**
 * Get database client instance
 */
export function getDatabase(config?: DatabaseConfig): DatabaseClient {
  if (!dbClient && config) {
    dbClient = new DatabaseClient(config)
  }

  if (!dbClient) {
    throw new Error('Database client not initialized. Call getDatabase(config) first.')
  }

  return dbClient
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (dbClient) {
    await dbClient.close()
    dbClient = null
  }
}
