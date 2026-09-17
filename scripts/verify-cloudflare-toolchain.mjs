import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const edge = new URL('../cloudflare/', import.meta.url)
const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(new URL(path, edge), 'utf8'))
  } catch {
    assert.fail(`Expected a readable JSON file at cloudflare/${path}`)
  }
}
const locked = readJson('package-lock.json')?.packages?.['node_modules/wrangler']?.version
const installed = readJson('node_modules/wrangler/package.json')?.version
assert.ok(
  typeof locked === 'string' && locked,
  'Authoritative lock must contain a Wrangler version'
)
assert.ok(typeof installed === 'string' && installed, 'Installed Wrangler must declare a version')
assert.equal(installed, locked, 'Installed Wrangler must match the authoritative lock')

const result = spawnSync(
  fileURLToPath(new URL('node_modules/.bin/wrangler', edge)),
  ['--version'],
  {
    cwd: fileURLToPath(edge),
    encoding: 'utf8',
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }
  }
)
assert.ifError(result.error)
assert.equal(result.status, 0, `Locked Wrangler failed to start: ${result.stderr}`)
assert.equal(result.stdout.trim(), locked, 'Executed Wrangler must match the authoritative lock')
console.log(`Verified locked Wrangler ${locked} under Node ${process.version}`)
