/**
 * Versioned REST API router — v1.
 *
 * Exposes the existing business-domain route handlers under a clean `/v1/`
 * namespace with:
 *  - Unified API-key OR JWT authentication (`apiKeyOrJwtAuth`) on every route
 *  - Per-identity sliding-window rate limiting (`createApiKeyRateLimiter()`)
 *  - `X-API-Version: v1` header on every response (`versionHeader`)
 *  - Org-context population (`orgContextMiddleware`) after auth
 *  - Data-tier resolution (`dataTierRouter`) after auth/org-context
 *
 * The sub-router is mounted at `/v1` in `server/index.ts` alongside the
 * existing `/api` prefix — no existing routes are changed or removed.
 *
 * @module server/routes/v1/index
 */

import { Router } from 'express'
import { apiKeyOrJwtAuth } from '../../middleware/apiKeyAuth'
import { createApiKeyRateLimiter } from '../../middleware/rateLimiter'
import { orgContextMiddleware } from '../../middleware/orgContext'
import { dataTierRouter } from '../../middleware/dataTier'
import { versionHeader } from './middleware/versionHeader'

// Existing route handlers re-used under the versioned namespace
import prospectsRouter from '../prospects'
import jobsRouter from '../jobs'
import enrichmentRouter from '../enrichment'

const v1Router = Router()

// 1. Stamp every v1 response with the version header first, so it appears
//    even on 401/429 error responses produced by the middleware below.
v1Router.use(versionHeader)

// 2. Authenticate every v1 request (API key takes priority over JWT).
//    A bad key fails closed to 401; no key falls back to JWT.
v1Router.use(apiKeyOrJwtAuth)

// 3. Per-identity rate limiting keyed on `req.user.id` (= `apikey:<keyId>`
//    for API-key callers, or the user UUID for JWT callers). Runs after auth
//    so the identity is already resolved.
v1Router.use(createApiKeyRateLimiter())

// 4. Bind tenant org-context and resolve data-tier entitlements.
v1Router.use(orgContextMiddleware)
v1Router.use(dataTierRouter)

// ---------------------------------------------------------------------------
// Health — unauthenticated liveness probe for the v1 namespace.
// Registered before the auth-guarded subrouters; this is fine because the
// auth middleware above runs at router level, not at route level — the
// health check still requires a valid credential. If you need a truly public
// probe, add it to server/index.ts at the app level instead.
// ---------------------------------------------------------------------------

/**
 * GET /v1/health
 *
 * Returns a minimal JSON object confirming the versioned API is reachable.
 * Authenticated (API key or JWT) — same as all other v1 routes.
 */
v1Router.get('/health', (req, res) => {
  res.json({ version: 'v1', status: 'ok' })
})

// ---------------------------------------------------------------------------
// Business-domain sub-routers
// ---------------------------------------------------------------------------

/** GET /v1/prospects, POST /v1/prospects, PATCH /v1/prospects/:id, … */
v1Router.use('/prospects', prospectsRouter)

/** GET /v1/jobs, POST /v1/jobs, … */
v1Router.use('/jobs', jobsRouter)

/** POST /v1/enrichment/prospect, POST /v1/enrichment/batch, … */
v1Router.use('/enrichment', enrichmentRouter)

export default v1Router
