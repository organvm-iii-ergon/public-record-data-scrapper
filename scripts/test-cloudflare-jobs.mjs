import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
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
const require = createRequire(new URL('package.json', edge))
const { build } = require('esbuild')
const { Miniflare, convertV4MiniflareOptions } = require('miniflare')
const compiled = await build({
  stdin: {
    contents: `
  import {claimJob, finishJob} from './workers/api/src/job-queue';
  export default {async fetch(request, env) {
    const input = await request.json();
    const result = input.operation === 'claim' ? await claimJob(env, input.now)
      : await finishJob(env, input.job, input.success, input.now);
    return Response.json(result);
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
    compatibilityDate: compatibility.date,
    compatibilityFlags: compatibility.flags,
    cf: false,
    host: '127.0.0.1',
    port: 0,
    telemetry: { enabled: false },
    d1Databases: { DB: 'lease-test' },
    outboundService: () => {
      throw new Error('No external requests permitted')
    }
  })
)
try {
  const db = await worker.getD1Database('DB')
  const initial = readFileSync(new URL('migrations/0001_init.sql', edge), 'utf8')
  await db.prepare(initial.match(/CREATE TABLE IF NOT EXISTS jobs \([\s\S]*?\);/)[0]).run()
  await db
    .prepare(
      "INSERT INTO jobs(id,type,status,attempts) VALUES ('legacy','unsupported','processing',1)"
    )
    .run()
  for (const sql of readFileSync(new URL('migrations/0004_job_leases.sql', edge), 'utf8')
    .split(';')
    .filter((value) => value.trim()))
    await db.prepare(sql).run()
  assert.equal(
    (await db.prepare("SELECT status FROM jobs WHERE id='legacy'").first()).status,
    'pending'
  )
  await db.prepare('DELETE FROM jobs').run()
  async function invoke(input) {
    const response = await worker.dispatchFetch('http://localhost/', {
      method: 'POST',
      body: JSON.stringify(input)
    })
    assert.equal(response.status, 200)
    return response.json()
  }
  const claim = (now) => invoke({ operation: 'claim', now })
  const finish = (job, success, now) => invoke({ operation: 'finish', job, success, now })
  async function insert(id, attempts = 0) {
    await db
      .prepare('INSERT INTO jobs(id,type,attempts) VALUES (?, ?, ?)')
      .bind(id, 'unsupported', attempts)
      .run()
  }
  await insert('parallel')
  const claims = await Promise.all([claim(1000), claim(1000)])
  assert.equal(claims.filter(Boolean).length, 1)
  const original = claims.find(Boolean)
  assert.equal(original.attempts, 1)
  assert.equal(await claim(original.lease_expires_at - 1), null)
  assert.equal(await finish(original, true, original.lease_expires_at), false)
  const recovered = await claim(original.lease_expires_at)
  assert.equal(recovered.id, original.id)
  assert.notEqual(recovered.lease_owner, original.lease_owner)
  assert.equal(recovered.attempts, 2)
  assert.equal(await finish(original, true, recovered.lease_expires_at - 1), false)
  assert.equal(await finish(recovered, true, recovered.lease_expires_at - 1), true)
  assert.equal(
    (await db.prepare("SELECT status FROM jobs WHERE id='parallel'").first()).status,
    'done'
  )
  await insert('retry')
  const retry = await claim(1000)
  assert.equal(await finish(retry, false, 1001), true)
  assert.equal(await claim(61000), null)
  const retried = await claim(61001)
  assert.equal(retried.attempts, 2)
  await finish(retried, true, 61002)
  await insert('exhausted', 5)
  assert.equal(await claim(70000), null)
  assert.equal(
    (await db.prepare("SELECT status FROM jobs WHERE id='exhausted'").first()).status,
    'failed'
  )
  await insert('last-attempt', 4)
  const last = await claim(80000)
  assert.equal(last.attempts, 5)
  assert.equal(await claim(last.lease_expires_at - 1), null)
  assert.equal(
    (await db.prepare("SELECT status FROM jobs WHERE id='last-attempt'").first()).status,
    'processing'
  )
  assert.equal(await claim(last.lease_expires_at), null)
  assert.equal(
    (await db.prepare("SELECT status FROM jobs WHERE id='last-attempt'").first()).status,
    'failed'
  )
  assert.equal(await finish(last, true, last.lease_expires_at + 1), false)
  console.log(
    'D1 lease verification passed: legacy recovery, concurrent claim exclusion, expiry recovery, owner fencing, retry delay and terminal crash recovery'
  )
} finally {
  await worker.dispose()
}
