import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction
} from 'react'
import { useKV as sparkUseKV } from '@github/spark/hooks'

export type UseSafeKVReturn<T> = [T, Dispatch<SetStateAction<T>>, () => void]

function readFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const stored = window.localStorage.getItem(key)
    if (stored === null) {
      return fallback
    }

    return JSON.parse(stored) as T
  } catch (error) {
    console.warn(`[useSafeKV] Failed to parse stored value for key "${key}".`, error)
    return fallback
  }
}

function writeToStorage<T>(key: string, value: T) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.warn(`[useSafeKV] Failed to persist value for key "${key}".`, error)
  }
}

function deleteFromStorage(key: string) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.removeItem(key)
  } catch (error) {
    console.warn(`[useSafeKV] Failed to remove value for key "${key}".`, error)
  }
}

export function useSafeKV<T>(key: string, initialValue: T): UseSafeKVReturn<T> {
  const triedSparkRef = useRef(false)
  const usingFallbackRef = useRef(false)
  const initialValueRef = useRef(initialValue)

  const [fallbackValue, setFallbackValue] = useState<T>(() =>
    readFromStorage(key, initialValueRef.current)
  )

  useEffect(() => {
    initialValueRef.current = initialValue
  }, [initialValue])

  const setFallback = useCallback<Dispatch<SetStateAction<T>>>(
    (valueOrUpdater) => {
      setFallbackValue((prev) => {
        const next =
          typeof valueOrUpdater === 'function'
            ? (valueOrUpdater as (prevState: T) => T)(prev)
            : valueOrUpdater

        writeToStorage(key, next)
        return next
      })
    },
    [key]
  )

  const deleteFallback = useCallback(() => {
    deleteFromStorage(key)
    setFallbackValue(initialValueRef.current)
  }, [key])

  const fallbackResult = useMemo(
    () => [fallbackValue, setFallback, deleteFallback] as UseSafeKVReturn<T>,
    [fallbackValue, setFallback, deleteFallback]
  )

  if (!triedSparkRef.current) {
    triedSparkRef.current = true
    try {
      const result = sparkUseKV<T>(key, initialValue)
      usingFallbackRef.current = false
      return result as UseSafeKVReturn<T>
    } catch (error) {
      usingFallbackRef.current = true
      console.warn(`[useSafeKV] Falling back to local storage for key "${key}".`, error)
    }
  }

  if (!usingFallbackRef.current) {
    return sparkUseKV<T>(key, initialValue) as UseSafeKVReturn<T>
  }

  return fallbackResult
}

export default useSafeKV
