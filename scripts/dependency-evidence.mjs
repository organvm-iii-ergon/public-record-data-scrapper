#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const sha256 = (text) => createHash('sha256').update(text).digest('hex')
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonical(value[key])])
  )
}
const equal = (left, right) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right))

export function graphDelta(base, head, lockfile) {
  for (const lock of [base, head]) {
    if (
      lock.lockfileVersion !== 3 ||
      !lock.packages ||
      Array.isArray(lock.packages) ||
      !lock.packages['']
    )
      throw new Error(`${lockfile}: expected npm lockfile v3 with a root package`)
    for (const entry of Object.values(lock.packages)) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry))
        throw new Error(`${lockfile}: malformed package entry`)
    }
  }
  const result = { added: [], removed: [], changed: [] }
  for (const path of [
    ...new Set([...Object.keys(base.packages), ...Object.keys(head.packages)])
  ].sort()) {
    const before = base.packages[path]
    const after = head.packages[path]
    const name = path.includes('node_modules/')
      ? path.split('node_modules/').at(-1)
      : (after?.name ?? before?.name ?? path)
    if (!before) result.added.push({ lockfile, path, name, entry: after })
    else if (!after) result.removed.push({ lockfile, path, name, entry: before })
    else if (!equal(before, after))
      result.changed.push({
        lockfile,
        path,
        name,
        before,
        after,
        fields: [...new Set([...Object.keys(before), ...Object.keys(after)])]
          .filter((key) => !equal(before[key], after[key]))
          .sort()
      })
  }
  return result
}

export function manifestPackagePaths(lock) {
  return Object.keys(lock.packages ?? {}).filter((path) => {
    if (path.includes('node_modules/')) return false
    if (path.startsWith('/') || path.includes('\\') || path.split('/').includes('..'))
      throw new Error('Workspace path must remain repository-relative')
    return true
  })
}

export function validateManifestLock(manifest, lock, lockfile, packagePath = '') {
  for (const field of [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies'
  ]) {
    if (!equal(manifest[field] ?? {}, lock.packages?.[packagePath]?.[field] ?? {}))
      throw new Error(`${lockfile}: manifest and lock root disagree on ${field}`)
  }
}

export function auditEntries(report, lockfile) {
  if (
    report?.error ||
    report?.auditReportVersion !== 2 ||
    !report.vulnerabilities ||
    typeof report.vulnerabilities !== 'object' ||
    Array.isArray(report.vulnerabilities) ||
    !Number.isInteger(report.metadata?.vulnerabilities?.total)
  ) {
    throw new Error(`${lockfile}: unavailable or malformed npm audit response`)
  }
  if (report.metadata.vulnerabilities.total !== Object.keys(report.vulnerabilities).length)
    throw new Error(`${lockfile}: incomplete vulnerability inventory`)
  const reachesAdvisory = (name, seen = new Set()) => {
    if (seen.has(name)) return false
    const vulnerability = report.vulnerabilities[name]
    if (!vulnerability || !Array.isArray(vulnerability.via)) return false
    const next = new Set([...seen, name])
    return vulnerability.via.some(
      (via) =>
        (typeof via === 'object' && via !== null) ||
        (typeof via === 'string' && reachesAdvisory(via, next))
    )
  }
  for (const name of Object.keys(report.vulnerabilities)) {
    if (!reachesAdvisory(name))
      throw new Error(`${lockfile}: advisory chain has no concrete evidence for ${name}`)
  }
  const entries = new Map()
  for (const [pkg, vulnerability] of Object.entries(report.vulnerabilities)) {
    if (!Array.isArray(vulnerability.via))
      throw new Error(`${lockfile}: malformed advisory for ${pkg}`)
    for (const via of vulnerability.via) {
      if (typeof via === 'string') {
        if (!Object.hasOwn(report.vulnerabilities, via))
          throw new Error(`${lockfile}: dangling advisory reference ${via}`)
        continue // The referenced package has its own concrete advisory.
      }
      if (
        !via ||
        typeof via.url !== 'string' ||
        !via.url.startsWith('https://') ||
        !['info', 'low', 'moderate', 'high', 'critical'].includes(via.severity) ||
        typeof via.range !== 'string'
      )
        throw new Error(`${lockfile}: incomplete advisory for ${pkg}`)
      const entry = {
        lockfile,
        package: pkg,
        id: via.url,
        severity: via.severity,
        range: via.range,
        title: via.title ?? ''
      }
      entries.set(advisoryKey(entry), entry)
    }
  }
  if (report.metadata.vulnerabilities.total > 0 && entries.size === 0)
    throw new Error(`${lockfile}: audit reported vulnerabilities without concrete advisories`)
  return [...entries.values()].sort((a, b) => advisoryKey(a).localeCompare(advisoryKey(b)))
}
const advisoryKey = (entry) =>
  JSON.stringify([entry.lockfile, entry.package, entry.id, entry.range])
export function advisoryDelta(base, head) {
  const oldKeys = new Set(base.map(advisoryKey))
  const newKeys = new Set(head.map(advisoryKey))
  return {
    introduced: head.filter((entry) => !oldKeys.has(advisoryKey(entry))),
    resolved: base.filter((entry) => !newKeys.has(advisoryKey(entry))),
    remaining: head.filter((entry) => oldKeys.has(advisoryKey(entry)))
  }
}

export function routeExceptions(graph, advisories, files, allowedFiles, sensitive = []) {
  const exceptions = []
  if (advisories.status !== 'complete') exceptions.push('advisory-evidence-unavailable')
  if (advisories.head.length) exceptions.push('advisories-remain')
  if (advisories.head.some((entry) => ['high', 'critical'].includes(entry.severity)))
    exceptions.push('high-or-critical-advisories-remain')
  if (advisories.introduced.length) exceptions.push('new-advisories')
  if (files.some((file) => !allowedFiles.includes(file)))
    exceptions.push('non-dependency-files-changed')
  if (graph.added.length || graph.removed.length)
    exceptions.push('dependency-graph-additions-or-removals')
  if (
    !graph.added.length &&
    !graph.removed.length &&
    !graph.changed.some((change) => change.path.includes('node_modules/'))
  )
    exceptions.push('no-dependency-graph-change')
  for (const change of graph.changed) {
    if (!change.path.includes('node_modules/')) {
      if (
        change.fields.some(
          (field) =>
            ![
              'dependencies',
              'devDependencies',
              'optionalDependencies',
              'peerDependencies'
            ].includes(field)
        )
      )
        exceptions.push(`workspace-or-root-lock-metadata:${change.path}`)
      for (const field of [
        'dependencies',
        'devDependencies',
        'optionalDependencies',
        'peerDependencies'
      ]) {
        for (const [name, spec] of Object.entries(change.after[field] ?? {})) {
          const previous = change.before[field]?.[name]
          if (previous === spec) continue
          const oldSpec = /^([~^]?)(\d+)\.(\d+)\.(\d+)$/.exec(previous ?? '')
          const newSpec = /^([~^]?)(\d+)\.(\d+)\.(\d+)$/.exec(spec)
          if (
            !oldSpec ||
            !newSpec ||
            oldSpec[1] !== newSpec[1] ||
            oldSpec[2] !== newSpec[2] ||
            (oldSpec[2] === '0' && oldSpec[3] !== newSpec[3]) ||
            Number(newSpec[3]) < Number(oldSpec[3]) ||
            (newSpec[3] === oldSpec[3] && Number(newSpec[4]) < Number(oldSpec[4]))
          )
            exceptions.push(`non-routine-direct-spec:${name}`)
        }
      }
      continue
    }
    if (
      sensitive.some(
        (name) =>
          change.name === name || (name.endsWith('*') && change.name.startsWith(name.slice(0, -1)))
      )
    )
      exceptions.push(`behavior-sensitive:${change.name}`)
    const from = /^(\d+)\.(\d+)\.(\d+)$/.exec(change.before.version ?? '')
    const to = /^(\d+)\.(\d+)\.(\d+)$/.exec(change.after.version ?? '')
    if (
      !from ||
      !to ||
      from[1] !== to[1] ||
      (from[1] === '0' && from[2] !== to[2]) ||
      (to &&
        from &&
        (Number(to[2]) < Number(from[2]) || (to[2] === from[2] && Number(to[3]) < Number(from[3]))))
    )
      exceptions.push(`non-routine-version:${change.name}`)
    if (
      change.fields.some((field) =>
        ['hasInstallScript', 'bin', 'engines', 'os', 'cpu', 'link'].includes(field)
      )
    )
      exceptions.push(`runtime-or-install-metadata:${change.name}`)
    if (
      change.before.version === change.after.version &&
      change.fields.some((field) => ['integrity', 'resolved'].includes(field))
    )
      exceptions.push(`same-version-source-change:${change.name}`)
    for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
      if (
        !equal(
          Object.keys(change.before[field] ?? {}).sort(),
          Object.keys(change.after[field] ?? {}).sort()
        )
      )
        exceptions.push(`dependency-edge-additions-or-removals:${change.name}`)
    }
    for (const entry of [change.before, change.after]) {
      if (entry.resolved && !entry.resolved.startsWith('https://registry.npmjs.org/'))
        exceptions.push(`nonstandard-source:${change.name}`)
    }
  }
  return [...new Set(exceptions)].sort()
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trimEnd()
}
function options(args) {
  const result = { lock: [], sensitive: [] }
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, '')
    if (!['lock', 'sensitive', 'base', 'head', 'tested', 'out'].includes(key) || !args[i + 1])
      throw new Error('Unknown or incomplete dependency-evidence option')
    if (Array.isArray(result[key])) result[key].push(args[i + 1])
    else result[key] = args[i + 1]
  }
  return result
}
function auditAt(revision, lockfile, outputDir, label) {
  const directory = mkdtempSync(join(tmpdir(), 'dependency-audit-'))
  try {
    for (const file of [lockfile, join(dirname(lockfile), 'package.json')])
      writeFileSync(
        join(directory, basename(file)),
        execFileSync('git', ['show', `${revision}:${file}`], { maxBuffer: 32 * 1024 * 1024 })
      )
    const result = spawnSync(
      'npm',
      ['audit', '--package-lock-only', '--ignore-scripts', '--json'],
      {
        cwd: directory,
        encoding: 'utf8',
        timeout: 120000,
        maxBuffer: 32 * 1024 * 1024,
        env: {
          ...process.env,
          NPM_CONFIG_REGISTRY: 'https://registry.npmjs.org/',
          NPM_CONFIG_OMIT: '',
          NPM_CONFIG_INCLUDE: 'dev'
        }
      }
    )
    writeFileSync(
      join(outputDir, `audit-${label}-${lockfile.replaceAll('/', '_')}`),
      result.stdout || '{}'
    )
    if (result.error || ![0, 1].includes(result.status))
      throw new Error(`npm audit failed: ${result.error?.message ?? result.status}`)
    return auditEntries(JSON.parse(result.stdout), lockfile)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

export function collect(args) {
  const config = options(args)
  for (const key of ['base', 'head', 'tested']) {
    if (!/^[a-f0-9]{40}$/.test(config[key] ?? ''))
      throw new Error(`${key} must be an exact 40-character commit SHA`)
    if (git('rev-parse', `${config[key]}^{commit}`) !== config[key])
      throw new Error(`${key} is not a commit`)
  }
  if (git('rev-parse', 'HEAD') !== config.tested)
    throw new Error('Tested SHA differs from actual checkout')
  const locks = config.lock.length ? config.lock : ['package-lock.json']
  const out = resolve(config.out ?? '.quality/dependency-evidence/dependency-evidence.json')
  mkdirSync(dirname(out), { recursive: true })
  const evidence = {
    schema: 'organvm.dependency-evidence.v1',
    repository: process.env.GITHUB_REPOSITORY ?? '',
    base_sha: config.base,
    head_sha: config.head,
    tested_sha: config.tested,
    dependency_revision_sha: config.tested,
    workflow_sha: process.env.GITHUB_WORKFLOW_SHA ?? '',
    workflow_path: process.env.DEPENDENCY_WORKFLOW_PATH ?? '.github/workflows/ci.yml',
    run_id: process.env.GITHUB_RUN_ID ?? '',
    run_attempt: process.env.GITHUB_RUN_ATTEMPT ?? '',
    generated_at: new Date().toISOString(),
    package_manager: `npm@${execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim()}`,
    lockfile_sha256: {},
    graph: { added: [], removed: [], changed: [] },
    advisories: {
      status: 'complete',
      base: [],
      head: [],
      introduced: [],
      resolved: [],
      remaining: [],
      errors: []
    },
    exceptions: [],
    route: 'exception'
  }
  const allowed = []
  for (const lock of locks) {
    if (
      lock.startsWith('/') ||
      lock.split('/').includes('..') ||
      basename(lock) !== 'package-lock.json'
    )
      throw new Error('Lock path must be a repository-relative package-lock.json')
    const current = execFileSync('git', ['show', `${config.tested}:${lock}`], {
      maxBuffer: 32 * 1024 * 1024
    })
    if (sha256(readFileSync(lock)) !== sha256(current))
      throw new Error(`${lock}: checkout changed after tested revision`)
    evidence.lockfile_sha256[lock] = sha256(current)
    const baseLock = JSON.parse(git('show', `${config.base}:${lock}`))
    const testedLock = JSON.parse(current)
    allowed.push(lock)
    for (const packagePath of manifestPackagePaths(testedLock)) {
      const manifestPath = join(dirname(lock), packagePath, 'package.json')
      allowed.push(manifestPath)
      const manifestAfter = JSON.parse(git('show', `${config.tested}:${manifestPath}`))
      validateManifestLock(manifestAfter, testedLock, lock, packagePath)
      if (!equal(JSON.parse(readFileSync(manifestPath, 'utf8')), manifestAfter))
        throw new Error(`${manifestPath}: manifest changed after tested revision`)
      if (!Object.hasOwn(baseLock.packages, packagePath)) {
        evidence.exceptions.push(`workspace-added:${manifestPath}`)
        continue
      }
      const manifestBefore = JSON.parse(git('show', `${config.base}:${manifestPath}`))
      const dependencyFields = [
        'dependencies',
        'devDependencies',
        'optionalDependencies',
        'peerDependencies'
      ]
      const behavior = (manifest) =>
        Object.fromEntries(
          Object.entries(manifest).filter(([key]) => !dependencyFields.includes(key))
        )
      if (!equal(behavior(manifestBefore), behavior(manifestAfter)))
        evidence.exceptions.push(`manifest-behavior-change:${manifestPath}`)
      for (const field of dependencyFields) {
        if (
          !equal(
            Object.keys(manifestBefore[field] ?? {}).sort(),
            Object.keys(manifestAfter[field] ?? {}).sort()
          )
        )
          evidence.exceptions.push(`direct-dependency-additions-or-removals:${manifestPath}`)
      }
    }
    const delta = graphDelta(
      JSON.parse(git('show', `${config.base}:${lock}`)),
      JSON.parse(current),
      lock
    )
    for (const key of ['added', 'removed', 'changed']) evidence.graph[key].push(...delta[key])
    for (const [label, revision] of [
      ['base', config.base],
      ['head', config.tested]
    ]) {
      try {
        evidence.advisories[label].push(...auditAt(revision, lock, dirname(out), label))
      } catch (error) {
        evidence.advisories.status = 'unavailable'
        evidence.advisories.errors.push({ lockfile: lock, revision, message: error.message })
      }
    }
  }
  // Never call missing audit data a closed advisory.
  if (evidence.advisories.status === 'complete')
    Object.assign(
      evidence.advisories,
      advisoryDelta(evidence.advisories.base, evidence.advisories.head)
    )
  // Graph, declarations, advisories and file scope all describe the tested merge tree.
  // head_sha separately identifies the PR source revision; it is not the dependency snapshot.
  const files = git('diff', '--name-only', '-z', config.base, config.tested)
    .split('\0')
    .filter(Boolean)
  evidence.exceptions.push(
    ...routeExceptions(evidence.graph, evidence.advisories, files, allowed, config.sensitive)
  )
  evidence.route = evidence.exceptions.length ? 'exception' : 'delegated-review'
  writeFileSync(out, `${JSON.stringify(evidence, null, 2)}\n`)
  console.log(
    JSON.stringify({
      out,
      route: evidence.route,
      exceptions: evidence.exceptions,
      advisory_status: evidence.advisories.status,
      resolved: evidence.advisories.resolved.length,
      introduced: evidence.advisories.introduced.length
    })
  )
  return evidence.advisories.status !== 'complete' ||
    evidence.advisories.introduced.some((entry) => ['high', 'critical'].includes(entry.severity))
    ? 1
    : 0
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = collect(process.argv.slice(2))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
