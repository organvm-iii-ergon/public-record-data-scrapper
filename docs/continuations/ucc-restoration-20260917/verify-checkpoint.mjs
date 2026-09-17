/** Read-only session-custody predicate. Never establishes product acceptance. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = dirname(fileURLToPath(import.meta.url))
const root = resolve(directory, '../../..')
const capsule = resolve(root, '.limen-workstream')
const run = (binary, args) =>
  execFileSync(binary, args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 30000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
  }).trim()
const read = (name) => readFileSync(resolve(directory, name), 'utf8')
const receipt = JSON.parse(read('workstream.json'))
const identity = JSON.parse(readFileSync(resolve(capsule, 'capsule.identity'), 'utf8'))
const launch = readFileSync(resolve(capsule, 'kickstart.sh'), 'utf8')
const before = run('git', ['status', '--porcelain=v1', '--untracked-files=all'])
assert.equal(before, '', 'checkpoint checkout must be clean')
assert.equal(run('git', ['branch', '--show-current']), receipt.branch)
const head = run('git', ['rev-parse', 'HEAD'])
const remote = run('git', ['ls-remote', '--exit-code', 'origin', `refs/heads/${receipt.branch}`])
assert.equal(remote.split(/\s+/)[0], head, 'exact HEAD must be remotely custodied')
run('git', ['diff', '--check'])
run('bash', ['-n', resolve(capsule, 'kickstart.sh')])
assert.equal(receipt.slug, 'ucc-restoration-20260917')
assert.equal(receipt.workstream, 'ucc-restoration')
const contract = JSON.parse(readFileSync(resolve(capsule, 'workstream.json'), 'utf8'))
assert.deepEqual(receipt.contract, contract)
assert.equal(contract.runway.duration_seconds, 1800)
assert.equal(contract.conductor.provider_and_model, 'provider_neutral')
assert.equal(contract.authorization.sandbox, 'workspace-write')
assert.ok(contract.authorization.retained_gates.includes('credential'))
assert.equal(
  launch.match(/^expected_invocation_sha256=([a-f0-9]{64})$/m)?.[1],
  identity.invocation_sha256
)
const modules = Object.keys(identity.modules)
const beforeHashes = Object.fromEntries(
  modules.map((name) => [name, createHash('sha256').update(readFileSync(resolve(capsule, name))).digest('hex')])
)
assert.deepEqual(beforeHashes, identity.modules)
run('python3', [
  resolve(capsule, 'workstream-contract.py'),
  'verify-identity',
  '--identity', resolve(capsule, 'capsule.identity'),
  '--invocation-sha256', identity.invocation_sha256,
  ...modules.flatMap((name) => ['--module', `${name}=${resolve(capsule, name)}`])
])
const checklist = read('README.md')
assert.equal((checklist.match(/^- \[x\] /gm) ?? []).length, 8)
assert.equal((checklist.match(/^- \[ \] /gm) ?? []).length, 3)
for (const [path, expected] of [
  ['repos/organvm-iii-ergon/public-record-data-scrapper/issues/comments/5713874971', 'https://github.com/organvm-iii-ergon/public-record-data-scrapper/issues/464#issuecomment-5713874971'],
  ['repos/organvm-iii-ergon/public-record-data-scrapper/issues/comments/5713875162', 'https://github.com/organvm-iii-ergon/public-record-data-scrapper/issues/465#issuecomment-5713875162'],
  ['repos/organvm/ops/issues/6', 'https://github.com/organvm/ops/issues/6'],
  ['repos/4444J99/limen/issues/comments/5713875366', 'https://github.com/4444J99/limen/issues/1818#issuecomment-5713875366']
]) assert.equal(run('gh', ['api', path, '--jq', '.html_url']), expected)
assert.equal(run('git', ['status', '--porcelain=v1', '--untracked-files=all']), before)
for (const [name, digest] of Object.entries(beforeHashes)) {
  assert.equal(createHash('sha256').update(readFileSync(resolve(capsule, name))).digest('hex'), digest)
}
console.log('PASS: exact-head remote custody, owner pointers, finite capsule identity and launch syntax; zero tracked/module changes.')
console.log('Scope: session checkpoint only. Provider not launched; restoration acceptance remains unproven.')
