import { describe, it, expect, beforeEach, vi } from 'vitest'
import express, { Request, Response } from 'express'
import request from 'supertest'
import {
  auditMiddleware,
  createAuditLog,
  redactSensitiveData,
  isSensitiveKey,
  extractEntityId,
  getEntityType,
  getSensitiveReadConfig
} from '../../middleware/auditMiddleware'
import type { AuthenticatedRequest } from '../../middleware/authMiddleware'

vi.mock('../../services/AuditService', () => ({
  auditService: {
    createAuditEntry: vi.fn().mockResolvedValue({ id: 'mock-audit-id' })
  }
}))

import { auditService } from '../../services/AuditService'

const mockCreateAuditEntry = vi.mocked(auditService.createAuditEntry)

describe('auditMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Redaction & Path Utilities', () => {
    it('isSensitiveKey matches camelCase and snake_case sensitive keys', () => {
      expect(isSensitiveKey('password')).toBe(true)
      expect(isSensitiveKey('ssn')).toBe(true)
      expect(isSensitiveKey('cardNumber')).toBe(true)
      expect(isSensitiveKey('card_number')).toBe(true)
      expect(isSensitiveKey('socialSecurityNumber')).toBe(true)
      expect(isSensitiveKey('social_security_number')).toBe(true)
      expect(isSensitiveKey('apiKey')).toBe(true)
      expect(isSensitiveKey('api_key')).toBe(true)
      expect(isSensitiveKey('name')).toBe(false)
      expect(isSensitiveKey('email')).toBe(false)
    })

    it('redactSensitiveData deeply redacts sensitive fields in nested structures and arrays', () => {
      const input = {
        name: 'Acme Corp',
        password: 'secretpassword',
        profile: {
          ssn: '000-00-0000',
          contact: {
            phone: '555-1234',
            token: 'jwt.token.here'
          }
        },
        cards: [{ cardNumber: '411111111111', exp: '12/28' }, { last4: '1111' }]
      }

      const redacted = redactSensitiveData(input) as Record<string, unknown>

      expect(redacted.name).toBe('Acme Corp')
      expect(redacted.password).toBe('[REDACTED]')
      const profile = redacted.profile as Record<string, unknown>
      expect(profile.ssn).toBe('[REDACTED]')
      const contact = profile.contact as Record<string, unknown>
      expect(contact.phone).toBe('555-1234')
      expect(contact.token).toBe('[REDACTED]')
      const cards = redacted.cards as Array<Record<string, unknown>>
      expect(cards[0].cardNumber).toBe('[REDACTED]')
      expect(cards[0].exp).toBe('12/28')
      expect(cards[1].last4).toBe('1111')
    })

    it('extractEntityId extracts UUIDs from standard or nested path segments', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000'
      expect(extractEntityId(`/api/contacts/${uuid}`)).toBe(uuid)
      expect(extractEntityId(`/api/compliance/disclosures/${uuid}`)).toBe(uuid)
      expect(extractEntityId(`/api/deals/${uuid}/documents`)).toBe(uuid)
      expect(extractEntityId('/api/contacts')).toBeUndefined()
    })

    it('getEntityType maps endpoints correctly', () => {
      expect(getEntityType('/api/prospects')).toBe('prospect')
      expect(getEntityType('/api/contacts/123')).toBe('contact')
      expect(getEntityType('/api/deals')).toBe('deal')
      expect(getEntityType('/api/unknown')).toBe('unknown')
    })

    it('getSensitiveReadConfig identifies sensitive endpoints for GET auditing', () => {
      expect(getSensitiveReadConfig('/api/contacts')).toEqual({
        entityType: 'contact',
        action: 'access'
      })
      expect(getSensitiveReadConfig('/api/compliance/audit/export')).toEqual({
        entityType: 'compliance_export',
        action: 'export'
      })
      expect(getSensitiveReadConfig('/api/health')).toBeNull()
      expect(getSensitiveReadConfig('/api/public')).toBeNull()
    })
  })

  describe('HTTP Middleware Interception', () => {
    function buildApp() {
      const app = express()
      app.use(express.json())

      // Fake auth injection
      app.use((req: Request, _res: Response, next) => {
        ;(req as AuthenticatedRequest).user = {
          id: 'user-123',
          email: 'test@example.com',
          role: 'admin',
          orgId: 'org-abc'
        }
        ;(req as AuthenticatedRequest).orgId = 'org-abc'
        next()
      })

      app.use(auditMiddleware)

      // Test routes
      app.post('/api/contacts', (req, res) => {
        res.status(201).json({ id: 'contact-1', name: req.body.name })
      })

      app.put('/api/contacts/:id', (req, res) => {
        res.status(200).json({ id: req.params.id, name: req.body.name, status: 'active' })
      })

      app.delete('/api/contacts/:id', (_req, res) => {
        res.status(204).send()
      })

      app.get('/api/contacts', (_req, res) => {
        res.status(200).json({ contacts: [{ id: 'c1', name: 'John Doe' }] })
      })

      app.get('/api/compliance/audit/export', (_req, res) => {
        res.status(200).json({ exportId: 'exp-1', total: 10 })
      })

      app.get('/api/health', (_req, res) => {
        res.status(200).json({ status: 'healthy' })
      })

      app.get('/api/general-data', (_req, res) => {
        res.status(200).json({ message: 'public' })
      })

      app.post('/api/contacts/error', (_req, res) => {
        res.status(400).json({ error: 'Validation failed' })
      })

      return app
    }

    it('audits POST requests with create action and afterState', async () => {
      const app = buildApp()

      const res = await request(app).post('/api/contacts').send({ name: 'Acme LLC' })

      expect(res.status).toBe(201)

      // Wait a tick for setImmediate async audit logging
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(mockCreateAuditEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'create',
          entityType: 'contact',
          orgId: 'org-abc',
          userId: 'user-123',
          afterState: expect.objectContaining({ id: 'contact-1', name: 'Acme LLC' })
        })
      )
    })

    it('audits PUT requests with update action and before/after states', async () => {
      const app = buildApp()

      const res = await request(app)
        .put('/api/contacts/550e8400-e29b-41d4-a716-446655440000')
        .send({ name: 'Updated LLC' })

      expect(res.status).toBe(200)
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(mockCreateAuditEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          entityType: 'contact',
          entityId: '550e8400-e29b-41d4-a716-446655440000',
          orgId: 'org-abc',
          userId: 'user-123'
        })
      )
    })

    it('audits DELETE 204 requests with delete action', async () => {
      const app = buildApp()

      const res = await request(app).delete('/api/contacts/550e8400-e29b-41d4-a716-446655440000')

      expect(res.status).toBe(204)
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(mockCreateAuditEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'delete',
          entityType: 'contact',
          entityId: '550e8400-e29b-41d4-a716-446655440000'
        })
      )
    })

    it('audits sensitive GET read requests (contacts)', async () => {
      const app = buildApp()

      const res = await request(app).get('/api/contacts?page=1')

      expect(res.status).toBe(200)
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(mockCreateAuditEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'access',
          entityType: 'contact',
          orgId: 'org-abc',
          userId: 'user-123'
        })
      )
    })

    it('audits compliance export GET requests with export action', async () => {
      const app = buildApp()

      const res = await request(app).get('/api/compliance/audit/export')

      expect(res.status).toBe(200)
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(mockCreateAuditEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'export',
          entityType: 'compliance_export',
          orgId: 'org-abc'
        })
      )
    })

    it('does not audit skipped paths like /api/health', async () => {
      const app = buildApp()

      const res = await request(app).get('/api/health')

      expect(res.status).toBe(200)
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(mockCreateAuditEntry).not.toHaveBeenCalled()
    })

    it('does not audit non-sensitive GET requests', async () => {
      const app = buildApp()

      const res = await request(app).get('/api/general-data')

      expect(res.status).toBe(200)
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(mockCreateAuditEntry).not.toHaveBeenCalled()
    })

    it('does not audit error responses (statusCode >= 400)', async () => {
      const app = buildApp()

      const res = await request(app).post('/api/contacts/error').send({ bad: true })

      expect(res.status).toBe(400)
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(mockCreateAuditEntry).not.toHaveBeenCalled()
    })
  })

  describe('createAuditLog helper', () => {
    it('creates an audit log with redacted data and request ID', async () => {
      await createAuditLog({
        orgId: 'org-1',
        action: 'system_action',
        entityType: 'system',
        beforeState: { token: 'secret' }
      })

      expect(mockCreateAuditEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org-1',
          action: 'system_action',
          entityType: 'system',
          beforeState: { token: '[REDACTED]' },
          requestId: expect.any(String)
        })
      )
    })
  })
})
