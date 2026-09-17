/**
 * Centralized constants for the UCC-MCA Intelligence Platform
 *
 * This file contains all magic numbers and configuration values
 * that were previously hardcoded throughout the codebase.
 */

/** Agentic system constants */
export const AGENTIC = {
  /** Minimum safety score required for autonomous execution */
  SAFETY_THRESHOLD: 80,
  /** Maximum improvements allowed per day per agent */
  MAX_DAILY_IMPROVEMENTS: 3,
  /** Interval between data collection cycles (ms) */
  COLLECTION_INTERVAL_MS: 1000,
  /** Maximum concurrent collection operations */
  MAX_CONCURRENT_COLLECTIONS: 3,
  /** Timeout for agent responses (ms) */
  AGENT_TIMEOUT_MS: 30000,
  /** Maximum retries for failed agent operations */
  MAX_RETRIES: 3
} as const

/** Video generation constants */
export const VIDEO = {
  /** Average words per minute for speech */
  WORDS_PER_MINUTE: 150,
  /** Default crossfade duration between clips (seconds) */
  DEFAULT_CROSSFADE_DURATION: 0.5,
  /** Minimum scene duration (seconds) */
  MIN_SCENE_DURATION: 2,
  /** Maximum scene duration (seconds) */
  MAX_SCENE_DURATION: 10
} as const

/** Rate limiting constants */
export const RATE_LIMIT = {
  /** Rate limit window duration (ms) - 15 minutes */
  WINDOW_MS: 15 * 60 * 1000,
  /** Maximum requests per window */
  MAX_REQUESTS: 100,
  /** Window for job queue operations (ms) */
  JOB_QUEUE_WINDOW_MS: 60000,
  /** Max job submissions per window */
  MAX_JOB_SUBMISSIONS: 10
} as const

/** Pagination constants */
export const PAGINATION = {
  /** Default page size for list endpoints */
  DEFAULT_PAGE_SIZE: 20,
  /** Maximum allowed page size */
  MAX_PAGE_SIZE: 100,
  /** Default page number */
  DEFAULT_PAGE: 1
} as const

/** API timeout constants */
export const TIMEOUTS = {
  /** Default API request timeout (ms) */
  DEFAULT_API_MS: 30000,
  /** Long-running operation timeout (ms) */
  LONG_RUNNING_MS: 120000,
  /** LLM request timeout (ms) */
  LLM_REQUEST_MS: 60000,
  /** Database query timeout (ms) */
  DATABASE_QUERY_MS: 30000,
  /** External service timeout (ms) */
  EXTERNAL_SERVICE_MS: 15000
} as const

/** Scoring constants */
export const SCORING = {
  /** Minimum priority score */
  MIN_PRIORITY_SCORE: 0,
  /** Maximum priority score */
  MAX_PRIORITY_SCORE: 100,
  /** High priority threshold */
  HIGH_PRIORITY_THRESHOLD: 70,
  /** Medium priority threshold */
  MEDIUM_PRIORITY_THRESHOLD: 40,
  /** Health score weights */
  HEALTH_WEIGHTS: {
    VIOLATIONS: 0.3,
    SENTIMENT: 0.25,
    FINANCIAL: 0.25,
    TREND: 0.2
  }
} as const

/** Signal detection constants */
export const SIGNALS = {
  /** Minimum confidence for signal detection */
  MIN_CONFIDENCE: 0.5,
  /** High confidence threshold */
  HIGH_CONFIDENCE: 0.8,
  /** Signal decay rate (percentage per day) */
  DECAY_RATE: 0.02,
  /** Maximum age for signals (days) */
  MAX_AGE_DAYS: 90
} as const

/** UI/UX constants */
export const UI = {
  /** Debounce delay for search input (ms) */
  SEARCH_DEBOUNCE_MS: 300,
  /** Toast notification duration (ms) */
  TOAST_DURATION_MS: 5000,
  /** Animation duration (ms) */
  ANIMATION_DURATION_MS: 200,
  /** Maximum items to display in dropdown */
  MAX_DROPDOWN_ITEMS: 50,
  /** Chart refresh interval (ms) */
  CHART_REFRESH_MS: 30000
} as const

/** Batch operation limits */
export const BATCH = {
  /** Maximum prospects per batch claim */
  MAX_CLAIM: 100,
  /** Maximum prospects per batch export */
  MAX_EXPORT: 1000,
  /** Maximum concurrent enrichment operations */
  MAX_CONCURRENT_ENRICHMENT: 10,
  /** Batch size for database operations */
  DB_BATCH_SIZE: 500
} as const

/** Cache constants */
export const CACHE = {
  /** Default TTL for cache entries (seconds) */
  DEFAULT_TTL_SECONDS: 300,
  /** TTL for competitor analysis (seconds) */
  COMPETITOR_ANALYSIS_TTL: 3600,
  /** TTL for health scores (seconds) */
  HEALTH_SCORE_TTL: 1800,
  /** Maximum cache size (items) */
  MAX_SIZE: 1000
} as const

/** Database constants */
export const DATABASE = {
  /** Maximum connection pool size */
  MAX_CONNECTIONS: 20,
  /** Idle connection timeout (ms) */
  IDLE_TIMEOUT_MS: 30000,
  /** Connection acquisition timeout (ms) */
  CONNECTION_TIMEOUT_MS: 2000,
  /** Query retry attempts */
  QUERY_RETRIES: 3
} as const

/** Job queue constants */
export const QUEUE = {
  /** Default job priority */
  DEFAULT_PRIORITY: 0,
  /** High priority jobs */
  HIGH_PRIORITY: -10,
  /** Maximum retries for failed jobs */
  MAX_RETRIES: 3,
  /** Initial backoff delay (ms) */
  BACKOFF_DELAY_MS: 2000,
  /** Job removal after completion (days) */
  COMPLETED_RETENTION_DAYS: 7,
  /** Job removal after failure (days) */
  FAILED_RETENTION_DAYS: 30
} as const

/** HTTP status codes (commonly used) */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503
} as const

/** Health grades */
export const HEALTH_GRADES = ['A', 'B', 'C', 'D', 'F'] as const
export type HealthGrade = (typeof HEALTH_GRADES)[number]

/** Prospect statuses */
export const PROSPECT_STATUSES = [
  'new',
  'contacted',
  'qualified',
  'proposal',
  'negotiation',
  'closed',
  'lost'
] as const
export type ProspectStatus = (typeof PROSPECT_STATUSES)[number]

/** Signal types */
export const SIGNAL_TYPES = [
  'hiring',
  'permit',
  'contract',
  'expansion',
  'equipment',
  'funding',
  'acquisition',
  'relocation'
] as const
export type SignalType = (typeof SIGNAL_TYPES)[number]
