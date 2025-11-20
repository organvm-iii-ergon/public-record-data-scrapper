/**
 * Rate Limiter
 * 
 * Implements token bucket algorithm for rate limiting API requests
 */

export interface RateLimitConfig {
  maxTokens: number
  refillRate: number // tokens per second
  refillInterval: number // milliseconds
}

export class RateLimiter {
  private tokens: number
  private lastRefill: number
  private config: RateLimitConfig

  constructor(config: RateLimitConfig) {
    this.config = config
    this.tokens = config.maxTokens
    this.lastRefill = Date.now()
  }

  /**
   * Attempt to consume tokens
   * @returns true if tokens were consumed, false if rate limit exceeded
   */
  tryConsume(tokensNeeded: number = 1): boolean {
    this.refillTokens()

    if (this.tokens >= tokensNeeded) {
      this.tokens -= tokensNeeded
      return true
    }

    return false
  }

  /**
   * Wait until tokens are available
   */
  async waitForTokens(tokensNeeded: number = 1): Promise<void> {
    while (!this.tryConsume(tokensNeeded)) {
      const tokensShortage = tokensNeeded - this.tokens
      const waitTime = (tokensShortage / this.config.refillRate) * 1000
      await this.sleep(Math.ceil(waitTime))
    }
  }

  /**
   * Refill tokens based on time elapsed
   */
  private refillTokens(): void {
    const now = Date.now()
    const timeSinceLastRefill = now - this.lastRefill

    if (timeSinceLastRefill >= this.config.refillInterval) {
      const intervalsElapsed = Math.floor(timeSinceLastRefill / this.config.refillInterval)
      const tokensToAdd = intervalsElapsed * this.config.refillRate

      this.tokens = Math.min(this.config.maxTokens, this.tokens + tokensToAdd)
      this.lastRefill = now
    }
  }

  /**
   * Get current token count
   */
  getAvailableTokens(): number {
    this.refillTokens()
    return this.tokens
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.tokens = this.config.maxTokens
    this.lastRefill = Date.now()
  }

  /**
   * Helper sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Rate limiter manager for multiple sources
 */
export class RateLimiterManager {
  private limiters: Map<string, RateLimiter> = new Map()

  /**
   * Get or create a rate limiter for a source
   */
  getLimiter(sourceName: string): RateLimiter {
    if (!this.limiters.has(sourceName)) {
      const config = this.getConfigForSource(sourceName)
      this.limiters.set(sourceName, new RateLimiter(config))
    }
    return this.limiters.get(sourceName)!
  }

  /**
   * Try to consume tokens for a source
   */
  tryConsume(sourceName: string, tokensNeeded: number = 1): boolean {
    const limiter = this.getLimiter(sourceName)
    return limiter.tryConsume(tokensNeeded)
  }

  /**
   * Wait for tokens for a source
   */
  async waitForTokens(sourceName: string, tokensNeeded: number = 1): Promise<void> {
    const limiter = this.getLimiter(sourceName)
    await limiter.waitForTokens(tokensNeeded)
  }

  /**
   * Get rate limit config for a data source
   */
  private getConfigForSource(sourceName: string): RateLimitConfig {
    const configs: Record<string, RateLimitConfig> = {
      'sec-edgar': { maxTokens: 10, refillRate: 10, refillInterval: 1000 }, // 10 req/sec
      'osha': { maxTokens: 5, refillRate: 1, refillInterval: 1000 }, // 1 req/sec
      'uspto': { maxTokens: 5, refillRate: 1, refillInterval: 1000 }, // 1 req/sec
      'census': { maxTokens: 5, refillRate: 1, refillInterval: 1000 }, // 1 req/sec
      'dnb': { maxTokens: 10, refillRate: 2, refillInterval: 1000 }, // 2 req/sec
      'google-places': { maxTokens: 50, refillRate: 10, refillInterval: 1000 }, // 10 req/sec
      'clearbit': { maxTokens: 10, refillRate: 1, refillInterval: 1000 }, // 1 req/sec
      'scraper-ca': { maxTokens: 5, refillRate: 5, refillInterval: 60000 }, // 5 req/min
      'scraper-tx': { maxTokens: 5, refillRate: 5, refillInterval: 60000 }, // 5 req/min
      'scraper-fl': { maxTokens: 5, refillRate: 5, refillInterval: 60000 }, // 5 req/min
    }

    return configs[sourceName] || { maxTokens: 5, refillRate: 1, refillInterval: 1000 }
  }

  /**
   * Reset all rate limiters
   */
  resetAll(): void {
    this.limiters.forEach(limiter => limiter.reset())
  }
}

// Global singleton instance
export const rateLimiterManager = new RateLimiterManager()
