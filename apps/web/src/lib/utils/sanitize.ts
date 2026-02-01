/**
 * Input Sanitization Utilities
 * Prevents XSS attacks by sanitizing user input and HTML content
 */

import DOMPurify from 'dompurify'

/**
 * Sanitizes HTML content, allowing only safe tags and attributes
 * Use for rendering user-generated HTML content
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'title', 'target'],
    ALLOW_DATA_ATTR: false
  })
}

/**
 * Sanitizes plain text by escaping HTML entities
 * Use for rendering user input in text contexts
 */
export function sanitizeText(text: string): string {
  return text.replace(/[<>&"']/g, (char) => {
    const map: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
      "'": '&#x27;'
    }
    return map[char] || char
  })
}

/**
 * Sanitizes URLs to prevent javascript: and data: protocols
 * Use for href and src attributes
 */
export function sanitizeUrl(url: string): string {
  const trimmed = url.trim().toLowerCase()

  // Block dangerous protocols
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('vbscript:')
  ) {
    return ''
  }

  return url
}

/**
 * Email validation regex
 * Validates:
 * - Valid local part characters (before @)
 * - Domain must have at least one dot (requires TLD)
 * - Valid domain label characters
 */
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

/**
 * Validates and sanitizes email addresses
 * Requires a proper domain with TLD (e.g., user@domain.com, not user@domain)
 *
 * @throws Error if email is invalid
 */
export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    throw new Error('Email is required')
  }

  const trimmed = email.trim().toLowerCase()

  // Check length limits (RFC 5321)
  if (trimmed.length > 254) {
    throw new Error('Email address too long')
  }

  // Check local part length (before @)
  const atIndex = trimmed.indexOf('@')
  if (atIndex === -1 || atIndex > 64) {
    throw new Error('Invalid email address')
  }

  // Must have at least one dot after @ (requires TLD)
  const domain = trimmed.substring(atIndex + 1)
  if (!domain.includes('.')) {
    throw new Error('Invalid email address')
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    throw new Error('Invalid email address')
  }

  return trimmed
}

/**
 * Sanitizes file names to prevent path traversal attacks
 */
export function sanitizeFileName(fileName: string): string {
  // Remove path separators and special characters
  return fileName
    .replace(/[/\\]/g, '')
    .replace(/\.\./g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 255) // Limit length
}

/**
 * Validates and sanitizes numeric input
 */
export function sanitizeNumber(
  value: string | number,
  options: { min?: number; max?: number; default?: number } = {}
): number {
  const num = typeof value === 'string' ? parseFloat(value) : value

  if (isNaN(num)) {
    return options.default ?? 0
  }

  if (options.min !== undefined && num < options.min) {
    return options.min
  }

  if (options.max !== undefined && num > options.max) {
    return options.max
  }

  return num
}

/**
 * Sanitizes SQL-like input by escaping special characters
 * Note: Always use parameterized queries - this is a last resort defense
 */
export function sanitizeSqlInput(input: string): string {
  return input
    .replace(/'/g, "''") // Escape single quotes
    .replace(/;/g, '') // Remove semicolons
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*/g, '') // Remove multi-line comment start
    .replace(/\*\//g, '') // Remove multi-line comment end
}

/**
 * Validates that a string contains only alphanumeric characters and specific allowed characters
 */
export function sanitizeAlphanumeric(input: string, allowedChars: string = '_-'): string {
  const regex = new RegExp(
    `[^a-zA-Z0-9${allowedChars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]`,
    'g'
  )
  return input.replace(regex, '')
}

/**
 * Deep sanitizes an object by recursively sanitizing all string values
 * Use with caution - may impact performance on large objects
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  sanitizer: (value: string) => string = sanitizeText
): T {
  const result: Record<string, unknown> | unknown[] = Array.isArray(obj) ? [] : {}

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      if (Array.isArray(result)) {
        result.push(sanitizer(value))
      } else {
        result[key] = sanitizer(value)
      }
    } else if (value && typeof value === 'object') {
      if (Array.isArray(result)) {
        result.push(sanitizeObject(value as Record<string, unknown>, sanitizer))
      } else {
        result[key] = sanitizeObject(value as Record<string, unknown>, sanitizer)
      }
    } else {
      if (Array.isArray(result)) {
        result.push(value)
      } else {
        result[key] = value
      }
    }
  }

  return result as T
}

/**
 * Content Security Policy (CSP) nonce generator
 * Use for inline scripts and styles
 */
export function generateNonce(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for older browsers
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
