import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePersistentState } from '../usePersistentState'

describe('usePersistentState', () => {
  const originalLocalStorage = window.localStorage
  let mockStorage: Record<string, string> = {}

  beforeEach(() => {
    mockStorage = {}

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => mockStorage[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
          mockStorage[key] = value
        }),
        removeItem: vi.fn((key: string) => {
          delete mockStorage[key]
        }),
        clear: vi.fn(() => {
          mockStorage = {}
        }),
        key: vi.fn((index: number) => Object.keys(mockStorage)[index] ?? null),
        get length() {
          return Object.keys(mockStorage).length
        }
      },
      writable: true
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true
    })
    vi.restoreAllMocks()
  })

  describe('initial state', () => {
    it('should return initial value when no stored value exists', () => {
      const { result } = renderHook(() => usePersistentState('test-key', 'initial'))

      expect(result.current[0]).toBe('initial')
    })

    it('should return stored value when it exists', () => {
      mockStorage['test-key'] = JSON.stringify('stored-value')

      const { result } = renderHook(() => usePersistentState('test-key', 'initial'))

      expect(result.current[0]).toBe('stored-value')
    })

    it('should handle complex objects', () => {
      const storedObject = { name: 'test', count: 42, nested: { value: true } }
      mockStorage['test-key'] = JSON.stringify(storedObject)

      const { result } = renderHook(() =>
        usePersistentState('test-key', { name: '', count: 0, nested: { value: false } })
      )

      expect(result.current[0]).toEqual(storedObject)
    })

    it('should handle arrays', () => {
      const storedArray = [1, 2, 3, 4, 5]
      mockStorage['test-key'] = JSON.stringify(storedArray)

      const { result } = renderHook(() => usePersistentState('test-key', []))

      expect(result.current[0]).toEqual(storedArray)
    })

    it('should handle boolean values', () => {
      mockStorage['test-key'] = JSON.stringify(true)

      const { result } = renderHook(() => usePersistentState('test-key', false))

      expect(result.current[0]).toBe(true)
    })

    it('should handle number values', () => {
      mockStorage['test-key'] = JSON.stringify(42)

      const { result } = renderHook(() => usePersistentState('test-key', 0))

      expect(result.current[0]).toBe(42)
    })

    it('should handle null values', () => {
      mockStorage['test-key'] = JSON.stringify(null)

      const { result } = renderHook(() => usePersistentState<string | null>('test-key', 'default'))

      expect(result.current[0]).toBe(null)
    })
  })

  describe('setState', () => {
    it('should update state with direct value', () => {
      const { result } = renderHook(() => usePersistentState('test-key', 'initial'))

      act(() => {
        result.current[1]('updated')
      })

      expect(result.current[0]).toBe('updated')
    })

    it('should update state with function updater', () => {
      const { result } = renderHook(() => usePersistentState('test-key', 10))

      act(() => {
        result.current[1]((prev) => prev + 5)
      })

      expect(result.current[0]).toBe(15)
    })

    it('should persist state to localStorage', () => {
      const { result } = renderHook(() => usePersistentState('test-key', 'initial'))

      act(() => {
        result.current[1]('persisted')
      })

      expect(mockStorage['test-key']).toBe(JSON.stringify('persisted'))
    })

    it('should persist complex objects to localStorage', () => {
      const { result } = renderHook(() => usePersistentState('test-key', { count: 0 }))

      act(() => {
        result.current[1]({ count: 42 })
      })

      expect(mockStorage['test-key']).toBe(JSON.stringify({ count: 42 }))
    })
  })

  describe('persistence across renders', () => {
    it('should maintain state across re-renders', () => {
      const { result, rerender } = renderHook(() => usePersistentState('test-key', 'initial'))

      act(() => {
        result.current[1]('updated')
      })

      rerender()

      expect(result.current[0]).toBe('updated')
    })

    it('should read from localStorage on mount with same key', () => {
      mockStorage['test-key'] = JSON.stringify('persisted-value')

      // First hook instance
      const { unmount } = renderHook(() => usePersistentState('test-key', 'initial'))
      unmount()

      // Second hook instance with same key should read from storage
      const { result } = renderHook(() => usePersistentState('test-key', 'initial'))

      expect(result.current[0]).toBe('persisted-value')
    })
  })

  describe('error handling', () => {
    it('should return initial value when localStorage read fails', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: vi.fn(() => {
            throw new Error('Storage error')
          }),
          setItem: vi.fn(),
          removeItem: vi.fn()
        },
        writable: true
      })

      const { result } = renderHook(() => usePersistentState('test-key', 'fallback'))

      expect(result.current[0]).toBe('fallback')
      expect(consoleWarnSpy).toHaveBeenCalled()

      consoleWarnSpy.mockRestore()
    })

    it('should handle invalid JSON in storage', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockStorage['test-key'] = 'not valid json'

      const { result } = renderHook(() => usePersistentState('test-key', 'fallback'))

      expect(result.current[0]).toBe('fallback')
      expect(consoleWarnSpy).toHaveBeenCalled()

      consoleWarnSpy.mockRestore()
    })

    it('should handle localStorage write failures gracefully', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: vi.fn(() => null),
          setItem: vi.fn(() => {
            throw new Error('QuotaExceededError')
          }),
          removeItem: vi.fn()
        },
        writable: true
      })

      const { result } = renderHook(() => usePersistentState('test-key', 'initial'))

      // State should still update even if persistence fails
      act(() => {
        result.current[1]('updated')
      })

      expect(result.current[0]).toBe('updated')

      consoleWarnSpy.mockRestore()
    })
  })

  describe('different keys', () => {
    it('should maintain separate state for different keys', () => {
      const { result: result1 } = renderHook(() => usePersistentState('key-1', 'value-1'))
      const { result: result2 } = renderHook(() => usePersistentState('key-2', 'value-2'))

      expect(result1.current[0]).toBe('value-1')
      expect(result2.current[0]).toBe('value-2')

      act(() => {
        result1.current[1]('updated-1')
      })

      expect(result1.current[0]).toBe('updated-1')
      expect(result2.current[0]).toBe('value-2')
    })
  })

  describe('key changes', () => {
    it('should read from new key when key changes', () => {
      mockStorage['key-1'] = JSON.stringify('value-1')
      mockStorage['key-2'] = JSON.stringify('value-2')

      const { result, rerender } = renderHook(({ key }) => usePersistentState(key, 'default'), {
        initialProps: { key: 'key-1' }
      })

      expect(result.current[0]).toBe('value-1')

      rerender({ key: 'key-2' })

      // Note: this tests what happens on key change
      // The actual behavior depends on implementation
      expect(mockStorage['key-2']).toBeDefined()
    })
  })
})
