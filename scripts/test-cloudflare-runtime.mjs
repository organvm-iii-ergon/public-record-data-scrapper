import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
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
    outboundService: () => {
      outboundRequests += 1
      throw new Error('This local smoke must never contact external services')
    }
  })
)
try {
  // Apply initial D1 schema migrations
  const db = await worker.getD1Database('DB')
  const rawMigration = fs.readFileSync(new URL('migrations/0001_init.sql', edge), 'utf8')

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

  for (const stmt of splitSqlStatements(rawMigration)) {
    await db.prepare(stmt).run()
  }

  const tables = await db
    .prepare(
      "SELECT name FROM sqlite_master WHERE name IN ('organizations', 'prospects', 'jobs', 'prospects_fts') ORDER BY name"
    )
    .all()
  const tableNames = new Set(tables.results.map((r) => r.name))
  assert.deepEqual(tableNames, new Set(['organizations', 'prospects', 'jobs', 'prospects_fts']))

  // Verify HTTP endpoints and security boundaries
  const health = await worker.dispatchFetch('http://localhost/health')
  assert.equal(health.status, 200)
  assert.deepEqual(await health.json(), {
    ok: true,
    env: 'local-dependency-smoke',
    revision: 'a'.repeat(40)
  })
  const protectedRoute = await worker.dispatchFetch('http://localhost/api/prospects')
  assert.equal(protectedRoute.status, 401)
  const missing = await worker.dispatchFetch('http://localhost/does-not-exist')
  assert.equal(missing.status, 404)

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
    'Local Worker runtime passed: health=200, unauthenticated=401, missing=404, schema=4 tables, crons=4 passed, d1_drain=ok; outbound=0'
  )
} finally {
  await worker.dispose()
}
