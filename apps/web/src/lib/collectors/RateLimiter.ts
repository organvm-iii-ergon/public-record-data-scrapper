/**
 * Rate Limiter for State Data Collection
 *
 * Implements multi-level rate limiting (per-second, per-minute, per-hour, per-day)
 * to comply with state portal restrictions and avoid blocking.
 */

export interface RateLimitConfig {
  requestsPerSecond?: number
  requestsPerMinute: number
  requestsPerHour: number
  requestsPerDay: number
}

interface RequestTimestamp {
  timestamp: number
  id: string
}

export class RateLimiter {
  private config: RateLimitConfig
  private requestQueue: RequestTimestamp[] = []
  private waitingPromises: Array<{
    resolve: () => void
    timestamp: number
  }> = []

  constructor(config: RateLimitConfig) {
    this.config = config
  }

  /**
   * Acquire a slot for making a request
   * Waits until rate limits allow the request
   */
  async acquire(): Promise<void> {
    const now = Date.now()

    // Clean up old timestamps
    this.cleanup(now)

    // Check if we can make a request now
    if (this.canMakeRequest()) {
      this.recordRequest(now)
      return
    }

    // Need to wait - calculate how long
    const waitTime = this.calculateWaitTime(now)

    return new Promise<void>((resolve) => {
      this.waitingPromises.push({ resolve, timestamp: now })

      setTimeout(() => {
        this.recordRequest(Date.now())
        resolve()
      }, waitTime)
    })
  }

  /**
   * Release a slot (for future use if needed)
   */
  release(): void {
    // Currently a no-op, but could be used for connection pooling
  }

  /**
   * Reset all rate limits
   */
  reset(): void {
    this.requestQueue = []
    this.waitingPromises.forEach(({ resolve }) => resolve())
    this.waitingPromises = []
  }

  /**
   * Get current rate limit stats
   */
  getStats() {
    const now = Date.now()
    this.cleanup(now)

    const lastSecond = this.countRequests(now, 1000)
    const lastMinute = this.countRequests(now, 60 * 1000)
    const lastHour = this.countRequests(now, 60 * 60 * 1000)
    const lastDay = this.countRequests(now, 24 * 60 * 60 * 1000)

    return {
      perSecond: {
        current: lastSecond,
        limit: this.config.requestsPerSecond || Infinity,
        available: Math.max(0, (this.config.requestsPerSecond || Infinity) - lastSecond)
      },
      perMinute: {
        current: lastMinute,
        limit: this.config.requestsPerMinute,
        available: Math.max(0, this.config.requestsPerMinute - lastMinute)
      },
      perHour: {
        current: lastHour,
        limit: this.config.requestsPerHour,
        available: Math.max(0, this.config.requestsPerHour - lastHour)
      },
      perDay: {
        current: lastDay,
        limit: this.config.requestsPerDay,
        available: Math.max(0, this.config.requestsPerDay - lastDay)
      }
    }
  }

  /**
   * Check if we can make a request given current rate limits
   */
  private canMakeRequest(): boolean {
    const stats = this.getStats()

    return (
      stats.perSecond.available > 0 &&
      stats.perMinute.available > 0 &&
      stats.perHour.available > 0 &&
      stats.perDay.available > 0
    )
  }

  /**
   * Calculate how long to wait before next request is allowed
   */
  private calculateWaitTime(now: number): number {
    const stats = this.getStats()
    const waitTimes: number[] = []

    // Check per-second limit
    if (this.config.requestsPerSecond && stats.perSecond.available === 0) {
      const oldestInSecond = this.getOldestTimestamp(now, 1000)
      if (oldestInSecond) {
        waitTimes.push(1000 - (now - oldestInSecond.timestamp))
      }
    }

    // Check per-minute limit
    if (stats.perMinute.available === 0) {
      const oldestInMinute = this.getOldestTimestamp(now, 60 * 1000)
      if (oldestInMinute) {
        waitTimes.push(60 * 1000 - (now - oldestInMinute.timestamp))
      }
    }

    // Check per-hour limit
    if (stats.perHour.available === 0) {
      const oldestInHour = this.getOldestTimestamp(now, 60 * 60 * 1000)
      if (oldestInHour) {
        waitTimes.push(60 * 60 * 1000 - (now - oldestInHour.timestamp))
      }
    }

    // Check per-day limit
    if (stats.perDay.available === 0) {
      const oldestInDay = this.getOldestTimestamp(now, 24 * 60 * 60 * 1000)
      if (oldestInDay) {
        waitTimes.push(24 * 60 * 60 * 1000 - (now - oldestInDay.timestamp))
      }
    }

    // Return the maximum wait time needed
    return waitTimes.length > 0 ? Math.max(...waitTimes) : 0
  }

  /**
   * Record a request timestamp
   */
  private recordRequest(timestamp: number): void {
    this.requestQueue.push({
      timestamp,
      id: `${timestamp}-${Math.random()}`
    })
  }

  /**
   * Clean up old timestamps outside the day window
   */
  private cleanup(now: number): void {
    const dayAgo = now - 24 * 60 * 60 * 1000
    this.requestQueue = this.requestQueue.filter((req) => req.timestamp > dayAgo)
  }

  /**
   * Count requests within a time window
   */
  private countRequests(now: number, windowMs: number): number {
    const cutoff = now - windowMs
    return this.requestQueue.filter((req) => req.timestamp > cutoff).length
  }

  /**
   * Get oldest timestamp within a time window
   */
  private getOldestTimestamp(now: number, windowMs: number): RequestTimestamp | undefined {
    const cutoff = now - windowMs
    const requestsInWindow = this.requestQueue.filter((req) => req.timestamp > cutoff)
    return requestsInWindow[0]
  }
}

/**
 * Create a rate limiter with common presets
 */
export function createRateLimiter(
  preset: 'conservative' | 'moderate' | 'aggressive' | RateLimitConfig
): RateLimiter {
  if (typeof preset === 'object') {
    return new RateLimiter(preset)
  }

  const presets: Record<string, RateLimitConfig> = {
    conservative: {
      requestsPerSecond: 1,
      requestsPerMinute: 15,
      requestsPerHour: 300,
      requestsPerDay: 3000
    },
    moderate: {
      requestsPerSecond: 2,
      requestsPerMinute: 30,
      requestsPerHour: 600,
      requestsPerDay: 6000
    },
    aggressive: {
      requestsPerSecond: 5,
      requestsPerMinute: 60,
      requestsPerHour: 1200,
      requestsPerDay: 12000
    }
  }

  return new RateLimiter(presets[preset])
}
