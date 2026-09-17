import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ContactsService } from '../../services/ContactsService'
import { NotFoundError, ValidationError, DatabaseError } from '../../errors'

// Mock the database module
vi.mock('../../database/connection', () => ({
  database: {
    query: vi.fn()
  }
}))

import { database } from '../../database/connection'

const mockQuery = vi.mocked(database.query)

describe('ContactsService', () => {
  let service: ContactsService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ContactsService()
  })

  describe('list', () => {
    it('should return paginated list of contacts', async () => {
      const mockContacts = [
        {
          id: 'contact-1',
          org_id: 'org-1',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          is_active: true,
          preferred_contact_method: 'email',
          timezone: 'America/New_York',
          tags: [],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ]

      mockQuery.mockResolvedValueOnce(mockContacts).mockResolvedValueOnce([{ count: '1' }])

      const result = await service.list({ orgId: 'org-1' })

      expect(result.contacts).toHaveLength(1)
      expect(result.contacts[0].firstName).toBe('John')
      expect(result.total).toBe(1)
      expect(result.page).toBe(1)
    })

    it('should filter by search term', async () => {
      mockQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: '0' }])

      await service.list({ orgId: 'org-1', search: 'john' })

      expect(mockQuery.mock.calls[0][0]).toContain('ILIKE')
      expect(mockQuery.mock.calls[0][1]).toContain('%john%')
    })

    it('should filter by role', async () => {
      mockQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: '0' }])

      await service.list({ orgId: 'org-1', role: 'owner' })

      expect(mockQuery.mock.calls[0][0]).toContain('role = $')
    })

    it('should filter by tags', async () => {
      mockQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: '0' }])

      await service.list({ orgId: 'org-1', tags: ['vip', 'priority'] })

      expect(mockQuery.mock.calls[0][0]).toContain('tags && $')
    })

    it('should handle sorting', async () => {
      mockQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: '0' }])

      await service.list({ orgId: 'org-1', sortBy: 'first_name', sortOrder: 'desc' })

      expect(mockQuery.mock.calls[0][0]).toContain('ORDER BY first_name DESC')
    })

    it('should default to safe sort column for invalid input', async () => {
      mockQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: '0' }])

      await service.list({
        orgId: 'org-1',
        sortBy: 'malicious; DROP TABLE contacts;--' as unknown as 'first_name'
      })

      expect(mockQuery.mock.calls[0][0]).toContain('ORDER BY last_name')
    })

    it('should throw DatabaseError on failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Connection failed'))

      await expect(service.list({ orgId: 'org-1' })).rejects.toThrow(DatabaseError)
    })
  })

  describe('getById', () => {
    it('should return contact by id', async () => {
      const mockContact = {
        id: 'contact-1',
        org_id: 'org-1',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        is_active: true,
        preferred_contact_method: 'email',
        timezone: 'America/New_York',
        tags: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockQuery.mockResolvedValueOnce([mockContact])

      const result = await service.getById('contact-1', 'org-1')

      expect(result).not.toBeNull()
      expect(result?.id).toBe('contact-1')
      expect(result?.firstName).toBe('John')
    })

    it('should return null for non-existent contact', async () => {
      mockQuery.mockResolvedValueOnce([])

      const result = await service.getById('non-existent', 'org-1')

      expect(result).toBeNull()
    })

    it('should throw DatabaseError on failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Query failed'))

      await expect(service.getById('contact-1', 'org-1')).rejects.toThrow(DatabaseError)
    })
  })

  describe('getByIdOrThrow', () => {
    it('should return contact when found', async () => {
      const mockContact = {
        id: 'contact-1',
        org_id: 'org-1',
        first_name: 'John',
        last_name: 'Doe',
        is_active: true,
        preferred_contact_method: 'email',
        timezone: 'America/New_York',
        tags: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockQuery.mockResolvedValueOnce([mockContact])

      const result = await service.getByIdOrThrow('contact-1', 'org-1')

      expect(result.id).toBe('contact-1')
    })

    it('should throw NotFoundError when contact does not exist', async () => {
      mockQuery.mockResolvedValueOnce([])

      await expect(service.getByIdOrThrow('non-existent', 'org-1')).rejects.toThrow(NotFoundError)
    })
  })

  describe('create', () => {
    it('should create a new contact', async () => {
      const mockCreated = {
        id: 'new-contact',
        org_id: 'org-1',
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane@example.com',
        is_active: true,
        preferred_contact_method: 'email',
        timezone: 'America/New_York',
        tags: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockQuery.mockResolvedValueOnce([mockCreated])

      const result = await service.create({
        orgId: 'org-1',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com'
      })

      expect(result.id).toBe('new-contact')
      expect(result.firstName).toBe('Jane')
      expect(result.lastName).toBe('Smith')
    })

    it('should throw ValidationError when first name is missing', async () => {
      await expect(
        service.create({ orgId: 'org-1', firstName: '', lastName: 'Smith' })
      ).rejects.toThrow(ValidationError)
    })

    it('should throw ValidationError when last name is missing', async () => {
      await expect(
        service.create({ orgId: 'org-1', firstName: 'Jane', lastName: '' })
      ).rejects.toThrow(ValidationError)
    })

    it('should use default values for optional fields', async () => {
      const mockCreated = {
        id: 'new-contact',
        org_id: 'org-1',
        first_name: 'Jane',
        last_name: 'Smith',
        is_active: true,
        preferred_contact_method: 'email',
        timezone: 'America/New_York',
        tags: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockQuery.mockResolvedValueOnce([mockCreated])

      await service.create({
        orgId: 'org-1',
        firstName: 'Jane',
        lastName: 'Smith'
      })

      const queryCall = mockQuery.mock.calls[0]
      expect(queryCall[1]).toContain('email') // default preferred contact method
      expect(queryCall[1]).toContain('America/New_York') // default timezone
    })

    it('should throw DatabaseError on failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Insert failed'))

      await expect(
        service.create({ orgId: 'org-1', firstName: 'Jane', lastName: 'Smith' })
      ).rejects.toThrow(DatabaseError)
    })
  })

  describe('update', () => {
    it('should update contact fields', async () => {
      const mockUpdated = {
        id: 'contact-1',
        org_id: 'org-1',
        first_name: 'John',
        last_name: 'Updated',
        is_active: true,
        preferred_contact_method: 'email',
        timezone: 'America/New_York',
        tags: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z'
      }

      mockQuery.mockResolvedValueOnce([mockUpdated])

      const result = await service.update('contact-1', 'org-1', {
        lastName: 'Updated'
      })

      expect(result.lastName).toBe('Updated')
    })

    it('should return current contact when no fields to update', async () => {
      const mockContact = {
        id: 'contact-1',
        org_id: 'org-1',
        first_name: 'John',
        last_name: 'Doe',
        is_active: true,
        preferred_contact_method: 'email',
        timezone: 'America/New_York',
        tags: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockQuery.mockResolvedValueOnce([mockContact])

      const result = await service.update('contact-1', 'org-1', {})

      expect(result.id).toBe('contact-1')
    })

    it('should throw NotFoundError for non-existent contact', async () => {
      mockQuery.mockResolvedValueOnce([])

      await expect(service.update('non-existent', 'org-1', { lastName: 'Test' })).rejects.toThrow(
        NotFoundError
      )
    })

    it('should throw DatabaseError on failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Update failed'))

      await expect(service.update('contact-1', 'org-1', { lastName: 'Test' })).rejects.toThrow(
        DatabaseError
      )
    })
  })

  describe('delete', () => {
    it('should soft delete a contact', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 } as unknown as [])

      const result = await service.delete('contact-1', 'org-1')

      expect(result).toBe(true)
      expect(mockQuery.mock.calls[0][0]).toContain('is_active = false')
    })

    it('should throw NotFoundError for non-existent contact', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0 } as unknown as [])

      await expect(service.delete('non-existent', 'org-1')).rejects.toThrow(NotFoundError)
    })

    it('should throw DatabaseError on failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Delete failed'))

      await expect(service.delete('contact-1', 'org-1')).rejects.toThrow(DatabaseError)
    })
  })

  describe('logActivity', () => {
    it('should log an activity for a contact', async () => {
      const mockActivity = {
        id: 'activity-1',
        contact_id: 'contact-1',
        activity_type: 'call_outbound',
        subject: 'Sales call',
        metadata: {},
        created_at: '2024-01-01T00:00:00Z'
      }

      mockQuery.mockResolvedValueOnce([mockActivity])

      const result = await service.logActivity({
        contactId: 'contact-1',
        activityType: 'call_outbound',
        subject: 'Sales call'
      })

      expect(result.id).toBe('activity-1')
      expect(result.activityType).toBe('call_outbound')
    })

    it('should include optional fields', async () => {
      const mockActivity = {
        id: 'activity-1',
        contact_id: 'contact-1',
        prospect_id: 'prospect-1',
        user_id: 'user-1',
        activity_type: 'meeting_completed',
        subject: 'Initial meeting',
        description: 'Discussed MCA options',
        outcome: 'interested',
        duration_seconds: 1800,
        metadata: { notes: 'Follow up next week' },
        scheduled_at: '2024-01-01T10:00:00Z',
        completed_at: '2024-01-01T10:30:00Z',
        created_at: '2024-01-01T00:00:00Z'
      }

      mockQuery.mockResolvedValueOnce([mockActivity])

      const result = await service.logActivity({
        contactId: 'contact-1',
        prospectId: 'prospect-1',
        userId: 'user-1',
        activityType: 'meeting_completed',
        subject: 'Initial meeting',
        description: 'Discussed MCA options',
        outcome: 'interested',
        durationSeconds: 1800,
        metadata: { notes: 'Follow up next week' }
      })

      expect(result.prospectId).toBe('prospect-1')
      expect(result.durationSeconds).toBe(1800)
    })

    it('should throw DatabaseError on failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Insert failed'))

      await expect(
        service.logActivity({ contactId: 'contact-1', activityType: 'note' })
      ).rejects.toThrow(DatabaseError)
    })
  })

  describe('getActivityTimeline', () => {
    it('should return activity timeline for a contact', async () => {
      const mockActivities = [
        {
          id: 'activity-1',
          contact_id: 'contact-1',
          activity_type: 'call_outbound',
          metadata: {},
          created_at: '2024-01-02T00:00:00Z'
        },
        {
          id: 'activity-2',
          contact_id: 'contact-1',
          activity_type: 'email_sent',
          metadata: {},
          created_at: '2024-01-01T00:00:00Z'
        }
      ]

      mockQuery.mockResolvedValueOnce(mockActivities)

      const result = await service.getActivityTimeline('contact-1')

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('activity-1')
    })

    it('should support pagination with before cursor', async () => {
      mockQuery.mockResolvedValueOnce([])

      await service.getActivityTimeline('contact-1', {
        limit: 20,
        before: '2024-01-01T00:00:00Z'
      })

      expect(mockQuery.mock.calls[0][0]).toContain('created_at < $2')
    })

    it('should throw DatabaseError on failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Query failed'))

      await expect(service.getActivityTimeline('contact-1')).rejects.toThrow(DatabaseError)
    })
  })

  describe('linkToProspect', () => {
    it('should link a contact to a prospect', async () => {
      const mockLink = {
        id: 'link-1',
        prospect_id: 'prospect-1',
        contact_id: 'contact-1',
        is_primary: false,
        relationship: 'employee',
        created_at: '2024-01-01T00:00:00Z'
      }

      mockQuery.mockResolvedValueOnce([mockLink])

      const result = await service.linkToProspect({
        prospectId: 'prospect-1',
        contactId: 'contact-1'
      })

      expect(result.prospectId).toBe('prospect-1')
      expect(result.contactId).toBe('contact-1')
    })

    it('should update existing link on conflict', async () => {
      const mockLink = {
        id: 'link-1',
        prospect_id: 'prospect-1',
        contact_id: 'contact-1',
        is_primary: true,
        relationship: 'owner',
        created_at: '2024-01-01T00:00:00Z'
      }

      mockQuery.mockResolvedValueOnce([mockLink])

      const result = await service.linkToProspect({
        prospectId: 'prospect-1',
        contactId: 'contact-1',
        isPrimary: true,
        relationship: 'owner'
      })

      expect(result.isPrimary).toBe(true)
      expect(result.relationship).toBe('owner')
      expect(mockQuery.mock.calls[0][0]).toContain('ON CONFLICT')
    })
  })

  describe('unlinkFromProspect', () => {
    it('should unlink a contact from a prospect', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 } as unknown as [])

      const result = await service.unlinkFromProspect('prospect-1', 'contact-1')

      expect(result).toBe(true)
    })

    it('should return false when link does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0 } as unknown as [])

      const result = await service.unlinkFromProspect('prospect-1', 'contact-1')

      expect(result).toBe(false)
    })
  })

  describe('getContactsForProspect', () => {
    it('should return contacts linked to a prospect', async () => {
      const mockContacts = [
        {
          id: 'contact-1',
          org_id: 'org-1',
          first_name: 'John',
          last_name: 'Doe',
          is_active: true,
          preferred_contact_method: 'email',
          timezone: 'America/New_York',
          tags: [],
          relationship: 'owner',
          is_primary: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ]

      mockQuery.mockResolvedValueOnce(mockContacts)

      const result = await service.getContactsForProspect('prospect-1')

      expect(result).toHaveLength(1)
      expect(result[0].firstName).toBe('John')
      expect(result[0].relationship).toBe('owner')
      expect(result[0].isPrimary).toBe(true)
    })
  })

  describe('getPrimaryContact', () => {
    it('should return primary contact for a prospect', async () => {
      const mockContact = {
        id: 'contact-1',
        org_id: 'org-1',
        first_name: 'John',
        last_name: 'Doe',
        is_active: true,
        preferred_contact_method: 'email',
        timezone: 'America/New_York',
        tags: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockQuery.mockResolvedValueOnce([mockContact])

      const result = await service.getPrimaryContact('prospect-1')

      expect(result).not.toBeNull()
      expect(result?.firstName).toBe('John')
    })

    it('should return null when no primary contact exists', async () => {
      mockQuery.mockResolvedValueOnce([])

      const result = await service.getPrimaryContact('prospect-1')

      expect(result).toBeNull()
    })
  })

  describe('findByEmail', () => {
    it('should find contacts by email', async () => {
      const mockContacts = [
        {
          id: 'contact-1',
          org_id: 'org-1',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          is_active: true,
          preferred_contact_method: 'email',
          timezone: 'America/New_York',
          tags: [],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ]

      mockQuery.mockResolvedValueOnce(mockContacts)

      const result = await service.findByEmail('john@example.com', 'org-1')

      expect(result).toHaveLength(1)
      expect(result[0].email).toBe('john@example.com')
    })
  })

  describe('findByPhone', () => {
    it('should find contacts by phone with normalization', async () => {
      const mockContacts = [
        {
          id: 'contact-1',
          org_id: 'org-1',
          first_name: 'John',
          last_name: 'Doe',
          phone: '1234567890',
          is_active: true,
          preferred_contact_method: 'phone',
          timezone: 'America/New_York',
          tags: [],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ]

      mockQuery.mockResolvedValueOnce(mockContacts)

      const result = await service.findByPhone('(123) 456-7890', 'org-1')

      expect(result).toHaveLength(1)
      // Verify normalized phone was used in query
      expect(mockQuery.mock.calls[0][1][0]).toBe('1234567890')
    })
  })

  describe('addTags', () => {
    it('should add tags to a contact', async () => {
      const mockUpdated = {
        id: 'contact-1',
        org_id: 'org-1',
        first_name: 'John',
        last_name: 'Doe',
        is_active: true,
        preferred_contact_method: 'email',
        timezone: 'America/New_York',
        tags: ['vip', 'priority'],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z'
      }

      mockQuery.mockResolvedValueOnce([mockUpdated])

      const result = await service.addTags('contact-1', 'org-1', ['vip', 'priority'])

      expect(result.tags).toContain('vip')
      expect(result.tags).toContain('priority')
    })

    it('should throw NotFoundError for non-existent contact', async () => {
      mockQuery.mockResolvedValueOnce([])

      await expect(service.addTags('non-existent', 'org-1', ['tag'])).rejects.toThrow(NotFoundError)
    })
  })

  describe('removeTags', () => {
    it('should remove tags from a contact', async () => {
      const mockUpdated = {
        id: 'contact-1',
        org_id: 'org-1',
        first_name: 'John',
        last_name: 'Doe',
        is_active: true,
        preferred_contact_method: 'email',
        timezone: 'America/New_York',
        tags: ['remaining'],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z'
      }

      mockQuery.mockResolvedValueOnce([mockUpdated])

      const result = await service.removeTags('contact-1', 'org-1', ['removed'])

      expect(result.tags).not.toContain('removed')
    })

    it('should throw NotFoundError for non-existent contact', async () => {
      mockQuery.mockResolvedValueOnce([])

      await expect(service.removeTags('non-existent', 'org-1', ['tag'])).rejects.toThrow(
        NotFoundError
      )
    })
  })
})
