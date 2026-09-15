/**
 * Versioned REST API — /v1/prospects
 *
 * Provides org-scoped CRUD and listing for UCC prospects.
 * Enforces telos invariant #3: every query binds `org_id` from the verified identity.
 */
import { Hono } from 'hono'
import { all, first, run } from '../db'
import type { AppBindings, ProspectRow } from '../types'

export const prospectsRoute = new Hono<AppBindings>()

/**
 * GET /v1/prospects — Org-scoped list of prospects.
 */
prospectsRoute.get('/', async (c) => {
  const { orgId } = c.get('identity')

  const rawLimit = Number.parseInt(c.req.query('limit') ?? '50', 10)
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50

  const rawOffset = Number.parseInt(c.req.query('offset') ?? '0', 10)
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0

  const statusFilter = c.req.query('status')
  const minPriorityRaw = c.req.query('min_priority')
  const minPriority = minPriorityRaw !== undefined ? Number.parseInt(minPriorityRaw, 10) : undefined

  const conditions: string[] = ['org_id = ?']
  const params: unknown[] = [orgId]

  if (statusFilter) {
    conditions.push('status = ?')
    params.push(statusFilter)
  }

  if (minPriority !== undefined && Number.isFinite(minPriority)) {
    conditions.push('priority_score >= ?')
    params.push(minPriority)
  }

  const whereClause = conditions.join(' AND ')

  // Total count for pagination metadata
  const countRow = await first<{ total: number }>(
    c.env,
    `SELECT COUNT(*) as total FROM prospects WHERE ${whereClause}`,
    ...params
  )
  const total = countRow?.total ?? 0

  // Fetch paginated records
  const queryParams = [...params, limit, offset]
  const rows = await all<ProspectRow>(
    c.env,
    `SELECT id, org_id, company_name, priority_score, status, enrichment_confidence, raw_data, created_at
       FROM prospects
      WHERE ${whereClause}
      ORDER BY priority_score DESC, created_at DESC
      LIMIT ? OFFSET ?`,
    ...queryParams
  )

  const data = rows.map((r) => {
    let parsedRawData: unknown = r.raw_data
    if (typeof r.raw_data === 'string') {
      try {
        parsedRawData = JSON.parse(r.raw_data)
      } catch {
        // Keep string if not valid JSON
      }
    }
    return {
      id: r.id,
      company_name: r.company_name,
      priority_score: r.priority_score,
      status: r.status,
      enrichment_confidence: r.enrichment_confidence,
      raw_data: parsedRawData,
      created_at: r.created_at
    }
  })

  return c.json({
    data,
    meta: {
      total,
      limit,
      offset
    }
  })
})

/**
 * GET /v1/prospects/:id — Get a single prospect by ID.
 * Returns 404 if the prospect does not exist or belongs to another tenant.
 */
prospectsRoute.get('/:id', async (c) => {
  const { orgId } = c.get('identity')
  const id = c.req.param('id')

  const row = await first<ProspectRow>(
    c.env,
    `SELECT id, org_id, company_name, priority_score, status, enrichment_confidence, raw_data, created_at
       FROM prospects
      WHERE id = ? AND org_id = ?`,
    id,
    orgId
  )

  if (!row) {
    return c.json(
      { error: { message: 'Prospect not found', code: 'NOT_FOUND', statusCode: 404 } },
      404
    )
  }

  let parsedRawData: unknown = row.raw_data
  if (typeof row.raw_data === 'string') {
    try {
      parsedRawData = JSON.parse(row.raw_data)
    } catch {
      // Keep string if not valid JSON
    }
  }

  return c.json({
    data: {
      id: row.id,
      company_name: row.company_name,
      priority_score: row.priority_score,
      status: row.status,
      enrichment_confidence: row.enrichment_confidence,
      raw_data: parsedRawData,
      created_at: row.created_at
    }
  })
})

interface CreateProspectBody {
  company_name: string
  priority_score?: number
  status?: string
  enrichment_confidence?: number
  raw_data?: unknown
}

/**
 * POST /v1/prospects — Ingest a new prospect into the tenant's pipeline.
 */
prospectsRoute.post('/', async (c) => {
  const { orgId } = c.get('identity')

  let body: CreateProspectBody
  try {
    body = await c.req.json<CreateProspectBody>()
  } catch {
    return c.json(
      { error: { message: 'Invalid JSON request body', code: 'BAD_REQUEST', statusCode: 400 } },
      400
    )
  }

  if (
    !body.company_name ||
    typeof body.company_name !== 'string' ||
    body.company_name.trim().length === 0
  ) {
    return c.json(
      { error: { message: 'company_name is required', code: 'VALIDATION_ERROR', statusCode: 400 } },
      400
    )
  }

  const priorityScore =
    typeof body.priority_score === 'number' &&
    body.priority_score >= 0 &&
    body.priority_score <= 100
      ? Math.round(body.priority_score)
      : null

  const confidence =
    typeof body.enrichment_confidence === 'number' &&
    body.enrichment_confidence >= 0 &&
    body.enrichment_confidence <= 1
      ? body.enrichment_confidence
      : null

  const rawDataString = body.raw_data !== undefined ? JSON.stringify(body.raw_data) : null
  const id = crypto.randomUUID()
  const status = body.status?.trim() || 'new'

  await run(
    c.env,
    `INSERT INTO prospects (id, org_id, company_name, priority_score, status, enrichment_confidence, raw_data)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    orgId,
    body.company_name.trim(),
    priorityScore,
    status,
    confidence,
    rawDataString
  )

  const created = await first<ProspectRow>(
    c.env,
    `SELECT id, company_name, priority_score, status, enrichment_confidence, raw_data, created_at
       FROM prospects
      WHERE id = ? AND org_id = ?`,
    id,
    orgId
  )

  return c.json({ data: created }, 201)
})
