/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures by temporarily disabling calls to
 * failing services. Used for external API calls (LLM, enrichment, etc.)
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Requests fail immediately, service is considered down
 * - HALF_OPEN: Testing if service has recovered
 */

import { logger } from './logger'

export interface CircuitBreakerOptions {
  /** Number of failures before opening the circuit */
  failureThreshold: number
  /** Time in ms to wait before trying again (reset timeout) */
  resetTimeout: number
  /** Number of successful calls needed to close the circuit */
  successThreshold?: number
  /** Optional name for logging */
  name?: string
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly state: CircuitState
  ) {
    super(message)
    this.name = 'CircuitBreakerError'
  }
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED'
  private failureCount = 0
  private successCount = 0
  private lastFailureTime: number | null = null
  private readonly failureThreshold: number
  private readonly resetTimeout: number
  private readonly successThreshold: number
  private readonly name: string

  constructor(options: CircuitBreakerOptions) {
    this.failureThreshold = options.failureThreshold
    this.resetTimeout = options.resetTimeout
    this.successThreshold = options.successThreshold ?? 1
    this.name = options.name ?? 'CircuitBreaker'
  }

  /**
   * Execute a function with circuit breaker protection
   *
   * @throws CircuitBreakerError if circuit is open
   * @throws Original error if function fails
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN'
        logger.info(`${this.name}: Transitioning to HALF_OPEN state`)
      } else {
        throw new CircuitBreakerError(
          `${this.name}: Circuit is open. Service unavailable.`,
          this.state
        )
      }
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  /**
   * Check if we should attempt to reset the circuit
   */
  private shouldAttemptReset(): boolean {
    if (this.lastFailureTime === null) return false
    return Date.now() - this.lastFailureTime >= this.resetTimeout
  }

  /**
   * Handle successful call
   */
  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successCount++
      if (this.successCount >= this.successThreshold) {
        this.state = 'CLOSED'
        this.failureCount = 0
        this.successCount = 0
        this.lastFailureTime = null
        logger.info(`${this.name}: Circuit closed after successful recovery`)
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success
      this.failureCount = 0
    }
  }

  /**
   * Handle failed call
   */
  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.state === 'HALF_OPEN') {
      // Failed during test, reopen circuit
      this.state = 'OPEN'
      this.successCount = 0
      logger.warn(`${this.name}: Circuit reopened after failure in HALF_OPEN state`)
    } else if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN'
      logger.warn(`${this.name}: Circuit opened after ${this.failureCount} failures`)
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    // Check if we should transition from OPEN to HALF_OPEN
    if (this.state === 'OPEN' && this.shouldAttemptReset()) {
      return 'HALF_OPEN'
    }
    return this.state
  }

  /**
   * Get circuit statistics
   */
  getStats(): {
    state: CircuitState
    failureCount: number
    successCount: number
    lastFailureTime: number | null
  } {
    return {
      state: this.getState(),
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
    }
  }

  /**
   * Manually reset the circuit to closed state
   */
  reset(): void {
    this.state = 'CLOSED'
    this.failureCount = 0
    this.successCount = 0
    this.lastFailureTime = null
    logger.info(`${this.name}: Circuit manually reset`)
  }

  /**
   * Manually open the circuit
   */
  trip(): void {
    this.state = 'OPEN'
    this.lastFailureTime = Date.now()
    logger.warn(`${this.name}: Circuit manually tripped`)
  }
}

/**
 * Create circuit breakers for common services
 */
export const circuitBreakers = {
  llm: new CircuitBreaker({
    name: 'LLM-Service',
    failureThreshold: 3,
    resetTimeout: 30000, // 30 seconds
    successThreshold: 2
  }),

  enrichment: new CircuitBreaker({
    name: 'Enrichment-Service',
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    successThreshold: 2
  }),

  scraper: new CircuitBreaker({
    name: 'Scraper-Service',
    failureThreshold: 3,
    resetTimeout: 120000, // 2 minutes
    successThreshold: 1
  })
}

/**
 * Execute with circuit breaker and fallback
 *
 * @example
 * const result = await executeWithFallback(
 *   circuitBreakers.llm,
 *   () => llmService.generateResponse(prompt),
 *   () => 'Service temporarily unavailable'
 * )
 */
export async function executeWithFallback<T>(
  breaker: CircuitBreaker,
  fn: () => Promise<T>,
  fallback: () => T | Promise<T>
): Promise<T> {
  try {
    return await breaker.execute(fn)
  } catch (error) {
    if (error instanceof CircuitBreakerError) {
      logger.warn('Using fallback due to open circuit', {
        circuit: breaker.getState(),
        error: error.message
      })
      return await fallback()
    }
    throw error
  }
}
