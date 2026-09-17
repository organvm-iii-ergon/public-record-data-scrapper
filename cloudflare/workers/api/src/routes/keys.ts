/**
 * Versioned REST API — /v1/keys
 *
 * Programmatic API Key provisioning, listing, and revocation for multi-tenant B2B data access.
 * The plaintext key (`prk_...`) is generated and shown EXACTLY ONCE on creation.
 * Only the SHA-256 hash is persisted in D1.
 */
import { Hono } from 'hono'
import { hashApiKey, API_KEY_PREFIX, requireRole } from '../auth'
import { all, first, run } from '../db'
import type { ApiKeyPublic, ApiKeyRow, AppBindings } from '../types'

export const keysRoute = new Hono<AppBindings>()
keysRoute.use('*', requireRole('admin'))

const DISPLAY_PREFIX_LENGTH = 12

function generateRandomKey(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    const byte = bytes[i]
    if (byte !== undefined) {
      binary += String.fromCharCode(byte)
    }
  }
  const base64 = btoa(binary)
  const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${API_KEY_PREFIX}${base64url}`
}

interface CreateKeyBody {
  name: string
  role?: 'user' | 'admin'
  expires_at?: string
}

/**
 * POST /v1/keys — Mint a new API key for the tenant.
 */
keysRoute.post('/', async (c) => {
  const { orgId } = c.get('identity')

  let body: CreateKeyBody
  try {
    const value = await c.req.json<unknown>()
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid body')
    body = value as CreateKeyBody
  } catch {
    return c.json(
      { error: { message: 'Invalid JSON body', code: 'BAD_REQUEST', statusCode: 400 } },
      400
    )
  }

  const name = body.name?.trim()
  if (!name) {
    return c.json(
      { error: { message: 'Key name is required', code: 'VALIDATION_ERROR', statusCode: 400 } },
      400
    )
  }

  const role = body.role === 'admin' ? 'admin' : 'user'
  const key = generateRandomKey()
  const keyHash = await hashApiKey(key)
  const keyPrefix = key.slice(0, DISPLAY_PREFIX_LENGTH)
  const id = crypto.randomUUID()
  let expiresAt: string | null = null
  if (body.expires_at) {
    const parsedExpiry = new Date(body.expires_at)
    if (!Number.isFinite(parsedExpiry.getTime())) {
      return c.json(
        {
          error: {
            message: 'expires_at must be a valid date-time',
            code: 'VALIDATION_ERROR',
            statusCode: 400
          }
        },
        400
      )
    }
    expiresAt = parsedExpiry.toISOString()
  }

  await run(
    c.env,
    `INSERT INTO api_keys (id, org_id, name, key_prefix, key_hash, role, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    orgId,
    name,
    keyPrefix,
    keyHash,
    role,
    expiresAt
  )

  const created = await first<ApiKeyRow>(
    c.env,
    `SELECT id, name, key_prefix, role, expires_at, created_at
       FROM api_keys
      WHERE id = ?`,
    id
  )

  return c.json(
    {
      data: {
        id: created?.id,
        name: created?.name,
        key, // Plaintext returned once!
        key_prefix: created?.key_prefix,
        role: created?.role,
        expires_at: created?.expires_at,
        created_at: created?.created_at
      }
    },
    201
  )
})

/**
 * GET /v1/keys — List active API keys for the tenant.
 */
keysRoute.get('/', async (c) => {
  const { orgId } = c.get('identity')

  const rows = await all<ApiKeyPublic>(
    c.env,
    `SELECT id, name, key_prefix, role, expires_at, revoked_at, last_used_at, created_at
       FROM api_keys
      WHERE org_id = ?
      ORDER BY created_at DESC`,
    orgId
  )

  return c.json({ data: rows })
})

/**
 * DELETE /v1/keys/:id — Revoke an API key immediately.
 */
keysRoute.delete('/:id', async (c) => {
  const { orgId } = c.get('identity')
  const keyId = c.req.param('id')

  const existing = await first<ApiKeyRow>(
    c.env,
    'SELECT id, key_hash FROM api_keys WHERE id = ? AND org_id = ?',
    keyId,
    orgId
  )

  if (!existing) {
    return c.json(
      { error: { message: 'API key not found', code: 'NOT_FOUND', statusCode: 404 } },
      404
    )
  }

  await run(
    c.env,
    `UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ? AND org_id = ?`,
    keyId,
    orgId
  )

  // Invalidate KV cache if bound
  if (c.env.KV && existing.key_hash) {
    try {
      c.executionCtx?.waitUntil?.(c.env.KV.delete(`apikey:${existing.key_hash}`))
    } catch {
      // ignore
    }
  }

  return c.json({ data: { id: keyId, revoked: true } })
})
