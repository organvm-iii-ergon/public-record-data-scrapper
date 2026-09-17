/**
 * Cloudflare Access (Zero Trust) JWT & API Key authentication — edge identity plane.
 *
 * Implements multi-tenant B2B authentication:
 *  1. Programmatic access: Long-lived API keys (`prk_...`) sent via `X-API-Key`
 *     or `Authorization: Bearer prk_...`. Hashed using SHA-256 before D1 lookup.
 *  2. Interactive / Dashboard access: Cloudflare Access JWT in `Cf-Access-Jwt-Assertion`
 *     verified against Zero Trust team JWKS.
 *
 * FAIL CLOSED everywhere: missing, malformed, revoked, or expired credentials yield 401.
 * Tenant isolation is rooted in the resolved `identity.orgId`.
 */
import { createMiddleware } from 'hono/factory'
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import { all, first, run } from './db'
import type { AppBindings, Env, Identity, SubscriptionTier } from './types'

export const ACCESS_HEADER = 'Cf-Access-Jwt-Assertion'
export const API_KEY_HEADER = 'X-API-Key'
export const API_KEY_PREFIX = 'prk_'

/**
 * JWKS sets are keyed by team domain and cached for the lifetime of the
 * isolate. `createRemoteJWKSet` caches keys and refetches on unknown `kid`.
 */
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

function getJwks(teamDomain: string): ReturnType<typeof createRemoteJWKSet> {
  let jwks = jwksCache.get(teamDomain)
  if (!jwks) {
    const certsUrl = new URL(`https://${teamDomain}/cdn-cgi/access/certs`)
    jwks = createRemoteJWKSet(certsUrl)
    jwksCache.set(teamDomain, jwks)
  }
  return jwks
}

/**
 * SHA-256 hex digest using native Web Crypto API.
 */
export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Pull an API key out of request headers (X-API-Key or Authorization: Bearer prk_...).
 */
export function extractApiKey(apiKeyHeader?: string, authHeader?: string): string | undefined {
  if (typeof apiKeyHeader === 'string' && apiKeyHeader.trim().length > 0) {
    return apiKeyHeader.trim()
  }

  if (typeof authHeader === 'string') {
    const parts = authHeader.trim().split(/\s+/)
    if (
      parts.length === 2 &&
      parts[0]?.toLowerCase() === 'bearer' &&
      parts[1]?.startsWith(API_KEY_PREFIX)
    ) {
      return parts[1]
    }
  }

  return undefined
}

interface ApiKeyVerifyRow {
  id: string
  org_id: string
  role: string
  expires_at: string | null
  revoked_at: string | null
  subscription_tier: string | null
}

interface AccessMembershipRow {
  org_id: string
  role: string
  subscription_tier: SubscriptionTier
}

interface AccessEnrollmentRow extends AccessMembershipRow {
  email: string
  claimed_subject: string | null
}

/**
 * Verify a presented API key against D1.
 * Returns the resolved `Identity` or `null` if invalid, revoked, or expired.
 */
export async function verifyApiKey(env: Env, presentedKey: string): Promise<Identity | null> {
  if (!presentedKey.startsWith(API_KEY_PREFIX)) {
    return null
  }

  const keyHash = await hashApiKey(presentedKey)

  const row = await first<ApiKeyVerifyRow>(
    env,
    `SELECT a.id, a.org_id, a.role, a.expires_at, a.revoked_at, o.subscription_tier
       FROM api_keys a
       INNER JOIN organizations o ON a.org_id = o.id
      WHERE a.key_hash = ?`,
    keyHash
  )

  if (!row) return null
  if (row.revoked_at !== null) return null
  if (
    row.expires_at !== null &&
    (!Number.isFinite(Date.parse(row.expires_at)) || Date.parse(row.expires_at) <= Date.now())
  ) {
    return null
  }

  // Best-effort usage timestamp update; failures must not block the request.
  try {
    await run(env, `UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?`, row.id)
  } catch {
    // ignore
  }

  const identity: Identity = {
    orgId: row.org_id,
    role: row.role ?? 'user',
    tier: (row.subscription_tier as SubscriptionTier) || 'free',
    authMethod: 'api_key',
    keyId: row.id
  }

  return identity
}

function extractOrgId(payload: JWTPayload): string | undefined {
  for (const [key, value] of Object.entries(payload)) {
    if (
      (key === 'org_id' || key.endsWith('/org_id')) &&
      typeof value === 'string' &&
      value.length > 0
    ) {
      return value
    }
  }
  return undefined
}

/** Called only after signature, issuer and audience verification. */
export async function resolveAccessMembership(
  env: Env,
  payload: JWTPayload
): Promise<Identity | null> {
  if (!payload.sub || payload.iss !== `https://${env.ACCESS_TEAM_DOMAIN}`) return null
  const requestedOrg = extractOrgId(payload)
  let rows = await all<AccessMembershipRow>(
    env,
    `SELECT m.org_id, m.role, o.subscription_tier FROM access_memberships m
      JOIN organizations o ON o.id = m.org_id
      WHERE m.issuer = ? AND m.subject = ? AND m.revoked_at IS NULL
        AND (? IS NULL OR m.org_id = ?) LIMIT 2`,
    payload.iss,
    payload.sub,
    requestedOrg ?? null,
    requestedOrg ?? null
  )
  if (rows.length === 0 && typeof payload.email === 'string') {
    const email = payload.email.trim().toLowerCase()
    if (email.length > 3) {
      const enrollments = await all<AccessEnrollmentRow>(
        env,
        `SELECT i.email, i.org_id, i.role, i.claimed_subject, o.subscription_tier
           FROM access_enrollment_invites i
           JOIN organizations o ON o.id = i.org_id
          WHERE i.issuer = ? AND i.email = ? AND i.revoked_at IS NULL
            AND (i.expires_at IS NULL OR
              (julianday(i.expires_at) IS NOT NULL AND julianday(i.expires_at) > julianday('now')))
            AND (i.claimed_subject IS NULL OR i.claimed_subject = ?)
            AND (? IS NULL OR i.org_id = ?) LIMIT 2`,
        payload.iss,
        email,
        payload.sub,
        requestedOrg ?? null,
        requestedOrg ?? null
      )
      if (enrollments.length === 1 && enrollments[0]) {
        const enrollment = enrollments[0]
        const [claimed] = await env.DB.batch([
          env.DB.prepare(
            `UPDATE access_enrollment_invites
                SET claimed_subject = COALESCE(claimed_subject, ?),
                    claimed_at = COALESCE(claimed_at, datetime('now'))
              WHERE issuer = ? AND email = ? AND org_id = ?
                AND role = ? AND revoked_at IS NULL
                AND (expires_at IS NULL OR
                  (julianday(expires_at) IS NOT NULL AND julianday(expires_at) > julianday('now')))
                AND (claimed_subject IS NULL OR claimed_subject = ?)`
          ).bind(payload.sub, payload.iss, email, enrollment.org_id, enrollment.role, payload.sub),
          env.DB.prepare(
            `INSERT INTO access_memberships(issuer, subject, org_id, role)
           SELECT issuer, ?, org_id, role
             FROM access_enrollment_invites
            WHERE issuer = ? AND email = ? AND org_id = ? AND role = ?
              AND claimed_subject = ? AND revoked_at IS NULL
              AND (expires_at IS NULL OR
                (julianday(expires_at) IS NOT NULL AND julianday(expires_at) > julianday('now')))
           ON CONFLICT(issuer, subject, org_id) DO NOTHING`
          ).bind(payload.sub, payload.iss, email, enrollment.org_id, enrollment.role, payload.sub)
        ])
        if (!claimed || claimed.meta.changes !== 1) return null
        rows = await all<AccessMembershipRow>(
          env,
          `SELECT m.org_id, m.role, o.subscription_tier FROM access_memberships m
            JOIN organizations o ON o.id = m.org_id
            WHERE m.issuer = ? AND m.subject = ? AND m.revoked_at IS NULL
              AND (? IS NULL OR m.org_id = ?) LIMIT 2`,
          payload.iss,
          payload.sub,
          requestedOrg ?? null,
          requestedOrg ?? null
        )
      }
    }
  }
  // Ambiguous memberships require an explicit organization selection; claims
  // can select a membership but can never create one or elevate its role.
  if (rows.length !== 1) return null
  const row = rows[0]
  if (!row) return null
  return {
    orgId: row.org_id,
    role: row.role,
    tier: row.subscription_tier,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    authMethod: 'cf_access'
  }
}

/**
 * Verify Cloudflare Access JWT and resolve tenant identity + tier.
 */
export async function verifyAccessJwt(
  token: string | undefined,
  teamDomain: string,
  audience: string,
  env?: Env
): Promise<Identity | null> {
  if (!token || token.length === 0) return null
  if (!teamDomain || !audience) return null

  const acceptedAudiences = audience
    .split(',')
    .map((value) => value.trim())
    .filter((value) => /^[a-fA-F0-9]{64}$/.test(value))
  if (
    acceptedAudiences.length === 0 ||
    new Set(acceptedAudiences).size !== acceptedAudiences.length
  )
    return null

  let payload: JWTPayload
  try {
    const result = await jwtVerify(token, getJwks(teamDomain), {
      issuer: `https://${teamDomain}`,
      audience: acceptedAudiences
    })
    payload = result.payload
  } catch {
    return null
  }

  if (!env) return null
  try {
    return await resolveAccessMembership(env, payload)
  } catch {
    return null
  }
}

/**
 * Unified Edge Auth Middleware:
 * Supports API Keys (X-API-Key or Authorization: Bearer prk_...) and Cloudflare Access JWT.
 * Fails closed with 401 if unauthenticated or invalid.
 */
export const unifiedAuth = createMiddleware<AppBindings>(async (c, next) => {
  const presentedKey = extractApiKey(
    c.req.header(API_KEY_HEADER) || c.req.header('x-api-key'),
    c.req.header('Authorization') || c.req.header('authorization')
  )

  if (presentedKey) {
    const identity = await verifyApiKey(c.env, presentedKey)
    if (!identity) {
      return c.json(
        { error: { message: 'Invalid or expired API key', code: 'UNAUTHORIZED', statusCode: 401 } },
        401
      )
    }
    c.set('identity', identity)
    await next()
    return
  }

  // Fall back to Cloudflare Access JWT
  const accessJwt = c.req.header(ACCESS_HEADER)
  if (accessJwt) {
    const identity = await verifyAccessJwt(
      accessJwt,
      c.env.ACCESS_TEAM_DOMAIN,
      c.env.ACCESS_AUD,
      c.env
    )
    if (!identity) {
      return c.json(
        { error: { message: 'Unauthorized', code: 'UNAUTHORIZED', statusCode: 401 } },
        401
      )
    }
    c.set('identity', identity)
    await next()
    return
  }

  return c.json({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED', statusCode: 401 } }, 401)
})

/**
 * Legacy accessAuth middleware for backward compatibility.
 */
export const accessAuth = createMiddleware<AppBindings>(async (c, next) => {
  const token = c.req.header(ACCESS_HEADER)
  const identity = await verifyAccessJwt(token, c.env.ACCESS_TEAM_DOMAIN, c.env.ACCESS_AUD, c.env)

  if (!identity) {
    return c.json(
      { error: { message: 'Unauthorized', code: 'UNAUTHORIZED', statusCode: 401 } },
      401
    )
  }

  c.set('identity', identity)
  await next()
})

/**
 * Enforces role restriction (e.g. 'admin').
 */
export function requireRole(...allowedRoles: string[]) {
  return createMiddleware<AppBindings>(async (c, next) => {
    const identity = c.get('identity')
    const role = identity?.role ?? 'user'
    if (!allowedRoles.includes(role)) {
      return c.json(
        {
          error: {
            message: 'Insufficient permissions for this operation',
            code: 'FORBIDDEN',
            statusCode: 403
          }
        },
        403
      )
    }
    await next()
  })
}

async function readSuppliedOrgId(
  c: Parameters<Parameters<typeof createMiddleware<AppBindings>>[0]>[0]
): Promise<string | undefined> {
  const fromQuery = c.req.query('org_id')
  if (fromQuery !== undefined) return fromQuery

  const contentType = c.req.header('Content-Type') ?? ''
  if (contentType.includes('application/json')) {
    try {
      const body = (await c.req.json()) as unknown
      if (body && typeof body === 'object' && 'org_id' in body) {
        const value = (body as Record<string, unknown>).org_id
        if (typeof value === 'string') return value
      }
    } catch {
      return undefined
    }
  }
  return undefined
}

/**
 * Hono middleware: port of #234 `resolveOrgId` cross-check.
 */
export const orgScope = createMiddleware<AppBindings>(async (c, next) => {
  const identity = c.get('identity')

  if (!identity?.orgId) {
    return c.json(
      {
        error: {
          message: 'No organization associated with this account',
          code: 'FORBIDDEN',
          statusCode: 403
        }
      },
      403
    )
  }

  const supplied = await readSuppliedOrgId(c)
  if (supplied !== undefined && supplied !== identity.orgId) {
    return c.json(
      {
        error: {
          message: 'org_id does not match authenticated organization',
          code: 'FORBIDDEN',
          statusCode: 403
        }
      },
      403
    )
  }

  await next()
})
