import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'

const ROOT = resolve(import.meta.dirname, '../..')

test('deploy-cloudflare.yml triggers and staging gates are strictly defined', () => {
  const workflowContent = readFileSync(
    resolve(ROOT, '.github/workflows/deploy-cloudflare.yml'),
    'utf8'
  )

  // Trigger specifications
  assert.match(workflowContent, /branches:\s*\[main\]/)
  assert.match(workflowContent, /- 'cloudflare\/\*\*'/)
  assert.match(workflowContent, /- 'scripts\/\*cloudflare\*'/)
  assert.match(workflowContent, /- '\.github\/workflows\/deploy-cloudflare\.yml'/)
  assert.match(workflowContent, /workflow_dispatch:/)
  assert.match(workflowContent, /staging:/)
  assert.match(workflowContent, /confirm:/)

  // Verify staging preflight step
  assert.match(workflowContent, /verify-staging:/)
  assert.match(workflowContent, /node scripts\/test-cloudflare-runtime\.mjs/)

  // Deploy staging conditions
  assert.match(workflowContent, /deploy-staging:/)
  assert.match(workflowContent, /needs:\s*verify-staging/)
  assert.match(workflowContent, /github\.ref\s*==\s*'refs\/heads\/main'/)
  assert.match(
    workflowContent,
    /github\.event_name\s*==\s*'workflow_dispatch'\s*&&\s*inputs\.staging\s*&&\s*inputs\.confirm\s*!=\s*'DEPLOY'/
  )

  // Enforces accepted main commit SHA
  assert.match(workflowContent, /test "\$\(git rev-parse HEAD\)" = "\$GITHUB_SHA"/)
  assert.match(
    workflowContent,
    /test "\$\(gh api "repos\/\$GITHUB_REPOSITORY\/git\/ref\/heads\/main" --jq \.object\.sha\)" = "\$GITHUB_SHA"/
  )

  // Remote D1 migration apply and schema query
  assert.match(
    workflowContent,
    /wrangler d1 migrations apply DB --config \.generated\/staging\.wrangler\.json --remote/
  )
  assert.match(
    workflowContent,
    /SELECT name FROM sqlite_master WHERE name IN \('organizations', 'prospects', 'jobs', 'prospects_fts'\)/
  )
})

test('cloudflare/wrangler.toml binds D1 database and declares cron triggers for staging', () => {
  const wranglerContent = readFileSync(resolve(ROOT, 'cloudflare/wrangler.toml'), 'utf8')

  // Top-level / default dev bindings
  assert.match(wranglerContent, /\[\[d1_databases\]\]/)
  assert.match(wranglerContent, /binding\s*=\s*"DB"/)
  assert.match(wranglerContent, /migrations_dir\s*=\s*"migrations"/)

  // Staging environment bindings
  assert.match(wranglerContent, /\[env\.staging\]/)
  assert.match(wranglerContent, /\[\[env\.staging\.d1_databases\]\]/)
  assert.match(wranglerContent, /binding\s*=\s*"DB"/)
  assert.match(wranglerContent, /database_id\s*=\s*"REPLACE_WITH_STAGING_D1_ID"/)

  // Production environment bindings
  assert.match(wranglerContent, /\[env\.production\]/)
  assert.match(wranglerContent, /\[\[env\.production\.d1_databases\]\]/)
  assert.match(wranglerContent, /database_id\s*=\s*"REPLACE_WITH_PRODUCTION_D1_ID"/)

  // Scheduled triggers across environments
  const requiredCrons = ['"0 2 * * *"', '"0 */6 * * *"', '"0 */12 * * *"']
  for (const cron of requiredCrons) {
    assert.ok(wranglerContent.includes(cron), `wrangler.toml must include cron trigger ${cron}`)
  }
})

test('Worker entrypoint exports scheduled handler and binds typed D1 client', () => {
  const indexContent = readFileSync(resolve(ROOT, 'cloudflare/workers/api/src/index.ts'), 'utf8')
  assert.match(
    indexContent,
    /import\s*\{\s*scheduled\s*\}\s*from\s*'(\.\/scheduled|\.\/scheduled\.ts)'/
  )
  assert.match(indexContent, /export\s+default\s*\{[\s\S]*fetch[\s\S]*scheduled[\s\S]*\}/)

  const typesContent = readFileSync(resolve(ROOT, 'cloudflare/workers/api/src/types.ts'), 'utf8')
  assert.match(typesContent, /DB:\s*D1Database/)
  assert.match(typesContent, /KV:\s*KVNamespace/)
  assert.match(typesContent, /ARTIFACTS:\s*R2Bucket/)

  const dbContent = readFileSync(resolve(ROOT, 'cloudflare/workers/api/src/db.ts'), 'utf8')
  assert.match(dbContent, /export\s+async\s+function\s+all/)
  assert.match(dbContent, /export\s+async\s+function\s+first/)
  assert.match(dbContent, /export\s+async\s+function\s+run/)
  assert.match(dbContent, /env\.DB\.prepare\(sql\)/)
})

test('scheduled.ts routes cron ticks and drains D1 jobs queue with fail-safe semantics', () => {
  const scheduledContent = readFileSync(
    resolve(ROOT, 'cloudflare/workers/api/src/scheduled.ts'),
    'utf8'
  )

  // Cron schedule routing
  assert.match(scheduledContent, /case '0 2 \* \* \*':[\s\S]*runIngestion\(env\)/)
  assert.match(scheduledContent, /case '0 \*\/6 \* \* \*':[\s\S]*runEnrichment\(env\)/)
  assert.match(scheduledContent, /case '0 \*\/12 \* \* \*':[\s\S]*runHealthScores\(env\)/)

  // Always drains jobs regardless of tick
  assert.match(scheduledContent, /await drainJobs\(env\)/)

  // Atomic claim query
  assert.match(
    scheduledContent,
    /SET status = 'processing', attempts = attempts \+ 1, claimed_at = datetime\('now'\)\s+WHERE id = \? AND status = 'pending'/
  )

  // Terminal or retry status handling
  assert.match(scheduledContent, /UPDATE jobs SET status = 'done', claimed_at = NULL WHERE id = \?/)
  assert.match(
    scheduledContent,
    /const nextStatus = job\.attempts \+ 1 >= MAX_ATTEMPTS \? 'failed' : 'pending'/
  )

  // Evicted workers cannot strand processing jobs forever.
  assert.match(
    scheduledContent,
    /SET status = 'pending', claimed_at = NULL[\s\S]*WHERE status = 'processing'/
  )
})

test('canonical D1 migration 0004 adds recoverable job leases', () => {
  const sql = readFileSync(resolve(ROOT, 'cloudflare/migrations/0004_job_claim_lease.sql'), 'utf8')
  assert.match(sql, /ALTER TABLE jobs ADD COLUMN claimed_at TEXT/)
  assert.match(sql, /UPDATE jobs SET status = 'pending' WHERE status = 'processing'/)
  assert.match(sql, /idx_jobs_claim_lease/)
})

test('D1 migration 0001_init.sql defines all required schema objects and index constraints', () => {
  const sql = readFileSync(resolve(ROOT, 'cloudflare/migrations/0001_init.sql'), 'utf8')

  assert.match(sql, /CREATE TABLE IF NOT EXISTS organizations/)
  assert.match(sql, /CREATE TABLE IF NOT EXISTS prospects/)
  assert.match(sql, /CREATE TABLE IF NOT EXISTS jobs/)
  assert.match(sql, /CREATE VIRTUAL TABLE IF NOT EXISTS prospects_fts USING fts5/)

  // Jobs table schema columns
  assert.match(sql, /id\s+TEXT PRIMARY KEY/)
  assert.match(sql, /type\s+TEXT NOT NULL/)
  assert.match(sql, /payload\s+TEXT/)
  assert.match(sql, /status\s+TEXT NOT NULL DEFAULT 'pending'/)
  assert.match(sql, /org_id\s+TEXT/)
  assert.match(sql, /attempts\s+INTEGER NOT NULL DEFAULT 0/)
  assert.match(sql, /created_at\s+TEXT NOT NULL DEFAULT \(datetime\('now'\)\)/)

  // Status index for fast queue drainage
  assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs\(status, created_at\)/)
})
