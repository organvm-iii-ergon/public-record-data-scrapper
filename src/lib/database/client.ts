/**
 * Database Client - PostgreSQL connection with pooling
 *
 * Provides connection pooling, query logging, retry logic, and timeout handling
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg'

export interface DatabaseConfig {
  connectionString?: string
  host?: string
  port?: number
  database?: string
  user?: string
  password?: string
  ssl?: boolean | { rejectUnauthorized: boolean }
  poolSize?: number
  idleTimeoutMillis?: number
  connectionTimeoutMillis?: number
  queryTimeoutMillis?: number
  enableQueryLogging?: boolean
}

export interface QueryOptions {
  timeout?: number
  retries?: number
  logQuery?: boolean
}

class DatabaseClient {
  private pool: Pool | null = null
  private config: DatabaseConfig
  private isConnected: boolean = false
  private queryCount: number = 0
  private errorCount: number = 0

  constructor(config: DatabaseConfig = {}) {
    this.config = {
      connectionString: config.connectionString || process.env.DATABASE_URL,
      host: config.host || process.env.DB_HOST || 'localhost',
      port: config.port || Number(process.env.DB_PORT) || 5432,
      database: config.database || process.env.DB_NAME || 'ucc_intelligence',
      user: config.user || process.env.DB_USER || 'postgres',
      password: config.password || process.env.DB_PASSWORD,
      ssl: config.ssl !== undefined ? config.ssl : process.env.DB_SSL === 'true',
      poolSize: config.poolSize || Number(process.env.DATABASE_POOL_SIZE) || 20,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 10000,
      queryTimeoutMillis: config.queryTimeoutMillis || Number(process.env.DATABASE_TIMEOUT) || 30000,
      enableQueryLogging: config.enableQueryLogging !== undefined
        ? config.enableQueryLogging
        : process.env.NODE_ENV === 'development'
    }
  }

  /**
   * Initialize database connection pool
   */
  async connect(): Promise<void> {
    if (this.pool) {
      console.warn('[Database] Already connected')
      return
    }

    try {
      this.pool = new Pool({
        connectionString: this.config.connectionString,
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        ssl: this.config.ssl,
        max: this.config.poolSize,
        idleTimeoutMillis: this.config.idleTimeoutMillis,
        connectionTimeoutMillis: this.config.connectionTimeoutMillis,
        statement_timeout: this.config.queryTimeoutMillis,
      })

      // Test connection
      const client = await this.pool.connect()
      await client.query('SELECT NOW()')
      client.release()

      this.isConnected = true
      console.log('[Database] Connected successfully')
    } catch (error) {
      console.error('[Database] Connection failed:', error)
      throw new Error(`Failed to connect to database: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Close database connection pool
   */
  async disconnect(): Promise<void> {
    if (!this.pool) {
      return
    }

    try {
      await this.pool.end()
      this.pool = null
      this.isConnected = false
      console.log('[Database] Disconnected successfully')
    } catch (error) {
      console.error('[Database] Error during disconnect:', error)
      throw error
    }
  }

  /**
   * Execute a query with retry logic and timeout
   */
  async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[],
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.')
    }

    const {
      timeout = this.config.queryTimeoutMillis,
      retries = 3,
      logQuery = this.config.enableQueryLogging
    } = options

    if (logQuery) {
      console.log('[Database Query]', text, params)
    }

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const startTime = Date.now()

        // Execute query with timeout
        const result = await Promise.race<QueryResult<T>>([
          this.pool.query<T>(text, params),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Query timeout')), timeout)
          )
        ])

        const duration = Date.now() - startTime
        this.queryCount++

        if (logQuery || duration > 1000) {
          console.log(`[Database] Query completed in ${duration}ms`)
        }

        return result
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        this.errorCount++

        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 100 // Exponential backoff
          console.warn(`[Database] Query failed (attempt ${attempt}/${retries}), retrying in ${delay}ms...`, error)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw new Error(`Query failed after ${retries} attempts: ${lastError?.message}`)
  }

  /**
   * Execute a query and return a single row
   */
  async queryOne<T extends QueryResultRow = any>(
    text: string,
    params?: any[],
    options?: QueryOptions
  ): Promise<T | null> {
    const result = await this.query<T>(text, params, options)
    return result.rows[0] || null
  }

  /**
   * Execute a query and return all rows
   */
  async queryMany<T extends QueryResultRow = any>(
    text: string,
    params?: any[],
    options?: QueryOptions
  ): Promise<T[]> {
    const result = await this.query<T>(text, params, options)
    return result.rows
  }

  /**
   * Get a client from the pool for transaction support
   */
  async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.')
    }
    return await this.pool.connect()
  }

  /**
   * Execute queries within a transaction
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient()

    try {
      await client.query('BEGIN')
      const result = await callback(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * Get connection statistics
   */
  getStats() {
    return {
      connected: this.isConnected,
      totalQueries: this.queryCount,
      errorCount: this.errorCount,
      poolSize: this.pool?.totalCount || 0,
      idleConnections: this.pool?.idleCount || 0,
      activeConnections: (this.pool?.totalCount || 0) - (this.pool?.idleCount || 0),
      waitingClients: this.pool?.waitingCount || 0,
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1')
      return true
    } catch (error) {
      console.error('[Database] Health check failed:', error)
      return false
    }
  }
}

// Singleton instance
let dbClient: DatabaseClient | null = null

/**
 * Get or create database client singleton
 */
export function getDatabase(config?: DatabaseConfig): DatabaseClient {
  if (!dbClient) {
    dbClient = new DatabaseClient(config)
  }
  return dbClient
}

/**
 * Initialize database connection
 */
export async function initDatabase(config?: DatabaseConfig): Promise<DatabaseClient> {
  const db = getDatabase(config)
  await db.connect()
  return db
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (dbClient) {
    await dbClient.disconnect()
    dbClient = null
  }
}

export { DatabaseClient }
export default getDatabase
