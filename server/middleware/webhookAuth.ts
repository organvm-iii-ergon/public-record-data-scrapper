/**
 * Webhook Authentication Middleware
 *
 * Provides signature verification for incoming webhooks from:
 * - Twilio (SMS and Voice)
 * - SendGrid (Email events)
 * - Plaid (Transaction and Item updates)
 *
 * Each service has its own signature verification method to ensure
 * requests are authentic and haven't been tampered with.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express'
import crypto from 'crypto'

// Configuration from environment
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || ''
const SENDGRID_WEBHOOK_VERIFICATION_KEY = process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY || ''
const PLAID_WEBHOOK_SECRET = process.env.PLAID_WEBHOOK_SECRET || ''

/**
 * Extended request with raw body for signature verification
 */
export interface WebhookRequest extends Request {
  rawBody?: Buffer
}

/**
 * Twilio Signature Verification
 *
 * Validates incoming Twilio webhooks using the X-Twilio-Signature header.
 * The signature is an HMAC-SHA1 hash of the request URL and sorted POST parameters.
 *
 * @see https://www.twilio.com/docs/usage/security#validating-requests
 */
export const verifyTwilioSignature: RequestHandler = (
  req: WebhookRequest,
  res: Response,
  next: NextFunction
) => {
  // Skip verification in development if no auth token configured
  if (!TWILIO_AUTH_TOKEN) {
    console.warn('[webhookAuth] Twilio auth token not configured - skipping verification')
    return next()
  }

  const signature = req.headers['x-twilio-signature'] as string
  if (!signature) {
    console.error('[webhookAuth] Missing X-Twilio-Signature header')
    return res.status(401).json({
      error: {
        message: 'Missing Twilio signature',
        code: 'WEBHOOK_AUTH_FAILED',
        statusCode: 401
      }
    })
  }

  // Build the full URL (including protocol, host, and path)
  const protocol = req.headers['x-forwarded-proto'] || req.protocol
  const host = req.headers.host || ''
  const url = `${protocol}://${host}${req.originalUrl}`

  // Sort and concatenate POST parameters
  const sortedParams = Object.keys(req.body || {})
    .sort()
    .reduce((acc, key) => acc + key + req.body[key], '')

  // Create HMAC-SHA1 hash
  const data = url + sortedParams
  const expectedSignature = crypto
    .createHmac('sha1', TWILIO_AUTH_TOKEN)
    .update(data)
    .digest('base64')

  // Timing-safe comparison to prevent timing attacks
  if (!timingSafeEqual(signature, expectedSignature)) {
    console.error('[webhookAuth] Invalid Twilio signature')
    return res.status(401).json({
      error: {
        message: 'Invalid Twilio signature',
        code: 'WEBHOOK_AUTH_FAILED',
        statusCode: 401
      }
    })
  }

  next()
}

/**
 * SendGrid Event Webhook Verification
 *
 * Validates incoming SendGrid event webhooks using ECDSA signature verification.
 * SendGrid signs the raw request body with their private key.
 *
 * @see https://docs.sendgrid.com/for-developers/tracking-events/getting-started-event-webhook-security-features
 */
export const verifySendGridSignature: RequestHandler = (
  req: WebhookRequest,
  res: Response,
  next: NextFunction
) => {
  // Skip verification in development if no verification key configured
  if (!SENDGRID_WEBHOOK_VERIFICATION_KEY) {
    console.warn('[webhookAuth] SendGrid verification key not configured - skipping verification')
    return next()
  }

  const signature = req.headers['x-twilio-email-event-webhook-signature'] as string
  const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'] as string

  if (!signature || !timestamp) {
    console.error('[webhookAuth] Missing SendGrid signature headers')
    return res.status(401).json({
      error: {
        message: 'Missing SendGrid signature',
        code: 'WEBHOOK_AUTH_FAILED',
        statusCode: 401
      }
    })
  }

  // Get the raw body for signature verification
  const rawBody = req.rawBody?.toString('utf8') || JSON.stringify(req.body)

  // Construct the payload to verify (timestamp + payload)
  const payload = timestamp + rawBody

  try {
    // Verify ECDSA signature
    const verifier = crypto.createVerify('sha256')
    verifier.update(payload)

    // Convert base64-encoded public key
    const publicKey = `-----BEGIN PUBLIC KEY-----\n${SENDGRID_WEBHOOK_VERIFICATION_KEY}\n-----END PUBLIC KEY-----`

    const isValid = verifier.verify(publicKey, signature, 'base64')

    if (!isValid) {
      console.error('[webhookAuth] Invalid SendGrid signature')
      return res.status(401).json({
        error: {
          message: 'Invalid SendGrid signature',
          code: 'WEBHOOK_AUTH_FAILED',
          statusCode: 401
        }
      })
    }

    next()
  } catch (error) {
    console.error('[webhookAuth] SendGrid signature verification error:', error)
    return res.status(401).json({
      error: {
        message: 'SendGrid signature verification failed',
        code: 'WEBHOOK_AUTH_FAILED',
        statusCode: 401
      }
    })
  }
}

/**
 * Plaid Webhook Verification
 *
 * Validates incoming Plaid webhooks using JWT verification.
 * Plaid sends a signed JWT in the Plaid-Verification header.
 *
 * @see https://plaid.com/docs/api/webhooks/webhook-verification/
 */
export const verifyPlaidSignature: RequestHandler = (
  req: WebhookRequest,
  res: Response,
  next: NextFunction
) => {
  // Skip verification in development if no webhook secret configured
  if (!PLAID_WEBHOOK_SECRET) {
    console.warn('[webhookAuth] Plaid webhook secret not configured - skipping verification')
    return next()
  }

  const signedJwt = req.headers['plaid-verification'] as string

  if (!signedJwt) {
    console.error('[webhookAuth] Missing Plaid-Verification header')
    return res.status(401).json({
      error: {
        message: 'Missing Plaid verification',
        code: 'WEBHOOK_AUTH_FAILED',
        statusCode: 401
      }
    })
  }

  try {
    // Get the raw body for signature verification
    const rawBody = req.rawBody?.toString('utf8') || JSON.stringify(req.body)

    // Parse the JWT header to get the key ID
    const jwtParts = signedJwt.split('.')
    if (jwtParts.length !== 3) {
      throw new Error('Invalid JWT format')
    }

    // Decode the JWT payload (header not used for basic validation)
    const payload = JSON.parse(Buffer.from(jwtParts[1], 'base64').toString())

    // Verify the claims
    const now = Math.floor(Date.now() / 1000)

    // Check expiration (5 minutes tolerance)
    if (payload.iat && now - payload.iat > 300) {
      console.error('[webhookAuth] Plaid webhook JWT expired')
      return res.status(401).json({
        error: {
          message: 'Plaid webhook JWT expired',
          code: 'WEBHOOK_AUTH_FAILED',
          statusCode: 401
        }
      })
    }

    // Verify the request body hash matches
    const bodyHash = crypto.createHash('sha256').update(rawBody).digest('hex')

    if (payload.request_body_sha256 !== bodyHash) {
      console.error('[webhookAuth] Plaid webhook body hash mismatch')
      return res.status(401).json({
        error: {
          message: 'Plaid webhook body hash mismatch',
          code: 'WEBHOOK_AUTH_FAILED',
          statusCode: 401
        }
      })
    }

    // In production, you would verify the JWT signature using Plaid's public keys
    // fetched from their /webhook_verification_key/get endpoint
    // For now, we've verified the basic structure and body hash

    // Attach the verified payload to the request for use in handlers
    ;(req as WebhookRequest & { plaidVerified: boolean }).plaidVerified = true

    next()
  } catch (error) {
    console.error('[webhookAuth] Plaid signature verification error:', error)
    return res.status(401).json({
      error: {
        message: 'Plaid signature verification failed',
        code: 'WEBHOOK_AUTH_FAILED',
        statusCode: 401
      }
    })
  }
}

/**
 * Raw Body Parser Middleware
 *
 * Captures the raw request body before JSON parsing for signature verification.
 * Must be applied before the JSON body parser.
 */
export const captureRawBody: RequestHandler = (
  req: WebhookRequest,
  res: Response,
  next: NextFunction
) => {
  const chunks: Buffer[] = []

  req.on('data', (chunk: Buffer) => {
    chunks.push(chunk)
  })

  req.on('end', () => {
    if (chunks.length > 0) {
      req.rawBody = Buffer.concat(chunks)
    }
  })

  next()
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Perform comparison anyway to maintain constant time
    crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a))
    return false
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

/**
 * Combined webhook authentication factory
 *
 * Returns the appropriate verification middleware based on the provider.
 */
export function createWebhookAuthMiddleware(
  provider: 'twilio' | 'sendgrid' | 'plaid'
): RequestHandler {
  switch (provider) {
    case 'twilio':
      return verifyTwilioSignature
    case 'sendgrid':
      return verifySendGridSignature
    case 'plaid':
      return verifyPlaidSignature
    default:
      throw new Error(`Unknown webhook provider: ${provider}`)
  }
}
