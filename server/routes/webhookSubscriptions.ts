/**
 * Webhook Subscriptions API
 *
 * Outbound webhook management endpoints (distinct from the inbound webhook
 * handlers in routes/webhooks.ts). All routes are tenant-scoped via req.user.orgId.
 *
 * Routes:
 *   GET    /api/webhooks/subscriptions          — list subscriptions
 *   POST   /api/webhooks/subscriptions          — create subscription
 *   DELETE /api/webhooks/subscriptions/:id      — delete subscription
 *   POST   /api/webhooks/subscriptions/:id/test — send a test event
 */

import { Router } from 'express'
import { z } from 'zod'
import crypto from 'crypto'
import { validateRequest } from '../middleware/validateRequest'
import { asyncHandler } from '../middleware/errorHandler'
import { NotFoundError } from '../errors'
import {
  OutboundWebhookService,
  buildWebhookPayload,
  deriveSigningSecret
} from '../services/OutboundWebhookService'
import { getWebhookDeliveryQueue } from '../queue/workers/webhookDeliveryWorker'
import { database } from '../database/connection'
import type { AuthenticatedRequest } from '../middleware/authMiddleware'

const router = Router()

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createSubscriptionSchema = z.object({
  url: z.string().url().startsWith('https://', 'Webhook URL must use https'),
  events: z.array(z.string().min(1)).min(1, 'At least one event is required')
})

const subscriptionIdParamSchema = z.object({
  id: z.string().uuid()
})

// ---------------------------------------------------------------------------
// GET /api/webhooks/subscriptions — list org subscriptions
// ---------------------------------------------------------------------------
router.get(
  '/subscriptions',
  asyncHandler(async (req, res) => {
    const orgId = (req as AuthenticatedRequest).user?.orgId
    if (!orgId) return res.status(403).json({ error: 'Org context required' })

    const service = new OutboundWebhookService(database)
    const subscriptions = await service.listSubscriptions(orgId)

    // Mask the secret — only expose a hint (last 4 hex chars of hash).
    const masked = subscriptions.map(({ secret, ...sub }) => ({
      ...sub,
      secret_hint: `sha256:…${secret.slice(-4)}`
    }))

    res.json({ subscriptions: masked, count: masked.length })
  })
)

// ---------------------------------------------------------------------------
// POST /api/webhooks/subscriptions — create subscription
// ---------------------------------------------------------------------------
router.post(
  '/subscriptions',
  validateRequest({ body: createSubscriptionSchema }),
  asyncHandler(async (req, res) => {
    const orgId = (req as AuthenticatedRequest).user?.orgId
    if (!orgId) return res.status(403).json({ error: 'Org context required' })

    const { url, events } = req.body as z.infer<typeof createSubscriptionSchema>

    // Generate a random seed; only its derived signing key is returned/stored.
    const rawSecret = crypto.randomBytes(32).toString('hex')

    const service = new OutboundWebhookService(database)
    const id = await service.createSubscription(orgId, url, events, rawSecret)
    const signingSecret = deriveSigningSecret(rawSecret)

    res.status(201).json({
      id,
      url,
      events,
      // The signing key is only surfaced on creation — store it safely.
      secret: signingSecret,
      message: 'Store the secret securely — it will not be shown again.'
    })
  })
)

// ---------------------------------------------------------------------------
// DELETE /api/webhooks/subscriptions/:id — delete subscription
// ---------------------------------------------------------------------------
router.delete(
  '/subscriptions/:id',
  validateRequest({ params: subscriptionIdParamSchema }),
  asyncHandler(async (req, res) => {
    const orgId = (req as AuthenticatedRequest).user?.orgId
    if (!orgId) return res.status(403).json({ error: 'Org context required' })

    const subscriptionId = req.params.id as string
    const service = new OutboundWebhookService(database)
    const deleted = await service.deleteSubscription(orgId, subscriptionId)

    if (!deleted) {
      throw new NotFoundError('WebhookSubscription', subscriptionId)
    }

    res.json({ deleted: true, id: subscriptionId })
  })
)

// ---------------------------------------------------------------------------
// POST /api/webhooks/subscriptions/:id/test — send a test event
// ---------------------------------------------------------------------------
router.post(
  '/subscriptions/:id/test',
  validateRequest({ params: subscriptionIdParamSchema }),
  asyncHandler(async (req, res) => {
    const orgId = (req as AuthenticatedRequest).user?.orgId
    if (!orgId) return res.status(403).json({ error: 'Org context required' })

    const subscriptionId = req.params.id as string
    const service = new OutboundWebhookService(database)
    const sub = await service.getSubscription(orgId, subscriptionId)

    if (!sub) {
      throw new NotFoundError('WebhookSubscription', subscriptionId)
    }

    // Persist a test delivery record and enqueue.
    const testPayload = buildWebhookPayload('webhook.test', {
      message: 'This is a test event from UCC-MCA Intelligence.',
      subscription_id: sub.id
    })

    const [deliveryRow] = await database.query<{ id: string }>(
      `INSERT INTO webhook_deliveries
         (subscription_id, event, payload, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id`,
      [sub.id, 'webhook.test', JSON.stringify(testPayload)]
    )

    if (deliveryRow) {
      await getWebhookDeliveryQueue().add(
        'deliver',
        { orgId, deliveryId: deliveryRow.id, event: 'webhook.test', attemptsMade: 0 },
        { delay: 0 }
      )
    }

    res.json({ queued: true, event: 'webhook.test', payload_id: testPayload.id })
  })
)

export default router
