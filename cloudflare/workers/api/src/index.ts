/**
 * ucc-mca-edge API Worker (Hono).
 *
 * The Express-shaped edge API from telos. Routes are ported from server/routes/*
 * one at a time — security logic first. Today: a public health check and one
 * real org-scoped read (`GET /api/prospects`) demonstrating the full chain:
 * Cloudflare Access JWT → identity → org cross-check → org-scoped D1 query.
 */
import { Hono } from 'hono'
import { accessAuth, orgScope } from './auth'
import { all, first, run } from './db'
import { scheduled } from './scheduled'
import { replayWebhookDelivery, sendWebhookDelivery, triggerWebhookEvent } from './webhooks'
import { pushProspectToCrm, CRM_ADAPTERS } from './crm'
import type {
  AppBindings,
  CrmIntegrationRow,
  CrmProvider,
  CrmPushLogRow,
  WebhookDeliveryRow,
  WebhookEndpointRow
} from './types'

const app = new Hono<AppBindings>()

/** Public liveness probe (no auth — telos invariant #5: observability default-on). */
app.get('/health', (c) => {
  return c.json({
    ok: true,
    env: c.env.ENVIRONMENT,
    ...(c.env.DEPLOYMENT_SHA ? { revision: c.env.DEPLOYMENT_SHA } : {})
  })
})

interface ProspectRow {
  id: string
  company_name: string | null
  priority_score: number | null
  status: string | null
}

/**
 * GET /api/prospects — org-scoped prospect list.
 * accessAuth: requires a valid Access JWT with an org_id (else 401).
 * orgScope:  any client-supplied org_id must match the token (else 403).
 * Query is org-scoped at the SQL layer (telos invariant #3).
 */
app.get('/api/prospects', accessAuth, orgScope, async (c) => {
  const { orgId } = c.get('identity')

  // Clamp limit defensively; never trust client pagination as-is.
  const rawLimit = Number.parseInt(c.req.query('limit') ?? '50', 10)
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50

  const rows = await all<ProspectRow>(
    c.env,
    `SELECT id, company_name, priority_score, status
       FROM prospects
      WHERE org_id = ?
      ORDER BY priority_score DESC
      LIMIT ?`,
    orgId,
    limit
  )

  return c.json({ prospects: rows })
})

// ============================================================================
// Webhooks API (Issue #485)
// ============================================================================

/**
 * GET /api/webhooks — list configured webhook endpoints for the tenant.
 */
app.get('/api/webhooks', accessAuth, orgScope, async (c) => {
  const { orgId } = c.get('identity')

  const endpoints = await all<WebhookEndpointRow>(
    c.env,
    `SELECT id, org_id, url, secret, description, events, status, consecutive_failures, created_at, updated_at
       FROM webhook_endpoints
      WHERE org_id = ?
      ORDER BY created_at DESC`,
    orgId
  )

  // Mask secret keys for safe display (e.g. "whsec_****abc1")
  const masked = endpoints.map((ep) => ({
    ...ep,
    events: (() => {
      try {
        return JSON.parse(ep.events)
      } catch {
        return [ep.events]
      }
    })(),
    secret_preview:
      ep.secret.length > 8 ? `${ep.secret.slice(0, 6)}••••${ep.secret.slice(-4)}` : '••••••••'
  }))

  return c.json({ endpoints: masked })
})

/**
 * POST /api/webhooks — register a new webhook destination.
 */
app.post('/api/webhooks', accessAuth, orgScope, async (c) => {
  const { orgId } = c.get('identity')

  const body = (await c.req.json().catch(() => ({}))) as {
    url?: string
    description?: string
    events?: string[]
    secret?: string
  }

  if (!body.url || typeof body.url !== 'string') {
    return c.json(
      { error: { message: 'Missing required field: url', code: 'BAD_REQUEST', statusCode: 400 } },
      400
    )
  }

  try {
    const parsedUrl = new URL(body.url)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return c.json(
        {
          error: {
            message: 'URL protocol must be http or https',
            code: 'BAD_REQUEST',
            statusCode: 400
          }
        },
        400
      )
    }
  } catch {
    return c.json(
      {
        error: { message: 'Invalid destination URL format', code: 'BAD_REQUEST', statusCode: 400 }
      },
      400
    )
  }

  const endpointId = `whe_${crypto.randomUUID()}`
  const secret =
    body.secret && body.secret.length >= 16
      ? body.secret
      : `whsec_${crypto.randomUUID().replace(/-/g, '')}`
  const events = JSON.stringify(
    Array.isArray(body.events) && body.events.length > 0 ? body.events : ['*']
  )
  const description = body.description ?? null

  await run(
    c.env,
    `INSERT INTO webhook_endpoints (id, org_id, url, secret, description, events, status)
     VALUES (?, ?, ?, ?, ?, ?, 'active')`,
    endpointId,
    orgId,
    body.url,
    secret,
    description,
    events
  )

  return c.json(
    {
      endpoint: {
        id: endpointId,
        org_id: orgId,
        url: body.url,
        secret, // Returned plaintext on creation so caller can copy it
        description,
        events: JSON.parse(events),
        status: 'active',
        created_at: new Date().toISOString()
      }
    },
    201
  )
})

/**
 * GET /api/webhooks/:id — fetch single webhook endpoint.
 */
app.get('/api/webhooks/:id', accessAuth, orgScope, async (c) => {
  const { orgId } = c.get('identity')
  const id = c.req.param('id')

  const endpoint = await first<WebhookEndpointRow>(
    c.env,
    `SELECT * FROM webhook_endpoints WHERE id = ? AND org_id = ?`,
    id,
    orgId
  )

  if (!endpoint) {
    return c.json(
      { error: { message: 'Webhook endpoint not found', code: 'NOT_FOUND', statusCode: 404 } },
      404
    )
  }

  return c.json({
    endpoint: {
      ...endpoint,
      events: (() => {
        try {
          return JSON.parse(endpoint.events)
        } catch {
          return [endpoint.events]
        }
      })()
    }
  })
})

/**
 * PUT /api/webhooks/:id — update an existing webhook endpoint.
 */
app.put('/api/webhooks/:id', accessAuth, orgScope, async (c) => {
  const { orgId } = c.get('identity')
  const id = c.req.param('id')

  const endpoint = await first<WebhookEndpointRow>(
    c.env,
    `SELECT * FROM webhook_endpoints WHERE id = ? AND org_id = ?`,
    id,
    orgId
  )

  if (!endpoint) {
    return c.json(
      { error: { message: 'Webhook endpoint not found', code: 'NOT_FOUND', statusCode: 404 } },
      404
    )
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    url?: string
    description?: string
    events?: string[]
    status?: 'active' | 'paused' | 'disabled'
  }

  const nextUrl = body.url ?? endpoint.url
  const nextDescription = body.description !== undefined ? body.description : endpoint.description
  const nextEvents = body.events !== undefined ? JSON.stringify(body.events) : endpoint.events
  const nextStatus = body.status ?? endpoint.status

  await run(
    c.env,
    `UPDATE webhook_endpoints
        SET url = ?,
            description = ?,
            events = ?,
            status = ?,
            updated_at = datetime('now')
      WHERE id = ? AND org_id = ?`,
    nextUrl,
    nextDescription,
    nextEvents,
    nextStatus,
    id,
    orgId
  )

  return c.json({
    endpoint: {
      id,
      url: nextUrl,
      description: nextDescription,
      events: (() => {
        try {
          return JSON.parse(nextEvents)
        } catch {
          return [nextEvents]
        }
      })(),
      status: nextStatus
    }
  })
})

/**
 * DELETE /api/webhooks/:id — delete a webhook endpoint.
 */
app.delete('/api/webhooks/:id', accessAuth, orgScope, async (c) => {
  const { orgId } = c.get('identity')
  const id = c.req.param('id')

  const res = await run(
    c.env,
    `DELETE FROM webhook_endpoints WHERE id = ? AND org_id = ?`,
    id,
    orgId
  )

  if (res.meta.changes === 0) {
    return c.json(
      { error: { message: 'Webhook endpoint not found', code: 'NOT_FOUND', statusCode: 404 } },
      404
    )
  }

  return c.json({ success: true, id })
})

/**
 * POST /api/webhooks/:id/test — trigger an immediate test ping delivery.
 */
app.post('/api/webhooks/:id/test', accessAuth, orgScope, async (c) => {
  const { orgId } = c.get('identity')
  const id = c.req.param('id')

  const endpoint = await first<WebhookEndpointRow>(
    c.env,
    `SELECT * FROM webhook_endpoints WHERE id = ? AND org_id = ?`,
    id,
    orgId
  )

  if (!endpoint) {
    return c.json(
      { error: { message: 'Webhook endpoint not found', code: 'NOT_FOUND', statusCode: 404 } },
      404
    )
  }

  const deliveryId = `del_${crypto.randomUUID()}`
  const payload = {
    id: `evt_${crypto.randomUUID()}`,
    event: 'test.ping',
    created_at: new Date().toISOString(),
    api_version: '2026-09-01',
    data: {
      message: 'Ping from UCC-MCA Intelligence Platform webhook system',
      endpoint_id: id,
      timestamp: new Date().toISOString()
    }
  }

  await run(
    c.env,
    `INSERT INTO webhook_deliveries (id, org_id, webhook_id, event, payload, status, attempts, max_attempts)
     VALUES (?, ?, ?, 'test.ping', ?, 'pending', 0, 1)`,
    deliveryId,
    orgId,
    id,
    JSON.stringify(payload)
  )

  const sendResult = await sendWebhookDelivery(c.env, deliveryId)
  return c.json({ delivery_id: deliveryId, ...sendResult })
})

/**
 * GET /api/webhooks/deliveries — list delivery logs and Dead-Letter Queue (DLQ).
 * Filter by ?status=dead_letter to inspect DLQ items.
 */
app.get('/api/webhooks/deliveries', accessAuth, orgScope, async (c) => {
  const { orgId } = c.get('identity')
  const statusFilter = c.req.query('status')
  const rawLimit = Number.parseInt(c.req.query('limit') ?? '50', 10)
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50

  let rows: WebhookDeliveryRow[]
  if (statusFilter) {
    rows = await all<WebhookDeliveryRow>(
      c.env,
      `SELECT * FROM webhook_deliveries
        WHERE org_id = ? AND status = ?
        ORDER BY created_at DESC
        LIMIT ?`,
      orgId,
      statusFilter,
      limit
    )
  } else {
    rows = await all<WebhookDeliveryRow>(
      c.env,
      `SELECT * FROM webhook_deliveries
        WHERE org_id = ?
        ORDER BY created_at DESC
        LIMIT ?`,
      orgId,
      limit
    )
  }

  return c.json({ deliveries: rows })
})

/**
 * GET /api/webhooks/deliveries/:id — single delivery detail.
 */
app.get('/api/webhooks/deliveries/:id', accessAuth, orgScope, async (c) => {
  const { orgId } = c.get('identity')
  const id = c.req.param('id')

  const delivery = await first<WebhookDeliveryRow>(
    c.env,
    `SELECT * FROM webhook_deliveries WHERE id = ? AND org_id = ?`,
    id,
    orgId
  )

  if (!delivery) {
    return c.json(
      { error: { message: 'Delivery not found', code: 'NOT_FOUND', statusCode: 404 } },
      404
    )
  }

  return c.json({ delivery })
})

/**
 * POST /api/webhooks/deliveries/:id/retry — replay a dead-letter or failed delivery.
 */
app.post('/api/webhooks/deliveries/:id/retry', accessAuth, orgScope, async (c) => {
  const { orgId } = c.get('identity')
  const id = c.req.param('id')

  const replayed = await replayWebhookDelivery(c.env, orgId, id)
  if (!replayed) {
    return c.json(
      {
        error: {
          message: 'Delivery not found or cannot replay',
          code: 'NOT_FOUND',
          statusCode: 404
        }
      },
      404
    )
  }

  const updated = await first<WebhookDeliveryRow>(
    c.env,
    `SELECT * FROM webhook_deliveries WHERE id = ? AND org_id = ?`,
    id,
    orgId
  )

  return c.json({ success: true, delivery: updated })
})

// ============================================================================
// CRM Integrations API (Issue #485)
// ============================================================================

/**
 * GET /api/crm/integrations — list CRM integrations configured for tenant.
 */
app.get('/api/crm/integrations', accessAuth, orgScope, async (c) => {
  const { orgId } = c.get('identity')

  const integrations = await all<CrmIntegrationRow>(
    c.env,
    `SELECT id, org_id, provider, status, api_key, config, created_at, updated_at
       FROM crm_integrations
      WHERE org_id = ?
      ORDER BY created_at DESC`,
    orgId
  )

  // Mask API keys in response
  const masked = integrations.map((item) => ({
    ...item,
    api_key_preview:
      item.api_key.length > 8
        ? `${item.api_key.slice(0, 4)}••••${item.api_key.slice(-4)}`
        : '••••••••',
    config: (() => {
      try {
        return item.config ? JSON.parse(item.config) : {}
      } catch {
        return {}
      }
    })()
  }))

  return c.json({ integrations: masked })
})

/**
 * POST /api/crm/integrations — register or update CRM integration (HubSpot, Salesforce, GoHighLevel).
 */
app.post('/api/crm/integrations', accessAuth, orgScope, async (c) => {
  const { orgId } = c.get('identity')

  const body = (await c.req.json().catch(() => ({}))) as {
    provider?: CrmProvider
    api_key?: string
    config?: Record<string, unknown>
  }

  if (!body.provider || !['hubspot', 'salesforce', 'gohighlevel'].includes(body.provider)) {
    return c.json(
      {
        error: {
          message: 'Invalid provider. Must be "hubspot", "salesforce", or "gohighlevel"',
          code: 'BAD_REQUEST',
          statusCode: 400
        }
      },
      400
    )
  }

  if (!body.api_key || typeof body.api_key !== 'string' || body.api_key.trim().length === 0) {
    return c.json(
      {
        error: { message: 'Missing required field: api_key', code: 'BAD_REQUEST', statusCode: 400 }
      },
      400
    )
  }

  // Verify credentials via provider adapter
  const adapter = CRM_ADAPTERS[body.provider]
  const isValid = await adapter.verifyCredentials(body.api_key)
  const status = isValid ? 'active' : 'error'

  const id = `crm_${crypto.randomUUID()}`
  const configString = body.config ? JSON.stringify(body.config) : null

  // Upsert on (org_id, provider)
  await run(
    c.env,
    `INSERT INTO crm_integrations (id, org_id, provider, status, api_key, config, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(org_id, provider) DO UPDATE SET
       status = excluded.status,
       api_key = excluded.api_key,
       config = excluded.config,
       updated_at = datetime('now')`,
    id,
    orgId,
    body.provider,
    status,
    body.api_key,
    configString
  )

  return c.json({
    success: true,
    provider: body.provider,
    status,
    verified: isValid,
    message: isValid
      ? 'Integration connected and verified'
      : 'Connected but credential verification failed'
  })
})

/**
 * DELETE /api/crm/integrations/:id — delete a CRM integration.
 */
app.delete('/api/crm/integrations/:id', accessAuth, orgScope, async (c) => {
  const { orgId } = c.get('identity')
  const id = c.req.param('id')

  const res = await run(
    c.env,
    `DELETE FROM crm_integrations WHERE id = ? AND org_id = ?`,
    id,
    orgId
  )

  if (res.meta.changes === 0) {
    return c.json(
      { error: { message: 'Integration not found', code: 'NOT_FOUND', statusCode: 404 } },
      404
    )
  }

  return c.json({ success: true, id })
})

/**
 * POST /api/crm/push — push a UCC prospect to the configured CRM.
 */
app.post('/api/crm/push', accessAuth, orgScope, async (c) => {
  const { orgId } = c.get('identity')

  const body = (await c.req.json().catch(() => ({}))) as {
    prospect_id?: string
    provider?: CrmProvider
  }

  if (!body.prospect_id || typeof body.prospect_id !== 'string') {
    return c.json(
      {
        error: {
          message: 'Missing required field: prospect_id',
          code: 'BAD_REQUEST',
          statusCode: 400
        }
      },
      400
    )
  }

  const result = await pushProspectToCrm(c.env, orgId, body.prospect_id, body.provider)

  if (!result.success) {
    return c.json(
      {
        error: {
          message: result.error ?? 'CRM push failed',
          code: 'CRM_PUSH_FAILED',
          statusCode: 502
        }
      },
      502
    )
  }

  // Also trigger outbound webhook for the prospect push event
  c.executionCtx.waitUntil(
    triggerWebhookEvent(c.env, orgId, 'prospect.pushed_to_crm', {
      prospect_id: body.prospect_id,
      provider: result.provider,
      external_id: result.externalId,
      timestamp: new Date().toISOString()
    })
  )

  return c.json({ ...result })
})

/**
 * GET /api/crm/logs — view CRM push audit log.
 */
app.get('/api/crm/logs', accessAuth, orgScope, async (c) => {
  const { orgId } = c.get('identity')
  const rawLimit = Number.parseInt(c.req.query('limit') ?? '50', 10)
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50

  const logs = await all<CrmPushLogRow>(
    c.env,
    `SELECT * FROM crm_push_logs WHERE org_id = ? ORDER BY created_at DESC LIMIT ?`,
    orgId,
    limit
  )

  return c.json({ logs })
})

/**
 * Fail-closed error handler. Never leak internals (telos invariant #5: no
 * silent failure, but also no stack traces to clients). Log server-side; return
 * a generic shape matching the Express API.
 */
app.onError((err, c) => {
  console.error('[api] unhandled error', err)
  return c.json(
    { error: { message: 'Internal Server Error', code: 'INTERNAL', statusCode: 500 } },
    500
  )
})

/** 404 fallback in the same envelope as the rest of the API. */
app.notFound((c) => {
  return c.json({ error: { message: 'Not Found', code: 'NOT_FOUND', statusCode: 404 } }, 404)
})

export default {
  fetch: app.fetch,
  scheduled
}
