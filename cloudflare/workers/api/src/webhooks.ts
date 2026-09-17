/**
 * ucc-mca-edge Webhook Dispatcher & Delivery Lifecycle (Issue #485).
 *
 * Implements:
 * - Standard event envelope (id, event, created_at, api_version, data).
 * - HMAC-SHA256 signature verification and generation via Web Crypto API.
 * - Header scheme: `X-UCC-Signature: t={timestamp},v1={hex_hmac}`.
 * - Exponential backoff retry scheduling with jitter.
 * - Dead-Letter Queue (DLQ) state transitions and circuit-breaker auto-pause.
 * - Org-isolated query discipline.
 */

import { all, first, run } from './db'
import type { Env, WebhookDeliveryRow, WebhookEndpointRow, WebhookPayload } from './types'

export const API_VERSION = '2026-09-01'
export const MAX_RETRY_ATTEMPTS = 5
export const CIRCUIT_BREAKER_THRESHOLD = 10
export const SIGNATURE_TOLERANCE_SECONDS = 300 // 5 minutes
export const MAX_RESPONSE_BODY_BYTES = 1000

/**
 * Read at most `maxBytes` from a webhook response and cancel the remainder.
 * Webhook destinations are tenant-controlled, so buffering `response.text()`
 * before truncation would allow an unbounded response to exhaust the isolate.
 */
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
      if (!value || value.byteLength === 0) continue

      const remaining = maxBytes - totalBytes
      const bounded = value.byteLength > remaining ? value.subarray(0, remaining) : value
      chunks.push(bounded)
      totalBytes += bounded.byteLength

      if (value.byteLength > remaining || totalBytes === maxBytes) {
        try {
          await reader.cancel('webhook response body limit reached')
        } catch {
          // Cancellation is best-effort; the bounded bytes are already isolated.
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
 * Generate a standard webhook payload envelope.
 */
export function createWebhookPayload<T = unknown>(
  event: string,
  data: T,
  id = `evt_${crypto.randomUUID()}`
): WebhookPayload<T> {
  return {
    id,
    event,
    created_at: new Date().toISOString(),
    api_version: API_VERSION,
    data
  }
}

/**
 * Sign a payload string with HMAC-SHA256 using Web Crypto API.
 * Format: `t=${timestamp},v1=${signature}`.
 */
export async function signWebhookPayload(
  payloadString: string,
  secret: string,
  timestamp = Math.floor(Date.now() / 1000)
): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signedPayload = `${timestamp}.${payloadString}`
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload))

  const signatureHex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return `t=${timestamp},v1=${signatureHex}`
}

/**
 * Verify an incoming HMAC-SHA256 signature against a payload and secret.
 * Replay protection: fails if timestamp exceeds toleranceSeconds.
 */
export async function verifyWebhookSignature(
  payloadString: string,
  header: string,
  secret: string,
  toleranceSeconds = SIGNATURE_TOLERANCE_SECONDS
): Promise<boolean> {
  if (!header || !secret) return false

  const parts = header.split(',')
  const timestampPart = parts.find((p) => p.startsWith('t='))
  const signaturePart = parts.find((p) => p.startsWith('v1='))

  if (!timestampPart || !signaturePart) return false

  const timestamp = Number.parseInt(timestampPart.slice(2), 10)
  const receivedSig = signaturePart.slice(3)

  if (!Number.isFinite(timestamp) || !receivedSig) return false

  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - timestamp) > toleranceSeconds) {
    return false // Replay window exceeded
  }

  const expectedHeader = await signWebhookPayload(payloadString, secret, timestamp)
  const expectedSig = expectedHeader.split(',')[1]?.slice(3)

  if (!expectedSig || expectedSig.length !== receivedSig.length) return false

  // Constant-time string comparison
  let mismatch = 0
  for (let i = 0; i < expectedSig.length; i++) {
    mismatch |= expectedSig.charCodeAt(i) ^ receivedSig.charCodeAt(i)
  }
  return mismatch === 0
}

/**
 * Calculate next retry timestamp with exponential backoff and jitter.
 * Schedule:
 * - Attempt 1 -> ~1 min
 * - Attempt 2 -> ~5 min
 * - Attempt 3 -> ~30 min
 * - Attempt 4 -> ~2 hours
 */
export function calculateNextRetry(attempt: number): string {
  const delaysSeconds = [60, 300, 1800, 7200]
  const baseDelay = delaysSeconds[Math.min(attempt - 1, delaysSeconds.length - 1)] ?? 7200
  const jitter = Math.floor(Math.random() * 15) // 0-15s jitter
  const nextRetryMs = Date.now() + (baseDelay + jitter) * 1000
  return new Date(nextRetryMs).toISOString()
}

/**
 * Execute delivery of a single webhook.
 * Handles timeouts, response status checking, retry backoff scheduling,
 * and DLQ transitions.
 */
export async function sendWebhookDelivery(
  env: Env,
  deliveryId: string
): Promise<{ success: boolean; status?: number; error?: string }> {
  const delivery = await first<WebhookDeliveryRow>(
    env,
    `SELECT * FROM webhook_deliveries WHERE id = ?`,
    deliveryId
  )
  if (!delivery) {
    return { success: false, error: `Delivery ${deliveryId} not found` }
  }

  const endpoint = await first<WebhookEndpointRow>(
    env,
    `SELECT * FROM webhook_endpoints WHERE id = ? AND org_id = ?`,
    delivery.webhook_id,
    delivery.org_id
  )
  if (!endpoint) {
    return {
      success: false,
      error: `Endpoint ${delivery.webhook_id} not found`
    }
  }

  if (endpoint.status !== 'active') {
    return {
      success: false,
      error: `Endpoint ${endpoint.id} is ${endpoint.status}`
    }
  }

  const currentAttempt = delivery.attempts + 1
  const signatureHeader = await signWebhookPayload(delivery.payload, endpoint.secret)

  let resStatus: number | null = null
  let resBody = ''
  let errorMsg: string | null = null
  let isSuccess = false

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'UCC-MCA-Webhook/1.0',
        'X-UCC-Delivery-ID': delivery.id,
        'X-UCC-Event': delivery.event,
        'X-UCC-Signature': signatureHeader
      },
      body: delivery.payload,
      signal: controller.signal
    })

    clearTimeout(timeout)
    resStatus = res.status
    resBody = await readBoundedResponseBody(res)
    isSuccess = res.ok
    if (!res.ok) {
      errorMsg = `HTTP ${res.status}: ${resBody.slice(0, 200)}`
    }
  } catch (err: unknown) {
    errorMsg = err instanceof Error ? err.message : String(err)
  }

  if (isSuccess) {
    await run(
      env,
      `UPDATE webhook_deliveries
          SET status = 'delivered',
              attempts = ?,
              response_status = ?,
              response_body = ?,
              delivered_at = datetime('now'),
              error_message = NULL,
              next_retry_at = NULL
        WHERE id = ?`,
      currentAttempt,
      resStatus,
      resBody,
      delivery.id
    )

    // Reset endpoint consecutive failures
    await run(
      env,
      `UPDATE webhook_endpoints
          SET consecutive_failures = 0,
              updated_at = datetime('now')
        WHERE id = ?`,
      endpoint.id
    )

    return { success: true, status: resStatus ?? 200 }
  }

  // Handle Failure & DLQ
  const isDeadLetter = currentAttempt >= delivery.max_attempts
  const nextStatus = isDeadLetter ? 'dead_letter' : 'pending'
  const nextRetryAt = isDeadLetter ? null : calculateNextRetry(currentAttempt)

  await run(
    env,
    `UPDATE webhook_deliveries
        SET status = ?,
            attempts = ?,
            response_status = ?,
            response_body = ?,
            error_message = ?,
            next_retry_at = ?
      WHERE id = ?`,
    nextStatus,
    currentAttempt,
    resStatus,
    resBody,
    errorMsg,
    nextRetryAt,
    delivery.id
  )

  // Increment failure count on endpoint
  const newConsecutiveFailures = endpoint.consecutive_failures + 1
  const shouldCircuitBreak = newConsecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD
  const nextEndpointStatus = shouldCircuitBreak ? 'paused' : endpoint.status

  await run(
    env,
    `UPDATE webhook_endpoints
        SET consecutive_failures = ?,
            status = ?,
            updated_at = datetime('now')
      WHERE id = ?`,
    newConsecutiveFailures,
    nextEndpointStatus,
    endpoint.id
  )

  return {
    success: false,
    status: resStatus ?? undefined,
    error: errorMsg ?? undefined
  }
}

/**
 * Trigger an event for an organization, matching subscribed endpoints and
 * scheduling deliveries.
 */
export async function triggerWebhookEvent<T = unknown>(
  env: Env,
  orgId: string,
  event: string,
  data: T
): Promise<string[]> {
  const endpoints = await all<WebhookEndpointRow>(
    env,
    `SELECT * FROM webhook_endpoints WHERE org_id = ? AND status = 'active'`,
    orgId
  )

  const deliveryIds: string[] = []
  const payloadObj = createWebhookPayload(event, data)
  const payloadString = JSON.stringify(payloadObj)

  for (const endpoint of endpoints) {
    let subscribed = false
    try {
      const parsedEvents = JSON.parse(endpoint.events) as string[]
      subscribed = parsedEvents.includes('*') || parsedEvents.includes(event)
    } catch {
      subscribed = endpoint.events === '*' || endpoint.events.includes(event)
    }

    if (!subscribed) continue

    const deliveryId = `del_${crypto.randomUUID()}`
    await run(
      env,
      `INSERT INTO webhook_deliveries (id, org_id, webhook_id, event, payload, status, attempts, max_attempts)
       VALUES (?, ?, ?, ?, ?, 'pending', 0, ?)`,
      deliveryId,
      orgId,
      endpoint.id,
      event,
      payloadString,
      MAX_RETRY_ATTEMPTS
    )

    deliveryIds.push(deliveryId)
  }

  return deliveryIds
}

/**
 * Drain pending webhook deliveries whose retry window is ready.
 */
export async function drainWebhookDeliveries(env: Env, limit = 25): Promise<number> {
  const deliveries = await all<WebhookDeliveryRow>(
    env,
    `SELECT d.id FROM webhook_deliveries d
      INNER JOIN webhook_endpoints e
        ON e.id = d.webhook_id AND e.org_id = d.org_id
      WHERE d.status = 'pending'
        AND e.status = 'active'
        AND (d.next_retry_at IS NULL OR datetime(d.next_retry_at) <= datetime('now'))
      ORDER BY d.created_at ASC
      LIMIT ?`,
    limit
  )

  let processed = 0
  for (const d of deliveries) {
    try {
      await sendWebhookDelivery(env, d.id)
      processed++
    } catch (err) {
      console.error(`[webhooks] failed processing delivery ${d.id}`, err)
    }
  }

  return processed
}

/**
 * Manual replay from Dead-Letter Queue (DLQ).
 * Resets attempts, clears error messages, and sets status back to pending.
 */
export async function replayWebhookDelivery(
  env: Env,
  orgId: string,
  deliveryId: string
): Promise<boolean> {
  const delivery = await first<WebhookDeliveryRow>(
    env,
    `SELECT * FROM webhook_deliveries
      WHERE id = ? AND org_id = ? AND status IN ('failed', 'dead_letter')`,
    deliveryId,
    orgId
  )

  if (!delivery) return false

  await run(
    env,
    `UPDATE webhook_deliveries
        SET status = 'pending',
            attempts = 0,
            error_message = NULL,
            next_retry_at = NULL
      WHERE id = ? AND org_id = ?`,
    deliveryId,
    orgId
  )

  // Trigger immediate dispatch
  await sendWebhookDelivery(env, deliveryId)
  return true
}
