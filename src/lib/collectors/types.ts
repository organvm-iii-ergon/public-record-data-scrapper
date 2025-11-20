/**
 * Common types for state data collectors
 */

/**
 * UCC Filing data structure
 */
export interface UCCFiling {
  filingNumber: string
  filingType: 'UCC-1' | 'UCC-3' | 'UCC-5' | string
  filingDate: string // ISO date string
  expirationDate?: string // ISO date string
  status: 'active' | 'lapsed' | 'terminated' | 'amended'
  state: string // Two-letter state code

  // Parties
  securedParty: Party
  debtor: Party
  assignee?: Party

  // Collateral
  collateral: string
  collateralType?: string

  // Metadata
  pages?: number
  amendments?: Amendment[]
  rawData?: Record<string, any>
}

export interface Party {
  name: string
  address?: Address
  organizationType?: 'individual' | 'organization'
}

export interface Address {
  street?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
}

export interface Amendment {
  filingNumber: string
  filingDate: string
  amendmentType: 'continuation' | 'assignment' | 'termination' | 'amendment'
  description?: string
}

/**
 * Search parameters for filing searches
 */
export interface SearchParams {
  businessName?: string
  filingNumber?: string
  debtorName?: string
  since?: Date
  until?: Date
  limit?: number
  offset?: number
  filingTypes?: string[]
}

/**
 * Search result with pagination
 */
export interface SearchResult {
  filings: UCCFiling[]
  total: number
  hasMore: boolean
  nextOffset?: number
}

/**
 * Collection options
 */
export interface CollectionOptions {
  since?: Date
  limit?: number
  filingTypes?: string[]
  includeInactive?: boolean
}

/**
 * Collection error types
 */
export type CollectionErrorType =
  | 'NETWORK'
  | 'PARSE'
  | 'RATE_LIMIT'
  | 'AUTH'
  | 'CAPTCHA'
  | 'TIMEOUT'
  | 'STRUCTURE_CHANGE'

/**
 * Collection error
 */
export class CollectionError extends Error {
  constructor(
    public state: string,
    public errorType: CollectionErrorType,
    public recoverable: boolean,
    message: string,
    public originalError?: Error
  ) {
    super(message)
    this.name = 'CollectionError'
  }
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings?: string[]
}

/**
 * Base state collector interface
 * All state-specific collectors must implement this interface
 */
export interface StateCollector {
  /**
   * Search for filings by business name
   */
  searchByBusinessName(name: string): Promise<SearchResult>

  /**
   * Search for a specific filing by number
   */
  searchByFilingNumber(number: string): Promise<UCCFiling | null>

  /**
   * Get detailed information about a filing
   */
  getFilingDetails(filingNumber: string): Promise<UCCFiling>

  /**
   * Collect new filings since a given date
   */
  collectNewFilings(options: CollectionOptions): Promise<UCCFiling[]>

  /**
   * Validate a filing object
   */
  validateFiling(filing: UCCFiling): ValidationResult

  /**
   * Get collector status and metrics
   */
  getStatus(): CollectorStatus
}

/**
 * Collector status
 */
export interface CollectorStatus {
  isHealthy: boolean
  lastCollectionTime?: string
  totalCollected: number
  errorRate: number
  averageLatency: number
  rateLimitStats?: {
    perMinute: { current: number; limit: number }
    perHour: { current: number; limit: number }
    perDay: { current: number; limit: number }
  }
}
