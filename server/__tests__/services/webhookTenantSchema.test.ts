import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'database/migrations/20260915_webhook_subscriptions.sql'),
  'utf8'
)

describe('webhook tenant schema contract', () => {
  it('uses the same UUID organization type as app_current_org_id()', () => {
    expect(migration).toMatch(/org_id UUID NOT NULL REFERENCES organizations\(id\)/)
    expect(migration).not.toMatch(/org_id TEXT/)
  })

  it('retains RLS and tenant predicates for both reads and writes', () => {
    expect(migration.match(/ENABLE ROW LEVEL SECURITY/g)).toHaveLength(2)
    expect(migration.match(/org_id = app_current_org_id\(\)/g)).toHaveLength(4)
  })
})
