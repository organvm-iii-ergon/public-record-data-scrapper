/**
 * ucc-mca-edge API Worker (Hono).
 *
 * Versioned REST API (v1) delivery platform for multi-tenant UCC data access.
 * Implements:
 *  - Public health & OpenAPI endpoints (/health, /v1/health, /openapi.json, /v1/openapi.json)
 *  - Edge API key & Access JWT authentication (unifiedAuth)
 *  - Edge sliding-window rate limiting & tier entitlement checks (rateLimiter)
 *  - Org-scoped resource routes (/v1/prospects, /v1/jobs, /v1/enrichment, /v1/keys)
 *  - Fail-closed error handling & structured logging
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { accessAuth, orgScope, unifiedAuth } from './auth'
import { all } from './db'
import { rateLimiter } from './rateLimit'
import { enrichmentRoute } from './routes/enrichment'
import { jobsRoute } from './routes/jobs'
import { keysRoute } from './routes/keys'
import { openApiSpec } from './routes/openapi'
import { prospectsRoute } from './routes/prospects'
import { scheduled } from './scheduled'
import type { Context } from 'hono'
import type { AppBindings, ProspectRow } from './types'

const app = new Hono<AppBindings>()

// Global permissive CORS for API clients
app.use('*', cors())

/** Public liveness probe (no auth — telos invariant #5: observability default-on). */
const healthHandler = (c: Context<AppBindings>) => {
  return c.json({
    ok: true,
    env: c.env.ENVIRONMENT,
    ...(c.env.DEPLOYMENT_SHA ? { revision: c.env.DEPLOYMENT_SHA } : {})
  })
}

app.get('/health', healthHandler)
app.get('/v1/health', healthHandler)

/** OpenAPI Specification */
app.get('/openapi.json', (c) => c.json(openApiSpec))
app.get('/v1/openapi.json', (c) => c.json(openApiSpec))

// ============================================================================
// Version 1 (v1) Sub-Application
// ============================================================================
const v1 = new Hono<AppBindings>()

// Protect v1 business endpoints with edge auth and rate limiting
v1.use('/prospects/*', unifiedAuth, rateLimiter)
v1.use('/prospects', unifiedAuth, rateLimiter)
v1.use('/jobs/*', unifiedAuth, rateLimiter)
v1.use('/jobs', unifiedAuth, rateLimiter)
v1.use('/enrichment/*', unifiedAuth, rateLimiter)
v1.use('/enrichment', unifiedAuth, rateLimiter)
v1.use('/keys/*', unifiedAuth, rateLimiter)
v1.use('/keys', unifiedAuth, rateLimiter)

v1.route('/prospects', prospectsRoute)
v1.route('/jobs', jobsRoute)
v1.route('/enrichment', enrichmentRoute)
v1.route('/keys', keysRoute)

app.route('/v1', v1)

// ============================================================================
// Legacy /api routes for backward compatibility
// ============================================================================

/**
 * GET /api/prospects — org-scoped prospect list (legacy Cloudflare Access auth).
 */
app.get('/api/prospects', accessAuth, orgScope, async (c) => {
  const { orgId } = c.get('identity')

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

/**
 * Fail-closed error handler. Never leak internals (telos invariant #5).
 */
app.onError((err, c) => {
  console.error('[api] unhandled error', err)
  return c.json(
    { error: { message: 'Internal Server Error', code: 'INTERNAL', statusCode: 500 } },
    500
  )
})

/** 404 fallback in the standard API envelope. */
app.notFound((c) => {
  return c.json({ error: { message: 'Not Found', code: 'NOT_FOUND', statusCode: 404 } }, 404)
})

export default {
  fetch: app.fetch,
  scheduled
}
