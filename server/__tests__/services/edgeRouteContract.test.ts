import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const routePath = resolve(process.cwd(), 'cloudflare/workers/api/src/index.ts')
const source = readFileSync(routePath, 'utf8')

describe('edge route registration regression guards', () => {
  it('registers delivery listing before the generic endpoint lookup', () => {
    const listing = source.indexOf("app.get('/api/webhooks/deliveries',")
    const endpoint = source.indexOf("app.get('/api/webhooks/:id',")
    expect(listing).toBeGreaterThanOrEqual(0)
    expect(endpoint).toBeGreaterThan(listing)
  })

  it.each(['prospects', 'jobs', 'enrichment', 'keys'])(
    'registers the %s authentication/quota chain only once',
    (resource) => {
      expect(source.split(`v1.use('/${resource}/*', unifiedAuth, rateLimiter)`)).toHaveLength(2)
      expect(source).not.toContain(`v1.use('/${resource}', unifiedAuth, rateLimiter)`)
    }
  )
})
