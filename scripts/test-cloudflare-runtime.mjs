import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

// Local dependency/runtime smoke. No Wrangler CLI, credentials or remote bindings.
const edge = new URL('../cloudflare/', import.meta.url)
const compatibility = JSON.parse(
  execFileSync(
    'python3',
    [
      '-c',
      'import json,sys,tomllib; c=tomllib.load(open(sys.argv[1], "rb")); print(json.dumps({"date":c["compatibility_date"],"flags":c.get("compatibility_flags",[])}))',
      fileURLToPath(new URL('wrangler.toml', edge))
    ],
    { encoding: 'utf8' }
  )
)
const requireEdge = createRequire(new URL('package.json', edge))
const { build } = requireEdge('esbuild')
const { Miniflare, convertV4MiniflareOptions } = requireEdge('miniflare')
const bundled = await build({
  absWorkingDir: fileURLToPath(edge),
  entryPoints: ['workers/api/src/index.ts'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  write: false
})
let outboundRequests = 0
const worker = new Miniflare(
  convertV4MiniflareOptions({
    script: bundled.outputFiles[0].text,
    modules: true,
    compatibilityDate: compatibility.date,
    compatibilityFlags: compatibility.flags,
    host: '127.0.0.1',
    port: 0,
    cf: false,
    telemetry: { enabled: false },
    bindings: { ENVIRONMENT: 'local-dependency-smoke', DEPLOYMENT_SHA: 'a'.repeat(40) },
    d1Databases: { DB: 'staging-test-db' },
    kvNamespaces: { KV: 'staging-test-kv' },
    outboundService: () => {
      outboundRequests += 1
      throw new Error('This local smoke must never contact external services')
    }
  })
)
try {
  // Apply D1 schema migrations (0001_init.sql and 0002_api_keys.sql)
  const db = await worker.getD1Database('DB')

  function splitSqlStatements(sql) {
    const statements = []
    let current = ''
    let inTrigger = false
    for (const line of sql.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('--') || !trimmed) continue
      current += line + '\n'
      if (/\bCREATE\s+TRIGGER\b/i.test(current) && !inTrigger) {
        inTrigger = true
      }
      if (inTrigger) {
        if (/\bEND\s*;/i.test(trimmed)) {
          inTrigger = false
          statements.push(current.trim())
          current = ''
        }
      } else if (trimmed.endsWith(';')) {
        statements.push(current.trim())
        current = ''
      }
    }
    if (current.trim()) statements.push(current.trim())
    return statements
  }

  const rawMigration1 = fs.readFileSync(new URL('migrations/0001_init.sql', edge), 'utf8')
  for (const stmt of splitSqlStatements(rawMigration1)) {
    await db.prepare(stmt).run()
  }

  const rawMigration2 = fs.readFileSync(new URL('migrations/0002_api_keys.sql', edge), 'utf8')
  for (const stmt of splitSqlStatements(rawMigration2)) {
    await db.prepare(stmt).run()
  }

  const tables = await db
    .prepare(
      "SELECT name FROM sqlite_master WHERE name IN ('organizations', 'prospects', 'jobs', 'prospects_fts') ORDER BY name"
    )
    .all()
  const tableNames = new Set(tables.results.map((r) => r.name))
  assert.deepEqual(tableNames, new Set(['organizations', 'prospects', 'jobs', 'prospects_fts']))

  const apiKeysTable = await db
    .prepare("SELECT name FROM sqlite_master WHERE name = 'api_keys'")
    .first()
  assert.equal(apiKeysTable?.name, 'api_keys')

  // Verify HTTP endpoints and security boundaries
  const health = await worker.dispatchFetch('http://localhost/health')
  assert.equal(health.status, 200)
  assert.deepEqual(await health.json(), {
    ok: true,
    env: 'local-dependency-smoke',
    revision: 'a'.repeat(40)
  })

  const v1Health = await worker.dispatchFetch('http://localhost/v1/health')
  assert.equal(v1Health.status, 200)

  // Verify OpenAPI spec alignment
  const openapi = await worker.dispatchFetch('http://localhost/v1/openapi.json')
  assert.equal(openapi.status, 200)
  const spec = await openapi.json()
  assert.equal(spec.openapi, '3.1.0')
  assert.ok(spec.paths['/v1/prospects'])
  assert.ok(spec.paths['/v1/jobs'])
  assert.ok(spec.paths['/v1/enrichment/batch'])
  assert.ok(spec.paths['/v1/keys'])

  const protectedRoute = await worker.dispatchFetch('http://localhost/api/prospects')
  assert.equal(protectedRoute.status, 401)
  const missing = await worker.dispatchFetch('http://localhost/does-not-exist')
  assert.equal(missing.status, 404)

  // ==========================================================================
  // Multi-Tenant B2B Auth, API Keys, Rate Limiting & Tier Entitlement Tests
  // ==========================================================================

  // 1. Seed test organizations (one Growth tier, one Free tier)
  await db
    .prepare('INSERT INTO organizations (id, name, subscription_tier) VALUES (?, ?, ?)')
    .bind('org-growth', 'Growth Corp B2B', 'growth')
    .run()

  await db
    .prepare('INSERT INTO organizations (id, name, subscription_tier) VALUES (?, ?, ?)')
    .bind('org-free', 'Free Tier Starter', 'free')
    .run()

  // 2. Provision test API keys
  function sha256Hex(str) {
    return crypto.createHash('sha256').update(str, 'utf8').digest('hex')
  }

  const growthKey = 'prk_growth_live_key_abcdef123456'
  const freeKey = 'prk_free_live_key_abcdef123456'
  const revokedKey = 'prk_revoked_key_abcdef123456'
  const expiredKey = 'prk_expired_key_abcdef123456'

  await db
    .prepare(
      'INSERT INTO api_keys (id, org_id, name, key_prefix, key_hash, role) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .bind(
      'key-growth-1',
      'org-growth',
      'Growth Key',
      growthKey.slice(0, 12),
      sha256Hex(growthKey),
      'admin'
    )
    .run()

  await db
    .prepare(
      'INSERT INTO api_keys (id, org_id, name, key_prefix, key_hash, role) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .bind('key-free-1', 'org-free', 'Free Key', freeKey.slice(0, 12), sha256Hex(freeKey), 'user')
    .run()

  await db
    .prepare(
      "INSERT INTO api_keys (id, org_id, name, key_prefix, key_hash, role, revoked_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
    )
    .bind(
      'key-revoked-1',
      'org-growth',
      'Revoked Key',
      revokedKey.slice(0, 12),
      sha256Hex(revokedKey),
      'user'
    )
    .run()

  await db
    .prepare(
      "INSERT INTO api_keys (id, org_id, name, key_prefix, key_hash, role, expires_at) VALUES (?, ?, ?, ?, ?, ?, '2020-01-01T00:00:00Z')"
    )
    .bind(
      'key-expired-1',
      'org-growth',
      'Expired Key',
      expiredKey.slice(0, 12),
      sha256Hex(expiredKey),
      'user'
    )
    .run()

  // 3. Verify Authentication Gates (Fail-Closed)
  // 3a. Unauthenticated v1 request -> 401
  const unauthV1 = await worker.dispatchFetch('http://localhost/v1/prospects')
  assert.equal(unauthV1.status, 401)

  // 3b. Malformed key format -> 401
  const malformed = await worker.dispatchFetch('http://localhost/v1/prospects', {
    headers: { 'X-API-Key': 'invalid-key-format' }
  })
  assert.equal(malformed.status, 401)

  // 3c. Revoked key -> 401
  const revokedRes = await worker.dispatchFetch('http://localhost/v1/prospects', {
    headers: { 'X-API-Key': revokedKey }
  })
  assert.equal(revokedRes.status, 401)

  // 3d. Expired key -> 401
  const expiredRes = await worker.dispatchFetch('http://localhost/v1/prospects', {
    headers: { 'X-API-Key': expiredKey }
  })
  assert.equal(expiredRes.status, 401)

  // 3e. Valid X-API-Key header -> 200 with rate limit headers
  const validHeaderRes = await worker.dispatchFetch('http://localhost/v1/prospects', {
    headers: { 'X-API-Key': growthKey }
  })
  assert.equal(validHeaderRes.status, 200)
  assert.equal(validHeaderRes.headers.get('X-RateLimit-Limit'), '1000')
  assert.ok(validHeaderRes.headers.get('X-RateLimit-Remaining'))
  assert.ok(validHeaderRes.headers.get('X-RateLimit-Reset'))
  const validHeaderJson = await validHeaderRes.json()
  assert.deepEqual(validHeaderJson.data, [])
  assert.equal(validHeaderJson.meta.total, 0)

  // 3f. Valid Bearer prk_... token in Authorization header -> 200
  const validBearerRes = await worker.dispatchFetch('http://localhost/v1/prospects', {
    headers: { Authorization: `Bearer ${growthKey}` }
  })
  assert.equal(validBearerRes.status, 200)

  // 4. Prospect Ingestion & Strict Tenant Isolation (Telos #3)
  // Org Growth creates a prospect
  const createProspectRes = await worker.dispatchFetch('http://localhost/v1/prospects', {
    method: 'POST',
    headers: {
      'X-API-Key': growthKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      company_name: 'Apex Capital Management',
      priority_score: 95,
      status: 'new',
      enrichment_confidence: 0.98,
      raw_data: { filing_state: 'CA', secured_party: 'Lender A' }
    })
  })
  assert.equal(createProspectRes.status, 201)
  const createdProspect = await createProspectRes.json()
  assert.equal(createdProspect.data.company_name, 'Apex Capital Management')
  const prospectId = createdProspect.data.id
  assert.ok(prospectId)

  // Org Growth queries prospects -> sees 1 prospect
  const growthListRes = await worker.dispatchFetch('http://localhost/v1/prospects', {
    headers: { 'X-API-Key': growthKey }
  })
  assert.equal(growthListRes.status, 200)
  const growthList = await growthListRes.json()
  assert.equal(growthList.data.length, 1)
  assert.equal(growthList.data[0].id, prospectId)

  // Org Free queries prospects -> sees 0 prospects (isolated!)
  const freeListRes = await worker.dispatchFetch('http://localhost/v1/prospects', {
    headers: { 'X-API-Key': freeKey }
  })
  assert.equal(freeListRes.status, 200)
  const freeList = await freeListRes.json()
  assert.equal(freeList.data.length, 0)

  // Org Free attempts to read Org Growth's prospect by ID -> 404 (zero existence leakage)
  const crossOrgRead = await worker.dispatchFetch(`http://localhost/v1/prospects/${prospectId}`, {
    headers: { 'X-API-Key': freeKey }
  })
  assert.equal(crossOrgRead.status, 404)

  // Org Growth reads prospect by ID -> 200
  const growthRead = await worker.dispatchFetch(`http://localhost/v1/prospects/${prospectId}`, {
    headers: { 'X-API-Key': growthKey }
  })
  assert.equal(growthRead.status, 200)
  const growthReadData = await growthRead.json()
  assert.equal(growthReadData.data.company_name, 'Apex Capital Management')

  // 5. Jobs Queueing Endpoints (/v1/jobs)
  const createJobRes = await worker.dispatchFetch('http://localhost/v1/jobs', {
    method: 'POST',
    headers: {
      'X-API-Key': growthKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'ucc-ingestion',
      payload: { state: 'NY', date: '2026-09-15' }
    })
  })
  assert.equal(createJobRes.status, 202)
  const createdJob = await createJobRes.json()
  const testJobId = createdJob.data.id
  assert.ok(testJobId)
  assert.equal(createdJob.data.status, 'pending')

  // Org Growth reads job status -> 200
  const readJobRes = await worker.dispatchFetch(`http://localhost/v1/jobs/${testJobId}`, {
    headers: { 'X-API-Key': growthKey }
  })
  assert.equal(readJobRes.status, 200)

  // Org Free cannot read Org Growth's job -> 404
  const crossJobRead = await worker.dispatchFetch(`http://localhost/v1/jobs/${testJobId}`, {
    headers: { 'X-API-Key': freeKey }
  })
  assert.equal(crossJobRead.status, 404)

  // 6. Enrichment & Tier Entitlements
  // 6a. Single prospect enrichment (available to all tiers)
  const singleEnrichRes = await worker.dispatchFetch('http://localhost/v1/enrichment/prospect', {
    method: 'POST',
    headers: {
      'X-API-Key': growthKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prospect_id: prospectId })
  })
  assert.equal(singleEnrichRes.status, 202)
  const singleEnrichData = await singleEnrichRes.json()
  assert.equal(singleEnrichData.data.prospect_id, prospectId)

  // 6b. Batch enrichment with Free tier -> 403 TIER_UPGRADE_REQUIRED (blocked at edge before D1!)
  const freeBatchRes = await worker.dispatchFetch('http://localhost/v1/enrichment/batch', {
    method: 'POST',
    headers: {
      'X-API-Key': freeKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prospect_ids: [prospectId] })
  })
  assert.equal(freeBatchRes.status, 403)
  const freeBatchJson = await freeBatchRes.json()
  assert.equal(freeBatchJson.error.code, 'TIER_UPGRADE_REQUIRED')

  // 6c. Batch enrichment with Growth tier -> 202 Accepted
  const growthBatchRes = await worker.dispatchFetch('http://localhost/v1/enrichment/batch', {
    method: 'POST',
    headers: {
      'X-API-Key': growthKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prospect_ids: [prospectId] })
  })
  assert.equal(growthBatchRes.status, 202)
  const growthBatchJson = await growthBatchRes.json()
  assert.equal(growthBatchJson.data.total, 1)

  // 6d. Enrichment status endpoint -> 200
  const enrichStatusRes = await worker.dispatchFetch('http://localhost/v1/enrichment/status', {
    headers: { 'X-API-Key': growthKey }
  })
  assert.equal(enrichStatusRes.status, 200)

  // 7. API Key Management Delivery Surface (/v1/keys)
  // Org Growth mints a new key
  const mintKeyRes = await worker.dispatchFetch('http://localhost/v1/keys', {
    method: 'POST',
    headers: {
      'X-API-Key': growthKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name: 'Integration Service Key', role: 'user' })
  })
  assert.equal(mintKeyRes.status, 201)
  const mintedKeyJson = await mintKeyRes.json()
  const mintedKeySecret = mintedKeyJson.data.key
  const mintedKeyId = mintedKeyJson.data.id
  assert.ok(mintedKeySecret.startsWith('prk_'))
  assert.ok(mintedKeyId)

  // Use the newly minted key to make an authenticated request
  const testNewKeyRes = await worker.dispatchFetch('http://localhost/v1/prospects', {
    headers: { 'X-API-Key': mintedKeySecret }
  })
  assert.equal(testNewKeyRes.status, 200)

  // Revoke the key
  const revokeKeyRes = await worker.dispatchFetch(`http://localhost/v1/keys/${mintedKeyId}`, {
    method: 'DELETE',
    headers: { 'X-API-Key': growthKey }
  })
  assert.equal(revokeKeyRes.status, 200)

  // Call with revoked key -> 401
  const afterRevokeRes = await worker.dispatchFetch('http://localhost/v1/prospects', {
    headers: { 'X-API-Key': mintedKeySecret }
  })
  assert.equal(afterRevokeRes.status, 401)

  // 8. Rate Limiting Edge Enforcement (Trigger 429)
  // Free tier limit is 10 requests/minute. Issue a burst of requests with freeKey.
  let rateLimited = false
  for (let i = 0; i < 15; i++) {
    const burstRes = await worker.dispatchFetch('http://localhost/v1/prospects', {
      headers: { 'X-API-Key': freeKey }
    })
    if (burstRes.status === 429) {
      rateLimited = true
      assert.equal(burstRes.headers.get('X-RateLimit-Limit'), '10')
      assert.equal(burstRes.headers.get('X-RateLimit-Remaining'), '0')
      assert.ok(burstRes.headers.get('Retry-After'))
      const body429 = await burstRes.json()
      assert.equal(body429.error.code, 'RATE_LIMIT_EXCEEDED')
      break
    }
  }
  assert.ok(rateLimited, 'Expected rate limiter to trigger HTTP 429 on free tier quota exhaustion')

  // Verify scheduled cron triggers and D1 queue drainage
  const runtimeWorker = await worker.getWorker()

  // 1. Continuous ingestion cron: 0 2 * * *
  const ingestOutcome = await runtimeWorker.scheduled({ cron: '0 2 * * *' })
  assert.equal(ingestOutcome.outcome, 'ok')

  // 2. Data enrichment cron: 0 */6 * * *
  const enrichOutcome = await runtimeWorker.scheduled({ cron: '0 */6 * * *' })
  assert.equal(enrichOutcome.outcome, 'ok')

  // 3. Health scoring cron: 0 */12 * * *
  const healthOutcome = await runtimeWorker.scheduled({ cron: '0 */12 * * *' })
  assert.equal(healthOutcome.outcome, 'ok')

  // 4. Unrecognized schedule fallback (fail-safe)
  const unknownOutcome = await runtimeWorker.scheduled({ cron: '0 0 1 1 *' })
  assert.equal(unknownOutcome.outcome, 'ok')

  // 5. Background jobs drainage via D1 on cron tick
  await db
    .prepare('INSERT INTO jobs (id, type, payload, status, org_id) VALUES (?, ?, ?, ?, ?)')
    .bind('smoke-job-1', 'unhandled-test', '{}', 'pending', 'org-smoke')
    .run()

  await runtimeWorker.scheduled({ cron: '0 2 * * *' })

  const jobRecord = await db
    .prepare("SELECT id, status, attempts FROM jobs WHERE id = 'smoke-job-1'")
    .first()
  assert.ok(jobRecord)
  assert.equal(jobRecord.attempts, 1)
  assert.equal(jobRecord.status, 'pending')

  // 6. Max attempts failure transition (attempts >= 5 -> failed)
  await db
    .prepare(
      'INSERT INTO jobs (id, type, payload, status, org_id, attempts) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .bind('smoke-job-max', 'unhandled-test', '{}', 'pending', 'org-smoke', 4)
    .run()

  await runtimeWorker.scheduled({ cron: '0 2 * * *' })

  const maxJobRecord = await db
    .prepare("SELECT id, status, attempts FROM jobs WHERE id = 'smoke-job-max'")
    .first()
  assert.ok(maxJobRecord)
  assert.equal(maxJobRecord.attempts, 5)
  assert.equal(maxJobRecord.status, 'failed')

  assert.equal(outboundRequests, 0)
  console.log(
    'Local Worker runtime passed: health=200, unauthenticated=401, missing=404, schema=5 tables, v1_api=ok, api_keys=ok, tenant_isolation=ok, rate_limits=ok (429 verified), tier_entitlements=ok (403 verified), crons=4 passed, d1_drain=ok; outbound=0'
  )
} finally {
  await worker.dispose()
}
