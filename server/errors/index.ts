/**
 * Base error class for service layer errors.
 * Provides consistent error structure across all services.
 */
export class ServiceError extends Error {
  public readonly statusCode: number
  public readonly code: string
  public readonly details?: Record<string, unknown>

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'SERVICE_ERROR',
    details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ServiceError'
    this.statusCode = statusCode
    this.code = code
    this.details = details

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor)
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      statusCode: this.statusCode,
      ...(this.details && { details: this.details })
    }
  }
}

/**
 * Error thrown when a requested resource is not found.
 */
export class NotFoundError extends ServiceError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`
    super(message, 404, 'NOT_FOUND', { resource, id })
    this.name = 'NotFoundError'
  }
}

/**
 * Error thrown when request validation fails.
 */
export class ValidationError extends ServiceError {
  constructor(message: string, fields?: Record<string, string[]>) {
    super(message, 400, 'VALIDATION_ERROR', fields ? { fields } : undefined)
    this.name = 'ValidationError'
  }
}

/**
 * Error thrown when user is not authenticated.
 */
export class UnauthorizedError extends ServiceError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED')
    this.name = 'UnauthorizedError'
  }
}

/**
 * Error thrown when user lacks permission for an action.
 */
export class ForbiddenError extends ServiceError {
  constructor(message: string = 'Permission denied') {
    super(message, 403, 'FORBIDDEN')
    this.name = 'ForbiddenError'
  }
}

/**
 * Error thrown when there's a conflict with existing data.
 */
export class ConflictError extends ServiceError {
  constructor(message: string, conflictingResource?: string) {
    super(
      message,
      409,
      'CONFLICT',
      conflictingResource ? { resource: conflictingResource } : undefined
    )
    this.name = 'ConflictError'
  }
}

/**
 * Error thrown when rate limit is exceeded.
 */
export class RateLimitError extends ServiceError {
  constructor(retryAfter?: number) {
    super(
      'Rate limit exceeded',
      429,
      'RATE_LIMIT_EXCEEDED',
      retryAfter ? { retryAfter } : undefined
    )
    this.name = 'RateLimitError'
  }
}

/**
 * Error thrown for database-related failures.
 */
export class DatabaseError extends ServiceError {
  constructor(message: string = 'Database operation failed', originalError?: Error) {
    super(
      message,
      500,
      'DATABASE_ERROR',
      originalError ? { originalMessage: originalError.message } : undefined
    )
    this.name = 'DatabaseError'
  }
}

/**
 * Error thrown when an external service fails.
 */
export class ExternalServiceError extends ServiceError {
  constructor(serviceName: string, message?: string) {
    super(message || `External service '${serviceName}' failed`, 502, 'EXTERNAL_SERVICE_ERROR', {
      service: serviceName
    })
    this.name = 'ExternalServiceError'
  }
}

/**
 * Type guard to check if an error is a ServiceError.
 */
export function isServiceError(error: unknown): error is ServiceError {
  return error instanceof ServiceError
}
