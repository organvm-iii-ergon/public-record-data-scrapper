import { Hono } from 'hono'
import { orgScope, requireRole, unifiedAuth } from '../auth'
import { all, run } from '../db'
import { rateLimiter } from '../rateLimit'
import type { AppBindings } from '../types'

type Collection = 'prospects' | 'competitors' | 'portfolio'
interface RecordRow {
  id: string
  collection: Collection
  payload: string
}
interface ActionRow {
  action_type: string
  details: string
  occurred_at: string
}

const collections = new Set<Collection>(['prospects', 'competitors', 'portfolio'])
const jsonHeaders = { 'Cache-Control': 'no-store' }

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function decode(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value)
    return object(parsed) ? parsed : null
  } catch {
    return null
  }
}

function strings(value: unknown): boolean {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

function validPayload(collection: Collection, payload: Record<string, unknown>): boolean {
  if (collection === 'prospects') {
    return (
      typeof payload.companyName === 'string' &&
      typeof payload.industry === 'string' &&
      typeof payload.state === 'string' &&
      typeof payload.status === 'string' &&
      typeof payload.priorityScore === 'number' &&
      typeof payload.defaultDate === 'string' &&
      typeof payload.timeSinceDefault === 'number' &&
      Array.isArray(payload.uccFilings) &&
      Array.isArray(payload.growthSignals) &&
      object(payload.healthScore) &&
      typeof payload.narrative === 'string'
    )
  }
  if (collection === 'competitors') {
    return (
      typeof payload.lenderName === 'string' &&
      typeof payload.filingCount === 'number' &&
      typeof payload.avgDealSize === 'number' &&
      typeof payload.marketShare === 'number' &&
      strings(payload.industries) &&
      typeof payload.topState === 'string' &&
      typeof payload.monthlyTrend === 'number'
    )
  }
  return (
    typeof payload.companyName === 'string' &&
    typeof payload.fundingDate === 'string' &&
    typeof payload.fundingAmount === 'number' &&
    typeof payload.currentStatus === 'string' &&
    object(payload.healthScore)
  )
}

export const dashboardRoute = new Hono<AppBindings>()
dashboardRoute.use('*', unifiedAuth, rateLimiter, orgScope)

dashboardRoute.get('/', async (c) => {
  const { orgId, tier } = c.get('identity')
  const records = await all<RecordRow>(
    c.env,
    `SELECT id, collection, payload FROM dashboard_records
      WHERE org_id = ? ORDER BY collection, observed_at DESC, id`,
    orgId
  )
  const actions = await all<ActionRow>(
    c.env,
    `SELECT action_type, details, occurred_at FROM dashboard_user_actions
      WHERE org_id = ? ORDER BY occurred_at DESC, id LIMIT 100`,
    orgId
  )
  const result: Record<Collection, Record<string, unknown>[]> = {
    prospects: [],
    competitors: [],
    portfolio: []
  }
  for (const row of records) {
    const payload = decode(row.payload)
    if (!payload || !collections.has(row.collection) || !validPayload(row.collection, payload)) {
      return c.json(
        {
          error: {
            message: 'A dashboard record is invalid',
            code: 'DATA_INTEGRITY',
            statusCode: 500
          }
        },
        500,
        jsonHeaders
      )
    }
    result[row.collection].push({ ...payload, id: row.id })
  }
  const userActions = []
  for (const row of actions) {
    const details = decode(row.details)
    if (!details) {
      return c.json(
        {
          error: {
            message: 'A dashboard action is invalid',
            code: 'DATA_INTEGRITY',
            statusCode: 500
          }
        },
        500,
        jsonHeaders
      )
    }
    userActions.push({ type: row.action_type, timestamp: row.occurred_at, details })
  }
  return c.json(
    { ...result, userActions, dataTier: tier === 'free' ? 'oss' : 'paid' },
    200,
    jsonHeaders
  )
})

dashboardRoute.post('/actions', async (c) => {
  const { orgId } = c.get('identity')
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    body = null
  }
  const type = object(body) ? body.type : undefined
  const timestamp = object(body) ? body.timestamp : undefined
  const details = object(body) ? body.details : undefined
  if (
    typeof type !== 'string' ||
    !type.trim() ||
    typeof timestamp !== 'string' ||
    !Number.isFinite(Date.parse(timestamp)) ||
    !object(details)
  ) {
    return c.json(
      { error: { message: 'Invalid user action', code: 'VALIDATION_ERROR', statusCode: 400 } },
      400
    )
  }
  await run(
    c.env,
    `INSERT INTO dashboard_user_actions(id, org_id, action_type, details, occurred_at)
    VALUES (?, ?, ?, ?, ?)`,
    crypto.randomUUID(),
    orgId,
    type.trim(),
    JSON.stringify(details),
    timestamp
  )
  return c.json({ type: type.trim(), timestamp, details }, 201, jsonHeaders)
})

dashboardRoute.put('/records/:collection/:id', requireRole('admin'), async (c) => {
  const { orgId } = c.get('identity')
  const collection = c.req.param('collection') as Collection
  const id = c.req.param('id')
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    body = null
  }
  const payload = object(body) ? body.payload : undefined
  const sourceRef = object(body) ? body.sourceRef : undefined
  const observedAt = object(body) ? body.observedAt : undefined
  if (
    !collections.has(collection) ||
    !id ||
    !object(payload) ||
    !validPayload(collection, payload) ||
    typeof sourceRef !== 'string' ||
    !sourceRef.trim() ||
    typeof observedAt !== 'string' ||
    !Number.isFinite(Date.parse(observedAt))
  ) {
    return c.json(
      { error: { message: 'Invalid dashboard record', code: 'VALIDATION_ERROR', statusCode: 400 } },
      400
    )
  }
  await run(
    c.env,
    `INSERT INTO dashboard_records
      (id, org_id, collection, payload, source_ref, observed_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(org_id, collection, id) DO UPDATE SET payload=excluded.payload,
      source_ref=excluded.source_ref, observed_at=excluded.observed_at, updated_at=datetime('now')`,
    id,
    orgId,
    collection,
    JSON.stringify(payload),
    sourceRef.trim(),
    observedAt
  )
  return c.json({ ...payload, id }, 200, jsonHeaders)
})
