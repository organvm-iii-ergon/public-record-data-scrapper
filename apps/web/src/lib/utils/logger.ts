/**
 * Structured logging utility for the UCC-MCA Intelligence Platform
 *
 * Provides consistent logging with log levels, timestamps, and context.
 * In production, debug logs are suppressed.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: LogContext
  error?: {
    name: string
    message: string
    stack?: string
  }
}

const isProduction = import.meta.env.PROD
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

// Minimum log level in production is 'info', in development is 'debug'
const minLogLevel: LogLevel = isProduction ? 'info' : 'debug'

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLogLevel]
}

function formatLogEntry(entry: LogEntry): string {
  const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : ''
  const errorStr = entry.error
    ? ` Error: ${entry.error.message}${entry.error.stack ? `\n${entry.error.stack}` : ''}`
    : ''
  return `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}${contextStr}${errorStr}`
}

function createLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: Error
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message
  }

  if (context && Object.keys(context).length > 0) {
    entry.context = context
  }

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: isProduction ? undefined : error.stack
    }
  }

  return entry
}

/**
 * Logger interface for consistent logging throughout the application
 */
export interface Logger {
  /** Log debug information (suppressed in production) */
  debug: (message: string, context?: LogContext) => void
  /** Log general information */
  info: (message: string, context?: LogContext) => void
  /** Log warnings */
  warn: (message: string, context?: LogContext) => void
  /** Log errors with optional Error object */
  error: (message: string, error?: Error, context?: LogContext) => void
  /** Create a child logger with additional context */
  child: (defaultContext: LogContext) => Logger
}

function createLogger(defaultContext?: LogContext): Logger {
  const mergeContext = (context?: LogContext): LogContext | undefined => {
    if (!defaultContext && !context) return undefined
    return { ...defaultContext, ...context }
  }

  return {
    debug: (message: string, context?: LogContext) => {
      if (!shouldLog('debug')) return
      const entry = createLogEntry('debug', message, mergeContext(context))
      console.debug(formatLogEntry(entry))
    },

    info: (message: string, context?: LogContext) => {
      if (!shouldLog('info')) return
      const entry = createLogEntry('info', message, mergeContext(context))
      console.info(formatLogEntry(entry))
    },

    warn: (message: string, context?: LogContext) => {
      if (!shouldLog('warn')) return
      const entry = createLogEntry('warn', message, mergeContext(context))
      console.warn(formatLogEntry(entry))
    },

    error: (message: string, error?: Error, context?: LogContext) => {
      if (!shouldLog('error')) return
      const entry = createLogEntry('error', message, mergeContext(context), error)
      console.error(formatLogEntry(entry))
    },

    child: (childContext: LogContext): Logger => {
      return createLogger({ ...defaultContext, ...childContext })
    }
  }
}

/**
 * Default logger instance
 *
 * @example
 * import { logger } from '@/lib/utils/logger'
 *
 * logger.debug('Processing data', { itemCount: 100 })
 * logger.info('User logged in', { userId: '123' })
 * logger.warn('Cache miss', { key: 'user:123' })
 * logger.error('Failed to fetch data', error, { endpoint: '/api/data' })
 */
export const logger: Logger = createLogger()

/**
 * Create a logger with module-specific context
 *
 * @example
 * const agentLogger = createModuleLogger('AgenticEngine')
 * agentLogger.info('Agent started', { agentId: 'abc123' })
 */
export function createModuleLogger(module: string): Logger {
  return createLogger({ module })
}

/**
 * Measure and log execution time of an async function
 *
 * @example
 * const result = await withTiming('fetchProspects', async () => {
 *   return await api.getProspects()
 * })
 */
export async function withTiming<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: LogContext
): Promise<T> {
  const start = performance.now()
  try {
    const result = await fn()
    const duration = performance.now() - start
    logger.debug(`${operation} completed`, { ...context, durationMs: Math.round(duration) })
    return result
  } catch (error) {
    const duration = performance.now() - start
    logger.error(`${operation} failed`, error as Error, {
      ...context,
      durationMs: Math.round(duration)
    })
    throw error
  }
}

/**
 * Create a performance tracker for measuring multiple operations
 *
 * @example
 * const tracker = createPerformanceTracker('DataPipeline')
 * tracker.mark('fetch')
 * await fetchData()
 * tracker.mark('process')
 * await processData()
 * tracker.mark('save')
 * await saveData()
 * tracker.log() // Logs all marks with durations
 */
export function createPerformanceTracker(name: string) {
  const marks: Array<{ name: string; timestamp: number }> = []
  const startTime = performance.now()

  return {
    mark: (markName: string) => {
      marks.push({ name: markName, timestamp: performance.now() })
    },
    log: () => {
      const totalDuration = performance.now() - startTime
      const durations: Record<string, number> = {}

      for (let i = 0; i < marks.length; i++) {
        const prevTimestamp = i === 0 ? startTime : marks[i - 1].timestamp
        durations[marks[i].name] = Math.round(marks[i].timestamp - prevTimestamp)
      }

      logger.debug(`${name} performance`, {
        totalMs: Math.round(totalDuration),
        ...durations
      })
    }
  }
}
