import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(process.argv[2] ?? 'dist')
const assets = resolve(root, 'assets')
const files = (await readdir(assets)).filter((name) => name.endsWith('.js'))
if (files.length === 0) throw new Error('Tenant dashboard JavaScript bundle is missing')
const source = (
  await Promise.all(files.map((name) => readFile(resolve(assets, name), 'utf8')))
).join('\n')

const required = ['Prospects', 'Portfolio', 'Intelligence', 'Analytics', 'Re-qual', 'Agentic']
for (const label of required) {
  if (!source.includes(label)) throw new Error(`Tenant surface is missing: ${label}`)
}

const forbiddenRoutes = [
  '/deals',
  '/contacts',
  '/communications',
  '/compliance',
  '/partner',
  '/search'
]
for (const route of forbiddenRoutes) {
  if (source.includes(route)) throw new Error(`Unsupported hosted route is bundled: ${route}`)
}

if (!source.includes('/dashboard')) throw new Error('Authoritative dashboard API route is missing')
console.log('Tenant dashboard bundle exposes six authoritative surfaces and no unsupported routes')
