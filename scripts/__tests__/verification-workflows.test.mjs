import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import YAML from 'yamljs'

const root = resolve(import.meta.dirname, '../..')
const workflow = (name) =>
  YAML.parse(readFileSync(resolve(root, '.github/workflows', name), 'utf8'))
const lanes = [
  'main',
  'lane/verify',
  'lane/heal',
  'lane/expand-public-records',
  'lane/evolve-platform'
]

test('every standing-lane PR receives verification and security workflows', () => {
  for (const name of [
    'ci-gate.yml',
    'validate-dependencies.yml',
    'secret-scan.yml',
    'backend-tests.yml',
    'deploy-cloudflare.yml'
  ]) {
    for (const lane of lanes)
      assert.ok(workflow(name).on.pull_request.branches.includes(lane), `${name}: ${lane}`)
  }
})

test('stable pr-gate fails when its upstream gate is not successful', () => {
  const job = workflow('ci-gate.yml').jobs['pr-gate']
  assert.equal(job.if, '${{ always() }}')
  assert.deepEqual(job.needs, ['gate'])
  for (const result of ['success', 'failure', 'cancelled', 'skipped', '']) {
    const run = spawnSync('bash', ['-ec', job.steps[0].run], {
      env: { ...process.env, GATE: result }
    })
    assert.equal(run.status === 0, result === 'success')
  }
})

test('staging acceptance rejects failed or skipped mandatory steps including credential denial', () => {
  const job = workflow('deploy-cloudflare.yml').jobs['deploy-staging']
  const step = job.steps.find(
    (entry) => entry.name === 'Require complete staging deployment acceptance'
  )
  assert.equal(step.if, '${{ always() }}')
  const valid = {
    PROVISION_EXIT: '0',
    PROVISION_READY: 'true',
    CONFIGURATION: 'success',
    MIGRATIONS: 'success',
    SCHEMA: 'success',
    DEPLOY: 'success',
    LIVE: 'success'
  }
  const run = (values) =>
    spawnSync('bash', ['-ec', step.run], { env: { ...process.env, ...values } }).status
  assert.equal(run(valid), 0)
  for (const key of Object.keys(valid)) {
    for (const value of ['', 'failure', 'skipped', 'cancelled']) {
      assert.notEqual(run({ ...valid, [key]: value }), 0, `${key}=${value}`)
    }
  }
  const artifact = job.steps.findIndex(
    (entry) => entry.name === 'Preserve provisioning and deployment evidence'
  )
  assert.ok(artifact < job.steps.indexOf(step))
  assert.equal(job.steps[artifact].if, '${{ !cancelled() }}')
})

test('production promotion is current-main, explicitly provisioned and terminally accepted', () => {
  const job = workflow('deploy-cloudflare.yml').jobs['deploy-production']
  const names = job.steps.map((entry) => entry.name)
  assert.ok(names.includes('Require the current accepted main revision'))
  assert.ok(names.includes('Reconcile the production Pages project prerequisite'))
  assert.ok(names.includes('Provision or reuse isolated production resources'))
  assert.ok(names.includes('Verify exact live production revision and authentication boundary'))
  const resolver = job.steps.find(
    (entry) => entry.name === 'Provision or reuse isolated production resources'
  )
  assert.match(resolver.run, /resolve-cloudflare-production\.py --apply/)
  const terminal = job.steps.find(
    (entry) => entry.name === 'Require complete production promotion acceptance'
  )
  assert.equal(terminal.if, '${{ always() }}')
  const valid = {
    RESOLUTION: 'success',
    CONFIGURATION: 'success',
    MIGRATIONS: 'success',
    SCHEMA: 'success',
    DEPLOY: 'success',
    LIVE: 'success'
  }
  const run = (values) =>
    spawnSync('bash', ['-ec', terminal.run], { env: { ...process.env, ...values } }).status
  assert.equal(run(valid), 0)
  for (const key of Object.keys(valid)) {
    assert.notEqual(run({ ...valid, [key]: 'skipped' }), 0, key)
  }
})

test('backend migration and test failures are unsuppressed', () => {
  const steps = workflow('backend-tests.yml').jobs.test.steps
  assert.equal(
    steps.find((entry) => entry.name === 'Run database migrations').run,
    'npm run migrate'
  )
  const tests = steps.find(
    (entry) => entry.name === 'Run isolated server tests and enforce coverage'
  )
  assert.equal(tests.run, 'npm run test:server:strict -- --run --coverage')
  assert.equal(tests['continue-on-error'], undefined)
})
