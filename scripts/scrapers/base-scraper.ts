/**
 * Base Scraper
 * 
 * Abstract base class for web scrapers with anti-detection and rate limiting
 */

export interface ScraperConfig {
  state: string
  baseUrl: string
  rateLimit: number // requests per minute
  timeout: number
  retryAttempts: number
}

export interface UCCFiling {
  filingNumber: string
  debtorName: string
  securedParty: string
  filingDate: string
  collateral: string
  status: 'active' | 'terminated' | 'lapsed'
  filingType: 'UCC-1' | 'UCC-3'
}

export interface ScraperResult {
  success: boolean
  filings?: UCCFiling[]
  error?: string
  searchUrl?: string
  timestamp: string
  retryCount?: number
  parsingErrors?: string[]
}

export abstract class BaseScraper {
  protected config: ScraperConfig

  constructor(config: ScraperConfig) {
    this.config = config
  }

  /**
   * Search for UCC filings
   */
  abstract search(companyName: string): Promise<ScraperResult>

  /**
   * Get manual search URL for fallback
   */
  abstract getManualSearchUrl(companyName: string): string

  /**
   * Validate search parameters
   */
  protected validateSearch(companyName: string): boolean {
    return Boolean(companyName && companyName.length > 0)
  }

  /**
   * Sleep helper for rate limiting
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get state code
   */
  getState(): string {
    return this.config.state
  }

  /**
   * Retry a function with exponential backoff
   * Returns the result along with retry count (number of retries performed, not including initial attempt)
   */
  protected async retryWithBackoff<T>(
    fn: () => Promise<T>,
    context: string
  ): Promise<{ result: T; retryCount: number }> {
    let lastError = new Error('Unknown error')
    let retriesMade = 0
    
    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const attemptType = attempt === 0 ? 'Initial attempt' : `Retry ${attempt}/${this.config.retryAttempts}`
        this.log('info', `${context} - ${attemptType}`)
        const result = await fn()
        this.log('info', `${context} succeeded${retriesMade > 0 ? ` after ${retriesMade} ${retriesMade === 1 ? 'retry' : 'retries'}` : ' on first attempt'}`)
        return { result, retryCount: retriesMade }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        if (attempt < this.config.retryAttempts) {
          // Check if error is retryable
          if (this.isRetryableError(lastError)) {
            retriesMade++
            // Exponential backoff: 2^attempt * 1000ms
            const backoffMs = Math.min(Math.pow(2, attempt) * 1000, 30000)
            this.log('warn', `${context} failed: ${lastError.message}. Retrying in ${backoffMs}ms... (retry ${retriesMade}/${this.config.retryAttempts})`)
            await this.sleep(backoffMs)
          } else {
            // Non-retryable error - fail immediately
            this.log('error', `${context} failed with non-retryable error: ${lastError.message}`)
            throw lastError
          }
        }
      }
    }
    
    // If we get here, all attempts (initial + retries) have failed
    const totalAttempts = retriesMade + 1 // initial attempt + retries
    this.log('error', `${context} failed after ${totalAttempts} ${totalAttempts === 1 ? 'attempt' : 'attempts'} (${retriesMade} ${retriesMade === 1 ? 'retry' : 'retries'})`)
    throw lastError
  }

  /**
   * Check if an error is retryable
   * Uses multiple strategies for robust error detection:
   * 1. Check error type/name
   * 2. Check error code property
   * 3. Fallback to message pattern matching
   */
  protected isRetryableError(error: Error): boolean {
    // Strategy 1: Check error type/constructor name
    const errorType = error.constructor.name
    const retryableTypes = [
      'TimeoutError',
      'NetworkError', 
      'FetchError',
      'AbortError'
    ]
    
    if (retryableTypes.includes(errorType)) {
      return true
    }
    
    // Strategy 2: Check error code property (for Node.js system errors)
    const errorWithCode = error as Error & { code?: string }
    if (errorWithCode.code) {
      const retryableCodes = [
        'ECONNRESET',
        'ENOTFOUND',
        'ETIMEDOUT',
        'ECONNREFUSED',
        'ECONNABORTED',
        'ENETUNREACH',
        'EAI_AGAIN'
      ]
      
      if (retryableCodes.includes(errorWithCode.code)) {
        return true
      }
    }
    
    // Strategy 3: Fallback to message pattern matching (less reliable but catches other cases)
    const message = error.message.toLowerCase()
    const retryablePatterns = [
      'timeout',
      'network',
      'econnreset',
      'enotfound',
      'etimedout',
      'econnrefused',
      'socket hang up',
      'navigation timeout',
      'net::err_',
      'failed to fetch',
      'fetch failed'
    ]
    
    return retryablePatterns.some(pattern => message.includes(pattern))
  }

  /**
   * Structured logging with better production readiness
   * Outputs to console but in a structured format that can be easily redirected
   * or parsed by log aggregation tools
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString()
    const logMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
    
    // Check if we're in a TTY (interactive terminal) for colored output
    if (process.stdout.isTTY) {
      // Human-readable format for development
      const dataStr = data && Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : ''
      logMethod(`[${timestamp}] [${level.toUpperCase()}] [${this.config.state}] ${message}${dataStr}`)
    } else {
      // Structured JSON format for production/logging systems
      const logEntry = {
        timestamp,
        level: level.toUpperCase(),
        scraper: this.config.state,
        message,
        ...(data && Object.keys(data).length > 0 ? { data } : {})
      }
      logMethod(JSON.stringify(logEntry))
    }
  }

  /**
   * Validate scraped filing data
   */
  protected validateFiling(filing: Partial<UCCFiling>): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    
    if (!filing.filingNumber || filing.filingNumber.trim() === '') {
      errors.push('Missing filing number')
    }
    
    if (!filing.debtorName || filing.debtorName.trim() === '') {
      errors.push('Missing debtor name')
    }
    
    if (!filing.securedParty || filing.securedParty.trim() === '') {
      errors.push('Missing secured party')
    }
    
    if (!filing.filingDate || filing.filingDate.trim() === '') {
      errors.push('Missing filing date')
    }
    
    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Validate and filter an array of filings
   * Returns validated filings and collects all errors
   */
  protected validateFilings(
    rawFilings: Partial<UCCFiling>[],
    parseErrors: string[] = []
  ): { validatedFilings: UCCFiling[]; validationErrors: string[] } {
    const validatedFilings: UCCFiling[] = []
    const validationErrors: string[] = [...parseErrors]

    rawFilings.forEach((filing, index) => {
      const validation = this.validateFiling(filing)
      if (validation.valid) {
        validatedFilings.push(filing as UCCFiling)
      } else {
        validationErrors.push(`Filing ${index + 1} validation errors: ${validation.errors.join(', ')}`)
      }
    })

    return { validatedFilings, validationErrors }
  }
}
