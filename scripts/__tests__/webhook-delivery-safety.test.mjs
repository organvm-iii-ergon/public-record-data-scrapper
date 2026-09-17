import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

import {
  drainWebhookDeliveries,
  readBoundedResponseBody,
  replayWebhookDelivery
} from '../../cloudflare/workers/api/src/webhooks.ts'
import { normalizeSubscriptionTier } from '../../cloudflare/workers/api/src/tier.ts'
import {
  isSecureWebhookUrl,
  publicCrmIntegration,
  publicWebhookEndpoint
} from '../../cloudflare/workers/api/src/integrationSafety.ts'

function createEnv({ firstResult = null, allResults = [], runChanges = 1 } = {}) {
  const calls = []
  const DB = {
    prepare(sql) {
      const call = { sql, params: [], operation: null }
      calls.push(call)
      return {
        bind(...params) {
          call.params = params
          return {
            async all() {
              call.operation = 'all'
              return { results: allResults }
            },
            async first() {
              call.operation = 'first'
              return firstResult
            },
            async run() {
              call.operation = 'run'
              return { success: true, meta: { changes: runChanges } }
            }
          }
        }
      }
    }
  }

  return { env: { DB }, calls }
}

test('bounded response reader cancels after the byte limit', async () => {
  let cancelled = false
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(600).fill(97))
      controller.enqueue(new Uint8Array(600).fill(98))
    },
    cancel() {
      cancelled = true
    }
  })

  const body = await readBoundedResponseBody(new Response(stream), 1000)

  assert.equal(new TextEncoder().encode(body).byteLength, 1000)
  assert.equal(body.slice(0, 600), 'a'.repeat(600))
  assert.equal(body.slice(600), 'b'.repeat(400))
  assert.equal(cancelled, true)
})

test('edge auth normalizes canonical billing tiers and fails unknown values closed', () => {
  assert.equal(normalizeSubscriptionTier('professional'), 'pro')
  assert.equal(normalizeSubscriptionTier('scale'), 'enterprise')
  assert.equal(normalizeSubscriptionTier(' growth '), 'growth')
  assert.equal(normalizeSubscriptionTier('unexpected'), 'free')
  assert.equal(normalizeSubscriptionTier(null), 'free')
})

test('pending drain excludes paused endpoints and normalizes ISO retry timestamps', async () => {
  const { env, calls } = createEnv()

  assert.equal(await drainWebhookDeliveries(env, 17), 0)
  assert.equal(calls.length, 1)
  assert.match(calls[0].sql, /INNER JOIN webhook_endpoints e/)
  assert.match(calls[0].sql, /e\.status = 'active'/)
  assert.match(calls[0].sql, /datetime\(d\.next_retry_at\) <= datetime\('now'\)/)
  assert.deepEqual(calls[0].params, [17])
})

test('pending drain atomically claims a delivery before sending it', async () => {
  const { env, calls } = createEnv({ allResults: [{ id: 'delivery-1' }], runChanges: 0 })

  assert.equal(await drainWebhookDeliveries(env, 1), 0)
  assert.equal(calls.length, 2)
  assert.equal(calls[1].operation, 'run')
  assert.match(calls[1].sql, /SET status = 'delivering'/)
  assert.match(calls[1].sql, /AND status = 'pending'/)
  assert.match(calls[1].sql, /e\.status = 'active'/)
  assert.deepEqual(calls[1].params, ['delivery-1'])
})

test('manual replay selects only failed or dead-letter deliveries', async () => {
  const { env, calls } = createEnv({ firstResult: null })

  assert.equal(await replayWebhookDelivery(env, 'org-1', 'delivery-1'), false)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].operation, 'first')
  assert.match(calls[0].sql, /status IN \('failed', 'dead_letter'\)/)
  assert.deepEqual(calls[0].params, ['delivery-1', 'org-1'])
})

test('public integration serializers omit signing secrets and provider API keys', () => {
  const endpoint = publicWebhookEndpoint({
    id: 'endpoint-1',
    secret: 'whsec_super-secret-value',
    events: '["prospect.created"]'
  })
  assert.equal('secret' in endpoint, false)
  assert.equal(endpoint.secret_preview, 'whsec_••••alue')
  assert.deepEqual(endpoint.events, ['prospect.created'])

  const integration = publicCrmIntegration({
    id: 'crm-1',
    api_key: 'provider-secret-value',
    config: '{"region":"us"}'
  })
  assert.equal('api_key' in integration, false)
  assert.equal(integration.api_key_preview, 'prov••••alue')
  assert.deepEqual(integration.config, { region: 'us' })
})

test('webhook destinations require a valid HTTPS URL', () => {
  assert.equal(isSecureWebhookUrl('https://hooks.example.test/events'), true)
  assert.equal(isSecureWebhookUrl('http://hooks.example.test/events'), false)
  assert.equal(isSecureWebhookUrl('ftp://hooks.example.test/events'), false)
  assert.equal(isSecureWebhookUrl('not a URL'), false)
})

test('edge API key management requires the admin role guard', () => {
  const source = readFileSync(
    new URL('../../cloudflare/workers/api/src/routes/keys.ts', import.meta.url),
    'utf8'
  )
  assert.match(source, /keysRoute\.use\('\*', requireRole\('admin'\)\)/)
  assert.match(source, /Number\.isFinite\(parsedExpiry\.getTime\(\)\)/)
})

test('edge job APIs preserve tenant boundaries and reserve internal producers', () => {
  const source = readFileSync(
    new URL('../../cloudflare/workers/api/src/routes/jobs.ts', import.meta.url),
    'utf8'
  )
  assert.match(source, /const conditions: string\[\] = \['org_id = \?'\]/)
  assert.match(source, /WHERE id = \? AND org_id = \?/)
  assert.match(source, /INTERNAL_JOB_TYPES\.has\(jobType\)/)
})

test('job drain uses recoverable leases and tenant-scoped webhook lookup', () => {
  const source = readFileSync(
    new URL('../../cloudflare/workers/api/src/scheduled.ts', import.meta.url),
    'utf8'
  )
  assert.match(source, /status = 'processing'[\s\S]*claimed_at IS NOT NULL/)
  assert.match(source, /claimed_at = datetime\('now'\)/)
  assert.match(source, /sendWebhookDelivery\(env, deliveryId, orgId\)/)

  const webhookSource = readFileSync(
    new URL('../../cloudflare/workers/api/src/webhooks.ts', import.meta.url),
    'utf8'
  )
  assert.match(webhookSource, /\(\? IS NULL OR org_id = \?\)/)
  assert.match(webhookSource, /status IN \('pending', 'delivering'\)/)
})

test('subscription management avoids raw JSON parsing and duplicate prefixes', () => {
  const source = readFileSync(new URL('../../server/index.ts', import.meta.url), 'utf8')
  assert.match(source, /req\.path === '\/subscriptions'/)
  assert.match(
    source,
    /this\.app\.use\(\s*'\/api\/webhooks',\s*authMiddleware,[\s\S]*webhookSubscriptionsRouter/
  )
})
