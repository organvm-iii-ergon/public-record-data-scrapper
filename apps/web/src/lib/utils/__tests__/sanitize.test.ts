/**
 * Tests for Input Sanitization Utilities
 */

import { describe, it, expect } from 'vitest'
import {
  sanitizeHtml,
  sanitizeText,
  sanitizeUrl,
  sanitizeEmail,
  sanitizeFileName,
  sanitizeNumber,
  sanitizeSqlInput,
  sanitizeAlphanumeric,
  sanitizeObject,
  generateNonce
} from '../sanitize'

describe('sanitizeHtml', () => {
  it('should allow safe HTML tags', () => {
    const input = '<p>Hello <strong>World</strong></p>'
    const output = sanitizeHtml(input)
    expect(output).toBe('<p>Hello <strong>World</strong></p>')
  })

  it('should remove script tags', () => {
    const input = '<p>Hello</p><script>alert("XSS")</script>'
    const output = sanitizeHtml(input)
    expect(output).not.toContain('<script>')
    expect(output).toContain('<p>Hello</p>')
  })

  it('should remove onclick handlers', () => {
    const input = '<a href="#" onclick="alert(\'XSS\')">Click</a>'
    const output = sanitizeHtml(input)
    expect(output).not.toContain('onclick')
  })

  it('should allow safe links', () => {
    const input = '<a href="https://example.com" title="Example">Link</a>'
    const output = sanitizeHtml(input)
    expect(output).toContain('href="https://example.com"')
  })
})

describe('sanitizeText', () => {
  it('should escape HTML entities', () => {
    const input = '<script>alert("XSS")</script>'
    const output = sanitizeText(input)
    expect(output).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;')
  })

  it('should escape ampersands', () => {
    const input = 'Company & Co.'
    const output = sanitizeText(input)
    expect(output).toBe('Company &amp; Co.')
  })

  it('should handle empty strings', () => {
    expect(sanitizeText('')).toBe('')
  })
})

describe('sanitizeUrl', () => {
  it('should allow http URLs', () => {
    const input = 'http://example.com'
    const output = sanitizeUrl(input)
    expect(output).toBe(input)
  })

  it('should allow https URLs', () => {
    const input = 'https://example.com'
    const output = sanitizeUrl(input)
    expect(output).toBe(input)
  })

  it('should block javascript protocol', () => {
    const input = 'javascript:alert("XSS")'
    const output = sanitizeUrl(input)
    expect(output).toBe('')
  })

  it('should block data protocol', () => {
    const input = 'data:text/html,<script>alert("XSS")</script>'
    const output = sanitizeUrl(input)
    expect(output).toBe('')
  })

  it('should handle mixed case protocols', () => {
    const input = 'JaVaScRiPt:alert("XSS")'
    const output = sanitizeUrl(input)
    expect(output).toBe('')
  })
})

describe('sanitizeEmail', () => {
  it('should accept valid emails', () => {
    const input = 'user@example.com'
    const output = sanitizeEmail(input)
    expect(output).toBe('user@example.com')
  })

  it('should normalize to lowercase', () => {
    const input = 'User@Example.COM'
    const output = sanitizeEmail(input)
    expect(output).toBe('user@example.com')
  })

  it('should reject invalid emails', () => {
    expect(() => sanitizeEmail('not-an-email')).toThrow('Invalid email address')
    expect(() => sanitizeEmail('missing@domain')).toThrow('Invalid email address')
    expect(() => sanitizeEmail('@example.com')).toThrow('Invalid email address')
  })

  it('should trim whitespace', () => {
    const input = '  user@example.com  '
    const output = sanitizeEmail(input)
    expect(output).toBe('user@example.com')
  })
})

describe('sanitizeFileName', () => {
  it('should allow safe filenames', () => {
    const input = 'document_2024-01-15.pdf'
    const output = sanitizeFileName(input)
    expect(output).toBe('document_2024-01-15.pdf')
  })

  it('should remove path traversal attempts', () => {
    const input = '../../../etc/passwd'
    const output = sanitizeFileName(input)
    expect(output).not.toContain('..')
    expect(output).not.toContain('/')
  })

  it('should replace special characters', () => {
    const input = 'my file!@#$.txt'
    const output = sanitizeFileName(input)
    expect(output).toMatch(/^[a-zA-Z0-9._-]+$/)
  })

  it('should limit length to 255 characters', () => {
    const input = 'a'.repeat(300) + '.txt'
    const output = sanitizeFileName(input)
    expect(output.length).toBeLessThanOrEqual(255)
  })
})

describe('sanitizeNumber', () => {
  it('should parse valid numbers', () => {
    expect(sanitizeNumber('42')).toBe(42)
    expect(sanitizeNumber(42)).toBe(42)
    expect(sanitizeNumber('3.14')).toBe(3.14)
  })

  it('should enforce minimum value', () => {
    expect(sanitizeNumber(-5, { min: 0 })).toBe(0)
  })

  it('should enforce maximum value', () => {
    expect(sanitizeNumber(150, { max: 100 })).toBe(100)
  })

  it('should return default for NaN', () => {
    expect(sanitizeNumber('not-a-number', { default: 0 })).toBe(0)
  })

  it('should handle negative numbers', () => {
    expect(sanitizeNumber('-42')).toBe(-42)
  })
})

describe('sanitizeSqlInput', () => {
  it('should escape single quotes', () => {
    const input = "O'Reilly"
    const output = sanitizeSqlInput(input)
    expect(output).toBe("O''Reilly")
  })

  it('should remove SQL comments', () => {
    const input = 'admin -- drop table users'
    const output = sanitizeSqlInput(input)
    expect(output).not.toContain('--')
  })

  it('should remove semicolons', () => {
    const input = 'value; DROP TABLE users;'
    const output = sanitizeSqlInput(input)
    expect(output).not.toContain(';')
  })

  it('should remove multi-line comments', () => {
    const input = 'value /* comment */ more'
    const output = sanitizeSqlInput(input)
    expect(output).not.toContain('/*')
    expect(output).not.toContain('*/')
  })
})

describe('sanitizeAlphanumeric', () => {
  it('should allow alphanumeric characters', () => {
    const input = 'abc123XYZ'
    const output = sanitizeAlphanumeric(input)
    expect(output).toBe('abc123XYZ')
  })

  it('should allow specified special characters', () => {
    const input = 'user_name-123'
    const output = sanitizeAlphanumeric(input, '_-')
    expect(output).toBe('user_name-123')
  })

  it('should remove disallowed characters', () => {
    const input = 'user@name!123'
    const output = sanitizeAlphanumeric(input)
    expect(output).toBe('username123')
  })
})

describe('sanitizeObject', () => {
  it('should sanitize string values', () => {
    const input = {
      name: '<script>alert("XSS")</script>',
      value: 42
    }
    const output = sanitizeObject(input)
    expect(output.name).not.toContain('<script>')
    expect(output.value).toBe(42)
  })

  it('should recursively sanitize nested objects', () => {
    const input = {
      user: {
        name: '<b>John</b>',
        bio: '<script>alert("XSS")</script>'
      }
    }
    const output = sanitizeObject(input)
    expect(output.user.name).not.toContain('<b>')
    expect(output.user.bio).not.toContain('<script>')
  })

  it('should handle arrays', () => {
    const input = {
      items: ['<script>XSS</script>', 'safe', '<b>bold</b>']
    }
    const output = sanitizeObject(input)
    expect(output.items[0]).not.toContain('<script>')
    expect(output.items[1]).toBe('safe')
    expect(output.items[2]).not.toContain('<b>')
  })
})

describe('generateNonce', () => {
  it('should generate unique nonces', () => {
    const nonce1 = generateNonce()
    const nonce2 = generateNonce()
    expect(nonce1).not.toBe(nonce2)
  })

  it('should generate nonces of expected length', () => {
    const nonce = generateNonce()
    expect(nonce.length).toBeGreaterThan(0)
  })

  it('should generate valid hex/UUID format', () => {
    const nonce = generateNonce()
    // Should be either UUID format or hex string
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nonce)
    const isHex = /^[0-9a-f]+$/i.test(nonce)
    expect(isUuid || isHex).toBe(true)
  })
})
