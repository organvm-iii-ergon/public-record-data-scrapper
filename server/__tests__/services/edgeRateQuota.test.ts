import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { admitQuota, type QuotaDatabase } from '../../../cloudflare/workers/api/src/atomicQuota'

let sqlite: DatabaseSync
let db: QuotaDatabase

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec(
    readFileSync(
      resolve(process.cwd(), 'cloudflare/migrations/0006_rate_limit_counters.sql'),
      'utf8'
    )
  )
  db = {
    prepare: (sql) => ({
      bind: (...values) => ({
        first: async <T>() =>
          (sqlite.prepare(sql).get(...(values as Array<string | number>)) ?? null) as T | null
      })
    })
  }
})

afterEach(() => sqlite.close())

describe('atomic edge quota admission', () => {
  it('admits exactly ten requests from a hundred-request burst', async () => {
    const results = await Promise.all(
      Array.from({ length: 100 }, () => admitQuota(db, 'key:a', 100, 10))
    )
    expect(results.filter((result) => result.allowed)).toHaveLength(10)
    expect(sqlite.prepare('SELECT request_count FROM rate_limit_counters').get()?.request_count).toBe(
      10
    )
  })

  it('isolates credentials and resets only when the window advances', async () => {
    expect(await admitQuota(db, 'key:a', 100, 10)).toEqual({ allowed: true, remaining: 9 })
    expect(await admitQuota(db, 'key:b', 100, 10)).toEqual({ allowed: true, remaining: 9 })
    expect(await admitQuota(db, 'key:a', 101, 10)).toEqual({ allowed: true, remaining: 9 })
    expect(await admitQuota(db, 'key:a', 100, 10)).toEqual({ allowed: false, remaining: 0 })
    expect(sqlite.prepare('SELECT COUNT(*) n FROM rate_limit_counters').get()?.n).toBe(2)
  })

  it('honors a reduced limit without incrementing an exhausted bucket', async () => {
    await admitQuota(db, 'key:a', 100, 10)
    await admitQuota(db, 'key:a', 100, 10)
    expect(await admitQuota(db, 'key:a', 100, 1)).toEqual({ allowed: false, remaining: 0 })
    expect(sqlite.prepare('SELECT request_count FROM rate_limit_counters').get()?.request_count).toBe(
      2
    )
  })

  it('rejects unavailable or malformed counter evidence rather than granting access', async () => {
    const failed: QuotaDatabase = {
      prepare: () => {
        throw new Error('database unavailable')
      }
    }
    await expect(admitQuota(failed, 'key:a', 100, 10)).rejects.toThrow('database unavailable')
    const malformed: QuotaDatabase = {
      prepare: () => ({ bind: () => ({ first: async <T>() => ({ request_count: NaN }) as T }) })
    }
    await expect(admitQuota(malformed, 'key:a', 100, 10)).rejects.toThrow('counter result')
  })

  it('rejects invalid admission parameters', async () => {
    await expect(admitQuota(db, '', 100, 10)).rejects.toThrow('parameters')
    await expect(admitQuota(db, 'key:a', NaN, 10)).rejects.toThrow('parameters')
    await expect(admitQuota(db, 'key:a', -1, 10)).rejects.toThrow('parameters')
    await expect(admitQuota(db, 'key:a', 100, 0)).rejects.toThrow('parameters')
  })
})
