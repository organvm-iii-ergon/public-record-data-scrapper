/**
 * ProspectsService
 *
 * Service layer for managing prospect data in the UCC-MCA Intelligence Platform.
 * Handles CRUD operations, filtering, pagination, and batch operations for prospects.
 *
 * @module server/services/ProspectsService
 */

import { database } from '../database/connection'
import type { Prospect } from '../../src/lib/types'
import { NotFoundError, DatabaseError, ValidationError } from '../errors'

/**
 * Allowlist of valid columns for sorting to prevent SQL injection.
 * Only these columns can be used in ORDER BY clauses.
 */
const ALLOWED_SORT_COLUMNS = [
  'priority_score',
  'created_at',
  'updated_at',
  'company_name',
  'state',
  'industry',
  'lien_amount',
  'filing_date',
  'status'
] as const

type AllowedSortColumn = (typeof ALLOWED_SORT_COLUMNS)[number]

/**
 * Validates and sanitizes a sort column to prevent SQL injection.
 *
 * @param column - The requested sort column name
 * @returns A safe column name from the allowlist, defaults to 'priority_score'
 */
function validateSortColumn(column: string): AllowedSortColumn {
  if (ALLOWED_SORT_COLUMNS.includes(column as AllowedSortColumn)) {
    return column as AllowedSortColumn
  }
  return 'priority_score' // Safe default
}

/**
 * Parameters for listing prospects with filtering and pagination.
 */
interface ListParams {
  /** Page number (1-indexed) */
  page: number
  /** Number of items per page */
  limit: number
  /** Filter by state code (e.g., 'CA', 'NY') */
  state?: string
  /** Filter by industry type */
  industry?: string
  /** Filter by minimum priority score (0-100) */
  min_score?: number
  /** Filter by maximum priority score (0-100) */
  max_score?: number
  /** Filter by claim status */
  status?: 'all' | 'unclaimed' | 'claimed' | 'contacted'
  /** Column to sort by (validated against allowlist) */
  sort_by: string
  /** Sort direction */
  sort_order: 'asc' | 'desc'
}

/**
 * Result of a paginated prospect list query.
 */
interface ListResult {
  /** Array of prospects matching the query */
  prospects: Prospect[]
  /** Current page number */
  page: number
  /** Items per page */
  limit: number
  /** Total number of matching prospects */
  total: number
}

/**
 * Service for managing prospect data.
 *
 * Provides methods for:
 * - Listing prospects with filtering, sorting, and pagination
 * - CRUD operations (create, read, update, delete)
 * - Claiming/unclaiming prospects
 * - Batch operations
 *
 * @example
 * ```typescript
 * const service = new ProspectsService()
 *
 * // List prospects with filters
 * const result = await service.list({
 *   page: 1,
 *   limit: 20,
 *   state: 'CA',
 *   min_score: 70,
 *   sort_by: 'priority_score',
 *   sort_order: 'desc'
 * })
 *
 * // Claim a prospect
 * const claimed = await service.claim('prospect-id', 'user-id')
 * ```
 */
export class ProspectsService {
  /**
   * List prospects with filtering, sorting, and pagination.
   *
   * Builds a dynamic SQL query based on provided filters. All parameters
   * are sanitized to prevent SQL injection.
   *
   * @param params - Query parameters for filtering and pagination
   * @returns Paginated list of prospects with total count
   * @throws {DatabaseError} If the database query fails
   */
  async list(params: ListParams): Promise<ListResult> {
    const { page, limit, state, industry, min_score, max_score, status, sort_by, sort_order } =
      params
    const safeSortBy = validateSortColumn(sort_by)
    const offset = (page - 1) * limit

    // Build WHERE clause
    const conditions: string[] = []
    const values: (string | number)[] = []
    let paramCount = 1

    if (state) {
      conditions.push(`state = $${paramCount++}`)
      values.push(state)
    }

    if (industry) {
      conditions.push(`industry = $${paramCount++}`)
      values.push(industry)
    }

    if (min_score !== undefined) {
      conditions.push(`priority_score >= $${paramCount++}`)
      values.push(min_score)
    }

    if (max_score !== undefined) {
      conditions.push(`priority_score <= $${paramCount++}`)
      values.push(max_score)
    }

    if (status && status !== 'all') {
      conditions.push(`status = $${paramCount++}`)
      values.push(status)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Query prospects - safeSortBy is validated against allowlist
    const safeSortOrder = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'
    const query = `
      SELECT * FROM prospects
      ${whereClause}
      ORDER BY ${safeSortBy} ${safeSortOrder}
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `
    values.push(limit, offset)

    try {
      const prospects = await database.query<Prospect>(query, values)

      // Get total count
      const countQuery = `SELECT COUNT(*) as count FROM prospects ${whereClause}`
      const countResult = await database.query<{ count: string }>(countQuery, values.slice(0, -2))
      const total = parseInt(countResult[0]?.count || '0')

      return {
        prospects,
        page,
        limit,
        total
      }
    } catch (error) {
      throw new DatabaseError(
        'Failed to list prospects',
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Get a prospect by ID.
   *
   * @param id - The prospect's unique identifier
   * @returns The prospect if found, null otherwise
   * @throws {DatabaseError} If the database query fails
   */
  async getById(id: string): Promise<Prospect | null> {
    try {
      const results = await database.query<Prospect>('SELECT * FROM prospects WHERE id = $1', [id])
      return results[0] || null
    } catch (error) {
      throw new DatabaseError('Failed to get prospect', error instanceof Error ? error : undefined)
    }
  }

  /**
   * Get a prospect by ID, throwing if not found.
   *
   * @param id - The prospect's unique identifier
   * @returns The prospect
   * @throws {NotFoundError} If the prospect doesn't exist
   * @throws {DatabaseError} If the database query fails
   */
  async getByIdOrThrow(id: string): Promise<Prospect> {
    const prospect = await this.getById(id)
    if (!prospect) {
      throw new NotFoundError('Prospect', id)
    }
    return prospect
  }

  /**
   * Create a new prospect.
   *
   * @param data - Prospect data to create
   * @returns The created prospect
   * @throws {ValidationError} If required fields are missing
   * @throws {DatabaseError} If the database insert fails
   */
  async create(data: Partial<Prospect>): Promise<Prospect> {
    if (!data.company_name) {
      throw new ValidationError('company_name is required', { company_name: ['Required field'] })
    }

    try {
      const results = await database.query<Prospect>(
        `INSERT INTO prospects (company_name, state, industry, lien_amount, filing_date, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          data.company_name,
          data.state,
          data.industry,
          data.lien_amount,
          data.filing_date,
          data.status || 'unclaimed'
        ]
      )
      return results[0]
    } catch (error) {
      throw new DatabaseError(
        'Failed to create prospect',
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Update an existing prospect.
   *
   * Dynamically builds the SET clause based on provided fields.
   * Only non-undefined fields are updated.
   *
   * @param id - The prospect's unique identifier
   * @param data - Fields to update
   * @returns The updated prospect
   * @throws {NotFoundError} If the prospect doesn't exist
   * @throws {DatabaseError} If the database update fails
   */
  async update(id: string, data: Partial<Prospect>): Promise<Prospect> {
    // Build SET clause dynamically
    const fields = Object.keys(data).filter((key) => data[key as keyof Prospect] !== undefined)

    if (fields.length === 0) {
      return this.getByIdOrThrow(id)
    }

    const setClause = fields.map((field, i) => `${field} = $${i + 2}`).join(', ')
    const values = [id, ...fields.map((f) => data[f as keyof Prospect])]

    try {
      const results = await database.query<Prospect>(
        `UPDATE prospects SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        values
      )
      if (!results[0]) {
        throw new NotFoundError('Prospect', id)
      }
      return results[0]
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error
      }
      throw new DatabaseError(
        'Failed to update prospect',
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Delete a prospect by ID.
   *
   * @param id - The prospect's unique identifier
   * @returns true if deleted successfully
   * @throws {NotFoundError} If the prospect doesn't exist
   * @throws {DatabaseError} If the database delete fails
   */
  async delete(id: string): Promise<boolean> {
    try {
      const results = await database.query('DELETE FROM prospects WHERE id = $1', [id])
      const deleted = (results as { rowCount: number }).rowCount > 0
      if (!deleted) {
        throw new NotFoundError('Prospect', id)
      }
      return true
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error
      }
      throw new DatabaseError(
        'Failed to delete prospect',
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Claim a prospect for a user.
   *
   * Sets the prospect's status to 'claimed' and records the claiming user
   * and timestamp.
   *
   * @param id - The prospect's unique identifier
   * @param userId - The ID of the user claiming the prospect
   * @returns The updated prospect
   * @throws {NotFoundError} If the prospect doesn't exist
   * @throws {DatabaseError} If the database update fails
   */
  async claim(id: string, userId: string): Promise<Prospect> {
    try {
      const results = await database.query<Prospect>(
        `UPDATE prospects
         SET status = 'claimed', claimed_by = $2, claimed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [id, userId]
      )
      if (!results[0]) {
        throw new NotFoundError('Prospect', id)
      }
      return results[0]
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error
      }
      throw new DatabaseError(
        'Failed to claim prospect',
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Claim multiple prospects in a batch operation.
   *
   * Processes each prospect individually, collecting successes and failures.
   * Limited to 100 prospects per batch for performance.
   *
   * @param ids - Array of prospect IDs to claim
   * @param userId - The ID of the user claiming the prospects
   * @returns Summary of batch operation results
   * @throws {ValidationError} If batch size exceeds 100
   */
  async batchClaim(
    ids: string[],
    userId: string
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const MAX_BATCH_SIZE = 100
    if (ids.length > MAX_BATCH_SIZE) {
      throw new ValidationError(`Batch size exceeds maximum of ${MAX_BATCH_SIZE}`)
    }

    let success = 0
    let failed = 0
    const errors: string[] = []

    for (const id of ids) {
      try {
        await this.claim(id, userId)
        success++
      } catch (error) {
        failed++
        const message = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`${id}: ${message}`)
        console.error(`[ProspectsService] batchClaim failed for id ${id}:`, message)
      }
    }

    return { success, failed, errors }
  }
}
