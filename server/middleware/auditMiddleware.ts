/**
 * Audit Middleware
 *
 * Intercepts mutating API requests (POST, PUT, PATCH, DELETE) as well as sensitive
 * data read operations (GET requests accessing PII, disclosures, exports, and financial data)
 * and logs them with cryptographic hash chaining for SOC2 compliance.
 *
 * Features:
 * - Cryptographic hash chaining through AuditService
 * - Captures before/after state for entity changes
 * - Intercepts sensitive GET access (contacts, prospects, deals, disclosures, compliance exports)
 * - Deep recursive redaction of sensitive fields (passwords, tokens, SSNs, credit cards, bank accounts)
 * - Records user context (IP, user agent, request ID, orgId)
 * - Skips health checks and other non-auditable endpoints
 * - Async logging to avoid blocking requests
 */

import { Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { auditService } from '../services/AuditService'
import type { AuthenticatedRequest } from './authMiddleware'

// Endpoints that should not be audited
export const SKIP_AUDIT_PATHS = [
  '/api/health',
  '/api/health/ready',
  '/api/health/live',
  '/api/metrics',
  '/api/jobs/status',
  '/api/auth/refresh',
  '/api/auth/logout'
]

// HTTP methods that trigger mutation auditing
export const AUDITABLE_MUTATION_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']

// Paths containing sensitive data where read (GET) operations must be audited
export const SENSITIVE_READ_PATTERNS: Array<{
  pattern: RegExp
  entityType: string
  action: string
}> = [
  {
    pattern: /^\/api\/compliance\/audit\/export-package/,
    entityType: 'compliance_package',
    action: 'export'
  },
  {
    pattern: /^\/api\/compliance\/audit\/export/,
    entityType: 'compliance_export',
    action: 'export'
  },
  {
    pattern: /^\/api\/compliance\/audit\/verify/,
    entityType: 'audit_integrity',
    action: 'verify'
  },
  {
    pattern: /^\/api\/compliance\/audit/,
    entityType: 'audit_log',
    action: 'access'
  },
  {
    pattern: /^\/api\/compliance\/disclosures/,
    entityType: 'disclosure',
    action: 'access'
  },
  {
    pattern: /^\/api\/compliance\/consents/,
    entityType: 'consent',
    action: 'access'
  },
  {
    pattern: /^\/api\/contacts/,
    entityType: 'contact',
    action: 'access'
  },
  {
    pattern: /^\/api\/prospects/,
    entityType: 'prospect',
    action: 'access'
  },
  {
    pattern: /^\/api\/deals\/[^/]+\/documents/,
    entityType: 'deal_document',
    action: 'access'
  },
  {
    pattern: /^\/api\/deals/,
    entityType: 'deal',
    action: 'access'
  },
  {
    pattern: /^\/api\/api-keys/,
    entityType: 'api_key',
    action: 'access'
  }
]

// Map of paths to entity types for mutations
export const ENTITY_TYPE_MAP: Record<string, string> = {
  '/api/prospects': 'prospect',
  '/api/contacts': 'contact',
  '/api/deals': 'deal',
  '/api/communications': 'communication',
  '/api/disclosures': 'disclosure',
  '/api/consent': 'consent',
  '/api/dnc': 'dnc_entry',
  '/api/portfolio': 'portfolio',
  '/api/competitors': 'competitor',
  '/api/api-keys': 'api_key'
}

// Map of HTTP methods to action names
export const ACTION_MAP: Record<string, string> = {
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete'
}

export interface AuditContext {
  requestId: string
  userId?: string
  orgId?: string
  action: string
  entityType: string
  entityId?: string
  ipAddress?: string
  userAgent?: string
  beforeState?: Record<string, unknown>
  afterState?: Record<string, unknown>
  changes?: Record<string, { old: unknown; new: unknown }>
}

/**
 * Check if path matches sensitive read pattern for GET auditing
 */
export function getSensitiveReadConfig(
  path: string
): { entityType: string; action: string } | null {
  for (const item of SENSITIVE_READ_PATTERNS) {
    if (item.pattern.test(path)) {
      return { entityType: item.entityType, action: item.action }
    }
  }
  return null
}

/**
 * Extract entity type from request path
 */
export function getEntityType(path: string): string {
  for (const [prefix, type] of Object.entries(ENTITY_TYPE_MAP)) {
    if (path.startsWith(prefix)) {
      return type
    }
  }
  return 'unknown'
}

/**
 * Extract entity ID from request path
 */
export function extractEntityId(path: string): string | undefined {
  const parts = path.split('/')
  for (let i = parts.length - 1; i >= 0; i--) {
    const potentialId = parts[i]
    // Basic UUID validation
    if (potentialId && /^[0-9a-f-]{36}$/i.test(potentialId)) {
      return potentialId
    }
  }
  return undefined
}

/**
 * Calculate changes between before and after states
 */
export function calculateChanges(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined
): Record<string, { old: unknown; new: unknown }> | undefined {
  if (!before || !after) {
    return undefined
  }

  const changes: Record<string, { old: unknown; new: unknown }> = {}
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])

  for (const key of allKeys) {
    const oldVal = before[key]
    const newVal = after[key]

    // Skip internal/timestamp fields
    if (['created_at', 'updated_at', 'createdAt', 'updatedAt'].includes(key)) {
      continue
    }

    // Compare JSON stringified values for deep comparison
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes[key] = { old: oldVal, new: newVal }
    }
  }

  return Object.keys(changes).length > 0 ? changes : undefined
}

/**
 * Asynchronously write audit log through AuditService
 * Guarantees cryptographic hash chaining and does not block the response
 */
async function writeAuditLog(context: AuditContext): Promise<void> {
  try {
    await auditService.createAuditEntry({
      orgId: context.orgId,
      userId: context.userId,
      action: context.action,
      entityType: context.entityType,
      entityId: context.entityId,
      changes: context.changes,
      beforeState: context.beforeState,
      afterState: context.afterState,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId
    })
  } catch (error) {
    // Log error but don't fail the request
    console.error('[AuditMiddleware] Failed to write audit log:', error)
  }
}

export const SENSITIVE_FIELDS = [
  'password',
  'ssn',
  'socialSecurityNumber',
  'bankAccount',
  'accountNumber',
  'routingNumber',
  'creditCard',
  'cardNumber',
  'cvv',
  'pin',
  'secret',
  'token',
  'apiKey'
]

// Pre-compute the normalized set of sensitive key names (lowercased, with both
// camelCase and snake_case variants) for efficient recursive matching.
const SENSITIVE_KEY_SET = new Set<string>(
  SENSITIVE_FIELDS.flatMap((field) => {
    const snakeCase = field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
    return [field.toLowerCase(), snakeCase.toLowerCase()]
  })
)

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_SET.has(key.toLowerCase())
}

/**
 * Recursively redact a single value (handles objects and arrays).
 */
function redactValue(value: unknown, depth: number): unknown {
  // Guard against deeply nested / cyclic-like structures.
  if (depth > 8) return '[TRUNCATED]'

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth + 1))
  }

  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(source)) {
      if (isSensitiveKey(key)) {
        out[key] = '[REDACTED]'
      } else {
        out[key] = redactValue(val, depth + 1)
      }
    }
    return out
  }

  return value
}

/**
 * Redact sensitive fields from audit logs.
 *
 * Recurses into nested objects and arrays so sensitive values are masked at any depth.
 */
export function redactSensitiveData(
  data: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!data) return undefined
  return redactValue(data, 0) as Record<string, unknown>
}

/**
 * Express middleware for auditing API mutations and sensitive data reads
 */
export const auditMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  // Skip excluded paths
  if (SKIP_AUDIT_PATHS.some((path) => req.path.startsWith(path))) {
    return next()
  }

  let isAuditable = false
  let action = ''
  let entityType = ''

  if (AUDITABLE_MUTATION_METHODS.includes(req.method)) {
    isAuditable = true
    action = ACTION_MAP[req.method] || req.method.toLowerCase()
    entityType = getEntityType(req.path)
  } else if (req.method === 'GET') {
    const sensitiveConfig = getSensitiveReadConfig(req.path)
    if (sensitiveConfig) {
      isAuditable = true
      action = sensitiveConfig.action
      entityType = sensitiveConfig.entityType
    }
  }

  if (!isAuditable) {
    return next()
  }

  // Generate or use existing request ID
  const requestId = (req as Request & { correlationId?: string }).correlationId || uuidv4()

  const auditContext: AuditContext = {
    requestId,
    userId: req.user?.id,
    orgId: (req as AuthenticatedRequest & { orgId?: string }).orgId || req.user?.orgId,
    action,
    entityType,
    entityId: extractEntityId(req.path) || req.body?.id,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent']
  }

  // Store original body and query for context
  const originalBody = req.body ? { ...req.body } : undefined
  const originalQuery =
    req.query && typeof req.query === 'object' && Object.keys(req.query).length > 0
      ? { ...req.query }
      : undefined

  let audited = false

  const processAudit = (body: unknown): void => {
    if (audited) return
    audited = true

    setImmediate(async () => {
      try {
        const responseObject =
          body && typeof body === 'object' && !Array.isArray(body)
            ? (body as Record<string, unknown>)
            : undefined
        const isErrorResponse = !!responseObject && 'error' in responseObject

        // For sensitive reads/exports
        if (['access', 'export', 'verify'].includes(auditContext.action)) {
          if (responseObject && !isErrorResponse) {
            auditContext.afterState = redactSensitiveData(responseObject)
          }
          if (originalQuery) {
            auditContext.beforeState = redactSensitiveData(originalQuery as Record<string, unknown>)
          }
        }

        // For creates, the response body is the after state
        if (auditContext.action === 'create' && responseObject && !isErrorResponse) {
          auditContext.afterState = redactSensitiveData(responseObject)
        }

        // For updates, calculate changes between request body and response
        if (
          auditContext.action === 'update' &&
          originalBody &&
          responseObject &&
          !isErrorResponse
        ) {
          auditContext.beforeState = redactSensitiveData(originalBody)
          auditContext.afterState = redactSensitiveData(responseObject)
          auditContext.changes = calculateChanges(
            redactSensitiveData(originalBody),
            redactSensitiveData(responseObject)
          )
        }

        // For deletes, the request body or params contain the entity info
        if (auditContext.action === 'delete') {
          auditContext.beforeState = redactSensitiveData(originalBody)
        }

        // Only log successful (non-error) responses
        if (res.statusCode < 400) {
          await writeAuditLog(auditContext)
        }
      } catch (error) {
        console.error('[AuditMiddleware] Error processing audit:', error)
      }
    })
  }

  // Capture original methods
  const originalJson = res.json.bind(res)
  const originalSend = res.send.bind(res)

  res.json = function (body: Record<string, unknown>): Response {
    processAudit(body)
    return originalJson(body)
  }

  res.send = function (body?: unknown): Response {
    let parsed: unknown = body
    if (typeof body === 'string') {
      try {
        parsed = JSON.parse(body)
      } catch {
        parsed = undefined
      }
    }
    processAudit(parsed)
    return originalSend(body)
  }

  next()
}

/**
 * Helper to manually create an audit log entry
 * Useful for custom audit scenarios not handled by middleware
 */
export async function createAuditLog(params: {
  orgId?: string
  userId?: string
  action: string
  entityType: string
  entityId?: string
  beforeState?: Record<string, unknown>
  afterState?: Record<string, unknown>
  changes?: Record<string, { old: unknown; new: unknown }>
  ipAddress?: string
  userAgent?: string
  requestId?: string
}): Promise<void> {
  const context: AuditContext = {
    ...params,
    requestId: params.requestId || uuidv4(),
    beforeState: redactSensitiveData(params.beforeState),
    afterState: redactSensitiveData(params.afterState)
  }
  await writeAuditLog(context)
}

export default auditMiddleware
