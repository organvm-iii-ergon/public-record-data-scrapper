import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OSHASource } from '@public-records/core/enrichment'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('OSHASource', () => {
  it('fails clearly when the upstream returns HTML with HTTP 200', async () => {
    vi.useFakeTimers()

    fetchMock.mockResolvedValue({
      ok: true,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/html' }),
      json: vi.fn()
    })

    const source = new OSHASource()
    const { retryAttempts, retryDelay } = source.getConfig()
    const totalRetryBackoffMs = Array.from(
      { length: Math.max(retryAttempts - 1, 0) },
      (_, attempt) => retryDelay * Math.pow(2, attempt)
    ).reduce((sum, delay) => sum + delay, 0)

    const resultPromise = source.fetchData({ companyName: 'Acme Co' })

    await vi.advanceTimersByTimeAsync(totalRetryBackoffMs + 100)

    const result = await resultPromise

    expect(result.success).toBe(false)
    expect(result.source).toBe('osha')
    expect(result.error).toContain('Non-JSON response from osha')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('accepts vendor JSON content types', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/problem+json; charset=utf-8' }),
      json: vi
        .fn()
        .mockResolvedValue([{ total_current_penalty: 1250 }, { total_current_penalty: 750 }])
    })

    const result = await new OSHASource().fetchData({ companyName: 'Acme Co' })

    expect(result.success).toBe(true)
    expect(result.data).toMatchObject({
      violations: 2,
      totalPenalties: 2000,
      companyName: 'Acme Co'
    })
  })
})
