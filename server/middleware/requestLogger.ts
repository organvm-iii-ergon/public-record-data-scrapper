import { Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'

// Sensitive keys that should be redacted from logs (query params)
const SENSITIVE_PARAM_KEYS = [
  'token',
  'password',
  'secret',
  'key',
  'apikey',
  'api_key',
  'authorization',
  'auth',
  'credential',
  'jwt',
  'bearer',
  'access_token',
  'refresh_token',
  'session',
  'cookie'
]

// Sensitive keys that should be redacted from request bodies
const SENSITIVE_BODY_KEYS = [
  'password',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'oldPassword',
  'secret',
  'apiKey',
  'api_key',
  'apiSecret',
  'api_secret',
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'creditCard',
  'credit_card',
  'cardNumber',
  'card_number',
  'cvv',
  'cvc',
  'ssn',
  'socialSecurityNumber',
  'social_security_number',
  'pin',
  'bankAccount',
  'bank_account',
  'accountNumber',
  'account_number',
  'routingNumber',
  'routing_number',
  'privateKey',
  'private_key'
]

function redactSensitiveParams(query: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(query)) {
    const keyLower = key.toLowerCase()
    const isSensitive = SENSITIVE_PARAM_KEYS.some((sensitive) => keyLower.includes(sensitive))
    redacted[key] = isSensitive ? '[REDACTED]' : value
  }
  return redacted
}

function redactSensitiveBody(body: Record<string, unknown>, depth = 0): Record<string, unknown> {
  // Prevent infinite recursion
  if (depth > 5) return { '[TRUNCATED]': 'Object too deep' }

  const redacted: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(body)) {
    const keyLower = key.toLowerCase()
    const isSensitive = SENSITIVE_BODY_KEYS.some(
      (sensitive) =>
        keyLower === sensitive.toLowerCase() || keyLower.includes(sensitive.toLowerCase())
    )

    if (isSensitive) {
      redacted[key] = '[REDACTED]'
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Recursively redact nested objects
      redacted[key] = redactSensitiveBody(value as Record<string, unknown>, depth + 1)
    } else if (Array.isArray(value)) {
      // Redact arrays of objects
      redacted[key] = value.map((item) =>
        item && typeof item === 'object'
          ? redactSensitiveBody(item as Record<string, unknown>, depth + 1)
          : item
      )
    } else {
      redacted[key] = value
    }
  }

  return redacted
}

function truncateBody(body: Record<string, unknown>, maxLength = 1000): string {
  const stringified = JSON.stringify(body)
  if (stringified.length > maxLength) {
    return stringified.slice(0, maxLength) + '...[TRUNCATED]'
  }
  return stringified
}

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Generate correlation ID
  const correlationId = uuidv4()
  ;(req as Request & { correlationId: string }).correlationId = correlationId

  const start = Date.now()

  // Prepare redacted body for logging
  let redactedBody: Record<string, unknown> | undefined
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    redactedBody = redactSensitiveBody(req.body as Record<string, unknown>)
  }

  // Log incoming request with sensitive data redacted
  console.log(
    '[REQUEST]',
    JSON.stringify({
      timestamp: new Date().toISOString(),
      correlationId,
      method: req.method,
      path: req.path,
      query: redactSensitiveParams(req.query as Record<string, unknown>),
      body: redactedBody ? truncateBody(redactedBody) : undefined,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })
  )

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start

    console.log(
      '[RESPONSE]',
      JSON.stringify({
        timestamp: new Date().toISOString(),
        correlationId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`
      })
    )
  })

  next()
}
