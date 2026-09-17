import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  advisoryDelta,
  auditEntries,
  graphDelta,
  manifestPackagePaths,
  routeExceptions,
  validateManifestLock
} from '../dependency-evidence.mjs'

const lock = (version = '1.0.0', extra = {}) => ({
  lockfileVersion: 3,
  packages: {
    '': { name: 'fixture' },
    'node_modules/example': {
      version,
      resolved: `https://registry.npmjs.org/example/-/example-${version}.tgz`,
      integrity: `sha512-${version}`,
      ...extra
    }
  }
})
const cleanAudit = () => ({ status: 'complete', head: [], introduced: [] })
const audit = (vulnerabilities = {}) => ({
  auditReportVersion: 2,
  vulnerabilities,
  metadata: { vulnerabilities: { total: Object.keys(vulnerabilities).length } }
})
const via = {
  url: 'https://github.com/advisories/GHSA-1234-5678-abcd',
  severity: 'high',
  range: '<1.0.1',
  title: 'fixture'
}

test('records complete version, source, integrity, lifecycle and dependency edge changes', () => {
  const base = lock()
  const head = lock('1.0.1', { hasInstallScript: true, dependencies: { child: '^1.0.0' } })
  head.packages['node_modules/child'] = { version: '1.0.0' }
  const result = graphDelta(base, head, 'package-lock.json')
  assert.equal(result.added.length, 1)
  assert.deepEqual(result.changed[0].fields, [
    'dependencies',
    'hasInstallScript',
    'integrity',
    'resolved',
    'version'
  ])
  assert.deepEqual(result.changed[0].after, head.packages['node_modules/example'])
  assert.equal(graphDelta(head, base, 'package-lock.json').removed.length, 1)
  assert.throws(() => graphDelta({}, head, 'package-lock.json'))
  assert.throws(() =>
    graphDelta(lock(), { ...lock(), packages: { '': {}, bad: null } }, 'package-lock.json')
  )
})

test('routine patch is eligible for delegated review but changed script or source is an exception', () => {
  const check = (head, sensitive = []) =>
    routeExceptions(
      graphDelta(lock(), head, 'package-lock.json'),
      cleanAudit(),
      ['package-lock.json'],
      ['package-lock.json'],
      sensitive
    )
  assert.deepEqual(check(lock('1.0.1')), [])
  assert.ok(
    check(lock('1.0.1', { hasInstallScript: true })).some((item) =>
      item.startsWith('runtime-or-install-metadata')
    )
  )
  assert.ok(
    check(lock('1.0.0', { integrity: 'sha512-substituted' })).some((item) =>
      item.startsWith('same-version-source-change')
    )
  )
  assert.ok(
    check(lock('1.0.1', { resolved: 'https://unusual.example/package.tgz' })).some((item) =>
      item.startsWith('nonstandard-source')
    )
  )
  assert.ok(check(lock('1.0.1'), ['example']).includes('behavior-sensitive:example'))
  assert.ok(check(lock('2.0.0')).includes('non-routine-version:example'))
  assert.ok(check(lock('1.0.1-rc.1')).includes('non-routine-version:example'))
  assert.ok(
    routeExceptions(
      graphDelta(lock('0.1.0'), lock('0.2.0'), 'package-lock.json'),
      cleanAudit(),
      [],
      []
    ).includes('non-routine-version:example')
  )
})

test('audit errors and malformed successful-looking payloads cannot establish closure', () => {
  for (const bad of [
    {},
    { error: { code: 'ENOTFOUND' } },
    { ...audit(), error: 'registry denied' },
    audit({ pkg: { via: [{}] } }),
    { ...audit(), metadata: { vulnerabilities: { total: 1 } } }
  ])
    assert.throws(() => auditEntries(bad, 'package-lock.json'))
  assert.deepEqual(auditEntries(audit(), 'package-lock.json'), [])
})

test('advisory closure is keyed by package, lock, advisory and range', () => {
  const base = auditEntries(audit({ example: { via: [via] } }), 'package-lock.json')
  assert.deepEqual(advisoryDelta(base, []).resolved, base)
  assert.deepEqual(advisoryDelta(base, base).remaining, base)
  assert.deepEqual(advisoryDelta([], base).introduced, base)
  const cloud = auditEntries(audit({ example: { via: [via] } }), 'cloudflare/package-lock.json')
  assert.equal(advisoryDelta(base, cloud).introduced.length, 1)
})

test('unavailable evidence, remaining severe advisories and nondependency changes route exceptions', () => {
  const graph = graphDelta(lock(), lock('1.0.1'), 'package-lock.json')
  assert.ok(
    routeExceptions(graph, { ...cleanAudit(), status: 'unavailable' }, [], []).includes(
      'advisory-evidence-unavailable'
    )
  )
  assert.ok(
    routeExceptions(graph, { ...cleanAudit(), head: [via] }, [], []).includes(
      'high-or-critical-advisories-remain'
    )
  )
  assert.ok(
    routeExceptions(
      graph,
      cleanAudit(),
      ['.github/workflows/ci.yml'],
      ['package-lock.json']
    ).includes('non-dependency-files-changed')
  )
})

test('incomplete, dangling and circular advisory inventories fail closed', () => {
  for (const bad of [
    audit({ example: { via: [via] }, missing: { via: ['absent'] } }),
    audit({ example: { via: [via] }, a: { via: ['b'] }, b: { via: ['a'] } }),
    audit({ example: { via: [via] }, empty: { via: [] } })
  ])
    assert.throws(() => auditEntries(bad, 'package-lock.json'))
  const report = audit({ example: { via: [via] }, indirect: { via: ['example'] } })
  assert.equal(auditEntries(report, 'package-lock.json').length, 1)
  assert.throws(() =>
    auditEntries({ ...report, metadata: { vulnerabilities: { total: 3 } } }, 'package-lock.json')
  )
})

test('root-only lock edits and direct range widening cannot route as routine', () => {
  const base = lock('1.0.1')
  base.packages[''].dependencies = { example: '^1.0.1' }
  for (const spec of ['*', 'latest', '>=1.0.1', '~1.0.1', '^0.9.0']) {
    const head = structuredClone(base)
    head.packages[''].dependencies.example = spec
    const reasons = routeExceptions(
      graphDelta(base, head, 'package-lock.json'),
      cleanAudit(),
      [],
      []
    )
    assert.ok(reasons.includes('non-routine-direct-spec:example'))
    assert.ok(reasons.includes('no-dependency-graph-change'))
  }
  const head = lock('1.0.2')
  head.packages[''].dependencies = { example: '^1.0.2' }
  assert.deepEqual(
    routeExceptions(graphDelta(base, head, 'package-lock.json'), cleanAudit(), [], []),
    []
  )
})

test('manifest range drift cannot hide behind a frozen-install-compatible lock', () => {
  const head = lock('1.0.2')
  head.packages[''].dependencies = { example: '^1.0.2', unchanged: '^4.1.3' }
  assert.doesNotThrow(() =>
    validateManifestLock(
      { dependencies: head.packages[''].dependencies },
      head,
      'package-lock.json'
    )
  )
  assert.throws(
    () =>
      validateManifestLock(
        { dependencies: { example: '^1.0.2', unchanged: '*' } },
        head,
        'package-lock.json'
      ),
    /manifest and lock root disagree/
  )
  assert.throws(
    () =>
      validateManifestLock(
        { dependencies: head.packages[''].dependencies, optionalDependencies: { hidden: '*' } },
        head,
        'package-lock.json'
      ),
    /optionalDependencies/
  )
})

test('all remaining advisory severities route an exception', () => {
  const graph = graphDelta(lock(), lock('1.0.1'), 'package-lock.json')
  for (const severity of ['info', 'low', 'moderate', 'high', 'critical']) {
    const reasons = routeExceptions(
      graph,
      { ...cleanAudit(), head: [{ ...via, severity }] },
      [],
      []
    )
    assert.ok(reasons.includes('advisories-remain'))
  }
})

test('workspace manifests are eligible only with matching declarations and routine ranges', () => {
  const base = lock()
  base.packages['apps/web'] = { name: 'web', dependencies: { example: '^1.0.0' } }
  const head = lock('1.0.1')
  head.packages['apps/web'] = { name: 'web', dependencies: { example: '^1.0.1' } }
  assert.deepEqual(manifestPackagePaths(head), ['', 'apps/web'])
  const files = ['apps/web/package.json', 'package-lock.json']
  const allowed = [
    'package-lock.json',
    ...manifestPackagePaths(head).map((path) => (path ? `${path}/package.json` : 'package.json'))
  ]
  assert.deepEqual(
    routeExceptions(graphDelta(base, head, 'package-lock.json'), cleanAudit(), files, allowed),
    []
  )
  validateManifestLock(
    { dependencies: { example: '^1.0.1' } },
    head,
    'package-lock.json',
    'apps/web'
  )
  assert.throws(() =>
    validateManifestLock({ dependencies: { example: '*' } }, head, 'package-lock.json', 'apps/web')
  )
  head.packages['apps/web'].dependencies.example = '*'
  assert.ok(
    routeExceptions(
      graphDelta(base, head, 'package-lock.json'),
      cleanAudit(),
      files,
      allowed
    ).includes('non-routine-direct-spec:example')
  )
  for (const path of ['../outside', '/absolute', 'apps/../../outside', 'apps\\outside']) {
    assert.throws(() => manifestPackagePaths({ packages: { [path]: {} } }))
  }
})

test('collector binds file and dependency deltas to the tested merge tree', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dependency-merge-test-'))
  const script = resolve('scripts/dependency-evidence.mjs')
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim()
  try {
    git('init', '-q', '-b', 'main')
    git('config', 'user.name', 'Fixture')
    git('config', 'user.email', 'fixture@example.invalid')
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'fixture' }))
    writeFileSync(join(dir, 'package-lock.json'), JSON.stringify(lock()))
    git('add', '.')
    git('commit', '-qm', 'base')
    const base = git('rev-parse', 'HEAD')
    git('switch', '-qc', 'candidate')
    writeFileSync(join(dir, 'package-lock.json'), JSON.stringify(lock('1.0.1')))
    git('commit', '-qam', 'dependency patch')
    const head = git('rev-parse', 'HEAD')
    git('switch', '-q', 'main')
    git('merge', '--no-ff', '--no-commit', 'candidate')
    writeFileSync(join(dir, 'resolution-only.txt'), 'merge tree behavior')
    git('add', 'resolution-only.txt')
    git('commit', '-qm', 'tested merge')
    const tested = git('rev-parse', 'HEAD')
    mkdirSync(join(dir, 'bin'))
    writeFileSync(
      join(dir, 'bin/npm'),
      `#!/bin/sh\nif [ "$1" = --version ]; then echo 11.9.0; else echo '{"auditReportVersion":2,"vulnerabilities":{},"metadata":{"vulnerabilities":{"total":0}}}'; fi\n`,
      { mode: 0o755 }
    )
    const output = join(dir, 'evidence.json')
    const run = spawnSync(
      process.execPath,
      [script, '--base', base, '--head', head, '--tested', tested, '--out', output],
      {
        cwd: dir,
        encoding: 'utf8',
        env: { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}` }
      }
    )
    assert.equal(run.status, 0, run.stderr)
    const receipt = JSON.parse(readFileSync(output, 'utf8'))
    assert.equal(receipt.head_sha, head)
    assert.equal(receipt.tested_sha, tested)
    assert.equal(receipt.dependency_revision_sha, tested)
    assert.equal(receipt.graph.changed[0].after.version, '1.0.1')
    assert.ok(receipt.exceptions.includes('non-dependency-files-changed'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
