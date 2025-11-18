/**
 * Database Migrations
 *
 * Handles database schema migrations with version tracking
 */

import { promises as fs } from 'fs'
import path from 'path'
import { DatabaseClient } from './client'

export interface Migration {
  id: number
  name: string
  filepath: string
  sql: string
  appliedAt?: Date
}

export interface MigrationResult {
  success: boolean
  migrations: Migration[]
  errors: string[]
}

class MigrationManager {
  private db: DatabaseClient

  constructor(db: DatabaseClient) {
    this.db = db
  }

  /**
   * Initialize migrations table
   */
  private async initMigrationsTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        version INTEGER UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_schema_migrations_version
        ON schema_migrations(version);
    `

    await this.db.query(sql)
    console.log('[Migrations] Migrations table initialized')
  }

  /**
   * Get list of applied migrations
   */
  private async getAppliedMigrations(): Promise<Set<number>> {
    const result = await this.db.queryMany<{ version: number }>(
      'SELECT version FROM schema_migrations ORDER BY version'
    )

    return new Set(result.map(row => row.version))
  }

  /**
   * Load migration files from directory
   */
  async loadMigrations(migrationsDir: string): Promise<Migration[]> {
    try {
      const files = await fs.readdir(migrationsDir)
      const sqlFiles = files.filter(f => f.endsWith('.sql')).sort()

      const migrations: Migration[] = []

      for (const file of sqlFiles) {
        const match = file.match(/^(\d+)_(.+)\.sql$/)
        if (!match) {
          console.warn(`[Migrations] Skipping invalid migration file: ${file}`)
          continue
        }

        const [, idStr, name] = match
        const id = parseInt(idStr, 10)
        const filepath = path.join(migrationsDir, file)
        const sql = await fs.readFile(filepath, 'utf-8')

        migrations.push({ id, name, filepath, sql })
      }

      return migrations
    } catch (error) {
      throw new Error(`Failed to load migrations: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Apply a single migration
   */
  private async applyMigration(migration: Migration): Promise<void> {
    await this.db.transaction(async (client) => {
      // Execute migration SQL
      await client.query(migration.sql)

      // Record migration
      await client.query(
        'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
        [migration.id, migration.name]
      )

      console.log(`[Migrations] Applied: ${migration.id}_${migration.name}`)
    })
  }

  /**
   * Run pending migrations
   */
  async migrate(migrationsDir?: string): Promise<MigrationResult> {
    const errors: string[] = []
    const appliedMigrations: Migration[] = []

    try {
      // Initialize migrations table
      await this.initMigrationsTable()

      // Determine migrations directory
      const dir = migrationsDir || path.join(process.cwd(), 'database', 'migrations')
      console.log(`[Migrations] Loading migrations from: ${dir}`)

      // Load all migration files
      const allMigrations = await this.loadMigrations(dir)
      console.log(`[Migrations] Found ${allMigrations.length} migration file(s)`)

      // Get applied migrations
      const applied = await this.getAppliedMigrations()
      console.log(`[Migrations] ${applied.size} migration(s) already applied`)

      // Filter pending migrations
      const pending = allMigrations.filter(m => !applied.has(m.id))

      if (pending.length === 0) {
        console.log('[Migrations] No pending migrations')
        return { success: true, migrations: [], errors: [] }
      }

      console.log(`[Migrations] Applying ${pending.length} pending migration(s)...`)

      // Apply each pending migration
      for (const migration of pending) {
        try {
          await this.applyMigration(migration)
          appliedMigrations.push({
            ...migration,
            appliedAt: new Date()
          })
        } catch (error) {
          const errorMsg = `Failed to apply migration ${migration.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(`[Migrations] ${errorMsg}`)
          errors.push(errorMsg)
          break // Stop on first error
        }
      }

      const success = errors.length === 0
      if (success) {
        console.log(`[Migrations] Successfully applied ${appliedMigrations.length} migration(s)`)
      } else {
        console.error(`[Migrations] Migration failed with ${errors.length} error(s)`)
      }

      return { success, migrations: appliedMigrations, errors }
    } catch (error) {
      const errorMsg = `Migration process failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      console.error(`[Migrations] ${errorMsg}`)
      return { success: false, migrations: appliedMigrations, errors: [errorMsg, ...errors] }
    }
  }

  /**
   * Rollback last migration (use with caution!)
   */
  async rollback(): Promise<void> {
    const lastMigration = await this.db.queryOne<{ version: number; name: string }>(
      'SELECT version, name FROM schema_migrations ORDER BY version DESC LIMIT 1'
    )

    if (!lastMigration) {
      console.log('[Migrations] No migrations to rollback')
      return
    }

    console.warn(`[Migrations] Rolling back: ${lastMigration.version}_${lastMigration.name}`)
    console.warn('[Migrations] WARNING: Rollback must be done manually by running the appropriate DOWN migration')
    console.warn('[Migrations] Remove from tracking with: DELETE FROM schema_migrations WHERE version = $1', lastMigration.version)
  }

  /**
   * Get migration status
   */
  async getStatus(): Promise<{ version: number; name: string; applied_at: Date }[]> {
    return await this.db.queryMany(
      'SELECT version, name, applied_at FROM schema_migrations ORDER BY version'
    )
  }

  /**
   * Reset all migrations (DANGEROUS - drops all data!)
   */
  async reset(): Promise<void> {
    console.warn('[Migrations] DANGER: Resetting database...')

    await this.db.transaction(async (client) => {
      // Drop all tables
      await client.query(`
        DO $$ DECLARE
          r RECORD;
        BEGIN
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
            EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
          END LOOP;
        END $$;
      `)

      console.log('[Migrations] All tables dropped')
    })
  }
}

/**
 * Run migrations
 */
export async function runMigrations(
  db: DatabaseClient,
  migrationsDir?: string
): Promise<MigrationResult> {
  const manager = new MigrationManager(db)
  return await manager.migrate(migrationsDir)
}

/**
 * Get migration status
 */
export async function getMigrationStatus(
  db: DatabaseClient
): Promise<{ version: number; name: string; applied_at: Date }[]> {
  const manager = new MigrationManager(db)
  return await manager.getStatus()
}

export { MigrationManager }
