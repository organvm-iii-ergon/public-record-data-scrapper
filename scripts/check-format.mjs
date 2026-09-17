#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import * as prettier from 'prettier'

// Check every supported changed file, including source, tests and documentation.
// NUL-delimited paths and direct API calls keep unusual filenames out of a shell.
const base = process.argv[2]
if (!/^[a-f0-9]{40}$/.test(base ?? '') || /^0+$/.test(base)) {
  throw new Error('Formatting requires the exact base commit SHA')
}
const files = execFileSync(
  'git',
  ['diff', '--name-only', '--diff-filter=ACMR', '-z', base, 'HEAD'],
  {
    encoding: 'utf8'
  }
)
  .split('\0')
  .filter(Boolean)
let checked = 0
for (const file of files) {
  const info = await prettier.getFileInfo(file)
  if (info.ignored || !info.inferredParser) continue
  const options = (await prettier.resolveConfig(file)) ?? {}
  const valid = await prettier.check(await readFile(file, 'utf8'), { ...options, filepath: file })
  checked += 1
  if (!valid) {
    console.error(`Formatting differs: ${JSON.stringify(file)}`)
    process.exitCode = 1
  }
}
console.log(`Checked formatting for ${checked} changed files`)
