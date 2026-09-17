import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const routePath = resolve(process.cwd(), 'cloudflare/workers/api/src/index.ts')
const source = readFileSync(routePath, 'utf8')
const collectorFactorySource = readFileSync(
  resolve(process.cwd(), 'apps/web/src/lib/collectors/StateCollectorFactory.ts'),
  'utf8'
)

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

  it.each([
    "app.post('/api/webhooks', accessAuth, orgScope, rateLimiter",
    "app.put('/api/webhooks/:id', accessAuth, orgScope, rateLimiter",
    "app.delete('/api/webhooks/:id', accessAuth, orgScope, rateLimiter",
    "app.post('/api/webhooks/:id/test', accessAuth, orgScope, rateLimiter",
    "app.post('/api/webhooks/deliveries/:id/retry', accessAuth, orgScope, rateLimiter",
    "app.post('/api/crm/integrations', accessAuth, orgScope, rateLimiter",
    "app.delete('/api/crm/integrations/:id', accessAuth, orgScope, rateLimiter",
    "app.post('/api/crm/push', accessAuth, orgScope, rateLimiter"
  ])('rate limits externally mutating integration route %s', (registration) => {
    expect(source).toContain(registration)
  })

  it('does not advertise collector fallback methods without builders', () => {
    expect(collectorFactorySource).toContain('accessMethods: [primaryMethod]')
    expect(collectorFactorySource).toContain('activeMethod: primaryMethod')
  })
})
