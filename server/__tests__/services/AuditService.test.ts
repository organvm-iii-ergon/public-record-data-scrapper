import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  AuditService,
  computeRecordHash,
  canonicalizeJson,
  cleanIp,
  GENESIS_HASH
} from '../../services/AuditService'
import { DatabaseError, ValidationError } from '../../errors'

// Mock the database module
vi.mock('../../database/connection', () => ({
  database: {
    query: vi.fn()
  }
}))

import { database } from '../../database/connection'

const mockQuery = vi.mocked(database.query)

describe('AuditService', () => {
  let service: AuditService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AuditService()
  })

  describe('getEntityHistory', () => {
    it('should return history for an entity', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          org_id: 'org-1',
          user_id: 'user-1',
          action: 'create',
          entity_type: 'prospect',
          entity_id: 'prospect-1',
          created_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'log-2',
          org_id: 'org-1',
          user_id: 'user-1',
          action: 'update',
          entity_type: 'prospect',
          entity_id: 'prospect-1',
          created_at: '2024-01-02T00:00:00Z'
        }
      ]

      mockQuery.mockResolvedValueOnce(mockLogs)

      const result = await service.getEntityHistory('prospect', 'prospect-1')

      expect(result).toHaveLength(2)
      expect(result[0].action).toBe('create')
      expect(result[1].action).toBe('update')
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE entity_type = $1 AND entity_id = $2'),
        expect.arrayContaining(['prospect', 'prospect-1'])
      )
    })

    it('should filter by orgId when provided', async () => {
      mockQuery.mockResolvedValueOnce([])

      await service.getEntityHistory('prospect', 'prospect-1', { orgId: 'org-1' })

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND org_id = $3'),
        expect.arrayContaining(['prospect', 'prospect-1', 'org-1'])
      )
    })

    it('should respect limit option', async () => {
      mockQuery.mockResolvedValueOnce([])

      await service.getEntityHistory('prospect', 'prospect-1', { limit: 50 })

      const call = mockQuery.mock.calls[0]
      expect(call[1]).toContain(50)
    })

    it('should throw DatabaseError on failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Connection failed'))

      await expect(service.getEntityHistory('prospect', 'prospect-1')).rejects.toThrow(
        DatabaseError
      )
    })
  })

  describe('searchAuditLogs', () => {
    it('should return paginated results', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          action: 'create',
          entity_type: 'contact',
          created_at: '2024-01-01T00:00:00Z'
        }
      ]

      mockQuery
        .mockResolvedValueOnce(mockLogs) // Results
        .mockResolvedValueOnce([{ count: '10' }]) // Count

      const result = await service.searchAuditLogs({}, { page: 1, limit: 50 })

      expect(result.logs).toHaveLength(1)
      expect(result.total).toBe(10)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(50)
    })

    it('should filter by orgId', async () => {
      mockQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: '0' }])

      await service.searchAuditLogs({ orgId: 'org-1' })

      expect(mockQuery.mock.calls[0][0]).toContain('org_id = $1')
    })

    it('should filter by userId', async () => {
      mockQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: '0' }])

      await service.searchAuditLogs({ userId: 'user-1' })

      expect(mockQuery.mock.calls[0][0]).toContain('user_id = $')
    })

    it('should filter by action', async () => {
      mockQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: '0' }])

      await service.searchAuditLogs({ action: 'update' })

      expect(mockQuery.mock.calls[0][0]).toContain('action = $')
    })

    it('should filter by date range', async () => {
      mockQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: '0' }])

      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')

      await service.searchAuditLogs({ startDate, endDate })

      expect(mockQuery.mock.calls[0][0]).toContain('created_at >= $')
      expect(mockQuery.mock.calls[0][0]).toContain('created_at <= $')
    })

    it('should handle descending sort order', async () => {
      mockQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: '0' }])

      await service.searchAuditLogs({}, { sortOrder: 'desc' })

      expect(mockQuery.mock.calls[0][0]).toContain('ORDER BY created_at DESC')
    })

    it('should throw DatabaseError on failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Query failed'))

      await expect(service.searchAuditLogs({})).rejects.toThrow(DatabaseError)
    })
  })

  describe('getAuditSummary', () => {
    it('should return summary grouped by entity type', async () => {
      const mockSummary = [
        {
          entity_type: 'prospect',
          total_changes: '50',
          creates: '20',
          updates: '25',
          deletes: '5',
          unique_entities: '15',
          unique_users: '3'
        },
        {
          entity_type: 'contact',
          total_changes: '30',
          creates: '15',
          updates: '12',
          deletes: '3',
          unique_entities: '10',
          unique_users: '2'
        }
      ]

      mockQuery.mockResolvedValueOnce(mockSummary)

      const result = await service.getAuditSummary('org-1', {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      })

      expect(result).toHaveLength(2)
      expect(result[0].entityType).toBe('prospect')
      expect(result[0].totalChanges).toBe(50)
      expect(result[0].creates).toBe(20)
      expect(result[0].updates).toBe(25)
      expect(result[0].deletes).toBe(5)
      expect(result[0].uniqueEntities).toBe(15)
      expect(result[0].uniqueUsers).toBe(3)
    })

    it('should throw DatabaseError on failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Query failed'))

      await expect(
        service.getAuditSummary('org-1', {
          start: new Date(),
          end: new Date()
        })
      ).rejects.toThrow(DatabaseError)
    })
  })

  describe('exportForCompliance', () => {
    it('should return JSON format by default', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          org_id: 'org-1',
          user_id: 'user-1',
          action: 'create',
          entity_type: 'deal',
          entity_id: 'deal-1',
          created_at: '2024-01-01T00:00:00Z'
        }
      ]

      mockQuery.mockResolvedValueOnce(mockLogs)

      const result = await service.exportForCompliance(
        'org-1',
        { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
        'json'
      )

      expect(Array.isArray(result)).toBe(true)
      expect((result as unknown[]).length).toBe(1)
    })

    it('should return CSV buffer when format is csv', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          org_id: 'org-1',
          user_id: 'user-1',
          action: 'create',
          entity_type: 'deal',
          entity_id: 'deal-1',
          created_at: '2024-01-01T00:00:00Z'
        }
      ]

      mockQuery.mockResolvedValueOnce(mockLogs)

      const result = await service.exportForCompliance(
        'org-1',
        { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
        'csv'
      )

      expect(Buffer.isBuffer(result)).toBe(true)
      const csvContent = (result as Buffer).toString('utf-8')
      expect(csvContent).toContain('ID,')
      expect(csvContent).toContain('Timestamp')
    })

    it('should throw ValidationError when start date is after end date', async () => {
      await expect(
        service.exportForCompliance(
          'org-1',
          { start: new Date('2024-02-01'), end: new Date('2024-01-01') },
          'json'
        )
      ).rejects.toThrow(ValidationError)
    })

    it('should throw ValidationError when date range exceeds 1 year', async () => {
      await expect(
        service.exportForCompliance(
          'org-1',
          { start: new Date('2023-01-01'), end: new Date('2024-06-01') },
          'json'
        )
      ).rejects.toThrow(ValidationError)
    })

    it('should filter by entity type when provided', async () => {
      mockQuery.mockResolvedValueOnce([])

      await service.exportForCompliance(
        'org-1',
        { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
        'json',
        { entityType: 'deal' }
      )

      expect(mockQuery.mock.calls[0][0]).toContain('entity_type = $')
    })
  })

  describe('getUserActivity', () => {
    it('should return user activity summary', async () => {
      mockQuery
        .mockResolvedValueOnce([
          { action: 'create', count: '10' },
          { action: 'update', count: '20' }
        ])
        .mockResolvedValueOnce([
          { entity_type: 'deal', count: '15' },
          { entity_type: 'contact', count: '15' }
        ])
        .mockResolvedValueOnce([
          { id: 'log-1', action: 'create', entity_type: 'deal', created_at: '2024-01-01T00:00:00Z' }
        ])

      const result = await service.getUserActivity('org-1', 'user-1', {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      })

      expect(result.userId).toBe('user-1')
      expect(result.totalActions).toBe(30)
      expect(result.actionBreakdown.create).toBe(10)
      expect(result.actionBreakdown.update).toBe(20)
      expect(result.entityBreakdown.deal).toBe(15)
      expect(result.recentActions).toHaveLength(1)
    })

    it('should throw DatabaseError on failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Query failed'))

      await expect(
        service.getUserActivity('org-1', 'user-1', {
          start: new Date(),
          end: new Date()
        })
      ).rejects.toThrow(DatabaseError)
    })
  })

  describe('getByRequestId', () => {
    it('should return logs for a specific request', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          request_id: 'req-123',
          action: 'create',
          entity_type: 'deal',
          created_at: '2024-01-01T00:00:00Z'
        }
      ]

      mockQuery.mockResolvedValueOnce(mockLogs)

      const result = await service.getByRequestId('req-123')

      expect(result).toHaveLength(1)
      expect(result[0].requestId).toBe('req-123')
    })

    it('should throw DatabaseError on failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Query failed'))

      await expect(service.getByRequestId('req-123')).rejects.toThrow(DatabaseError)
    })
  })

  describe('getHighVolumeAlerts', () => {
    it('should return alerts for high-volume users', async () => {
      const mockAlerts = [
        {
          user_id: 'user-1',
          hour: '2024-01-01T10:00:00Z',
          action_count: '150',
          entity_types: ['deal', 'contact']
        }
      ]

      mockQuery.mockResolvedValueOnce(mockAlerts)

      const result = await service.getHighVolumeAlerts('org-1', {
        thresholdPerHour: 100,
        hoursBack: 24
      })

      expect(result).toHaveLength(1)
      expect(result[0].userId).toBe('user-1')
      expect(result[0].actionCount).toBe(150)
      expect(result[0].entityTypes).toEqual(['deal', 'contact'])
    })

    it('should use default options when not provided', async () => {
      mockQuery.mockResolvedValueOnce([])

      await service.getHighVolumeAlerts('org-1')

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('HAVING COUNT(*) >= $3'),
        expect.arrayContaining(['org-1', '24', 100])
      )
    })

    it('should throw DatabaseError on failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Query failed'))

      await expect(service.getHighVolumeAlerts('org-1')).rejects.toThrow(DatabaseError)
    })
  })

  describe('Cryptographic helpers', () => {
    it('canonicalizeJson produces deterministic output regardless of key insertion order', () => {
      const objA = { b: 2, a: 1, nested: { y: 20, x: 10 } }
      const objB = { a: 1, nested: { x: 10, y: 20 }, b: 2 }

      expect(canonicalizeJson(objA)).toBe(canonicalizeJson(objB))
      expect(canonicalizeJson(null)).toBe('')
      expect(canonicalizeJson([3, 2, 1])).toBe('[3,2,1]')
    })

    it('cleanIp normalizes and validates IP addresses', () => {
      expect(cleanIp('127.0.0.1')).toBe('127.0.0.1')
      expect(cleanIp('192.168.1.1, 10.0.0.1')).toBe('192.168.1.1')
      expect(cleanIp('::1')).toBe('::1')
      expect(cleanIp('not-an-ip')).toBeNull()
      expect(cleanIp(undefined)).toBeNull()
    })

    it('computeRecordHash generates stable SHA-256 bound to prevHash', () => {
      const hash1 = computeRecordHash({
        prevHash: GENESIS_HASH,
        orgId: 'org-1',
        action: 'create',
        entityType: 'deal',
        createdAt: '2025-01-01T00:00:00.000Z'
      })

      const hash2 = computeRecordHash({
        prevHash: GENESIS_HASH,
        orgId: 'org-1',
        action: 'create',
        entityType: 'deal',
        createdAt: '2025-01-01T00:00:00.000Z'
      })

      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(64)

      // Different prevHash produces completely different hash
      const hashDifferentPrev = computeRecordHash({
        prevHash: '1'.repeat(64),
        orgId: 'org-1',
        action: 'create',
        entityType: 'deal',
        createdAt: '2025-01-01T00:00:00.000Z'
      })
      expect(hashDifferentPrev).not.toBe(hash1)
    })
  })

  describe('createAuditEntry', () => {
    it('links to GENESIS_HASH on initial log in org', async () => {
      // Query for preceding hash returns empty (no previous records)
      mockQuery.mockResolvedValueOnce([])
      // Insert returns inserted row
      const mockInserted = {
        id: 'new-log-1',
        org_id: 'org-1',
        user_id: 'user-1',
        action: 'create',
        entity_type: 'deal',
        entity_id: 'deal-1',
        prev_hash: GENESIS_HASH,
        record_hash: 'abc123hash',
        created_at: '2025-01-01T00:00:00.000Z'
      }
      mockQuery.mockResolvedValueOnce([mockInserted])

      const entry = await service.createAuditEntry({
        orgId: 'org-1',
        userId: 'user-1',
        action: 'create',
        entityType: 'deal',
        entityId: 'deal-1'
      })

      expect(entry.id).toBe('new-log-1')
      expect(mockQuery).toHaveBeenCalledTimes(2)
      // First call checks previous record
      expect(mockQuery.mock.calls[0][0]).toContain('SELECT record_hash FROM audit_logs')
      // Second call inserts with prev_hash
      expect(mockQuery.mock.calls[1][1]).toContain(GENESIS_HASH)
    })

    it('chains to preceding record_hash when prior records exist', async () => {
      const priorHash = 'f'.repeat(64)
      mockQuery.mockResolvedValueOnce([{ record_hash: priorHash }])
      mockQuery.mockResolvedValueOnce([])

      await service.createAuditEntry({
        orgId: 'org-1',
        action: 'update',
        entityType: 'deal'
      })

      expect(mockQuery.mock.calls[1][1]).toContain(priorHash)
    })

    it('throws DatabaseError when database query fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB failure'))

      await expect(
        service.createAuditEntry({
          action: 'create',
          entityType: 'contact'
        })
      ).rejects.toThrow(DatabaseError)
    })
  })

  describe('logAccess and logModification', () => {
    it('logAccess creates an audit entry with action access', async () => {
      mockQuery.mockResolvedValueOnce([]) // previous hash lookup
      mockQuery.mockResolvedValueOnce([]) // insert

      await service.logAccess({
        orgId: 'org-1',
        userId: 'user-1',
        entityType: 'contact',
        entityId: 'contact-1',
        metadata: { fieldAccessed: ['ssn', 'phone'] }
      })

      expect(mockQuery.mock.calls[1][1]).toContain('access')
      expect(mockQuery.mock.calls[1][1]).toContain('contact')
    })

    it('logModification creates an audit entry with changes', async () => {
      mockQuery.mockResolvedValueOnce([])
      mockQuery.mockResolvedValueOnce([])

      await service.logModification({
        orgId: 'org-1',
        action: 'security_config_update',
        entityType: 'system_settings',
        changes: { mfaRequired: { old: false, new: true } }
      })

      expect(mockQuery.mock.calls[1][1]).toContain('security_config_update')
      expect(mockQuery.mock.calls[1][1]).toContain('system_settings')
    })
  })

  describe('verifyLogIntegrity', () => {
    it('verifies a valid hash chain with no violations', async () => {
      const t1 = '2025-01-01T00:00:00.000Z'
      const t2 = '2025-01-02T00:00:00.000Z'

      const hash1 = computeRecordHash({
        prevHash: GENESIS_HASH,
        orgId: 'org-1',
        action: 'create',
        entityType: 'deal',
        entityId: 'deal-1',
        createdAt: t1
      })

      const hash2 = computeRecordHash({
        prevHash: hash1,
        orgId: 'org-1',
        action: 'update',
        entityType: 'deal',
        entityId: 'deal-1',
        createdAt: t2
      })

      const rows = [
        {
          id: 'log-1',
          org_id: 'org-1',
          action: 'create',
          entity_type: 'deal',
          entity_id: 'deal-1',
          prev_hash: GENESIS_HASH,
          record_hash: hash1,
          created_at: t1
        },
        {
          id: 'log-2',
          org_id: 'org-1',
          action: 'update',
          entity_type: 'deal',
          entity_id: 'deal-1',
          prev_hash: hash1,
          record_hash: hash2,
          created_at: t2
        }
      ]

      mockQuery.mockResolvedValueOnce(rows)

      const result = await service.verifyLogIntegrity({ orgId: 'org-1' })

      expect(result.valid).toBe(true)
      expect(result.totalChecked).toBe(2)
      expect(result.violations).toHaveLength(0)
      expect(result.rootHash).toBe(hash1)
      expect(result.latestHash).toBe(hash2)
    })

    it('detects record hash tampering', async () => {
      const t1 = '2025-01-01T00:00:00.000Z'
      const rows = [
        {
          id: 'log-1',
          org_id: 'org-1',
          action: 'create',
          entity_type: 'deal',
          prev_hash: GENESIS_HASH,
          record_hash: 'tampered-hash-value',
          created_at: t1
        }
      ]

      mockQuery.mockResolvedValueOnce(rows)

      const result = await service.verifyLogIntegrity({ orgId: 'org-1' })

      expect(result.valid).toBe(false)
      expect(result.violations).toHaveLength(1)
      expect(result.violations[0].reason).toContain('Record hash tampering detected')
    })

    it('detects broken hash chain linkage between adjacent records', async () => {
      const t1 = '2025-01-01T00:00:00.000Z'
      const t2 = '2025-01-02T00:00:00.000Z'

      const hash1 = computeRecordHash({
        prevHash: GENESIS_HASH,
        orgId: 'org-1',
        action: 'create',
        entityType: 'deal',
        createdAt: t1
      })

      const rows = [
        {
          id: 'log-1',
          org_id: 'org-1',
          action: 'create',
          entity_type: 'deal',
          prev_hash: GENESIS_HASH,
          record_hash: hash1,
          created_at: t1
        },
        {
          id: 'log-2',
          org_id: 'org-1',
          action: 'update',
          entity_type: 'deal',
          prev_hash: 'wrong-predecessor-hash',
          record_hash: 'anything',
          created_at: t2
        }
      ]

      mockQuery.mockResolvedValueOnce(rows)

      const result = await service.verifyLogIntegrity({ orgId: 'org-1' })

      expect(result.valid).toBe(false)
      expect(result.violations.some((v) => v.reason.includes('Hash chain broken'))).toBe(true)
    })
  })

  describe('exportCompliancePackage', () => {
    it('generates a SOC2 signed compliance package', async () => {
      // 1. verifyLogIntegrity query
      mockQuery.mockResolvedValueOnce([])
      // 2. exportForCompliance query
      mockQuery.mockResolvedValueOnce([])

      const pkg = await service.exportCompliancePackage('org-1', {
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31')
      })

      expect(pkg.packageId).toBeDefined()
      expect(pkg.organizationId).toBe('org-1')
      expect(pkg.manifest.hashAlgorithm).toBe('SHA-256')
      expect(pkg.manifest.signature).toHaveLength(64)
      expect(pkg.integrity.valid).toBe(true)
    })

    it('throws ValidationError if startDate is after endDate', async () => {
      await expect(
        service.exportCompliancePackage('org-1', {
          startDate: new Date('2025-02-01'),
          endDate: new Date('2025-01-01')
        })
      ).rejects.toThrow(ValidationError)
    })
  })
})
