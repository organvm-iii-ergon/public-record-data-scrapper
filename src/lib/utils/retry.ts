/**
 * Retry Utilities
 *
 * Utilities for implementing retry logic with exponential backoff
 */

export interface RetryOptions {
  maxAttempts: number
  baseDelay: number // milliseconds
  maxDelay?: number // milliseconds
  exponentialBackoff?: boolean
  onRetry?: (attempt: number, error: Error) => void
}

export class RetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: Error
  ) {
    super(message)
    this.name = 'RetryError'
  }
}

/**
 * Execute a function with retry logic
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const {
    maxAttempts,
    baseDelay,
    maxDelay = 30000,
    exponentialBackoff = true,
    onRetry
  } = options

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < maxAttempts) {
        // Calculate delay
        let delay = exponentialBackoff
          ? baseDelay * Math.pow(2, attempt - 1)
          : baseDelay

        // Cap at maxDelay
        delay = Math.min(delay, maxDelay)

        // Add jitter to prevent thundering herd
        delay = delay + Math.random() * 1000

        // Call onRetry callback
        if (onRetry) {
          onRetry(attempt, lastError)
        }

        console.log(`Retry attempt ${attempt}/${maxAttempts} after ${delay}ms`)

        // Wait before retrying
        await sleep(delay)
      }
    }
  }

  throw new RetryError(
    `Failed after ${maxAttempts} attempts: ${lastError?.message}`,
    maxAttempts,
    lastError!
  )
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: Error): boolean {
  // Network errors
  if (error.message.includes('fetch') || error.message.includes('network')) {
    return true
  }

  // HTTP errors (5xx)
  if (error.message.includes('HTTP error! status: 5')) {
    return true
  }

  // Rate limit errors (429)
  if (error.message.includes('429') || error.message.includes('rate limit')) {
    return true
  }

  // Timeout errors
  if (error.message.includes('timeout')) {
    return true
  }

  return false
}

/**
 * Retry with conditional logic
 */
export async function retryIf<T>(
  fn: () => Promise<T>,
  shouldRetry: (error: Error) => boolean,
  options: RetryOptions
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < options.maxAttempts && shouldRetry(lastError)) {
        let delay = options.exponentialBackoff
          ? options.baseDelay * Math.pow(2, attempt - 1)
          : options.baseDelay

        delay = Math.min(delay, options.maxDelay || 30000)
        delay = delay + Math.random() * 1000

        if (options.onRetry) {
          options.onRetry(attempt, lastError)
        }

        console.log(`Retry attempt ${attempt}/${options.maxAttempts} after ${delay}ms`)
        await sleep(delay)
      } else {
        throw lastError
      }
    }
  }

  throw new RetryError(
    `Failed after ${options.maxAttempts} attempts: ${lastError?.message}`,
    options.maxAttempts,
    lastError!
  )
}

/**
 * Circuit breaker for preventing cascading failures
 */
export class CircuitBreaker {
  private failures = 0
  private lastFailureTime: number | null = null
  private state: 'closed' | 'open' | 'half-open' = 'closed'

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.lastFailureTime && Date.now() - this.lastFailureTime > this.timeout) {
        // Try half-open
        this.state = 'half-open'
      } else {
        throw new Error('Circuit breaker is open')
      }
    }

    try {
      const result = await fn()

      // Success - reset circuit breaker
      if (this.state === 'half-open') {
        this.state = 'closed'
      }
      this.failures = 0

      return result
    } catch (error) {
      this.failures++
      this.lastFailureTime = Date.now()

      if (this.failures >= this.threshold) {
        this.state = 'open'
      }

      throw error
    }
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state
  }

  reset(): void {
    this.failures = 0
    this.lastFailureTime = null
    this.state = 'closed'
  }
}

/**
 * Batch processor with error handling
 */
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: {
    batchSize: number
    concurrency?: number
    onError?: (item: T, error: Error) => void
    retryOptions?: RetryOptions
  }
): Promise<{ results: R[]; errors: Array<{ item: T; error: Error }> }> {
  const results: R[] = []
  const errors: Array<{ item: T; error: Error }> = []
  const concurrency = options.concurrency || 5

  for (let i = 0; i < items.length; i += options.batchSize) {
    const batch = items.slice(i, i + options.batchSize)

    // Process batch with concurrency control
    const batchPromises = batch.map(async item => {
      try {
        const process = () => processor(item)

        const result = options.retryOptions
          ? await retry(process, options.retryOptions)
          : await process()

        results.push(result)
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        errors.push({ item, error: err })

        if (options.onError) {
          options.onError(item, err)
        }
      }
    })

    // Process in chunks based on concurrency
    for (let j = 0; j < batchPromises.length; j += concurrency) {
      const chunk = batchPromises.slice(j, j + concurrency)
      await Promise.all(chunk)
    }

    // Small delay between batches
    if (i + options.batchSize < items.length) {
      await sleep(1000)
    }
  }

  return { results, errors }
}
