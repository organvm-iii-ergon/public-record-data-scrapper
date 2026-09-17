import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchDashboard } from '../dashboard'

afterEach(() => vi.unstubAllGlobals())

function response(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })
}

describe('dashboard tenant snapshot', () => {
  it('requests one same-origin authenticated surface and preserves all collections', async () => {
    const fetch = vi.fn().mockResolvedValue(
      response({
        prospects: [{ id: 'p1' }],
        competitors: [],
        portfolio: [],
        userActions: [],
        dataTier: 'paid'
      })
    )
    vi.stubGlobal('fetch', fetch)
    const snapshot = await fetchDashboard()
    expect(snapshot.prospects).toEqual([{ id: 'p1' }])
    expect(snapshot.dataTier).toBe('paid')
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch.mock.calls[0][0]).toBe('/api/dashboard')
  })

  it.each([
    null,
    { prospects: {}, competitors: [], portfolio: [], userActions: [], dataTier: 'oss' },
    { prospects: [], competitors: [], portfolio: [], userActions: ['invalid'], dataTier: 'oss' },
    { prospects: [], competitors: [], portfolio: [], userActions: [], dataTier: 'enterprise' }
  ])('rejects malformed successful snapshots: %j', async (body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(body)))
    await expect(fetchDashboard()).rejects.toThrow(/invalid/i)
  })
})
