import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export function validateMigrationVersions(files) {
  const versions = new Map()
  for (const file of files.filter((name) => name.endsWith('.sql') && !name.endsWith('_down.sql'))) {
    const match = /^(\d+)_.+\.sql$/.exec(file)
    if (!match) throw new Error(`Invalid migration filename: ${file}`)
    const version = BigInt(match[1]).toString()
    if (versions.has(version)) {
      throw new Error(`Duplicate migration version: ${versions.get(version)} and ${file}`)
    }
    versions.set(version, file)
  }
  return versions
}

export function checkMigrations(root = resolve(import.meta.dirname, '..')) {
  for (const directory of ['database/migrations', 'cloudflare/migrations']) {
    validateMigrationVersions(readdirSync(resolve(root, directory)))
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  checkMigrations()
  console.log('Migration versions are unique in both stores')
}
