import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const edge = new URL('../cloudflare/', import.meta.url)
const compatibilityDate = execFileSync(
  'python3',
  [
    '-c',
    'import sys,tomllib; print(tomllib.load(open(sys.argv[1], "rb"))["compatibility_date"])',
    fileURLToPath(new URL('wrangler.toml', edge))
  ],
  { encoding: 'utf8' }
).trim()
const require = createRequire(new URL('package.json', edge))
const { build } = require('esbuild')
const { Miniflare, convertV4MiniflareOptions } = require('miniflare')
const compiled = await build({
  stdin: {
    contents: `
    import {resolveAccessMembership, verifyApiKey} from './workers/api/src/auth';
    export default {async fetch(request, env) {
      const input = await request.json();
      return Response.json(input.key ? await verifyApiKey(env, input.key)
        : await resolveAccessMembership(env, input.payload));
    }};`,
    resolveDir: fileURLToPath(edge)
  },
  bundle: true,
  format: 'esm',
  platform: 'browser',
  write: false
})
const worker = new Miniflare(
  convertV4MiniflareOptions({
    script: compiled.outputFiles[0].text,
    modules: true,
    compatibilityDate,
    cf: false,
    host: '127.0.0.1',
    port: 0,
    telemetry: { enabled: false },
    d1Databases: { DB: 'membership-test' },
    kvNamespaces: { KV: 'membership-kv' },
    bindings: { ACCESS_TEAM_DOMAIN: 'test.cloudflareaccess.com' },
    outboundService: () => {
      throw new Error('No external requests permitted')
    }
  })
)
try {
  const db = await worker.getD1Database('DB')
  const initial = readFileSync(new URL('migrations/0001_init.sql', edge), 'utf8')
  await db.prepare(initial.match(/CREATE TABLE IF NOT EXISTS organizations \([\s\S]*?\);/)[0]).run()
  for (const name of [
    '0002_api_keys.sql',
    '0005_access_memberships.sql',
    '0008_access_enrollment_invites.sql'
  ]) {
    const sql = readFileSync(new URL('migrations/' + name, edge), 'utf8').replace(/^\s*--.*$/gm, '')
    for (const statement of sql.split(';').filter((value) => value.trim()))
      await db.prepare(statement).run()
  }
  await db
    .prepare(
      "INSERT INTO organizations(id,name,subscription_tier) VALUES ('a','Test A','growth'),('b','Test B','free')"
    )
    .run()
  const issuer = 'https://test.cloudflareaccess.com'
  const payload = {
    iss: issuer,
    sub: 'subject',
    email: 'test@example.test',
    org_id: 'a',
    role: 'admin'
  }
  async function invoke(input) {
    const response = await worker.dispatchFetch('http://localhost/', {
      method: 'POST',
      body: JSON.stringify(input)
    })
    assert.equal(response.status, 200)
    return response.json()
  }
  const resolve = (value) => invoke({ payload: value })
  assert.equal(await resolve(payload), null, 'claims without enrollment cannot create membership')
  await db
    .prepare(
      'INSERT INTO access_enrollment_invites(issuer,email,org_id,role,expires_at) VALUES (?,?,?,?,?)'
    )
    .bind(issuer, 'test@example.test', 'a', 'user', '2000-01-01T00:00:00Z')
    .run()
  assert.equal(await resolve(payload), null, 'expired enrollment fails closed')
  await db
    .prepare("UPDATE access_enrollment_invites SET expires_at = NULL, revoked_at = datetime('now')")
    .run()
  assert.equal(await resolve(payload), null, 'revoked enrollment fails closed')
  await db.prepare('UPDATE access_enrollment_invites SET revoked_at = NULL').run()
  await db
    .prepare(
      `CREATE TRIGGER reject_test_membership BEFORE INSERT ON access_memberships
       BEGIN SELECT RAISE(ABORT, 'test membership rejection'); END`
    )
    .run()
  const rejected = await worker.dispatchFetch('http://localhost/', {
    method: 'POST',
    body: JSON.stringify({ payload })
  })
  assert.equal(rejected.status, 500, 'membership failure aborts the enrollment batch')
  const unclaimed = await db
    .prepare(
      'SELECT claimed_subject, claimed_at FROM access_enrollment_invites WHERE issuer=? AND email=? AND org_id=?'
    )
    .bind(issuer, 'test@example.test', 'a')
    .first()
  assert.equal(unclaimed.claimed_subject, null, 'failed membership insert rolls back the claim')
  assert.equal(unclaimed.claimed_at, null, 'failed membership insert rolls back claim time')
  await db.prepare('DROP TRIGGER reject_test_membership').run()
  assert.equal(
    (await resolve({ ...payload, email: ' Test@Example.Test ' })).role,
    'user',
    'verified enrollment supplies authority with normalized email'
  )
  const claimed = await db
    .prepare(
      'SELECT claimed_subject, claimed_at FROM access_enrollment_invites WHERE issuer=? AND email=? AND org_id=?'
    )
    .bind(issuer, 'test@example.test', 'a')
    .first()
  assert.equal(claimed.claimed_subject, 'subject')
  assert.equal(typeof claimed.claimed_at, 'string')
  await db.prepare('DELETE FROM access_memberships').run()
  assert.equal(
    (await resolve(payload)).role,
    'user',
    'same subject can repair its durable membership'
  )
  await db.prepare('DELETE FROM access_memberships').run()
  assert.equal(
    await resolve({ ...payload, sub: 'other' }),
    null,
    'claimed enrollment cannot be reassigned'
  )
  await db.prepare('DELETE FROM access_enrollment_invites').run()
  await db
    .prepare('INSERT INTO access_memberships(issuer,subject,org_id,role) VALUES (?,?,?,?)')
    .bind(issuer, 'subject', 'a', 'user')
    .run()
  assert.equal((await resolve(payload)).role, 'user', 'token cannot elevate role')
  assert.equal((await resolve({ ...payload, org_id: undefined })).orgId, 'a')
  assert.equal(await resolve({ ...payload, org_id: 'b' }), null, 'cross-tenant claim rejected')
  assert.equal(await resolve({ ...payload, sub: 'other' }), null)
  assert.equal(await resolve({ ...payload, iss: 'https://other.cloudflareaccess.com' }), null)
  await db.prepare("UPDATE access_memberships SET revoked_at = datetime('now')").run()
  assert.equal(await resolve(payload), null, 'revocation effective immediately')
  await db.prepare('UPDATE access_memberships SET revoked_at = NULL').run()
  await db
    .prepare('INSERT INTO access_memberships(issuer,subject,org_id,role) VALUES (?,?,?,?)')
    .bind(issuer, 'subject', 'b', 'admin')
    .run()
  assert.equal(
    await resolve({ ...payload, org_id: undefined }),
    null,
    'ambiguous tenant fails closed'
  )
  assert.equal((await resolve({ ...payload, org_id: 'b' })).tier, 'free')
  const key = 'prk_membership_test_only'
  const hash = Buffer.from(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  ).toString('hex')
  await db
    .prepare(
      "INSERT INTO api_keys(id,org_id,name,key_prefix,key_hash,role) VALUES ('key','a','Test','prk_',?,'user')"
    )
    .bind(hash)
    .run()
  assert.equal((await invoke({ key })).orgId, 'a')
  const kv = await worker.getKVNamespace('KV')
  await kv.put('apikey:' + hash, JSON.stringify({ orgId: 'b', role: 'admin', tier: 'enterprise' }))
  assert.equal((await invoke({ key })).orgId, 'a', 'stale cache cannot override authority')
  await db.prepare("UPDATE api_keys SET revoked_at = datetime('now') WHERE id='key'").run()
  assert.equal(await invoke({ key }), null, 'cached revoked keys denied')
  await db
    .prepare("UPDATE api_keys SET revoked_at = NULL, expires_at = 'invalid' WHERE id='key'")
    .run()
  assert.equal(await invoke({ key }), null, 'invalid expiry denied')
  console.log(
    'D1 membership passed: pre-enrollment claim, authoritative roles, tenant isolation, issuer/subject binding, ambiguity and immediate revocation'
  )
} finally {
  await worker.dispose()
}
