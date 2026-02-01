import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

/**
 * Stores state in localStorage when available to avoid external KV dependencies.
 * Provides a drop-in replacement for useState that persists values between sessions.
 */
export function usePersistentState<T>(
  key: string,
  initialValue: T
): [T, Dispatch<SetStateAction<T>>] {
  const isBrowser = typeof window !== 'undefined'

  const [state, setState] = useState<T>(() => {
    if (!isBrowser) {
      return initialValue
    }

    try {
      const storedValue = window.localStorage.getItem(key)
      if (storedValue !== null) {
        return JSON.parse(storedValue) as T
      }
    } catch (error) {
      console.warn(`[usePersistentState] Failed to read key "${key}" from localStorage`, error)
    }

    return initialValue
  })

  useEffect(() => {
    if (!isBrowser) {
      return
    }

    try {
      window.localStorage.setItem(key, JSON.stringify(state))
    } catch (error) {
      console.warn(`[usePersistentState] Failed to persist key "${key}" to localStorage`, error)
    }
  }, [isBrowser, key, state])

  return [state, setState]
}
