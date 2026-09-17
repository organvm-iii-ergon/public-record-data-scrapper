/**
 * OutboundWebhookService
 *
 * Handles signing and delivery of standardized outbound webhook payloads to
 * tenant-registered subscriber endpoints. Implements HMAC-SHA256 envelope
 * signing (X-Webhook-Signature) and a five-attempt exponential backoff
 * schedule before promoting a delivery to the dead-letter state.
 */

import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Standard envelope for ALL outbound webhooks. */
export interface WebhookPayload {
  /** UUID v4 — idempotency / deduplication key for the recipient. */
  id: string
  /** Dot-namespaced event name, e.g. 'prospect.created'. */
  event: string
  /** ISO 8601 timestamp of when the event was generated. */
  created_at: string
  /** Payload schema version. Always 'v1' for this generation. */
  api_version: 'v1'
  /** Event-specific data object. */
  data: unknown
}

export type WebhookDeliveryStatus = 'pending' | 'delivered' | 'failed' | 'dead'

export interface DeliveryAttemptResult {
  success: boolean
  /** HTTP status code returned by the subscriber, if any. */
  responseStatus?: number
  /** First 1 KB of the response body, for logging. */
  responseBody?: string
  error?: string
}

export interface OutboundWebhookConfig {
  /** Target URL — must be https://. */
  url: string
  /** Raw HMAC secret (the raw bytes, before any hashing). */
  secret: string
  /** Request timeout in milliseconds. Defaults to 5000. */
  timeoutMs?: number
}

// ---------------------------------------------------------------------------
// Retry schedule
// Attempt 1: 30 s, Attempt 2: 5 min, Attempt 3: 30 min, Attempt 4: 2 hr,
// Attempt 5: promote to dead.
// ---------------------------------------------------------------------------

/** Maximum number of delivery attempts before a delivery goes dead. */
export const MAX_DELIVERY_ATTEMPTS = 5

/**
 * Return the delay in milliseconds before the next retry, given the attempt
 * number that just failed (1-indexed). Returns null when max retries are
 * exhausted (attempt 5 → dead).
 */
export function retryDelayMs(attemptNumber: number): number | null {
  switch (attemptNumber) {
    case 1:
      return 30_000 // 30 s
    case 2:
      return 5 * 60_000 // 5 min
    case 3:
      return 30 * 60_000 // 30 min
    case 4:
      return 2 * 60 * 60_000 // 2 hr
    default:
      return null // dead
  }
}

/**
 * Return the ISO 8601 timestamp at which the next retry should be attempted,
 * or null if the delivery should be promoted to dead-letter.
 */
export function nextRetryAt(attemptNumber: number, now = new Date()): string | null {
  const delayMs = retryDelayMs(attemptNumber)
  if (delayMs === null) return null
  return new Date(now.getTime() + delayMs).toISOString()
}

// ---------------------------------------------------------------------------
// Payload builder
// ---------------------------------------------------------------------------

/**
 * Construct a standard WebhookPayload envelope around the given event data.
 * The caller may pass a pre-generated id for idempotent retries.
 */
export function buildWebhookPayload(
  event: string,
  data: unknown,
  id: string = uuidv4()
): WebhookPayload {
  return {
    id,
    event,
    created_at: new Date().toISOString(),
    api_version: 'v1',
    data
  }
}

// ---------------------------------------------------------------------------
// HMAC-SHA256 signing
// ---------------------------------------------------------------------------

/**
 * Compute the HMAC-SHA256 signature of a raw JSON body using the given secret.
 * Returns the canonical header value: `sha256=<hex>`.
 */
export function signPayload(rawBody: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  return `sha256=${hmac}`
}

/** Derive the actual HMAC key disclosed once to a new subscriber. */
export function deriveSigningSecret(seed: string): string {
  return crypto.createHash('sha256').update(seed).digest('hex')
}

// ---------------------------------------------------------------------------
// URL safety guard (mirrors DeliveryService pattern)
// ---------------------------------------------------------------------------

function assertSafeUrl(rawUrl: string): URL {
  const url = new URL(rawUrl)
  const hostname = url.hostname.toLowerCase()

  if (url.protocol !== 'https:') {
    throw new Error('Outbound webhook URL must use https')
  }

  if (
    hostname === 'localhost' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname.endsWith('.local') ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^169\.254\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  ) {
    throw new Error('Outbound webhook URL must not target local or private hosts')
  }

  return url
}

// ---------------------------------------------------------------------------
// Core delivery
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 5_000
const MAX_RESPONSE_BODY_BYTES = 1024

/** Read only the response prefix retained in delivery logs. */
export async function readBoundedResponseBody(
  response: Response,
  maxBytes = MAX_RESPONSE_BODY_BYTES
): Promise<string> {
  if (!response.body || maxBytes <= 0) return ''

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  try {
    while (totalBytes < maxBytes) {
      const { value, done } = await reader.read()
      if (done) break
      if (!value?.byteLength) continue

      const remaining = maxBytes - totalBytes
      const chunk = value.byteLength > remaining ? value.subarray(0, remaining) : value
      chunks.push(chunk)
      totalBytes += chunk.byteLength

      if (value.byteLength > remaining || totalBytes === maxBytes) {
        try {
          await reader.cancel('webhook response body limit reached')
        } catch {
          // Cancellation is best-effort; retained bytes are already bounded.
        }
        break
      }
    }
  } finally {
    reader.releaseLock()
  }

  const body = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(body)
}

/**
 * Deliver a signed webhook payload to a subscriber endpoint.
 *
 * - Signs the raw JSON body with HMAC-SHA256 using the subscription secret.
 * - Adds `X-Webhook-Signature`, `X-Webhook-Id`, `X-Webhook-Timestamp` headers.
 * - Enforces a 5 s request timeout by default.
 * - Treats any non-2xx HTTP response as a failure.
 */
export async function deliverWebhook(
  payload: WebhookPayload,
  config: OutboundWebhookConfig
): Promise<DeliveryAttemptResult> {
  let url: URL
  try {
    url = assertSafeUrl(config.url)
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }

  const rawBody = JSON.stringify(payload)
  const signature = signPayload(rawBody, config.secret)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'POST',
      // Never forward signed tenant payloads or credentials to a redirect target.
      // The destination was validated above; any redirect must be rejected and
      // reconfigured explicitly by the subscriber.
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Id': payload.id,
        'X-Webhook-Timestamp': payload.created_at
      },
      body: rawBody,
      signal: controller.signal
    })

    // Read up to 1 KB of the response for logging.
    let responseBody: string | undefined
    try {
      responseBody = await readBoundedResponseBody(response)
    } catch {
      // Ignore body-read errors.
    }

    if (!response.ok) {
      return {
        success: false,
        responseStatus: response.status,
        responseBody,
        error: `HTTP ${response.status}`
      }
    }

    return {
      success: true,
      responseStatus: response.status,
      responseBody
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return { success: false, error }
  } finally {
    clearTimeout(timeout)
  }
}

// ---------------------------------------------------------------------------
// Service class (thin orchestration façade)
// ---------------------------------------------------------------------------

/** Minimal DB surface used for reading subscriptions and logging deliveries. */
export type WebhookDb = {
  query: <T>(sql: string, params?: unknown[]) => Promise<T[]>
}

export interface WebhookSubscriptionRow {
  id: string
  org_id: string
  url: string
  secret: string
  events: string[]
  enabled: boolean
}

export interface WebhookDeliveryRow {
  id: string
  subscription_id: string
  event: string
  payload: unknown
  status: WebhookDeliveryStatus
  attempt_count: number
  last_attempt_at: string | null
  next_retry_at: string | null
  response_status: number | null
  response_body: string | null
  created_at: string
}

export interface WebhookDeliveryJob {
  deliveryId: string
  event: string
  attemptsMade: number
}

type EnqueueWebhookDelivery = (job: WebhookDeliveryJob) => Promise<void>

async function enqueueWebhookDelivery(job: WebhookDeliveryJob): Promise<void> {
  // Keep the service independent from worker startup while using the production queue by default.
  const { getWebhookDeliveryQueue } = await import('../queue/workers/webhookDeliveryWorker')
  await getWebhookDeliveryQueue().add('deliver', job, { jobId: job.deliveryId })
}

/**
 * OutboundWebhookService orchestrates:
 * 1. Finding subscriptions for an event.
 * 2. Creating delivery records.
 * 3. Performing the HTTP delivery.
 * 4. Updating the delivery record with the outcome.
 */
export class OutboundWebhookService {
  constructor(
    private readonly db: WebhookDb,
    private readonly enqueueDelivery: EnqueueWebhookDelivery = enqueueWebhookDelivery
  ) {}

  /**
   * Fan out an event to all matching enabled subscriptions for an org.
   * Returns a delivery record ID for each subscription notified.
   */
  async dispatch(orgId: string, event: string, data: unknown): Promise<string[]> {
    // 1. Find enabled subscriptions that match the event.
    const subscriptions = await this.db.query<WebhookSubscriptionRow>(
      `SELECT id, org_id, url, secret, events, enabled
       FROM webhook_subscriptions
       WHERE org_id = $1
         AND enabled = true
         AND (events @> ARRAY[$2]::text[] OR events @> ARRAY['*']::text[])`,
      [orgId, event]
    )

    const deliveryIds: string[] = []

    for (const sub of subscriptions) {
      const payload = buildWebhookPayload(event, data)

      // 2. Insert a delivery record (status=pending).
      const [row] = await this.db.query<{ id: string }>(
        `INSERT INTO webhook_deliveries
           (subscription_id, event, payload, status)
         VALUES ($1, $2, $3, 'pending')
         RETURNING id`,
        [sub.id, event, JSON.stringify(payload)]
      )
      if (row) {
        await this.enqueueDelivery({ deliveryId: row.id, event, attemptsMade: 0 })
        deliveryIds.push(row.id)
      }
    }

    return deliveryIds
  }

  /**
   * Execute a single delivery attempt for the given delivery record.
   * Updates the record with the outcome (delivered / failed / dead).
   */
  async deliver(deliveryId: string): Promise<DeliveryAttemptResult> {
    // Fetch delivery + subscription in one join.
    const [row] = await this.db.query<{
      delivery_id: string
      attempt_count: number
      payload: WebhookPayload
      url: string
      secret: string
    }>(
      `SELECT d.id AS delivery_id,
              d.attempt_count,
              d.payload,
              s.url,
              s.secret
       FROM webhook_deliveries d
       JOIN webhook_subscriptions s ON s.id = d.subscription_id
       WHERE d.id = $1`,
      [deliveryId]
    )

    if (!row) {
      return { success: false, error: `Delivery record ${deliveryId} not found` }
    }

    const attemptNumber = row.attempt_count + 1
    const result = await deliverWebhook(row.payload, { url: row.url, secret: row.secret })
    const nextRetry = result.success ? null : nextRetryAt(attemptNumber)
    const newStatus: WebhookDeliveryStatus = result.success
      ? 'delivered'
      : nextRetry === null
        ? 'dead'
        : 'failed'

    await this.db.query(
      `UPDATE webhook_deliveries
       SET status = $1,
           attempt_count = $2,
           last_attempt_at = NOW(),
           next_retry_at = $3,
           response_status = $4,
           response_body = $5
       WHERE id = $6`,
      [
        newStatus,
        attemptNumber,
        nextRetry,
        result.responseStatus ?? null,
        result.responseBody ?? null,
        deliveryId
      ]
    )

    return result
  }

  /** List webhook subscriptions for an org. */
  async listSubscriptions(orgId: string): Promise<WebhookSubscriptionRow[]> {
    return this.db.query<WebhookSubscriptionRow>(
      `SELECT id, org_id, url, secret, events, enabled, created_at, updated_at
       FROM webhook_subscriptions
       WHERE org_id = $1
       ORDER BY created_at DESC`,
      [orgId]
    )
  }

  /** Create a new webhook subscription. Returns the new row id. */
  async createSubscription(
    orgId: string,
    url: string,
    events: string[],
    secret: string
  ): Promise<string> {
    const signingSecret = deriveSigningSecret(secret)
    const [row] = await this.db.query<{ id: string }>(
      `INSERT INTO webhook_subscriptions (org_id, url, secret, events)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [orgId, url, signingSecret, events]
    )
    if (!row) throw new Error('Failed to create webhook subscription')
    return row.id
  }

  /** Delete a webhook subscription (scoped to org for safety). */
  async deleteSubscription(orgId: string, subscriptionId: string): Promise<boolean> {
    const rows = await this.db.query<{ id: string }>(
      `DELETE FROM webhook_subscriptions
       WHERE id = $1 AND org_id = $2
       RETURNING id`,
      [subscriptionId, orgId]
    )
    return rows.length > 0
  }

  /** Get a single subscription (scoped to org). */
  async getSubscription(
    orgId: string,
    subscriptionId: string
  ): Promise<WebhookSubscriptionRow | null> {
    const [row] = await this.db.query<WebhookSubscriptionRow>(
      `SELECT id, org_id, url, secret, events, enabled, created_at, updated_at
       FROM webhook_subscriptions
       WHERE id = $1 AND org_id = $2`,
      [subscriptionId, orgId]
    )
    return row ?? null
  }
}
