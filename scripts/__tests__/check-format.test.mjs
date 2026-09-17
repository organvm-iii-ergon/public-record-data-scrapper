import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

test('format gate rejects changed application code outside maintenance files', () => {
  const directory = mkdtempSync(join(tmpdir(), 'format-gate-test-'))
  const script = resolve('scripts/check-format.mjs')
  const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim()
  try {
    git('init', '-q', '-b', 'main')
    git('config', 'user.name', 'Fixture')
    git('config', 'user.email', 'fixture@example.invalid')
    writeFileSync(join(directory, '.prettierrc'), '{"semi":false,"singleQuote":true}\n')
    git('add', '.')
    git('commit', '-qm', 'base')
    const base = git('rev-parse', 'HEAD')
    const filename = 'application with spaces.tsx'
    writeFileSync(join(directory, filename), 'export const Hello=()=>{return <div>Hello</div>};')
    git('add', '.')
    git('commit', '-qm', 'bad application formatting')
    const check = () =>
      spawnSync(process.execPath, [script, base], { cwd: directory, encoding: 'utf8' })
    const rejected = check()
    assert.equal(rejected.status, 1)
    assert.match(rejected.stderr, /application with spaces.tsx/)
    writeFileSync(
      join(directory, filename),
      'export const Hello = () => {\n  return <div>Hello</div>\n}\n'
    )
    git('commit', '-qam', 'repair formatting')
    assert.equal(check().status, 0)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
