/**
 * Versioned REST API — /v1/jobs
 *
 * Async jobs queue delivery for $0 edge ingestion and background tasks.
 * Jobs are drained by the cron trigger handler (see scheduled.ts).
 */
import { Hono } from 'hono'
import { all, first, run } from '../db'
import type { AppBindings, JobRow } from '../types'

export const jobsRoute = new Hono<AppBindings>()
const INTERNAL_JOB_TYPES = new Set(['webhook_delivery', 'crm_push'])

/**
 * GET /v1/jobs — List background jobs for the tenant.
 */
jobsRoute.get('/', async (c) => {
  const { orgId } = c.get('identity')

  const rawLimit = Number.parseInt(c.req.query('limit') ?? '50', 10)
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50

  const rawOffset = Number.parseInt(c.req.query('offset') ?? '0', 10)
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0

  const status = c.req.query('status')

  const conditions: string[] = ['org_id = ?']
  const params: unknown[] = [orgId]

  if (status) {
    conditions.push('status = ?')
    params.push(status)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const countRow = await first<{ total: number }>(
    c.env,
    `SELECT COUNT(*) as total FROM jobs ${whereClause}`,
    ...params
  )
  const total = countRow?.total ?? 0

  const rows = await all<JobRow>(
    c.env,
    `SELECT id, type, payload, status, org_id, attempts, created_at
       FROM jobs
       ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset
  )

  const data = rows.map((job) => {
    let parsedPayload: unknown = job.payload
    if (typeof job.payload === 'string') {
      try {
        parsedPayload = JSON.parse(job.payload)
      } catch {
        // keep string
      }
    }
    return {
      id: job.id,
      type: job.type,
      payload: parsedPayload,
      status: job.status,
      org_id: job.org_id,
      attempts: job.attempts,
      created_at: job.created_at
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
 * GET /v1/jobs/:id — Retrieve a background job status.
 */
jobsRoute.get('/:id', async (c) => {
  const { orgId } = c.get('identity')
  const id = c.req.param('id')

  const job = await first<JobRow>(
    c.env,
    `SELECT id, type, payload, status, org_id, attempts, created_at
       FROM jobs
      WHERE id = ? AND org_id = ?`,
    id,
    orgId
  )

  if (!job) {
    return c.json({ error: { message: 'Job not found', code: 'NOT_FOUND', statusCode: 404 } }, 404)
  }

  let parsedPayload: unknown = job.payload
  if (typeof job.payload === 'string') {
    try {
      parsedPayload = JSON.parse(job.payload)
    } catch {
      // keep string
    }
  }

  return c.json({
    data: {
      id: job.id,
      type: job.type,
      payload: parsedPayload,
      status: job.status,
      org_id: job.org_id,
      attempts: job.attempts,
      created_at: job.created_at
    }
  })
})

interface CreateJobBody {
  type: string
  payload?: unknown
}

/**
 * POST /v1/jobs — Enqueue an asynchronous pipeline job.
 */
jobsRoute.post('/', async (c) => {
  const { orgId } = c.get('identity')

  let body: CreateJobBody
  try {
    body = await c.req.json<CreateJobBody>()
  } catch {
    return c.json(
      { error: { message: 'Invalid JSON body', code: 'BAD_REQUEST', statusCode: 400 } },
      400
    )
  }

  if (!body.type || typeof body.type !== 'string' || body.type.trim().length === 0) {
    return c.json(
      { error: { message: 'Job type is required', code: 'VALIDATION_ERROR', statusCode: 400 } },
      400
    )
  }

  const jobType = body.type.trim()
  if (INTERNAL_JOB_TYPES.has(jobType)) {
    return c.json(
      {
        error: {
          message: 'This job type is reserved for internal producers',
          code: 'FORBIDDEN_JOB_TYPE',
          statusCode: 403
        }
      },
      403
    )
  }

  const id = crypto.randomUUID()
  const payloadStr = body.payload !== undefined ? JSON.stringify(body.payload) : '{}'

  await run(
    c.env,
    `INSERT INTO jobs (id, type, payload, status, org_id, attempts)
     VALUES (?, ?, ?, 'pending', ?, 0)`,
    id,
    jobType,
    payloadStr,
    orgId
  )

  const created = await first<JobRow>(
    c.env,
    `SELECT id, type, payload, status, org_id, attempts, created_at
       FROM jobs
      WHERE id = ?`,
    id
  )

  return c.json({ data: created }, 202)
})
