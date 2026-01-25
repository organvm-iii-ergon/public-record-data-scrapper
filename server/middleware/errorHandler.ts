import { Request, Response, NextFunction, RequestHandler } from 'express'
import { config } from '../config'
import { ServiceError, isServiceError } from '../errors'

// Extended request type with correlation ID
interface RequestWithCorrelation extends Request {
  correlationId?: string
}

export interface AppError extends Error {
  statusCode?: number
  code?: string
  details?: Record<string, unknown>
}

export class HttpError extends Error implements AppError {
  statusCode: number
  code: string

  constructor(statusCode: number, message: string, code?: string) {
    super(message)
    this.statusCode = statusCode
    this.code = code || 'INTERNAL_ERROR'
    this.name = 'HttpError'
  }
}

export const errorHandler = (
  err: AppError | ServiceError,
  req: RequestWithCorrelation,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) => {
  const correlationId = req.correlationId

  // Handle ServiceError instances with rich error info
  if (isServiceError(err)) {
    console.error('[ERROR]', {
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
      statusCode: err.statusCode,
      code: err.code,
      message: err.message,
      details: err.details,
      stack: config.server.env === 'development' ? err.stack : undefined,
      correlationId
    })

    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code,
        statusCode: err.statusCode,
        correlationId,
        ...(err.details && { details: err.details }),
        ...(config.server.env === 'development' && { stack: err.stack })
      }
    })
  }

  // Handle generic errors
  const statusCode = err.statusCode || 500
  const message = err.message || 'Internal Server Error'

  // Log error - omit stack trace in production
  console.error('[ERROR]', {
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    statusCode,
    message,
    stack: config.server.env === 'development' ? err.stack : undefined,
    correlationId
  })

  // Send error response - omit stack trace in production
  res.status(statusCode).json({
    error: {
      message:
        config.server.env === 'production' && statusCode === 500
          ? 'Internal Server Error'
          : message,
      code: err.code || 'INTERNAL_ERROR',
      statusCode,
      correlationId,
      ...(config.server.env === 'development' && { stack: err.stack })
    }
  })
}

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      code: 'NOT_FOUND',
      statusCode: 404
    }
  })
}

// Async error wrapper
type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void | Response>

export const asyncHandler = (fn: AsyncRequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
