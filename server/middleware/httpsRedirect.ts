import { Request, Response, NextFunction } from 'express'
import { config } from '../config'

/**
 * HTTPS redirect middleware for production environments
 *
 * This middleware:
 * 1. Redirects HTTP requests to HTTPS in production
 * 2. Adds HSTS (HTTP Strict Transport Security) header
 *
 * Note: When behind a reverse proxy (AWS ALB, Nginx, etc.),
 * the proxy typically handles TLS termination. The original
 * protocol is passed via X-Forwarded-Proto header.
 */
export const httpsRedirect = (req: Request, res: Response, next: NextFunction): void => {
  // Only enforce HTTPS in production
  if (config.server.env !== 'production') {
    return next()
  }

  // Check if request came over HTTPS
  // X-Forwarded-Proto is set by reverse proxies (ALB, Nginx, etc.)
  const protocol = req.headers['x-forwarded-proto']
  const isHttps = protocol === 'https' || req.secure || req.connection.encrypted

  if (!isHttps) {
    // 301 Permanent Redirect to HTTPS
    const httpsUrl = `https://${req.headers.host}${req.url}`
    res.redirect(301, httpsUrl)
    return
  }

  // Add HSTS header for HTTPS requests
  // max-age: 1 year (31536000 seconds)
  // includeSubDomains: Apply to all subdomains
  // preload: Allow inclusion in browser preload lists
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')

  next()
}

/**
 * Configurable HTTPS redirect with options
 */
interface HttpsRedirectOptions {
  enabled?: boolean
  hstsMaxAge?: number
  includeSubDomains?: boolean
  preload?: boolean
}

export function createHttpsRedirect(
  options: HttpsRedirectOptions = {}
): (req: Request, res: Response, next: NextFunction) => void {
  const {
    enabled = config.server.env === 'production',
    hstsMaxAge = 31536000,
    includeSubDomains = true,
    preload = true
  } = options

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!enabled) {
      return next()
    }

    const protocol = req.headers['x-forwarded-proto']
    const isHttps =
      protocol === 'https' || req.secure || (req.connection as { encrypted?: boolean }).encrypted

    if (!isHttps) {
      const httpsUrl = `https://${req.headers.host}${req.url}`
      res.redirect(301, httpsUrl)
      return
    }

    // Build HSTS header
    let hstsValue = `max-age=${hstsMaxAge}`
    if (includeSubDomains) hstsValue += '; includeSubDomains'
    if (preload) hstsValue += '; preload'

    res.setHeader('Strict-Transport-Security', hstsValue)
    next()
  }
}
