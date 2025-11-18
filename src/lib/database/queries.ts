/**
 * Database Queries - Typed query helpers
 *
 * Provides type-safe database query functions
 */

import type { Prospect, UCCFiling, GrowthSignal } from '../types'
import { DatabaseClient } from './client'

export interface ProspectRow {
  id: string
  company_name: string
  company_name_normalized: string
  industry: string
  state: string
  status: string
  priority_score: number
  default_date: Date
  time_since_default: number
  last_filing_date: Date | null
  narrative: string | null
  estimated_revenue: number | null
  claimed_by: string | null
  claimed_date: Date | null
  created_at: Date
  updated_at: Date
  last_enriched_at: Date | null
  enrichment_confidence: number | null
}

export interface UCCFilingRow {
  id: string
  external_id: string
  filing_date: Date
  debtor_name: string
  debtor_name_normalized: string
  secured_party: string
  secured_party_normalized: string
  state: string
  lien_amount: number | null
  status: string
  filing_type: string
  source: string
  raw_data: any
  created_at: Date
  updated_at: Date
}

export interface GrowthSignalRow {
  id: string
  prospect_id: string
  type: string
  source: string
  description: string
  detected_date: Date
  confidence: number
  metadata: any
  created_at: Date
}

export class DatabaseQueries {
  constructor(private db: DatabaseClient) {}

  // ============================================================================
  // Prospects
  // ============================================================================

  /**
   * Get all prospects with optional filters
   */
  async getProspects(filters?: {
    status?: string
    industry?: string
    state?: string
    minScore?: number
    limit?: number
    offset?: number
  }): Promise<ProspectRow[]> {
    let sql = 'SELECT * FROM prospects WHERE 1=1'
    const params: any[] = []
    let paramIndex = 1

    if (filters?.status) {
      sql += ` AND status = $${paramIndex++}`
      params.push(filters.status)
    }

    if (filters?.industry) {
      sql += ` AND industry = $${paramIndex++}`
      params.push(filters.industry)
    }

    if (filters?.state) {
      sql += ` AND state = $${paramIndex++}`
      params.push(filters.state)
    }

    if (filters?.minScore !== undefined) {
      sql += ` AND priority_score >= $${paramIndex++}`
      params.push(filters.minScore)
    }

    sql += ' ORDER BY priority_score DESC, default_date DESC'

    if (filters?.limit) {
      sql += ` LIMIT $${paramIndex++}`
      params.push(filters.limit)
    }

    if (filters?.offset) {
      sql += ` OFFSET $${paramIndex++}`
      params.push(filters.offset)
    }

    return await this.db.queryMany<ProspectRow>(sql, params)
  }

  /**
   * Get a single prospect by ID
   */
  async getProspectById(id: string): Promise<ProspectRow | null> {
    return await this.db.queryOne<ProspectRow>(
      'SELECT * FROM prospects WHERE id = $1',
      [id]
    )
  }

  /**
   * Search prospects by company name (fuzzy)
   */
  async searchProspects(query: string, limit: number = 20): Promise<ProspectRow[]> {
    const normalized = query.toLowerCase().trim()
    return await this.db.queryMany<ProspectRow>(
      `SELECT * FROM prospects
       WHERE company_name_normalized % $1
       ORDER BY similarity(company_name_normalized, $1) DESC
       LIMIT $2`,
      [normalized, limit]
    )
  }

  /**
   * Create a new prospect
   */
  async createProspect(data: {
    companyName: string
    industry: string
    state: string
    priorityScore: number
    defaultDate: Date
    timeSinceDefault: number
    lastFilingDate?: Date
    narrative?: string
    estimatedRevenue?: number
  }): Promise<ProspectRow> {
    const result = await this.db.queryOne<ProspectRow>(
      `INSERT INTO prospects (
        company_name, company_name_normalized, industry, state,
        priority_score, default_date, time_since_default,
        last_filing_date, narrative, estimated_revenue
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        data.companyName,
        data.companyName.toLowerCase().trim(),
        data.industry,
        data.state,
        data.priorityScore,
        data.defaultDate,
        data.timeSinceDefault,
        data.lastFilingDate || null,
        data.narrative || null,
        data.estimatedRevenue || null
      ]
    )

    if (!result) {
      throw new Error('Failed to create prospect')
    }

    return result
  }

  /**
   * Update prospect
   */
  async updateProspect(id: string, data: Partial<{
    status: string
    priorityScore: number
    narrative: string
    estimatedRevenue: number
    claimedBy: string
    claimedDate: Date
  }>): Promise<ProspectRow | null> {
    const updates: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex++}`)
      params.push(data.status)
    }

    if (data.priorityScore !== undefined) {
      updates.push(`priority_score = $${paramIndex++}`)
      params.push(data.priorityScore)
    }

    if (data.narrative !== undefined) {
      updates.push(`narrative = $${paramIndex++}`)
      params.push(data.narrative)
    }

    if (data.estimatedRevenue !== undefined) {
      updates.push(`estimated_revenue = $${paramIndex++}`)
      params.push(data.estimatedRevenue)
    }

    if (data.claimedBy !== undefined) {
      updates.push(`claimed_by = $${paramIndex++}, claimed_date = $${paramIndex++}`)
      params.push(data.claimedBy, data.claimedDate || new Date())
    }

    if (updates.length === 0) {
      return await this.getProspectById(id)
    }

    updates.push(`updated_at = NOW()`)
    params.push(id)

    const sql = `
      UPDATE prospects
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `

    return await this.db.queryOne<ProspectRow>(sql, params)
  }

  /**
   * Delete prospect
   */
  async deleteProspect(id: string): Promise<boolean> {
    const result = await this.db.query(
      'DELETE FROM prospects WHERE id = $1',
      [id]
    )
    return (result.rowCount || 0) > 0
  }

  // ============================================================================
  // UCC Filings
  // ============================================================================

  /**
   * Get UCC filings for a prospect
   */
  async getProspectUCCFilings(prospectId: string): Promise<UCCFilingRow[]> {
    return await this.db.queryMany<UCCFilingRow>(
      `SELECT uf.* FROM ucc_filings uf
       INNER JOIN prospect_ucc_filings puf ON uf.id = puf.ucc_filing_id
       WHERE puf.prospect_id = $1
       ORDER BY uf.filing_date DESC`,
      [prospectId]
    )
  }

  /**
   * Create UCC filing
   */
  async createUCCFiling(data: {
    externalId: string
    filingDate: Date
    debtorName: string
    securedParty: string
    state: string
    lienAmount?: number
    status: string
    filingType: string
    source: string
    rawData?: any
  }): Promise<UCCFilingRow> {
    const result = await this.db.queryOne<UCCFilingRow>(
      `INSERT INTO ucc_filings (
        external_id, filing_date, debtor_name, debtor_name_normalized,
        secured_party, secured_party_normalized, state, lien_amount,
        status, filing_type, source, raw_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (external_id) DO UPDATE SET
        status = EXCLUDED.status,
        updated_at = NOW()
      RETURNING *`,
      [
        data.externalId,
        data.filingDate,
        data.debtorName,
        data.debtorName.toLowerCase().trim(),
        data.securedParty,
        data.securedParty.toLowerCase().trim(),
        data.state,
        data.lienAmount || null,
        data.status,
        data.filingType,
        data.source,
        data.rawData ? JSON.stringify(data.rawData) : null
      ]
    )

    if (!result) {
      throw new Error('Failed to create UCC filing')
    }

    return result
  }

  /**
   * Link UCC filing to prospect
   */
  async linkUCCFilingToProspect(prospectId: string, uccFilingId: string): Promise<void> {
    await this.db.query(
      `INSERT INTO prospect_ucc_filings (prospect_id, ucc_filing_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [prospectId, uccFilingId]
    )
  }

  // ============================================================================
  // Growth Signals
  // ============================================================================

  /**
   * Get growth signals for a prospect
   */
  async getProspectGrowthSignals(prospectId: string): Promise<GrowthSignalRow[]> {
    return await this.db.queryMany<GrowthSignalRow>(
      `SELECT * FROM growth_signals
       WHERE prospect_id = $1
       ORDER BY detected_date DESC`,
      [prospectId]
    )
  }

  /**
   * Create growth signal
   */
  async createGrowthSignal(data: {
    prospectId: string
    type: string
    source: string
    description: string
    detectedDate: Date
    confidence: number
    metadata?: any
  }): Promise<GrowthSignalRow> {
    const result = await this.db.queryOne<GrowthSignalRow>(
      `INSERT INTO growth_signals (
        prospect_id, type, source, description,
        detected_date, confidence, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        data.prospectId,
        data.type,
        data.source,
        data.description,
        data.detectedDate,
        data.confidence,
        data.metadata ? JSON.stringify(data.metadata) : null
      ]
    )

    if (!result) {
      throw new Error('Failed to create growth signal')
    }

    return result
  }

  // ============================================================================
  // Statistics & Analytics
  // ============================================================================

  /**
   * Get prospect statistics
   */
  async getProspectStats(): Promise<{
    total: number
    byStatus: Record<string, number>
    byIndustry: Record<string, number>
    avgScore: number
  }> {
    const [
      totalResult,
      byStatusResult,
      byIndustryResult,
      avgScoreResult
    ] = await Promise.all([
      this.db.queryOne<{ count: string }>('SELECT COUNT(*)::text as count FROM prospects'),
      this.db.queryMany<{ status: string; count: string }>('SELECT status, COUNT(*)::text as count FROM prospects GROUP BY status'),
      this.db.queryMany<{ industry: string; count: string }>('SELECT industry, COUNT(*)::text as count FROM prospects GROUP BY industry'),
      this.db.queryOne<{ avg: string }>('SELECT AVG(priority_score)::text as avg FROM prospects')
    ])

    return {
      total: parseInt(totalResult?.count || '0', 10),
      byStatus: Object.fromEntries(byStatusResult.map(r => [r.status, parseInt(r.count, 10)])),
      byIndustry: Object.fromEntries(byIndustryResult.map(r => [r.industry, parseInt(r.count, 10)])),
      avgScore: parseFloat(avgScoreResult?.avg || '0')
    }
  }
}

/**
 * Create database queries instance
 */
export function createQueries(db: DatabaseClient): DatabaseQueries {
  return new DatabaseQueries(db)
}
