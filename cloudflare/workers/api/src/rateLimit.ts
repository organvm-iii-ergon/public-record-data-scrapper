/**
 * Edge Rate Limiting & Tier Entitlements for Cloudflare Workers.
 *
 * Enforces sliding/fixed-window request quotas and subscription entitlements
 * at the edge BEFORE any D1 database query is executed.
 *
 * Rate-limit window key: `ratelimit:<apiKeyHash>:<windowMinute>`
 * When the caller used a Cloudflare Access JWT (no API key) we fall back to
 * keying on the tenant's `orgId` to ensure JWT callers are still rate-limited.
 *
 * Tier limits (requests per minute per key):
 *  free       → 10
 *  starter    → 100
 *  growth     → 1 000
 *  pro        → 1 000
 *  enterprise → 10 000
 */
import { createMiddleware } from 'hono/factory'
import { hashApiKey } from './auth'
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

// In-isolate memory store to protect KV from concurrent write spikes.
// Keyed on the same composite key used in KV so hot-path reads avoid KV round-trips.
const memoryCounters = new Map<string, { count: number; window: number }>()

/**
 * Derive a stable rate-limit bucket key for the current request.
 *
 * API-key callers are bucketed by their key's SHA-256 hash (independent
 * tenant quota even when two tenants share the same egress IP / orgId).
 * JWT / Access callers fall back to orgId-based bucketing.
 */
async function buildRateLimitKey(
  identity: { orgId: string; keyId?: string; authMethod: string },
  presentedKey: string | undefined,
  windowMinute: number
): Promise<string> {
  if (identity.authMethod === 'api_key' && presentedKey) {
    const hash = await hashApiKey(presentedKey)
    return `ratelimit:${hash}:${windowMinute}`
  }
  return `ratelimit:${identity.orgId}:${windowMinute}`
}

/**
 * Edge rate-limiting middleware.
 *
 * Uses a 60-second fixed window keyed by the tenant's API key hash (or orgId
 * for JWT callers). Inspects tier entitlement and sets standard rate-limit
 * response headers:
 *  - X-RateLimit-Limit
 *  - X-RateLimit-Remaining
 *  - X-RateLimit-Reset
 *  - Retry-After (on 429)
 *
 * Also injects `X-Forwarded-Tier` so the Express origin can skip its own
 * DB tier lookup when the edge has already resolved the subscription tier.
 */
export const rateLimiter = createMiddleware<AppBindings>(async (c, next) => {
  const identity = c.get('identity')
  const tier: SubscriptionTier = identity?.tier ?? 'free'
  const limit = TIER_LIMITS[tier] ?? TIER_LIMITS.free
  const orgId = identity?.orgId ?? 'anonymous'

  const now = Date.now()
  const windowMinute = Math.floor(now / 60000)
  const resetEpoch = (windowMinute + 1) * 60
  const resetInSeconds = Math.max(1, resetEpoch - Math.floor(now / 1000))

  // Extract presented API key for per-key bucketing
  const apiKeyHeader = c.req.header('X-API-Key') ?? c.req.header('x-api-key')
  const authHeader = c.req.header('Authorization') ?? c.req.header('authorization')
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

  const cacheKey = await buildRateLimitKey(
    { orgId, keyId: identity?.keyId, authMethod: identity?.authMethod ?? 'cf_access' },
    presentedKey,
    windowMinute
  )

  // 1. Check & increment in-memory counter (fast path, avoids KV on every request)
  let currentCount = 0
  const mem = memoryCounters.get(cacheKey)
  if (mem && mem.window === windowMinute) {
    mem.count += 1
    currentCount = mem.count
  } else {
    // Evict stale windows to prevent isolate memory leaks
    if (memoryCounters.size > 1000) {
      memoryCounters.clear()
    }
    currentCount = 1
    memoryCounters.set(cacheKey, { count: 1, window: windowMinute })
  }

  // 2. Sync with KV if bound (authoritative cross-isolate count)
  if (c.env.KV) {
    try {
      const kvRaw = await c.env.KV.get(cacheKey)
      const kvCount = kvRaw ? Number.parseInt(kvRaw, 10) : 0
      currentCount = Math.max(currentCount, kvCount + 1)
      // Best-effort KV write with 120 s TTL (2× window); failures are non-fatal
      c.executionCtx?.waitUntil?.(
        c.env.KV.put(cacheKey, String(currentCount), { expirationTtl: 120 })
      )
    } catch {
      // KV failure is non-fatal; the in-memory counter provides degraded protection
    }
  }

  const remaining = Math.max(0, limit - currentCount)

  // 3. Short-circuit at the edge when the quota is exceeded
  if (currentCount > limit) {
    c.header('X-RateLimit-Limit', String(limit))
    c.header('X-RateLimit-Remaining', '0')
    c.header('X-RateLimit-Reset', String(resetEpoch))
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

  // 4. Inject rate-limit headers and the resolved tier for the origin server
  c.header('X-RateLimit-Limit', String(limit))
  c.header('X-RateLimit-Remaining', String(remaining))
  c.header('X-RateLimit-Reset', String(resetEpoch))
  // Signal resolved tier to Express so it can skip its own DB org lookup
  c.header('X-Forwarded-Tier', tier)

  await next()
})

/**
 * Tier entitlement middleware.
 *
 * Ensures the tenant possesses at least `minTier` access before executing
 * downstream handlers. Evaluated at the edge before any D1 query.
 */
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
