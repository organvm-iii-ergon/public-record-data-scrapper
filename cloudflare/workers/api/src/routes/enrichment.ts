/**
 * Versioned REST API — /v1/enrichment
 *
 * Enrichment delivery endpoints for data-as-a-service consumers.
 * Enforces tier entitlements at the edge before dispatching jobs.
 */
import { Hono, type Context } from 'hono'
import { all, first } from '../db'
import { requireTier } from '../rateLimit'
import type { AppBindings, ProspectRow } from '../types'

export const enrichmentRoute = new Hono<AppBindings>()

function unavailableResponse(c: Context<AppBindings>) {
  return c.json(
    {
      error: {
        message: 'Edge enrichment execution is not available',
        code: 'SERVICE_UNAVAILABLE',
        statusCode: 503
      }
    },
    503
  )
}

interface SingleEnrichmentBody {
  prospect_id: string
}

/**
 * POST /v1/enrichment/prospect — Trigger enrichment for a single prospect.
 * Available to all tiers.
 */
enrichmentRoute.post('/prospect', async (c) => {
  const { orgId } = c.get('identity')

  let body: SingleEnrichmentBody
  try {
    body = await c.req.json<SingleEnrichmentBody>()
  } catch {
    return c.json(
      { error: { message: 'Invalid JSON body', code: 'BAD_REQUEST', statusCode: 400 } },
      400
    )
  }

  if (!body.prospect_id || typeof body.prospect_id !== 'string') {
    return c.json(
      { error: { message: 'prospect_id is required', code: 'VALIDATION_ERROR', statusCode: 400 } },
      400
    )
  }

  // Verify the prospect belongs to this organization
  const prospect = await first<ProspectRow>(
    c.env,
    'SELECT id, company_name FROM prospects WHERE id = ? AND org_id = ?',
    body.prospect_id,
    orgId
  )

  if (!prospect) {
    return c.json(
      { error: { message: 'Prospect not found', code: 'NOT_FOUND', statusCode: 404 } },
      404
    )
  }

  return unavailableResponse(c)
})

interface BatchEnrichmentBody {
  prospect_ids: string[]
}

/**
 * POST /v1/enrichment/batch — High-volume prospect batch enrichment.
 * Gated at the edge: requires Growth or Enterprise tier entitlement.
 */
enrichmentRoute.post('/batch', requireTier('growth'), async (c) => {
  let body: BatchEnrichmentBody
  try {
    body = await c.req.json<BatchEnrichmentBody>()
  } catch {
    return c.json(
      { error: { message: 'Invalid JSON body', code: 'BAD_REQUEST', statusCode: 400 } },
      400
    )
  }

  if (!Array.isArray(body.prospect_ids) || body.prospect_ids.length === 0) {
    return c.json(
      {
        error: {
          message: 'prospect_ids must be a non-empty array',
          code: 'VALIDATION_ERROR',
          statusCode: 400
        }
      },
      400
    )
  }

  if (body.prospect_ids.length > 100) {
    return c.json(
      {
        error: {
          message: 'Batch size exceeds maximum limit of 100 prospects',
          code: 'VALIDATION_ERROR',
          statusCode: 400
        }
      },
      400
    )
  }

  return unavailableResponse(c)
})

/**
 * GET /v1/enrichment/status — Pipeline status and queued metrics for tenant.
 */
enrichmentRoute.get('/status', async (c) => {
  const { orgId } = c.get('identity')

  const counts = await all<{ status: string; count: number }>(
    c.env,
    `SELECT status, COUNT(*) as count
       FROM jobs
      WHERE org_id = ? AND type IN ('data-enrichment', 'batch-enrichment')
      GROUP BY status`,
    orgId
  )

  const statusMap: Record<string, number> = {
    pending: 0,
    processing: 0,
    done: 0,
    failed: 0
  }

  for (const row of counts) {
    if (row.status in statusMap) {
      statusMap[row.status] = row.count
    }
  }

  return c.json({
    data: {
      pipeline: 'enrichment',
      queue: statusMap,
      healthy: false,
      available: false
    }
  })
})
