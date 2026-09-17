import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { database } from '../../server/database/connection'
import { config } from '../../server/config'
import { ConsentService } from '../../server/services/ConsentService'

let connected = false
let orgId: string
let contactId: string

beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL
  if (!url || !new URL(url).pathname.endsWith('_test')) {
    throw new Error('Database integration requires an explicit TEST_DATABASE_URL ending in _test')
  }
  config.database.url = url
  // Every query in a test uses one connection, including BEGIN and ROLLBACK.
  // No request tenant context is installed in this service integration suite.
  config.database.maxConnections = 1
  await database.connect()
  connected = true
})

beforeEach(async () => {
  await database.query('BEGIN')
  orgId = randomUUID()
  contactId = randomUUID()
  await database.query('INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)', [
    orgId,
    'Isolated test tenant',
    orgId
  ])
  await database.query(
    'INSERT INTO contacts (id, org_id, first_name, last_name) VALUES ($1, $2, $3, $4)',
    [contactId, orgId, 'Test', 'Contact']
  )
})

afterEach(async () => {
  if (!connected) return
  await database.query('ROLLBACK')
  const rows = await database.query('SELECT id FROM organizations WHERE id = $1', [orgId])
  expect(rows).toEqual([])
})

afterAll(async () => {
  if (connected) await database.disconnect()
})

describe('migrated PostgreSQL persistence', () => {
  it('returns rows, including affected rows, through the real connection adapter', async () => {
    const rows = await database.query(
      'UPDATE contacts SET title = $1 WHERE id = $2 RETURNING 1 AS affected',
      ['Owner', contactId]
    )
    expect(rows).toEqual([{ affected: 1 }])
    expect(await database.query('SELECT title FROM contacts WHERE id = $1', [contactId])).toEqual([
      { title: 'Owner' }
    ])
    expect(
      await database.query('DELETE FROM contacts WHERE id = $1 RETURNING 1 AS affected', [
        randomUUID()
      ])
    ).toEqual([])
  })

  it('persists consent revocation and counts the grant plus channel marker', async () => {
    const service = new ConsentService()
    await service.recordConsent({
      orgId,
      contactId,
      consentType: 'express_written',
      channel: 'email',
      collectionMethod: 'web_form'
    })
    expect(await service.revokeConsent(orgId, contactId, 'email', 'withdrawn')).toBe(2)
    const rows = await database.query<{
      is_granted: boolean
      revoked_reason: string
      revoked_at: Date
    }>('SELECT is_granted, revoked_reason, revoked_at FROM consent_records WHERE contact_id = $1', [
      contactId
    ])
    expect(rows).toHaveLength(2)
    expect(rows.every((row) => row.revoked_at !== null && row.revoked_reason === 'withdrawn')).toBe(
      true
    )
  })

  it('does not revoke another tenant contact', async () => {
    const service = new ConsentService()
    await service.recordConsent({
      orgId,
      contactId,
      consentType: 'express_written',
      channel: 'all',
      collectionMethod: 'web_form'
    })
    expect(await service.revokeConsent(randomUUID(), contactId, 'all')).toBe(0)
    const rows = await database.query<{ is_granted: boolean }>(
      'SELECT is_granted FROM consent_records WHERE contact_id = $1',
      [contactId]
    )
    expect(rows).toEqual([{ is_granted: true }])
    expect(await service.revokeConsent(randomUUID(), contactId, 'email')).toBe(0)
  })

  it('keeps audit immutability enabled while rollback removes test writes', async () => {
    await database.query(
      'INSERT INTO audit_logs (org_id, action, entity_type) VALUES ($1, $2, $3)',
      [orgId, 'create', 'integration-test']
    )
    // Hold the connection across the expected error; pool.query discards a
    // connection on rejection, which would also discard the savepoint.
    const client = await database.getPoolClient()
    try {
      await client.query('SAVEPOINT immutable_check')
      await expect(
        client.query('DELETE FROM audit_logs WHERE org_id = $1', [orgId])
      ).rejects.toThrow(/immutable/)
      await client.query('ROLLBACK TO SAVEPOINT immutable_check')
    } finally {
      client.release()
    }
    const rows = await database.query('SELECT id FROM audit_logs WHERE org_id = $1', [orgId])
    expect(rows).toHaveLength(1)
  })
})
