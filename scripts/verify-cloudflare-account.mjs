import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const edgeRequire = createRequire(new URL('../cloudflare/package.json', import.meta.url))
const { unstable_readConfig } = edgeRequire('wrangler')
const configPath = fileURLToPath(new URL('../cloudflare/wrangler.toml', import.meta.url))
const staging = unstable_readConfig({ config: configPath, env: 'staging' }, { hideWarnings: true })
const production = unstable_readConfig(
  { config: configPath, env: 'production' },
  { hideWarnings: true }
)
assert.equal(staging.account_id, 'e0921b840fd656d8ea46426f1f114c30')
assert.equal(
  production.account_id,
  undefined,
  'Production must retain its existing account override'
)
console.log(
  'Locked Wrangler resolves the verified staging account; production targeting is unchanged'
)
