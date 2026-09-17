/**
 * AuditService
 *
 * Service layer for creating, querying, verifying, and exporting audit logs.
 * Provides:
 * - Cryptographic hash chaining (prev_hash -> record_hash) for SOC2 immutability
 * - Tamper-evident integrity verification across chronological audit chains
 * - Sensitive access logging (read/export auditing) and system modification logging
 * - Entity history retrieval
 * - Audit log search with filtering
 * - Compliance export in CSV/JSON formats and SOC2 compliance package bundling
 *
 * Note: Audit logs are immutable in the database via triggers preventing update/delete/truncate.
 */

import crypto from 'crypto'
import { database } from '../database/connection'
import { DatabaseError, ValidationError } from '../errors'
import type { AuditLog } from '@public-records/core'

export const GENESIS_HASH = '0'.repeat(64)

/**
 * Deterministic JSON canonicalization for hashing
 */
export function canonicalizeJson(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value !== 'object') return String(value)
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalizeJson).join(',') + ']'
  }
  const obj = value as Record<string, unknown>
  const sortedKeys = Object.keys(obj).sort()
  return (
    '{' + sortedKeys.map((k) => `${JSON.stringify(k)}:${canonicalizeJson(obj[k])}`).join(',') + '}'
  )
}

/**
 * Validates and cleans IP address string to safe IPv4 or IPv6 format
 */
export function cleanIp(ip: string | undefined | null): string | null {
  if (!ip) return null
  const first = ip.split(',')[0].trim()
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(first) || /^[0-9a-fA-F:]+$/.test(first)) {
    return first
  }
  return null
}

/**
 * Computes SHA-256 record hash binding preceding hash to current audit record state
 */
export function computeRecordHash(params: {
  prevHash: string
  orgId?: string | null
  userId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  changes?: unknown
  beforeState?: unknown
  afterState?: unknown
  ipAddress?: string | null
  userAgent?: string | null
  requestId?: string | null
  createdAt: string
}): string {
  const parts = [
    params.prevHash || GENESIS_HASH,
    params.orgId || '',
    params.userId || '',
    params.action || '',
    params.entityType || '',
    params.entityId || '',
    canonicalizeJson(params.changes),
    canonicalizeJson(params.beforeState),
    canonicalizeJson(params.afterState),
    params.ipAddress || '',
    params.userAgent || '',
    params.requestId || '',
    params.createdAt
  ]
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex')
}

// Database row type
export interface AuditLogRow {
  id: string
  org_id?: string
  user_id?: string
  action: string
  entity_type: string
  entity_id?: string
  changes?: Record<string, { old: unknown; new: unknown }>
  before_state?: Record<string, unknown>
  after_state?: Record<string, unknown>
  ip_address?: string
  user_agent?: string
  request_id?: string
  prev_hash?: string
  record_hash?: string
  created_at: string
}

export interface CreateAuditEntryInput {
  id?: string
  orgId?: string
  userId?: string
  action: string
  entityType: string
  entityId?: string
  changes?: Record<string, { old: unknown; new: unknown }>
  beforeState?: Record<string, unknown>
  afterState?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  requestId?: string
  createdAt?: string
}

export interface IntegrityViolation {
  logId: string
  sequenceIndex: number
  reason: string
  expectedHash?: string
  actualHash?: string
}

export interface AuditIntegrityResult {
  valid: boolean
  totalChecked: number
  rootHash?: string
  latestHash?: string
  violations: IntegrityViolation[]
  verifiedAt: string
}

export interface CompliancePackageOptions {
  startDate: Date
  endDate: Date
  format?: 'json' | 'csv'
  entityType?: string
  userId?: string
  action?: string
}

export interface ComplianceAuditPackage {
  packageId: string
  organizationId: string
  generatedAt: string
  dateRange: { start: string; end: string }
  totalRecords: number
  integrity: AuditIntegrityResult
  manifest: {
    hashAlgorithm: string
    rootHash?: string
    latestHash?: string
    signature: string
  }
  logs: AuditLog[]
}

// Search filters
export interface AuditSearchFilters {
  orgId?: string
  userId?: string
  entityType?: string
  entityId?: string
  action?: string
  startDate?: Date
  endDate?: Date
  ipAddress?: string
  requestId?: string
}

// Pagination params
export interface PaginationParams {
  page?: number
  limit?: number
  sortOrder?: 'asc' | 'desc'
}

// Date range for compliance exports
export interface DateRange {
  start: Date
  end: Date
}

// Export format options
export type ExportFormat = 'json' | 'csv'

export class AuditService {
  /**
   * Transform database row to AuditLog type
   */
  private transformAuditLog(row: AuditLogRow): AuditLog {
    return {
      id: row.id,
      orgId: row.org_id,
      userId: row.user_id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      changes: row.changes,
      beforeState: row.before_state,
      afterState: row.after_state,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      requestId: row.request_id,
      prevHash: row.prev_hash,
      recordHash: row.record_hash,
      createdAt: row.created_at
    }
  }

  /**
   * Create an immutable audit log entry with cryptographic hash chaining
   */
  async createAuditEntry(input: CreateAuditEntryInput): Promise<AuditLog> {
    try {
      const createdAt = input.createdAt || new Date().toISOString()
      const orgId = input.orgId || null

      // Fetch preceding record hash for hash chaining
      let prevHash = GENESIS_HASH
      const prevQuery = orgId
        ? `SELECT record_hash FROM audit_logs WHERE org_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1`
        : `SELECT record_hash FROM audit_logs WHERE org_id IS NULL ORDER BY created_at DESC, id DESC LIMIT 1`
      const prevParams = orgId ? [orgId] : []
      const prevResult = await database.query<{ record_hash: string | null }>(prevQuery, prevParams)

      if (prevResult && prevResult.length > 0 && prevResult[0]?.record_hash) {
        prevHash = prevResult[0].record_hash
      }

      const recordHash = computeRecordHash({
        prevHash,
        orgId: input.orgId,
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        changes: input.changes,
        beforeState: input.beforeState,
        afterState: input.afterState,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        requestId: input.requestId,
        createdAt
      })

      const cleanedIp = cleanIp(input.ipAddress)

      const insertQuery = `
        INSERT INTO audit_logs (
          id, org_id, user_id, action, entity_type, entity_id,
          changes, before_state, after_state,
          ip_address, user_agent, request_id,
          prev_hash, record_hash, created_at
        ) VALUES (
          COALESCE($1, uuid_generate_v4()), $2, $3, $4, $5, $6,
          $7, $8, $9,
          $10::inet, $11, $12,
          $13, $14, $15
        ) RETURNING *
      `

      const values = [
        input.id || null,
        orgId,
        input.userId || null,
        input.action,
        input.entityType,
        input.entityId || null,
        input.changes ? JSON.stringify(input.changes) : null,
        input.beforeState ? JSON.stringify(input.beforeState) : null,
        input.afterState ? JSON.stringify(input.afterState) : null,
        cleanedIp,
        input.userAgent || null,
        input.requestId || null,
        prevHash,
        recordHash,
        createdAt
      ]

      const result = await database.query<AuditLogRow>(insertQuery, values)
      if (result && result[0]) {
        return this.transformAuditLog(result[0])
      }

      return {
        id: input.id || 'generated-id',
        orgId: input.orgId,
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        changes: input.changes,
        beforeState: input.beforeState,
        afterState: input.afterState,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        requestId: input.requestId,
        prevHash,
        recordHash,
        createdAt
      }
    } catch (error) {
      throw new DatabaseError(
        'Failed to create audit log entry',
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Log sensitive data access (read/export operations)
   */
  async logAccess(params: {
    orgId?: string
    userId?: string
    entityType: string
    entityId?: string
    ipAddress?: string
    userAgent?: string
    requestId?: string
    metadata?: Record<string, unknown>
  }): Promise<AuditLog> {
    return this.createAuditEntry({
      orgId: params.orgId,
      userId: params.userId,
      action: 'access',
      entityType: params.entityType,
      entityId: params.entityId,
      afterState: params.metadata,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      requestId: params.requestId
    })
  }

  /**
   * Log administrative / system modification operations
   */
  async logModification(params: {
    orgId?: string
    userId?: string
    action: string
    entityType: string
    entityId?: string
    beforeState?: Record<string, unknown>
    afterState?: Record<string, unknown>
    changes?: Record<string, { old: unknown; new: unknown }>
    ipAddress?: string
    userAgent?: string
    requestId?: string
  }): Promise<AuditLog> {
    return this.createAuditEntry({
      orgId: params.orgId,
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      beforeState: params.beforeState,
      afterState: params.afterState,
      changes: params.changes,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      requestId: params.requestId
    })
  }

  /**
   * Verify cryptographic integrity of audit logs across a hash chain
   */
  async verifyLogIntegrity(
    options: {
      orgId?: string
      startDate?: Date
      endDate?: Date
    } = {}
  ): Promise<AuditIntegrityResult> {
    try {
      const conditions: string[] = []
      const values: unknown[] = []
      let paramCount = 1

      if (options.orgId) {
        conditions.push(`org_id = $${paramCount++}`)
        values.push(options.orgId)
      }

      if (options.startDate) {
        conditions.push(`created_at >= $${paramCount++}`)
        values.push(options.startDate.toISOString())
      }

      if (options.endDate) {
        conditions.push(`created_at <= $${paramCount++}`)
        values.push(options.endDate.toISOString())
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
      const query = `
        SELECT * FROM audit_logs
        ${whereClause}
        ORDER BY created_at ASC, id ASC
      `

      const rows = await database.query<AuditLogRow>(query, values)
      const logs = rows.map((row) => this.transformAuditLog(row))

      const violations: IntegrityViolation[] = []
      let prevExpectedHash: string | null = null
      const isStartFromGenesis = !options.startDate

      for (let i = 0; i < logs.length; i++) {
        const log = logs[i]
        const expectedRecordHash = computeRecordHash({
          prevHash: log.prevHash || GENESIS_HASH,
          orgId: log.orgId,
          userId: log.userId,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          changes: log.changes,
          beforeState: log.beforeState,
          afterState: log.afterState,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          requestId: log.requestId,
          createdAt: log.createdAt
        })

        // Check 1: Record hash matches recomputed hash
        if (!log.recordHash || log.recordHash !== expectedRecordHash) {
          violations.push({
            logId: log.id,
            sequenceIndex: i,
            reason: `Record hash tampering detected: stored hash ${log.recordHash} does not match computed hash ${expectedRecordHash}`,
            expectedHash: expectedRecordHash,
            actualHash: log.recordHash
          })
        }

        // Check 2: Hash chain linkage
        if (i === 0 && isStartFromGenesis) {
          if (log.prevHash && log.prevHash !== GENESIS_HASH) {
            violations.push({
              logId: log.id,
              sequenceIndex: i,
              reason: `Genesis log prev_hash broken: expected ${GENESIS_HASH}, got ${log.prevHash}`,
              expectedHash: GENESIS_HASH,
              actualHash: log.prevHash
            })
          }
        } else if (i > 0 && prevExpectedHash) {
          if (log.prevHash !== prevExpectedHash) {
            violations.push({
              logId: log.id,
              sequenceIndex: i,
              reason: `Hash chain broken: prev_hash ${log.prevHash} does not match preceding record_hash ${prevExpectedHash}`,
              expectedHash: prevExpectedHash,
              actualHash: log.prevHash
            })
          }
        }

        prevExpectedHash = log.recordHash || expectedRecordHash
      }

      const rootHash = logs.length > 0 ? logs[0].recordHash || undefined : undefined
      const latestHash = logs.length > 0 ? logs[logs.length - 1].recordHash || undefined : undefined

      return {
        valid: violations.length === 0,
        totalChecked: logs.length,
        rootHash,
        latestHash,
        violations,
        verifiedAt: new Date().toISOString()
      }
    } catch (error) {
      throw new DatabaseError(
        'Failed to verify audit log integrity',
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Export comprehensive SOC2 compliance audit package with tamper-evident signature
   */
  async exportCompliancePackage(
    orgId: string,
    options: CompliancePackageOptions
  ): Promise<ComplianceAuditPackage> {
    if (options.startDate > options.endDate) {
      throw new ValidationError('Start date must be before end date')
    }

    const integrity = await this.verifyLogIntegrity({
      orgId,
      startDate: options.startDate,
      endDate: options.endDate
    })

    const rawExport = await this.exportForCompliance(
      orgId,
      { start: options.startDate, end: options.endDate },
      'json',
      {
        entityType: options.entityType,
        userId: options.userId,
        action: options.action
      }
    )

    const logs = rawExport as AuditLog[]
    const packageId = crypto.randomUUID()
    const generatedAt = new Date().toISOString()

    const manifestPayload = JSON.stringify({
      packageId,
      orgId,
      generatedAt,
      totalRecords: logs.length,
      rootHash: integrity.rootHash,
      latestHash: integrity.latestHash,
      valid: integrity.valid
    })

    const signature = crypto.createHash('sha256').update(manifestPayload).digest('hex')

    return {
      packageId,
      organizationId: orgId,
      generatedAt,
      dateRange: {
        start: options.startDate.toISOString(),
        end: options.endDate.toISOString()
      },
      totalRecords: logs.length,
      integrity,
      manifest: {
        hashAlgorithm: 'SHA-256',
        rootHash: integrity.rootHash,
        latestHash: integrity.latestHash,
        signature
      },
      logs
    }
  }

  /**
   * Get complete history of changes for a specific entity
   * Ordered from oldest to newest to show chronological progression
   */
  async getEntityHistory(
    entityType: string,
    entityId: string,
    options: { orgId?: string; limit?: number } = {}
  ): Promise<AuditLog[]> {
    const { orgId, limit = 100 } = options

    try {
      let query = `
        SELECT * FROM audit_logs
        WHERE entity_type = $1 AND entity_id = $2
      `
      const values: unknown[] = [entityType, entityId]
      let paramCount = 3

      if (orgId) {
        query += ` AND org_id = $${paramCount++}`
        values.push(orgId)
      }

      query += ` ORDER BY created_at ASC LIMIT $${paramCount}`
      values.push(limit)

      const results = await database.query<AuditLogRow>(query, values)
      return results.map((r) => this.transformAuditLog(r))
    } catch (error) {
      throw new DatabaseError(
        'Failed to get entity history',
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Search audit logs with various filters
   * Supports pagination and date range filtering
   */
  async searchAuditLogs(
    filters: AuditSearchFilters,
    pagination: PaginationParams = {}
  ): Promise<{
    logs: AuditLog[]
    total: number
    page: number
    limit: number
  }> {
    const { page = 1, limit = 50, sortOrder = 'desc' } = pagination

    const conditions: string[] = []
    const values: unknown[] = []
    let paramCount = 1

    if (filters.orgId) {
      conditions.push(`org_id = $${paramCount++}`)
      values.push(filters.orgId)
    }

    if (filters.userId) {
      conditions.push(`user_id = $${paramCount++}`)
      values.push(filters.userId)
    }

    if (filters.entityType) {
      conditions.push(`entity_type = $${paramCount++}`)
      values.push(filters.entityType)
    }

    if (filters.entityId) {
      conditions.push(`entity_id = $${paramCount++}`)
      values.push(filters.entityId)
    }

    if (filters.action) {
      conditions.push(`action = $${paramCount++}`)
      values.push(filters.action)
    }

    if (filters.startDate) {
      conditions.push(`created_at >= $${paramCount++}`)
      values.push(filters.startDate.toISOString())
    }

    if (filters.endDate) {
      conditions.push(`created_at <= $${paramCount++}`)
      values.push(filters.endDate.toISOString())
    }

    if (filters.ipAddress) {
      conditions.push(`ip_address = $${paramCount++}::inet`)
      values.push(filters.ipAddress)
    }

    if (filters.requestId) {
      conditions.push(`request_id = $${paramCount++}`)
      values.push(filters.requestId)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC'
    const offset = (page - 1) * limit

    try {
      // Get paginated results
      const query = `
        SELECT * FROM audit_logs
        ${whereClause}
        ORDER BY created_at ${safeSortOrder}
        LIMIT $${paramCount} OFFSET $${paramCount + 1}
      `
      const results = await database.query<AuditLogRow>(query, [...values, limit, offset])

      // Get total count
      const countQuery = `SELECT COUNT(*) as count FROM audit_logs ${whereClause}`
      const countResult = await database.query<{ count: string }>(countQuery, values)
      const total = parseInt(countResult[0]?.count || '0')

      return {
        logs: results.map((r) => this.transformAuditLog(r)),
        total,
        page,
        limit
      }
    } catch (error) {
      throw new DatabaseError(
        'Failed to search audit logs',
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Get audit logs grouped by entity for compliance review
   */
  async getAuditSummary(
    orgId: string,
    dateRange: DateRange
  ): Promise<
    {
      entityType: string
      totalChanges: number
      creates: number
      updates: number
      deletes: number
      uniqueEntities: number
      uniqueUsers: number
    }[]
  > {
    try {
      const results = await database.query<{
        entity_type: string
        total_changes: string
        creates: string
        updates: string
        deletes: string
        unique_entities: string
        unique_users: string
      }>(
        `SELECT
          entity_type,
          COUNT(*) as total_changes,
          COUNT(CASE WHEN action = 'create' THEN 1 END) as creates,
          COUNT(CASE WHEN action = 'update' THEN 1 END) as updates,
          COUNT(CASE WHEN action = 'delete' THEN 1 END) as deletes,
          COUNT(DISTINCT entity_id) as unique_entities,
          COUNT(DISTINCT user_id) as unique_users
        FROM audit_logs
        WHERE org_id = $1
          AND created_at >= $2
          AND created_at <= $3
        GROUP BY entity_type
        ORDER BY total_changes DESC`,
        [orgId, dateRange.start.toISOString(), dateRange.end.toISOString()]
      )

      return results.map((row) => ({
        entityType: row.entity_type,
        totalChanges: parseInt(row.total_changes),
        creates: parseInt(row.creates),
        updates: parseInt(row.updates),
        deletes: parseInt(row.deletes),
        uniqueEntities: parseInt(row.unique_entities),
        uniqueUsers: parseInt(row.unique_users)
      }))
    } catch (error) {
      throw new DatabaseError(
        'Failed to get audit summary',
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Export audit trail for compliance purposes
   * Returns data in requested format (JSON or CSV)
   */
  async exportForCompliance(
    orgId: string,
    dateRange: DateRange,
    format: ExportFormat = 'json',
    filters: Partial<AuditSearchFilters> = {}
  ): Promise<Buffer | AuditLog[]> {
    // Validate date range
    if (dateRange.start > dateRange.end) {
      throw new ValidationError('Start date must be before end date')
    }

    // Limit export to 1 year of data
    const maxRangeMs = 365 * 24 * 60 * 60 * 1000 // 1 year in ms
    if (dateRange.end.getTime() - dateRange.start.getTime() > maxRangeMs) {
      throw new ValidationError('Export date range cannot exceed 1 year')
    }

    try {
      const conditions: string[] = ['org_id = $1', 'created_at >= $2', 'created_at <= $3']
      const values: unknown[] = [orgId, dateRange.start.toISOString(), dateRange.end.toISOString()]
      let paramCount = 4

      if (filters.entityType) {
        conditions.push(`entity_type = $${paramCount++}`)
        values.push(filters.entityType)
      }

      if (filters.userId) {
        conditions.push(`user_id = $${paramCount++}`)
        values.push(filters.userId)
      }

      if (filters.action) {
        conditions.push(`action = $${paramCount++}`)
        values.push(filters.action)
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`

      const results = await database.query<AuditLogRow>(
        `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at ASC`,
        values
      )

      const logs = results.map((r) => this.transformAuditLog(r))

      if (format === 'json') {
        return logs
      }

      // Generate CSV
      return this.generateCsv(logs)
    } catch (error) {
      if (error instanceof ValidationError) throw error
      throw new DatabaseError(
        'Failed to export audit logs',
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Generate CSV from audit logs
   */
  private generateCsv(logs: AuditLog[]): Buffer {
    const headers = [
      'ID',
      'Timestamp',
      'User ID',
      'Action',
      'Entity Type',
      'Entity ID',
      'Changes',
      'IP Address',
      'User Agent',
      'Request ID',
      'Prev Hash',
      'Record Hash'
    ]

    const escapeCsvValue = (value: unknown): string => {
      if (value === null || value === undefined) return ''
      const str = typeof value === 'object' ? JSON.stringify(value) : String(value)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const rows = logs.map((log) => [
      log.id,
      log.createdAt,
      log.userId || '',
      log.action,
      log.entityType,
      log.entityId || '',
      log.changes ? JSON.stringify(log.changes) : '',
      log.ipAddress || '',
      log.userAgent || '',
      log.requestId || '',
      log.prevHash || '',
      log.recordHash || ''
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map(escapeCsvValue).join(','))
    ].join('\n')

    return Buffer.from(csvContent, 'utf-8')
  }

  /**
   * Get user activity report
   */
  async getUserActivity(
    orgId: string,
    userId: string,
    dateRange: DateRange
  ): Promise<{
    userId: string
    totalActions: number
    actionBreakdown: Record<string, number>
    entityBreakdown: Record<string, number>
    recentActions: AuditLog[]
  }> {
    try {
      // Get action counts
      const actionStats = await database.query<{
        action: string
        count: string
      }>(
        `SELECT action, COUNT(*) as count
        FROM audit_logs
        WHERE org_id = $1 AND user_id = $2
          AND created_at >= $3 AND created_at <= $4
        GROUP BY action`,
        [orgId, userId, dateRange.start.toISOString(), dateRange.end.toISOString()]
      )

      // Get entity type counts
      const entityStats = await database.query<{
        entity_type: string
        count: string
      }>(
        `SELECT entity_type, COUNT(*) as count
        FROM audit_logs
        WHERE org_id = $1 AND user_id = $2
          AND created_at >= $3 AND created_at <= $4
        GROUP BY entity_type`,
        [orgId, userId, dateRange.start.toISOString(), dateRange.end.toISOString()]
      )

      // Get recent actions
      const recentActions = await database.query<AuditLogRow>(
        `SELECT * FROM audit_logs
        WHERE org_id = $1 AND user_id = $2
          AND created_at >= $3 AND created_at <= $4
        ORDER BY created_at DESC
        LIMIT 50`,
        [orgId, userId, dateRange.start.toISOString(), dateRange.end.toISOString()]
      )

      const actionBreakdown: Record<string, number> = {}
      let totalActions = 0
      for (const row of actionStats) {
        actionBreakdown[row.action] = parseInt(row.count)
        totalActions += parseInt(row.count)
      }

      const entityBreakdown: Record<string, number> = {}
      for (const row of entityStats) {
        entityBreakdown[row.entity_type] = parseInt(row.count)
      }

      return {
        userId,
        totalActions,
        actionBreakdown,
        entityBreakdown,
        recentActions: recentActions.map((r) => this.transformAuditLog(r))
      }
    } catch (error) {
      throw new DatabaseError(
        'Failed to get user activity',
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Get audit logs for a specific request (for debugging/investigation)
   */
  async getByRequestId(requestId: string): Promise<AuditLog[]> {
    try {
      const results = await database.query<AuditLogRow>(
        'SELECT * FROM audit_logs WHERE request_id = $1 ORDER BY created_at ASC',
        [requestId]
      )
      return results.map((r) => this.transformAuditLog(r))
    } catch (error) {
      throw new DatabaseError(
        'Failed to get audit logs by request ID',
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Get high-volume change alerts (for detecting unusual activity)
   */
  async getHighVolumeAlerts(
    orgId: string,
    options: {
      thresholdPerHour?: number
      hoursBack?: number
    } = {}
  ): Promise<
    {
      userId: string
      hour: string
      actionCount: number
      entityTypes: string[]
    }[]
  > {
    const { thresholdPerHour = 100, hoursBack = 24 } = options

    try {
      const results = await database.query<{
        user_id: string
        hour: string
        action_count: string
        entity_types: string[]
      }>(
        `SELECT
          user_id,
          date_trunc('hour', created_at) as hour,
          COUNT(*) as action_count,
          array_agg(DISTINCT entity_type) as entity_types
        FROM audit_logs
        WHERE org_id = $1
          AND created_at >= NOW() - ($2 || ' hours')::interval
          AND user_id IS NOT NULL
        GROUP BY user_id, date_trunc('hour', created_at)
        HAVING COUNT(*) >= $3
        ORDER BY hour DESC, action_count DESC`,
        [orgId, hoursBack.toString(), thresholdPerHour]
      )

      return results.map((row) => ({
        userId: row.user_id,
        hour: row.hour,
        actionCount: parseInt(row.action_count),
        entityTypes: row.entity_types
      }))
    } catch (error) {
      throw new DatabaseError(
        'Failed to get high-volume alerts',
        error instanceof Error ? error : undefined
      )
    }
  }
}

// Export singleton instance
export const auditService = new AuditService()
