import { Pool, PoolClient } from 'pg'
import { config } from '../config'

class Database {
  private pool: Pool | null = null

  async connect(): Promise<void> {
    if (this.pool) {
      console.log('Database already connected')
      return
    }

    this.pool = new Pool({
      connectionString: config.database.url,
      max: config.database.maxConnections,
      idleTimeoutMillis: config.database.idleTimeoutMillis,
      connectionTimeoutMillis: config.database.connectionTimeoutMillis
    })

    // Test connection
    try {
      const client = await this.pool.connect()
      const result = await client.query('SELECT NOW()')
      console.log('✓ Database connected:', result.rows[0].now)
      client.release()
    } catch (error) {
      console.error('✗ Database connection failed:', error)
      throw error
    }

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected database error:', err)
    })
  }

  async disconnect(): Promise<void> {
    if (!this.pool) {
      console.log('Database not connected')
      return
    }

    await this.pool.end()
    this.pool = null
    console.log('✓ Database disconnected')
  }

  getPool(): Pool {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.')
    }
    return this.pool
  }

  async query<T = Record<string, unknown>>(text: string, params?: Array<unknown>): Promise<T[]> {
    const pool = this.getPool()
    const result = await pool.query(text, params)
    return result.rows
  }

  async getClient(): Promise<PoolClient> {
    const pool = this.getPool()
    return pool.connect()
  }
}

export const database = new Database()
