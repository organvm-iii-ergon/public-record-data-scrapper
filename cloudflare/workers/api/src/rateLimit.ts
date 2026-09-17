/**
 * Edge Rate Limiting & Tier Entitlements for Cloudflare Workers.
 *
 * A single conditional D1 UPSERT admits each authenticated request before
 * executing business handlers. KV and isolate-local maps are not suitable
 * for an authoritative cross-isolate counter and are deliberately not used.
 * A missing migration or unavailable counter fails closed with HTTP 503.
 */
import { createMiddleware } from 'hono/factory'
import { hashApiKey } from './auth'
import { admitQuota } from './atomicQuota'
import type { AppBindings, SubscriptionTier } from './types'

/** Requests-per-minute quota per subscription tier. */
export const TIER_LIMITS: Record<SubscriptionTier, number> = {
  free: 10,
  starter: 100,
  growth: 1000,
  pro: 1000,
  enterprise: 10000
} as const

const TIER_HIERARCHY: Record<SubscriptionTier, number> = {
  free: 0,
  starter: 1,
  growth: 2,
  pro: 2,
  enterprise: 3
}

/** Stable credential bucket; the database stores the current window separately. */
async function buildRateLimitKey(
  identity: { orgId: string; authMethod: string },
  presentedKey: string | undefined
): Promise<string> {
  if (identity.authMethod === 'api_key') {
    if (!presentedKey) throw new Error('Authenticated API key is missing')
    return `ratelimit:key:${await hashApiKey(presentedKey)}`
  }
  return `ratelimit:org:${identity.orgId}`
}

export const rateLimiter = createMiddleware<AppBindings>(async (c, next) => {
  const identity = c.get('identity')
  if (!identity?.orgId) {
    return c.json(
      { error: { message: 'Authentication required', code: 'UNAUTHORIZED', statusCode: 401 } },
      401
    )
  }
  const tier: SubscriptionTier = identity.tier ?? 'free'
  const limit = TIER_LIMITS[tier] ?? TIER_LIMITS.free
  const now = Date.now()
  const windowMinute = Math.floor(now / 60000)
  const resetEpoch = (windowMinute + 1) * 60
  const resetInSeconds = Math.max(1, resetEpoch - Math.floor(now / 1000))

  const apiKeyHeader = c.req.header('X-API-Key')
  const authHeader = c.req.header('Authorization')
  let presentedKey: string | undefined
  if (typeof apiKeyHeader === 'string' && apiKeyHeader.trim().length > 0) {
    presentedKey = apiKeyHeader.trim()
  } else if (typeof authHeader === 'string') {
    const parts = authHeader.trim().split(/\s+/)
    if (
      parts.length === 2 &&
      parts[0]?.toLowerCase() === 'bearer' &&
      parts[1]?.startsWith('prk_')
    ) {
      presentedKey = parts[1]
    }
  }

  c.header('X-RateLimit-Limit', String(limit))
  c.header('X-RateLimit-Reset', String(resetEpoch))

  let admission: Awaited<ReturnType<typeof admitQuota>>
  try {
    const bucket = await buildRateLimitKey(identity, presentedKey)
    admission = await admitQuota(c.env.DB, bucket, windowMinute, limit)
  } catch {
    c.header('X-RateLimit-Remaining', '0')
    c.header('Retry-After', '1')
    return c.json(
      {
        error: {
          message: 'Rate-limit admission is temporarily unavailable',
          code: 'RATE_LIMIT_UNAVAILABLE',
          statusCode: 503
        }
      },
      503
    )
  }

  c.header('X-RateLimit-Remaining', String(admission.remaining))
  if (!admission.allowed) {
    c.header('Retry-After', String(resetInSeconds))
    return c.json(
      {
        error: {
          message: `Rate limit exceeded for tier '${tier}'. Limit is ${limit} requests per minute.`,
          code: 'RATE_LIMIT_EXCEEDED',
          statusCode: 429
        }
      },
      429
    )
  }

  // Informational response header only; never an origin authorization input.
  c.header('X-Forwarded-Tier', tier)
  await next()
})

/** Ensure the authenticated tenant possesses at least the requested tier. */
export function requireTier(minTier: SubscriptionTier) {
  return createMiddleware<AppBindings>(async (c, next) => {
    const identity = c.get('identity')
    const currentTier: SubscriptionTier = identity?.tier ?? 'free'
    const currentLevel = TIER_HIERARCHY[currentTier] ?? 0
    const requiredLevel = TIER_HIERARCHY[minTier] ?? 0

    if (currentLevel < requiredLevel) {
      return c.json(
        {
          error: {
            message: `This operation requires the '${minTier}' tier or higher. Your current tier is '${currentTier}'.`,
            code: 'TIER_UPGRADE_REQUIRED',
            statusCode: 403
          }
        },
        403
      )
    }

    await next()
  })
}
