import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8')

test('subscription management is mounted once and bypasses the inbound raw parser', () => {
  const source = read('server/index.ts')
  assert.match(source, /if \(req\.path === '\/subscriptions'/)
  assert.match(
    source,
    /this\.app\.use\(\s*'\/api\/webhooks',\s*authMiddleware[\s\S]*webhookSubscriptionsRouter/
  )
  assert.doesNotMatch(
    source,
    /'\/api\/webhooks\/subscriptions',[\s\S]{0,120}webhookSubscriptionsRouter/
  )
})

test('subscriber signing secret is persisted exactly as returned', () => {
  const source = read('server/services/OutboundWebhookService.ts')
  const method = source.slice(
    source.indexOf('async createSubscription'),
    source.indexOf('/** Delete')
  )
  assert.match(method, /\[orgId, url, secret, events\]/)
  assert.doesNotMatch(method, /createHash/)
})

test('edge jobs stay tenant-scoped and internal job types cannot be submitted', () => {
  const source = read('cloudflare/workers/api/src/routes/jobs.ts')
  assert.match(source, /conditions\.push\('org_id = \?'\)/)
  assert.match(source, /WHERE id = \? AND org_id = \?/)
  assert.doesNotMatch(source, /OR \? = 'admin'/)
  assert.match(source, /INTERNAL_JOB_TYPES = new Set\(\['webhook_delivery', 'crm_push'\]\)/)
  assert.match(source, /INTERNAL_JOB_TYPES\.has\(jobType\)/)
})

test('scheduled webhook delivery binds the delivery to the queued organization', () => {
  const scheduled = read('cloudflare/workers/api/src/scheduled.ts')
  const webhooks = read('cloudflare/workers/api/src/webhooks.ts')
  assert.match(scheduled, /sendWebhookDelivery\(env, deliveryId, orgId\)/)
  assert.match(webhooks, /AND \(\? IS NULL OR org_id = \?\)/)
  assert.match(webhooks, /status IN \('pending', 'delivering'\)/)
})
