import { Request, Response, NextFunction } from 'express'
import { Redis } from 'ioredis'
import { config } from '../config'

// Redis client for rate limiting (separate from queue Redis)
let redisClient: Redis | null = null

function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000)
        return delay
      }
    })

    redisClient.on('error', (error) => {
      console.error('[RateLimiter] Redis error:', error.message)
    })
  }
  return redisClient
}

/**
 * Extract client IP address, accounting for proxies
 */
function getClientIp(req: Request): string {
  // Check X-Forwarded-For header (set by proxies/load balancers)
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) {
    // Take the first IP in the chain (original client)
    const forwardedStr = Array.isArray(forwarded) ? forwarded[0] : forwarded
    const firstIp = forwardedStr.split(',')[0].trim()
    if (firstIp) return firstIp
  }

  // Check X-Real-IP header (Nginx)
  const realIp = req.headers['x-real-ip']
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp
  }

  // Fallback to req.ip (may be proxy IP if not configured)
  return req.ip || 'unknown'
}

/**
 * Redis-based sliding window rate limiter
 *
 * Uses sorted sets for accurate sliding window tracking.
 * This works correctly across multiple server instances.
 */
export const rateLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const identifier = getClientIp(req)
  const key = `ratelimit:${identifier}`
  const now = Date.now()
  const windowStart = now - config.rateLimit.windowMs

  try {
    const redis = getRedisClient()

    // Use Redis multi/exec for atomicity
    const pipeline = redis.multi()

    // Remove expired entries
    pipeline.zremrangebyscore(key, 0, windowStart)

    // Count requests in current window
    pipeline.zcard(key)

    // Add current request
    pipeline.zadd(key, now, `${now}-${Math.random().toString(36).slice(2)}`)

    // Set expiration on the key
    pipeline.expire(key, Math.ceil(config.rateLimit.windowMs / 1000))

    const results = await pipeline.exec()

    if (!results) {
      // Redis transaction failed, allow request through (fail open)
      console.warn('[RateLimiter] Redis transaction failed, allowing request')
      return next()
    }

    // zcard result is at index 1 (after zremrangebyscore)
    const count = (results[1]?.[1] as number) || 0

    // Check if over limit
    if (count >= config.rateLimit.max) {
      // Get the oldest timestamp to calculate retry-after
      const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES')
      const oldestTimestamp = oldest.length >= 2 ? parseInt(oldest[1], 10) : now
      const retryAfter = Math.ceil((oldestTimestamp + config.rateLimit.windowMs - now) / 1000)

      res.set('Retry-After', Math.max(1, retryAfter).toString())
      res.set('X-RateLimit-Limit', config.rateLimit.max.toString())
      res.set('X-RateLimit-Remaining', '0')
      res.set(
        'X-RateLimit-Reset',
        new Date(oldestTimestamp + config.rateLimit.windowMs).toISOString()
      )

      res.status(429).json({
        error: {
          message: 'Too many requests. Please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
          statusCode: 429,
          retryAfter: Math.max(1, retryAfter)
        }
      })
      return
    }

    // Add rate limit headers
    res.set('X-RateLimit-Limit', config.rateLimit.max.toString())
    res.set('X-RateLimit-Remaining', Math.max(0, config.rateLimit.max - count - 1).toString())
    res.set('X-RateLimit-Reset', new Date(now + config.rateLimit.windowMs).toISOString())

    next()
  } catch (error) {
    // If Redis fails, fall back to allowing the request (fail open)
    // This prevents Redis outages from blocking all traffic
    console.error('[RateLimiter] Redis error, allowing request:', error)
    next()
  }
}

/**
 * In-memory fallback rate limiter for development/testing
 * when Redis is not available
 */
interface InMemoryStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

const inMemoryStore: InMemoryStore = {}

export const inMemoryRateLimiter = (req: Request, res: Response, next: NextFunction): void => {
  const identifier = getClientIp(req)
  const now = Date.now()

  if (!inMemoryStore[identifier]) {
    inMemoryStore[identifier] = {
      count: 1,
      resetTime: now + config.rateLimit.windowMs
    }
    return next()
  }

  const record = inMemoryStore[identifier]

  // Reset if window expired
  if (now > record.resetTime) {
    record.count = 1
    record.resetTime = now + config.rateLimit.windowMs
    return next()
  }

  // Increment count
  record.count++

  // Check limit
  if (record.count > config.rateLimit.max) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000)

    res.set('Retry-After', retryAfter.toString())
    res.set('X-RateLimit-Limit', config.rateLimit.max.toString())
    res.set('X-RateLimit-Remaining', '0')
    res.set('X-RateLimit-Reset', new Date(record.resetTime).toISOString())

    res.status(429).json({
      error: {
        message: 'Too many requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        statusCode: 429,
        retryAfter
      }
    })
    return
  }

  // Add rate limit headers
  res.set('X-RateLimit-Limit', config.rateLimit.max.toString())
  res.set('X-RateLimit-Remaining', (config.rateLimit.max - record.count).toString())
  res.set('X-RateLimit-Reset', new Date(record.resetTime).toISOString())

  next()
}

// Cleanup old entries every hour (in-memory fallback only)
setInterval(
  () => {
    const now = Date.now()
    Object.keys(inMemoryStore).forEach((key) => {
      if (now > inMemoryStore[key].resetTime) {
        delete inMemoryStore[key]
      }
    })
  },
  60 * 60 * 1000
)

/**
 * Create rate limiter middleware based on environment
 * Uses Redis in production, in-memory in development
 */
export function createRateLimiter(): (
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void> {
  if (config.server.env === 'production' || process.env.USE_REDIS_RATE_LIMIT === 'true') {
    console.log('[RateLimiter] Using Redis-based rate limiting')
    return rateLimiter
  }
  console.log('[RateLimiter] Using in-memory rate limiting (development mode)')
  return inMemoryRateLimiter
}

/**
 * Close Redis connection (for graceful shutdown)
 */
export async function closeRateLimiterConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
    console.log('[RateLimiter] Redis connection closed')
  }
}
