/**
 * AuditService
 *
 * Service layer for querying and exporting audit logs. Provides:
 * - Entity history retrieval
 * - Audit log search with filtering
 * - Compliance export in CSV/JSON formats
 *
 * Note: Audit logs are immutable - this service is read-only.
 */

import { database } from '../database/connection'
import { DatabaseError, ValidationError } from '../errors'
import type { AuditLog } from '@public-records/core'

// Database row type
interface AuditLogRow {
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
  created_at: string
}

// Search filters
interface AuditSearchFilters {
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
interface PaginationParams {
  page?: number
  limit?: number
  sortOrder?: 'asc' | 'desc'
}

// Date range for compliance exports
interface DateRange {
  start: Date
  end: Date
}

// Export format options
type ExportFormat = 'json' | 'csv'

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
      createdAt: row.created_at
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
      return results.map(this.transformAuditLog)
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
    const {
      page = 1,
      limit = 50,
      sortOrder = 'desc'
    } = pagination

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
      const results = await database.query<AuditLogRow>(
        query,
        [...values, limit, offset]
      )

      // Get total count
      const countQuery = `SELECT COUNT(*) as count FROM audit_logs ${whereClause}`
      const countResult = await database.query<{ count: string }>(countQuery, values)
      const total = parseInt(countResult[0]?.count || '0')

      return {
        logs: results.map(this.transformAuditLog),
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
  ): Promise<{
    entityType: string
    totalChanges: number
    creates: number
    updates: number
    deletes: number
    uniqueEntities: number
    uniqueUsers: number
  }[]> {
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
      const values: unknown[] = [
        orgId,
        dateRange.start.toISOString(),
        dateRange.end.toISOString()
      ]
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

      const logs = results.map(this.transformAuditLog)

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
      'Request ID'
    ]

    const escapeCsvValue = (value: unknown): string => {
      if (value === null || value === undefined) return ''
      const str = typeof value === 'object' ? JSON.stringify(value) : String(value)
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
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
      log.requestId || ''
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
        recentActions: recentActions.map(this.transformAuditLog)
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
      return results.map(this.transformAuditLog)
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
  ): Promise<{
    userId: string
    hour: string
    actionCount: number
    entityTypes: string[]
  }[]> {
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
