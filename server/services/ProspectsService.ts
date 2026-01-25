import { database } from '../database/connection'
import type { Prospect } from '../../src/lib/types'
import { NotFoundError, DatabaseError, ValidationError } from '../errors'

// Allowlist of valid columns for sorting - prevents SQL injection
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

function validateSortColumn(column: string): AllowedSortColumn {
  if (ALLOWED_SORT_COLUMNS.includes(column as AllowedSortColumn)) {
    return column as AllowedSortColumn
  }
  return 'priority_score' // Safe default
}

interface ListParams {
  page: number
  limit: number
  state?: string
  industry?: string
  min_score?: number
  max_score?: number
  status?: 'all' | 'unclaimed' | 'claimed' | 'contacted'
  sort_by: string
  sort_order: 'asc' | 'desc'
}

interface ListResult {
  prospects: Prospect[]
  page: number
  limit: number
  total: number
}

export class ProspectsService {
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

  async getById(id: string): Promise<Prospect | null> {
    try {
      const results = await database.query<Prospect>('SELECT * FROM prospects WHERE id = $1', [id])
      return results[0] || null
    } catch (error) {
      throw new DatabaseError('Failed to get prospect', error instanceof Error ? error : undefined)
    }
  }

  async getByIdOrThrow(id: string): Promise<Prospect> {
    const prospect = await this.getById(id)
    if (!prospect) {
      throw new NotFoundError('Prospect', id)
    }
    return prospect
  }

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
