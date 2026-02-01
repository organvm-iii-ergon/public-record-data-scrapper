/**
 * Database Migration System
 *
 * Simple migration runner for PostgreSQL schema changes
 */

import { DatabaseClient } from './client'
import { logger } from '../logging/logger'
import fs from 'fs/promises'
import path from 'path'

export interface Migration {
  id: number
  name: string
  sql: string
  executed_at?: string
}

export class MigrationRunner {
  private client: DatabaseClient
  private migrationsDir: string

  constructor(client: DatabaseClient, migrationsDir: string = 'database/migrations') {
    this.client = client
    this.migrationsDir = migrationsDir
  }

  /**
   * Initialize migrations table
   */
  async initialize(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `

    await this.client.query(sql)
    logger.info('Migrations table initialized')
  }

  /**
   * Get executed migrations
   */
  async getExecutedMigrations(): Promise<Migration[]> {
    const result = await this.client.query<Migration>(
      'SELECT * FROM schema_migrations ORDER BY id ASC'
    )
    return result.rows
  }

  /**
   * Get pending migrations
   */
  async getPendingMigrations(): Promise<Migration[]> {
    const executed = await this.getExecutedMigrations()
    const executedIds = new Set(executed.map((m) => m.id))

    const allMigrations = await this.loadMigrationFiles()
    return allMigrations.filter((m) => !executedIds.has(m.id))
  }

  /**
   * Run pending migrations
   */
  async migrate(): Promise<void> {
    await this.initialize()

    const pending = await this.getPendingMigrations()

    if (pending.length === 0) {
      logger.info('No pending migrations')
      return
    }

    logger.info(`Running ${pending.length} migrations`)

    for (const migration of pending) {
      await this.runMigration(migration)
    }

    logger.info('All migrations completed')
  }

  /**
   * Run a single migration
   */
  private async runMigration(migration: Migration): Promise<void> {
    logger.info(`Running migration: ${migration.name}`)

    await this.client.transaction(async (client) => {
      // Execute migration SQL
      await client.query(migration.sql)

      // Record migration
      await client.query('INSERT INTO schema_migrations (id, name) VALUES ($1, $2)', [
        migration.id,
        migration.name
      ])

      logger.info(`Migration completed: ${migration.name}`)
    })
  }

  /**
   * Load migration files from directory
   */
  private async loadMigrationFiles(): Promise<Migration[]> {
    try {
      const files = await fs.readdir(this.migrationsDir)
      const sqlFiles = files.filter((f) => f.endsWith('.sql')).sort()

      const migrations: Migration[] = []

      for (const file of sqlFiles) {
        const match = file.match(/^(\d+)_(.+)\.sql$/)
        if (!match) continue

        const id = parseInt(match[1], 10)
        const name = match[2]
        const filePath = path.join(this.migrationsDir, file)
        const sql = await fs.readFile(filePath, 'utf-8')

        migrations.push({ id, name, sql })
      }

      return migrations
    } catch (error) {
      logger.error('Failed to load migration files', { error })
      throw error
    }
  }

  /**
   * Rollback last migration
   */
  async rollback(): Promise<void> {
    const executed = await this.getExecutedMigrations()
    if (executed.length === 0) {
      logger.warn('No migrations to rollback')
      return
    }

    const last = executed[executed.length - 1]
    logger.warn(`Rolling back migration: ${last.name}`)

    await this.client.query('DELETE FROM schema_migrations WHERE id = $1', [last.id])

    logger.info('Rollback completed (SQL changes must be manually reverted)')
  }
}

/**
 * Create migration file
 */
export async function createMigration(
  name: string,
  migrationsDir: string = 'database/migrations'
): Promise<void> {
  const timestamp = Date.now()
  const filename = `${timestamp}_${name}.sql`
  const filePath = path.join(migrationsDir, filename)

  const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}

-- Add your SQL migration here

-- Example:
-- CREATE TABLE example (
--   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   name VARCHAR(255) NOT NULL
-- );
`

  await fs.writeFile(filePath, template, 'utf-8')
  logger.info(`Migration file created: ${filename}`)
}
