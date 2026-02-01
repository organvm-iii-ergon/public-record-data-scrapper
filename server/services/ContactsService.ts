/**
 * ContactsService
 *
 * Manages contacts in the Broker OS CRM. Provides:
 * - CRUD operations for contacts
 * - Activity tracking
 * - Prospect linking
 * - Search and filtering
 */

import { database } from '../database/connection'
import { NotFoundError, ValidationError, DatabaseError } from '../errors'
import type {
  Contact,
  ContactActivity,
  ProspectContact,
  ActivityType,
  ContactRole,
  ContactMethod,
  ContactRelationship
} from '@public-records/core'

// Database row types (snake_case)
interface ContactRow {
  id: string
  org_id: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  phone_ext?: string
  mobile?: string
  title?: string
  role?: string
  preferred_contact_method: string
  timezone: string
  notes?: string
  tags: string[]
  source?: string
  is_active: boolean
  last_contacted_at?: string
  created_by?: string
  created_at: string
  updated_at: string
}

interface ContactActivityRow {
  id: string
  contact_id: string
  prospect_id?: string
  user_id?: string
  activity_type: string
  subject?: string
  description?: string
  outcome?: string
  duration_seconds?: number
  metadata: Record<string, unknown>
  scheduled_at?: string
  completed_at?: string
  created_at: string
}

interface ProspectContactRow {
  id: string
  prospect_id: string
  contact_id: string
  is_primary: boolean
  relationship: string
  created_at: string
}

// Query parameters
interface ListContactsParams {
  orgId: string
  page?: number
  limit?: number
  search?: string
  role?: ContactRole
  tags?: string[]
  isActive?: boolean
  sortBy?: 'first_name' | 'last_name' | 'created_at' | 'last_contacted_at'
  sortOrder?: 'asc' | 'desc'
}

interface CreateContactInput {
  orgId: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
  phoneExt?: string
  mobile?: string
  title?: string
  role?: ContactRole
  preferredContactMethod?: ContactMethod
  timezone?: string
  notes?: string
  tags?: string[]
  source?: string
  createdBy?: string
}

interface UpdateContactInput {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  phoneExt?: string
  mobile?: string
  title?: string
  role?: ContactRole
  preferredContactMethod?: ContactMethod
  timezone?: string
  notes?: string
  tags?: string[]
  isActive?: boolean
}

interface LogActivityInput {
  contactId: string
  prospectId?: string
  userId?: string
  activityType: ActivityType
  subject?: string
  description?: string
  outcome?: string
  durationSeconds?: number
  metadata?: Record<string, unknown>
  scheduledAt?: string
  completedAt?: string
}

interface LinkContactInput {
  prospectId: string
  contactId: string
  isPrimary?: boolean
  relationship?: ContactRelationship
}

export class ContactsService {
  /**
   * Transform database row to Contact type
   */
  private transformContact(row: ContactRow): Contact {
    return {
      id: row.id,
      orgId: row.org_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      phoneExt: row.phone_ext,
      mobile: row.mobile,
      title: row.title,
      role: row.role as ContactRole,
      preferredContactMethod: row.preferred_contact_method as ContactMethod,
      timezone: row.timezone,
      notes: row.notes,
      tags: row.tags || [],
      source: row.source,
      isActive: row.is_active,
      lastContactedAt: row.last_contacted_at,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  /**
   * Transform database row to ContactActivity type
   */
  private transformActivity(row: ContactActivityRow): ContactActivity {
    return {
      id: row.id,
      contactId: row.contact_id,
      prospectId: row.prospect_id,
      userId: row.user_id,
      activityType: row.activity_type as ActivityType,
      subject: row.subject,
      description: row.description,
      outcome: row.outcome,
      durationSeconds: row.duration_seconds,
      metadata: row.metadata || {},
      scheduledAt: row.scheduled_at,
      completedAt: row.completed_at,
      createdAt: row.created_at
    }
  }

  /**
   * List contacts with filtering and pagination
   */
  async list(params: ListContactsParams): Promise<{
    contacts: Contact[]
    total: number
    page: number
    limit: number
  }> {
    const {
      orgId,
      page = 1,
      limit = 20,
      search,
      role,
      tags,
      isActive = true,
      sortBy = 'last_name',
      sortOrder = 'asc'
    } = params

    const conditions: string[] = ['org_id = $1', 'is_active = $2']
    const values: unknown[] = [orgId, isActive]
    let paramCount = 3

    if (search) {
      conditions.push(`(
        first_name ILIKE $${paramCount} OR
        last_name ILIKE $${paramCount} OR
        email ILIKE $${paramCount} OR
        phone ILIKE $${paramCount}
      )`)
      values.push(`%${search}%`)
      paramCount++
    }

    if (role) {
      conditions.push(`role = $${paramCount}`)
      values.push(role)
      paramCount++
    }

    if (tags?.length) {
      conditions.push(`tags && $${paramCount}`)
      values.push(tags)
      paramCount++
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`
    const offset = (page - 1) * limit

    // Validate sort column
    const allowedSortColumns = ['first_name', 'last_name', 'created_at', 'last_contacted_at']
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'last_name'
    const safeSortOrder = sortOrder === 'desc' ? 'DESC' : 'ASC'

    try {
      const contacts = await database.query<ContactRow>(
        `SELECT * FROM contacts
         ${whereClause}
         ORDER BY ${safeSortBy} ${safeSortOrder}
         LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
        [...values, limit, offset]
      )

      const countResult = await database.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM contacts ${whereClause}`,
        values
      )
      const total = parseInt(countResult[0]?.count || '0')

      return {
        contacts: contacts.map(this.transformContact),
        total,
        page,
        limit
      }
    } catch (error) {
      throw new DatabaseError('Failed to list contacts', error instanceof Error ? error : undefined)
    }
  }

  /**
   * Get a single contact by ID
   */
  async getById(id: string, orgId: string): Promise<Contact | null> {
    try {
      const results = await database.query<ContactRow>(
        'SELECT * FROM contacts WHERE id = $1 AND org_id = $2',
        [id, orgId]
      )
      return results[0] ? this.transformContact(results[0]) : null
    } catch (error) {
      throw new DatabaseError('Failed to get contact', error instanceof Error ? error : undefined)
    }
  }

  /**
   * Get contact by ID, throwing if not found
   */
  async getByIdOrThrow(id: string, orgId: string): Promise<Contact> {
    const contact = await this.getById(id, orgId)
    if (!contact) {
      throw new NotFoundError('Contact', id)
    }
    return contact
  }

  /**
   * Create a new contact
   */
  async create(input: CreateContactInput): Promise<Contact> {
    if (!input.firstName || !input.lastName) {
      throw new ValidationError('First and last name are required')
    }

    try {
      const results = await database.query<ContactRow>(
        `INSERT INTO contacts (
          org_id, first_name, last_name, email, phone, phone_ext, mobile,
          title, role, preferred_contact_method, timezone, notes, tags, source, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *`,
        [
          input.orgId,
          input.firstName,
          input.lastName,
          input.email,
          input.phone,
          input.phoneExt,
          input.mobile,
          input.title,
          input.role,
          input.preferredContactMethod || 'email',
          input.timezone || 'America/New_York',
          input.notes,
          input.tags || [],
          input.source,
          input.createdBy
        ]
      )

      return this.transformContact(results[0])
    } catch (error) {
      throw new DatabaseError('Failed to create contact', error instanceof Error ? error : undefined)
    }
  }

  /**
   * Update an existing contact
   */
  async update(id: string, orgId: string, input: UpdateContactInput): Promise<Contact> {
    // Build dynamic update query
    const updates: string[] = []
    const values: unknown[] = [id, orgId]
    let paramCount = 3

    const fieldMap: Record<keyof UpdateContactInput, string> = {
      firstName: 'first_name',
      lastName: 'last_name',
      email: 'email',
      phone: 'phone',
      phoneExt: 'phone_ext',
      mobile: 'mobile',
      title: 'title',
      role: 'role',
      preferredContactMethod: 'preferred_contact_method',
      timezone: 'timezone',
      notes: 'notes',
      tags: 'tags',
      isActive: 'is_active'
    }

    for (const [key, column] of Object.entries(fieldMap)) {
      const value = input[key as keyof UpdateContactInput]
      if (value !== undefined) {
        updates.push(`${column} = $${paramCount}`)
        values.push(value)
        paramCount++
      }
    }

    if (updates.length === 0) {
      return this.getByIdOrThrow(id, orgId)
    }

    try {
      const results = await database.query<ContactRow>(
        `UPDATE contacts
         SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND org_id = $2
         RETURNING *`,
        values
      )

      if (!results[0]) {
        throw new NotFoundError('Contact', id)
      }

      return this.transformContact(results[0])
    } catch (error) {
      if (error instanceof NotFoundError) throw error
      throw new DatabaseError('Failed to update contact', error instanceof Error ? error : undefined)
    }
  }

  /**
   * Delete a contact (soft delete by setting is_active = false)
   */
  async delete(id: string, orgId: string): Promise<boolean> {
    try {
      const results = await database.query(
        'UPDATE contacts SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND org_id = $2',
        [id, orgId]
      )
      const deleted = (results as { rowCount: number }).rowCount > 0
      if (!deleted) {
        throw new NotFoundError('Contact', id)
      }
      return true
    } catch (error) {
      if (error instanceof NotFoundError) throw error
      throw new DatabaseError('Failed to delete contact', error instanceof Error ? error : undefined)
    }
  }

  /**
   * Log an activity for a contact
   */
  async logActivity(input: LogActivityInput): Promise<ContactActivity> {
    try {
      const results = await database.query<ContactActivityRow>(
        `INSERT INTO contact_activities (
          contact_id, prospect_id, user_id, activity_type,
          subject, description, outcome, duration_seconds,
          metadata, scheduled_at, completed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          input.contactId,
          input.prospectId,
          input.userId,
          input.activityType,
          input.subject,
          input.description,
          input.outcome,
          input.durationSeconds,
          input.metadata || {},
          input.scheduledAt,
          input.completedAt
        ]
      )

      return this.transformActivity(results[0])
    } catch (error) {
      throw new DatabaseError('Failed to log activity', error instanceof Error ? error : undefined)
    }
  }

  /**
   * Get activity timeline for a contact
   */
  async getActivityTimeline(
    contactId: string,
    options: { limit?: number; before?: string } = {}
  ): Promise<ContactActivity[]> {
    const { limit = 50, before } = options

    let query = `
      SELECT * FROM contact_activities
      WHERE contact_id = $1
    `
    const values: unknown[] = [contactId]

    if (before) {
      query += ` AND created_at < $2`
      values.push(before)
    }

    query += ` ORDER BY created_at DESC LIMIT $${values.length + 1}`
    values.push(limit)

    try {
      const results = await database.query<ContactActivityRow>(query, values)
      return results.map(this.transformActivity)
    } catch (error) {
      throw new DatabaseError('Failed to get activity timeline', error instanceof Error ? error : undefined)
    }
  }

  /**
   * Link a contact to a prospect
   */
  async linkToProspect(input: LinkContactInput): Promise<ProspectContact> {
    try {
      const results = await database.query<ProspectContactRow>(
        `INSERT INTO prospect_contacts (prospect_id, contact_id, is_primary, relationship)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (prospect_id, contact_id)
         DO UPDATE SET is_primary = $3, relationship = $4
         RETURNING *`,
        [
          input.prospectId,
          input.contactId,
          input.isPrimary ?? false,
          input.relationship || 'employee'
        ]
      )

      const row = results[0]
      return {
        id: row.id,
        prospectId: row.prospect_id,
        contactId: row.contact_id,
        isPrimary: row.is_primary,
        relationship: row.relationship as ContactRelationship,
        createdAt: row.created_at
      }
    } catch (error) {
      throw new DatabaseError('Failed to link contact to prospect', error instanceof Error ? error : undefined)
    }
  }

  /**
   * Unlink a contact from a prospect
   */
  async unlinkFromProspect(prospectId: string, contactId: string): Promise<boolean> {
    try {
      const results = await database.query(
        'DELETE FROM prospect_contacts WHERE prospect_id = $1 AND contact_id = $2',
        [prospectId, contactId]
      )
      return (results as { rowCount: number }).rowCount > 0
    } catch (error) {
      throw new DatabaseError('Failed to unlink contact from prospect', error instanceof Error ? error : undefined)
    }
  }

  /**
   * Get all contacts for a prospect
   */
  async getContactsForProspect(prospectId: string): Promise<(Contact & { relationship: ContactRelationship; isPrimary: boolean })[]> {
    try {
      const results = await database.query<ContactRow & { relationship: string; is_primary: boolean }>(
        `SELECT c.*, pc.relationship, pc.is_primary
         FROM contacts c
         JOIN prospect_contacts pc ON c.id = pc.contact_id
         WHERE pc.prospect_id = $1 AND c.is_active = true
         ORDER BY pc.is_primary DESC, c.last_name`,
        [prospectId]
      )

      return results.map(row => ({
        ...this.transformContact(row),
        relationship: row.relationship as ContactRelationship,
        isPrimary: row.is_primary
      }))
    } catch (error) {
      throw new DatabaseError('Failed to get contacts for prospect', error instanceof Error ? error : undefined)
    }
  }

  /**
   * Get primary contact for a prospect
   */
  async getPrimaryContact(prospectId: string): Promise<Contact | null> {
    try {
      const results = await database.query<ContactRow>(
        `SELECT c.*
         FROM contacts c
         JOIN prospect_contacts pc ON c.id = pc.contact_id
         WHERE pc.prospect_id = $1 AND pc.is_primary = true AND c.is_active = true
         LIMIT 1`,
        [prospectId]
      )

      return results[0] ? this.transformContact(results[0]) : null
    } catch (error) {
      throw new DatabaseError('Failed to get primary contact', error instanceof Error ? error : undefined)
    }
  }

  /**
   * Find contacts by email
   */
  async findByEmail(email: string, orgId: string): Promise<Contact[]> {
    try {
      const results = await database.query<ContactRow>(
        'SELECT * FROM contacts WHERE LOWER(email) = LOWER($1) AND org_id = $2 AND is_active = true',
        [email, orgId]
      )
      return results.map(this.transformContact)
    } catch (error) {
      throw new DatabaseError('Failed to find contacts by email', error instanceof Error ? error : undefined)
    }
  }

  /**
   * Find contacts by phone
   */
  async findByPhone(phone: string, orgId: string): Promise<Contact[]> {
    // Normalize phone for comparison (strip non-digits)
    const normalizedPhone = phone.replace(/\D/g, '')

    try {
      const results = await database.query<ContactRow>(
        `SELECT * FROM contacts
         WHERE org_id = $2 AND is_active = true
         AND (
           regexp_replace(phone, '[^0-9]', '', 'g') = $1
           OR regexp_replace(mobile, '[^0-9]', '', 'g') = $1
         )`,
        [normalizedPhone, orgId]
      )
      return results.map(this.transformContact)
    } catch (error) {
      throw new DatabaseError('Failed to find contacts by phone', error instanceof Error ? error : undefined)
    }
  }

  /**
   * Add tags to a contact
   */
  async addTags(id: string, orgId: string, tags: string[]): Promise<Contact> {
    try {
      const results = await database.query<ContactRow>(
        `UPDATE contacts
         SET tags = array_cat(tags, $3), updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND org_id = $2
         RETURNING *`,
        [id, orgId, tags]
      )

      if (!results[0]) {
        throw new NotFoundError('Contact', id)
      }

      return this.transformContact(results[0])
    } catch (error) {
      if (error instanceof NotFoundError) throw error
      throw new DatabaseError('Failed to add tags', error instanceof Error ? error : undefined)
    }
  }

  /**
   * Remove tags from a contact
   */
  async removeTags(id: string, orgId: string, tags: string[]): Promise<Contact> {
    try {
      const results = await database.query<ContactRow>(
        `UPDATE contacts
         SET tags = array(
           SELECT unnest(tags) EXCEPT SELECT unnest($3::text[])
         ), updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND org_id = $2
         RETURNING *`,
        [id, orgId, tags]
      )

      if (!results[0]) {
        throw new NotFoundError('Contact', id)
      }

      return this.transformContact(results[0])
    } catch (error) {
      if (error instanceof NotFoundError) throw error
      throw new DatabaseError('Failed to remove tags', error instanceof Error ? error : undefined)
    }
  }
}

// Export singleton instance
export const contactsService = new ContactsService()
