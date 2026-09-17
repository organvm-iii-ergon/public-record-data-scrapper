import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CircuitBreaker,
  CircuitBreakerError,
  executeWithFallback
} from '../../utils/circuitBreaker'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(1000)
})
afterEach(() => vi.useRealTimers())
const failing = () => Promise.reject(new Error('provider unavailable'))

describe('outage containment and recovery', () => {
  it('opens after consecutive failures, rejects without calling the provider, and recovers after two probes', async () => {
    const breaker = new CircuitBreaker({
      name: 'test',
      failureThreshold: 2,
      resetTimeout: 100,
      successThreshold: 2
    })
    await expect(breaker.execute(failing)).rejects.toThrow('provider unavailable')
    expect(breaker.getState()).toBe('CLOSED')
    await expect(breaker.execute(failing)).rejects.toThrow('provider unavailable')
    expect(breaker.getStats()).toEqual({
      state: 'OPEN',
      failureCount: 2,
      successCount: 0,
      lastFailureTime: 1000
    })
    const provider = vi.fn(async () => 'real response')
    await expect(breaker.execute(provider)).rejects.toBeInstanceOf(CircuitBreakerError)
    expect(provider).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(breaker.getState()).toBe('HALF_OPEN')
    expect(await breaker.execute(provider)).toBe('real response')
    expect(breaker.getState()).toBe('HALF_OPEN')
    expect(await breaker.execute(provider)).toBe('real response')
    expect(breaker.getStats()).toEqual({
      state: 'CLOSED',
      failureCount: 0,
      successCount: 0,
      lastFailureTime: null
    })
  })
  it('resets failure streaks on success and reopens when a recovery probe fails', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2, resetTimeout: 100 })
    await expect(breaker.execute(failing)).rejects.toThrow()
    await breaker.execute(async () => 'recovered')
    expect(breaker.getStats().failureCount).toBe(0)
    breaker.trip()
    vi.advanceTimersByTime(100)
    await expect(breaker.execute(failing)).rejects.toThrow()
    expect(breaker.getState()).toBe('OPEN')
    breaker.reset()
    expect(breaker.getStats()).toEqual({
      state: 'CLOSED',
      failureCount: 0,
      successCount: 0,
      lastFailureTime: null
    })
  })
  it('uses an explicit unavailable result only for an open circuit, propagating provider errors', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 100 })
    const unavailable = vi.fn(() => ({ unavailable: true }))
    expect(
      await executeWithFallback(breaker, async () => ({ unavailable: false }), unavailable)
    ).toEqual({ unavailable: false })
    await expect(executeWithFallback(breaker, failing, unavailable)).rejects.toThrow(
      'provider unavailable'
    )
    expect(unavailable).not.toHaveBeenCalled()
    expect(await executeWithFallback(breaker, failing, unavailable)).toEqual({ unavailable: true })
  })
})
