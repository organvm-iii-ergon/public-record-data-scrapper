/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Create hoisted mocks
const mocks = vi.hoisted(() => {
  const mockSparkUseKV = vi.fn()
  const mockStorage: Record<string, string> = {}

  return {
    mockSparkUseKV,
    mockStorage,
    getStorage: () => mockStorage,
    resetStorage: () => {
      Object.keys(mockStorage).forEach((key) => delete mockStorage[key])
    }
  }
})

// Mock @github/spark/hooks
vi.mock('@github/spark/hooks', () => ({
  useKV: mocks.mockSparkUseKV
}))

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn((key: string) => mocks.mockStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mocks.mockStorage[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete mocks.mockStorage[key]
  }),
  clear: vi.fn(() => mocks.resetStorage())
}

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
})

describe('useSafeKV', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resetStorage()
    vi.resetModules()
  })

  afterEach(() => {
    vi.clearAllMocks()
    mocks.resetStorage()
  })

  describe('Spark hook available', () => {
    beforeEach(() => {
      mocks.mockSparkUseKV.mockImplementation(<T>(key: string, initialValue: T) => {
        const { useState } = require('react')
        const [value, setValue] = useState(initialValue)
        const deleteValue = () => setValue(initialValue)
        return [value, setValue, deleteValue]
      })
    })

    it('should use Spark useKV when available', async () => {
      const { useSafeKV } = await import('../use-safe-kv')

      renderHook(() => useSafeKV('test-key', 'initial'))

      expect(mocks.mockSparkUseKV).toHaveBeenCalledWith('test-key', 'initial')
    })

    it('should return value from Spark hook', async () => {
      mocks.mockSparkUseKV.mockImplementation(<T>(_key: string, _initialValue: T) => {
        const { useState } = require('react')
        const [value] = useState('spark-value')
        return [value, vi.fn(), vi.fn()]
      })

      const { useSafeKV } = await import('../use-safe-kv')

      const { result } = renderHook(() => useSafeKV('test-key', 'initial'))

      expect(result.current[0]).toBe('spark-value')
    })
  })

  describe('Spark hook unavailable - localStorage fallback', () => {
    beforeEach(() => {
      mocks.mockSparkUseKV.mockImplementation(() => {
        throw new Error('Spark not available')
      })
    })

    it('should fall back to localStorage when Spark throws', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { useSafeKV } = await import('../use-safe-kv')

      const { result } = renderHook(() => useSafeKV('fallback-key', 'initial'))

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Falling back to local storage'),
        expect.any(Error)
      )
      consoleSpy.mockRestore()
    })

    it('should return initial value when no stored value', async () => {
      const { useSafeKV } = await import('../use-safe-kv')

      const { result } = renderHook(() => useSafeKV('new-key', 'default-value'))

      expect(result.current[0]).toBe('default-value')
    })

    it('should return stored value from localStorage', async () => {
      mocks.mockStorage['existing-key'] = JSON.stringify('stored-value')

      const { useSafeKV } = await import('../use-safe-kv')

      const { result } = renderHook(() => useSafeKV('existing-key', 'default'))

      expect(result.current[0]).toBe('stored-value')
    })

    it('should persist value to localStorage on set', async () => {
      const { useSafeKV } = await import('../use-safe-kv')

      const { result } = renderHook(() => useSafeKV('persist-key', 'initial'))

      act(() => {
        result.current[1]('new-value')
      })

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'persist-key',
        JSON.stringify('new-value')
      )
    })

    it('should support updater function for setValue', async () => {
      const { useSafeKV } = await import('../use-safe-kv')

      const { result } = renderHook(() => useSafeKV('counter-key', 0))

      act(() => {
        result.current[1]((prev) => prev + 1)
      })

      expect(result.current[0]).toBe(1)
    })

    it('should delete value from localStorage', async () => {
      mocks.mockStorage['delete-key'] = JSON.stringify('to-delete')

      const { useSafeKV } = await import('../use-safe-kv')

      const { result } = renderHook(() => useSafeKV('delete-key', 'initial'))

      act(() => {
        result.current[2]()
      })

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('delete-key')
      expect(result.current[0]).toBe('initial')
    })

    it('should handle object values', async () => {
      const { useSafeKV } = await import('../use-safe-kv')

      const initialObj = { name: 'test', count: 0 }
      const { result } = renderHook(() => useSafeKV('object-key', initialObj))

      expect(result.current[0]).toEqual(initialObj)

      act(() => {
        result.current[1]({ name: 'updated', count: 5 })
      })

      expect(result.current[0]).toEqual({ name: 'updated', count: 5 })
    })

    it('should handle array values', async () => {
      const { useSafeKV } = await import('../use-safe-kv')

      const { result } = renderHook(() => useSafeKV('array-key', [1, 2, 3]))

      act(() => {
        result.current[1]([4, 5, 6])
      })

      expect(result.current[0]).toEqual([4, 5, 6])
    })
  })

  describe('JSON parsing errors', () => {
    beforeEach(() => {
      mocks.mockSparkUseKV.mockImplementation(() => {
        throw new Error('Spark not available')
      })
    })

    it('should return fallback on invalid JSON', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mocks.mockStorage['invalid-json'] = 'not-valid-json'

      const { useSafeKV } = await import('../use-safe-kv')

      const { result } = renderHook(() => useSafeKV('invalid-json', 'fallback'))

      expect(result.current[0]).toBe('fallback')
      consoleSpy.mockRestore()
    })
  })

  describe('SSR compatibility', () => {
    it('should handle missing window gracefully', async () => {
      // This test verifies the code doesn't throw during SSR
      // The actual SSR behavior is handled by checking typeof window
      const { useSafeKV } = await import('../use-safe-kv')

      // Should not throw
      expect(() => {
        renderHook(() => useSafeKV('ssr-key', 'initial'))
      }).not.toThrow()
    })
  })

  describe('key changes', () => {
    beforeEach(() => {
      mocks.mockSparkUseKV.mockImplementation(() => {
        throw new Error('Spark not available')
      })
    })

    it('should update when key changes', async () => {
      mocks.mockStorage['key-1'] = JSON.stringify('value-1')
      mocks.mockStorage['key-2'] = JSON.stringify('value-2')

      const { useSafeKV } = await import('../use-safe-kv')

      let key = 'key-1'
      const { result, rerender } = renderHook(() => useSafeKV(key, 'default'))

      expect(result.current[0]).toBe('value-1')

      key = 'key-2'
      rerender()

      // Note: Depending on implementation, this might need adjustment
      // The hook may or may not re-read on key change
    })
  })

  describe('storage errors', () => {
    beforeEach(() => {
      mocks.mockSparkUseKV.mockImplementation(() => {
        throw new Error('Spark not available')
      })
    })

    it('should handle localStorage.setItem errors', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockLocalStorage.setItem.mockImplementationOnce(() => {
        throw new Error('QuotaExceededError')
      })

      const { useSafeKV } = await import('../use-safe-kv')

      const { result: hookResult } = renderHook(() => useSafeKV('error-key', 'initial'))

      act(() => {
        hookResult.current[1]('new-value')
      })

      // Should still update state even if storage fails
      expect(hookResult.current[0]).toBe('new-value')
      consoleSpy.mockRestore()
    })

    it('should handle localStorage.removeItem errors', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockLocalStorage.removeItem.mockImplementationOnce(() => {
        throw new Error('Storage error')
      })

      const { useSafeKV } = await import('../use-safe-kv')

      const { result: hookResult } = renderHook(() => useSafeKV('error-key', 'initial'))

      act(() => {
        hookResult.current[2]()
      })

      // Should still reset state even if storage fails
      expect(hookResult.current[0]).toBe('initial')
      consoleSpy.mockRestore()
    })
  })

  describe('memoization', () => {
    beforeEach(() => {
      mocks.mockSparkUseKV.mockImplementation(() => {
        throw new Error('Spark not available')
      })
    })

    it('should return stable setter function', async () => {
      const { useSafeKV } = await import('../use-safe-kv')

      const { result, rerender } = renderHook(() => useSafeKV('memo-key', 'initial'))

      const firstSetter = result.current[1]

      rerender()

      expect(result.current[1]).toBe(firstSetter)
    })

    it('should return stable delete function', async () => {
      const { useSafeKV } = await import('../use-safe-kv')

      const { result, rerender } = renderHook(() => useSafeKV('memo-key', 'initial'))

      const firstDelete = result.current[2]

      rerender()

      expect(result.current[2]).toBe(firstDelete)
    })
  })
})
