/**
 * Webhook Delivery Worker
 *
 * BullMQ worker that processes `webhook-delivery` queue jobs. Each job
 * represents a single delivery attempt for a webhook_deliveries record.
 *
 * Retry lifecycle:
 *   - On failure BullMQ retries the same durable job with exponential backoff.
 *   - After MAX_DELIVERY_ATTEMPTS the delivery is marked dead in the DB and
 *     a failure notification is emitted (logged; email hook is a no-op stub
 *     unless a notification service is injected).
 */

import { Worker, Job, Queue } from 'bullmq'
import { redisConnection } from '../connection'
import { database } from '../../database/connection'
import {
  OutboundWebhookService,
  MAX_DELIVERY_ATTEMPTS
} from '../../services/OutboundWebhookService'

// ---------------------------------------------------------------------------
// Job data
// ---------------------------------------------------------------------------

export interface WebhookDeliveryJobData {
  /** webhook_deliveries.id */
  deliveryId: string
  /** Human-readable event name for logging. */
  event: string
  /** Number of attempts already made (0 on first try). */
  attemptsMade: number
}

export interface WebhookDeliveryJobResult {
  deliveryId: string
  success: boolean
  responseStatus?: number
  newStatus: 'delivered' | 'failed' | 'dead'
}

// ---------------------------------------------------------------------------
// Singleton queue handle (lazy-initialised)
// ---------------------------------------------------------------------------

let webhookDeliveryQueue: Queue<WebhookDeliveryJobData> | null = null

export function getWebhookDeliveryQueue(): Queue<WebhookDeliveryJobData> {
  if (!webhookDeliveryQueue) {
    const { client } = redisConnection.connect()
    webhookDeliveryQueue = new Queue<WebhookDeliveryJobData>('webhook-delivery', {
      connection: client,
      defaultJobOptions: {
        // BullMQ owns retry persistence. A failed attempt throws below, so a
        // worker exit or Redis interruption cannot strand a database row
        // between a committed failure and a separate enqueue operation.
        attempts: MAX_DELIVERY_ATTEMPTS,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: { count: 500, age: 7 * 24 * 60 * 60 },
        removeOnFail: { count: 500, age: 30 * 24 * 60 * 60 }
      }
    })
  }
  return webhookDeliveryQueue
}

// ---------------------------------------------------------------------------
// Core processor
// ---------------------------------------------------------------------------

/** Notify about a dead delivery. Replace with a real email/alert in prod. */
async function notifyDeadDelivery(deliveryId: string, event: string): Promise<void> {
  console.error(
    `[webhookDeliveryWorker] Delivery ${deliveryId} (event=${event}) promoted to dead-letter after ${MAX_DELIVERY_ATTEMPTS} attempts`
  )
  // TODO: wire up EmailService.sendSystemAlert() here for dead-letter emails.
}

export async function processWebhookDeliveryJob(
  jobData: WebhookDeliveryJobData
): Promise<WebhookDeliveryJobResult> {
  const service = new OutboundWebhookService(database)
  const { deliveryId, event, attemptsMade } = jobData

  const result = await service.deliver(deliveryId)

  if (result.success) {
    return {
      deliveryId,
      success: true,
      responseStatus: result.responseStatus,
      newStatus: 'delivered'
    }
  }

  // Delivery failed. Determine whether to re-queue or promote to dead.
  const nextAttempt = attemptsMade + 1 // attempts already made → next attempt number
  if (nextAttempt >= MAX_DELIVERY_ATTEMPTS) {
    // No more retries — record is already marked dead by OutboundWebhookService.deliver().
    await notifyDeadDelivery(deliveryId, event)
    return { deliveryId, success: false, responseStatus: result.responseStatus, newStatus: 'dead' }
  }

  return { deliveryId, success: false, responseStatus: result.responseStatus, newStatus: 'failed' }
}

// ---------------------------------------------------------------------------
// Worker factory
// ---------------------------------------------------------------------------

export function createWebhookDeliveryWorker() {
  const { client } = redisConnection.connect()

  const worker = new Worker<WebhookDeliveryJobData, WebhookDeliveryJobResult>(
    'webhook-delivery',
    async (job: Job<WebhookDeliveryJobData>) => {
      const result = await processWebhookDeliveryJob({
        ...job.data,
        attemptsMade: job.attemptsMade
      })
      if (result.newStatus === 'failed') {
        throw new Error(`Webhook delivery ${result.deliveryId} failed; BullMQ will retry`)
      }
      return result
    },
    {
      connection: client,
      concurrency: 10,
      limiter: {
        max: 100,
        duration: 60_000
      }
    }
  )

  worker.on('completed', (job, returnvalue) => {
    console.log(
      `[webhookDeliveryWorker] Job ${job.id} completed (status=${returnvalue.newStatus})`,
      { deliveryId: returnvalue.deliveryId }
    )
  })

  worker.on('failed', (job, err) => {
    console.error(`[webhookDeliveryWorker] Job ${job?.id} failed:`, err.message)
  })

  worker.on('error', (err) => {
    console.error('[webhookDeliveryWorker] Worker error:', err)
  })

  console.log('✓ Webhook delivery worker started')
  return worker
}
