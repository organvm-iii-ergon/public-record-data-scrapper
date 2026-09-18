import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

import {
  drainWebhookDeliveries,
  readBoundedResponseBody,
  replayWebhookDelivery,
  sendWebhookDelivery
} from '../../cloudflare/workers/api/src/webhooks.ts'
import { normalizeSubscriptionTier } from '../../cloudflare/workers/api/src/tier.ts'
import { HubSpotAdapter, pushProspectToCrm } from '../../cloudflare/workers/api/src/crm.ts'
import {
  decryptCredential,
  encryptCredential,
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
  assert.equal(calls.length, 2)
  assert.match(calls[0].sql, /status = 'delivering'/)
  assert.match(calls[0].sql, /claimed_at IS NOT NULL/)
  assert.deepEqual(calls[0].params, ['-300 seconds'])
  assert.match(calls[1].sql, /INNER JOIN webhook_endpoints e/)
  assert.match(calls[1].sql, /e\.status = 'active'/)
  assert.match(calls[1].sql, /datetime\(d\.next_retry_at\) <= datetime\('now'\)/)
  assert.deepEqual(calls[1].params, [17])
})

test('pending drain atomically claims a delivery before sending it', async () => {
  const { env, calls } = createEnv({ allResults: [{ id: 'delivery-1' }], runChanges: 0 })

  assert.equal(await drainWebhookDeliveries(env, 1), 0)
  assert.equal(calls.length, 3)
  assert.equal(calls[2].operation, 'run')
  assert.match(calls[2].sql, /SET status = 'delivering', claimed_at = datetime\('now'\)/)
  assert.match(calls[2].sql, /AND status = 'pending'/)
  assert.match(calls[2].sql, /e\.status = 'active'/)
  assert.deepEqual(calls[2].params, ['delivery-1'])
})

test('manual replay atomically claims only failed or dead-letter deliveries', async () => {
  const { env, calls } = createEnv({ runChanges: 0 })

  assert.equal(await replayWebhookDelivery(env, 'org-1', 'delivery-1'), false)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].operation, 'run')
  assert.match(calls[0].sql, /SET status = 'delivering'/)
  assert.match(calls[0].sql, /status IN \('failed', 'dead_letter'\)/)
  assert.deepEqual(calls[0].params, ['delivery-1', 'org-1'])
})

test('test webhook delivery is claimed before the direct send', () => {
  const source = readFileSync(
    new URL('../../cloudflare/workers/api/src/index.ts', import.meta.url),
    'utf8'
  )
  const route = source.slice(
    source.indexOf("app.post('/api/webhooks/:id/test'"),
    source.indexOf("app.get('/api/webhooks/deliveries/:id'")
  )

  assert.match(route, /SET status = 'delivering', claimed_at = datetime\('now'\)/)
  assert.match(route, /WHERE id = \? AND org_id = \? AND status = 'pending'/)
  assert.match(route, /claimResult\.meta\.changes === 0/)
  assert.match(route, /sendWebhookDelivery\(c\.env, deliveryId, orgId\)/)
  assert.match(route, /SET status = 'pending', claimed_at = NULL/)
  assert.match(route, /WHERE id = \? AND org_id = \? AND status = 'delivering'/)
  assert.ok(route.indexOf("SET status = 'delivering'") < route.indexOf('sendWebhookDelivery('))

  const dialog = readFileSync(
    new URL('../../apps/web/src/components/IntegrationsDialog.tsx', import.meta.url),
    'utf8'
  )
  assert.match(dialog, /result\.status === 'processing'/)
  assert.match(dialog, /Test ping is processing/)
})

test('webhook delivery refuses redirects and increments failure state atomically', async () => {
  const delivery = {
    id: 'delivery-1',
    org_id: 'org-1',
    webhook_id: 'endpoint-1',
    event: 'test.ping',
    payload: '{}',
    status: 'pending',
    attempts: 0,
    max_attempts: 5,
    next_retry_at: null
  }
  const endpoint = {
    id: 'endpoint-1',
    org_id: 'org-1',
    url: 'https://hooks.example.test/events',
    secret: 'whsec_test',
    events: '["*"]',
    status: 'active',
    consecutive_failures: 9
  }
  const calls = []
  const DB = {
    prepare(sql) {
      const call = { sql, params: [] }
      calls.push(call)
      return {
        bind(...params) {
          call.params = params
          return {
            async first() {
              return calls.filter((item) => item.sql.startsWith('SELECT')).length === 1
                ? delivery
                : endpoint
            },
            async run() {
              return { success: true, meta: { changes: 1 } }
            }
          }
        }
      }
    }
  }
  const originalFetch = globalThis.fetch
  let redirect
  globalThis.fetch = async (_url, init) => {
    redirect = init.redirect
    return new Response('', { status: 302, headers: { location: 'http://127.0.0.1/' } })
  }
  try {
    const result = await sendWebhookDelivery({ DB }, 'delivery-1', 'org-1')
    assert.equal(result.success, false)
    assert.equal(redirect, 'manual')
    const endpointUpdate = calls.find((call) =>
      call.sql.includes('consecutive_failures = consecutive_failures + 1')
    )
    assert.ok(endpointUpdate)
    assert.match(endpointUpdate.sql, /consecutive_failures \+ 1 >= \?/)
    assert.deepEqual(endpointUpdate.params, [10, 'endpoint-1', 'org-1'])
  } finally {
    globalThis.fetch = originalFetch
  }
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
  assert.equal(integration.api_key_preview, 'credential unavailable')
  assert.deepEqual(integration.config, { region: 'us' })
})

test('CRM credentials round-trip only through an encrypted envelope', async () => {
  const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
  const encrypted = await encryptCredential('provider-secret', key)
  assert.match(encrypted, /^enc:v1:/)
  assert.equal(encrypted.includes('provider-secret'), false)
  assert.equal(await decryptCredential(encrypted, key), 'provider-secret')
  await assert.rejects(decryptCredential('provider-secret', key), /reconnect/)
})

test('HubSpot pushes include the advertised UCC qualification fields', async () => {
  const originalFetch = globalThis.fetch
  let properties
  globalThis.fetch = async (_url, init) => {
    properties = JSON.parse(init.body).properties
    return new Response(JSON.stringify({ id: 'company-1' }), { status: 200 })
  }
  try {
    const result = await new HubSpotAdapter().pushProspect('provider-secret', {
      id: 'prospect-1',
      company_name: 'Acme',
      priority_score: 88,
      status: 'qualified'
    })

    assert.equal(result.success, true)
    assert.equal(properties.ucc_priority_score, '88')
    assert.equal(properties.ucc_status, 'qualified')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('HubSpot setup provisions qualification properties before activating', async () => {
  const originalFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    if (String(url).endsWith('?limit=1')) return new Response('{}', { status: 200 })
    if (init.method === 'GET') return new Response('{}', { status: 404 })
    return new Response('{}', { status: 201 })
  }
  try {
    const config = {}
    assert.equal(await new HubSpotAdapter().verifyCredentials('provider-secret', config), true)
    assert.equal(config.uccPropertiesProvisioned, true)
    assert.equal(calls.filter((call) => call.init.method === 'POST').length, 2)
    assert.ok(calls.some((call) => call.url.endsWith('/ucc_priority_score')))
    assert.ok(calls.some((call) => call.url.endsWith('/ucc_status')))
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('HubSpot omits unprovisioned qualification properties for existing integrations', async () => {
  const originalFetch = globalThis.fetch
  let properties
  globalThis.fetch = async (_url, init) => {
    properties = JSON.parse(init.body).properties
    return new Response(JSON.stringify({ id: 'company-1' }), { status: 200 })
  }
  try {
    const result = await new HubSpotAdapter().pushProspect(
      'provider-secret',
      { id: 'prospect-1', company_name: 'Acme', priority_score: 88, status: 'qualified' },
      {}
    )
    assert.equal(result.success, true)
    assert.equal('ucc_priority_score' in properties, false)
    assert.equal('ucc_status' in properties, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('CRM pushes claim one idempotency key before the remote create', async () => {
  const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
  const encrypted = await encryptCredential('provider-secret', key)
  let log = null
  let remoteCalls = 0
  const DB = {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async first() {
              if (sql.includes('FROM crm_integrations')) {
                return {
                  id: 'crm-1',
                  org_id: 'org-1',
                  provider: 'hubspot',
                  status: 'active',
                  api_key: encrypted,
                  config: null
                }
              }
              if (sql.includes('FROM prospects')) {
                return {
                  id: 'prospect-1',
                  company_name: 'Acme',
                  priority_score: 90,
                  status: 'new',
                  raw_data: null
                }
              }
              if (sql.includes('FROM crm_push_logs')) return log
              return null
            },
            async run() {
              if (sql.includes('INSERT OR IGNORE INTO crm_push_logs')) {
                if (log) return { meta: { changes: 0 } }
                log = { status: 'pending', external_id: null }
                return { meta: { changes: 1 } }
              }
              if (sql.includes('UPDATE crm_push_logs')) {
                log = { status: params[1], external_id: params[0] }
              }
              return { meta: { changes: 1 } }
            }
          }
        }
      }
    }
  }
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    remoteCalls += 1
    return new Response(JSON.stringify({ id: 'company-1' }), { status: 200 })
  }
  try {
    const env = { DB, CRM_CREDENTIAL_ENCRYPTION_KEY: key }
    assert.equal((await pushProspectToCrm(env, 'org-1', 'prospect-1')).success, true)
    assert.equal((await pushProspectToCrm(env, 'org-1', 'prospect-1')).success, true)
    assert.equal(remoteCalls, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('webhook destinations require public DNS and a valid HTTPS URL', async () => {
  const publicResolver = async (_url, init) => {
    const type = String(_url).includes('type=A') && !String(_url).includes('type=AAAA') ? 1 : 28
    return new Response(
      JSON.stringify({ Answer: type === 1 ? [{ type, data: '93.184.216.34' }] : [] }),
      { status: 200 }
    )
  }
  const privateResolver = async () =>
    new Response(JSON.stringify({ Answer: [{ type: 1, data: '127.0.0.1' }] }), { status: 200 })
  assert.equal(await isSecureWebhookUrl('https://hooks.example.test/events', publicResolver), true)
  assert.equal(
    await isSecureWebhookUrl('https://hooks.example.test/events', privateResolver),
    false
  )
  assert.equal(await isSecureWebhookUrl('https://127.0.0.1/events', publicResolver), false)
  assert.equal(await isSecureWebhookUrl('https://[::1]/events', publicResolver), false)
  assert.equal(await isSecureWebhookUrl('https://[fc00::1]/events', publicResolver), false)
  assert.equal(await isSecureWebhookUrl('https://[fe80::1]/events', publicResolver), false)
  assert.equal(await isSecureWebhookUrl('https://[::ffff:7f00:1]/events', publicResolver), false)
  assert.equal(await isSecureWebhookUrl('https://[::ffff:a00:1]/events', publicResolver), false)
  assert.equal(await isSecureWebhookUrl('https://[::ffff:a9fe:a9fe]/events', publicResolver), false)
  assert.equal(
    await isSecureWebhookUrl('https://[2606:4700:4700::1111]/events', publicResolver),
    true
  )
  assert.equal(await isSecureWebhookUrl('http://hooks.example.test/events', publicResolver), false)
  assert.equal(await isSecureWebhookUrl('not a URL', publicResolver), false)
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
  assert.match(source, /!PUBLIC_JOB_TYPES\.has\(jobType\)/)
  assert.match(source, /!body \|\| typeof body !== 'object'/)
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
  assert.match(webhookSource, /status = 'pending', claimed_at = NULL/)
  assert.match(webhookSource, /claimed_at = datetime\('now'\)/)

  const leaseMigration = readFileSync(
    new URL('../../cloudflare/migrations/0005_webhook_delivery_claim_lease.sql', import.meta.url),
    'utf8'
  )
  assert.match(leaseMigration, /ADD COLUMN claimed_at TEXT/)
})

test('outbound integrations have durable retries, timeouts, and tenant RLS', () => {
  const workerSource = readFileSync(
    new URL('../../server/queue/workers/webhookDeliveryWorker.ts', import.meta.url),
    'utf8'
  )
  assert.match(workerSource, /attempts: MAX_DELIVERY_ATTEMPTS/)
  assert.match(workerSource, /backoff: \{ type: 'exponential', delay: 30_000 \}/)
  assert.doesNotMatch(workerSource, /getWebhookDeliveryQueue\(\)\.add\([\s\S]*nextAttempt/)

  const crmSource = readFileSync(
    new URL('../../cloudflare/workers/api/src/crm.ts', import.meta.url),
    'utf8'
  )
  assert.match(crmSource, /CRM_REQUEST_TIMEOUT_MS = 10_000/)
  assert.equal((crmSource.match(/signal: crmRequestSignal\(\)/g) ?? []).length, 8)
  assert.doesNotMatch(crmSource, /return apiKey\.length > 10/)

  const authSource = readFileSync(
    new URL('../../cloudflare/workers/api/src/auth.ts', import.meta.url),
    'utf8'
  )
  assert.doesNotMatch(authSource, /KV\?\.get<Identity>/)

  const prospectsSource = readFileSync(
    new URL('../../cloudflare/workers/api/src/routes/prospects.ts', import.meta.url),
    'utf8'
  )
  assert.match(prospectsSource, /!body \|\|[\s\S]*typeof body !== 'object'/)

  const crmMigration = readFileSync(
    new URL('../../cloudflare/migrations/0003_webhooks_crm.sql', import.meta.url),
    'utf8'
  )
  assert.match(crmMigration, /crm_id\s+TEXT REFERENCES crm_integrations\(id\) ON DELETE SET NULL/)

  const rlsMigration = readFileSync(
    new URL('../../database/migrations/20260915_webhook_subscriptions.sql', import.meta.url),
    'utf8'
  )
  assert.match(rlsMigration, /ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY/)
  assert.match(rlsMigration, /CREATE POLICY webhook_deliveries_tenant_isolation/)
  assert.match(rlsMigration, /subscription\.org_id = app_current_org_id\(\)/)

  const openApiSource = readFileSync(
    new URL('../../cloudflare/workers/api/src/routes/openapi.ts', import.meta.url),
    'utf8'
  )
  assert.doesNotMatch(openApiSource, /summary: 'Enqueue a background job'/)
  assert.equal(
    (openApiSource.match(/'503': \{ description: 'Enrichment worker unavailable' \}/g) ?? [])
      .length,
    2
  )
})

test('subscription management avoids raw JSON parsing and duplicate prefixes', () => {
  const source = readFileSync(new URL('../../server/index.ts', import.meta.url), 'utf8')
  assert.match(source, /req\.path === '\/subscriptions'/)
  assert.match(
    source,
    /this\.app\.use\(\s*'\/api\/webhooks',\s*authMiddleware,[\s\S]*webhookSubscriptionsRouter/
  )
})
