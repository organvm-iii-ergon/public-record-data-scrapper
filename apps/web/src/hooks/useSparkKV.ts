import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export type UseKVReturn<T> = readonly [
  T | undefined,
  (newValue: T | ((oldValue?: T) => T)) => void,
  () => void
]

const memoryStore = new Map<string, unknown>()

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const storage = window.localStorage
    const testKey = '__spark_kv_test__'
    storage.setItem(testKey, '1')
    storage.removeItem(testKey)
    return storage
  } catch (error) {
    console.warn('[useSparkKV] Local storage unavailable, falling back to in-memory store.', error)
    return null
  }
}

function readValue<T>(key: string, storage: Storage | null): T | undefined {
  if (storage) {
    try {
      const raw = storage.getItem(key)
      if (raw !== null) {
        return JSON.parse(raw) as T
      }
    } catch (error) {
      console.warn(`[useSparkKV] Failed to parse stored value for key "${key}"`, error)
    }
  }

  if (memoryStore.has(key)) {
    return memoryStore.get(key) as T
  }

  return undefined
}

function persistValue<T>(key: string, value: T, storage: Storage | null) {
  memoryStore.set(key, value as unknown)

  if (!storage) {
    return
  }

  try {
    storage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.warn(`[useSparkKV] Failed to persist value for key "${key}"`, error)
  }
}

function removeValue(key: string, storage: Storage | null) {
  memoryStore.delete(key)

  if (!storage) {
    return
  }

  try {
    storage.removeItem(key)
  } catch (error) {
    console.warn(`[useSparkKV] Failed to remove value for key "${key}"`, error)
  }
}

function parseStorageEventValue<T>(event: StorageEvent): T | undefined {
  if (event.newValue === null) {
    return undefined
  }

  try {
    return JSON.parse(event.newValue) as T
  } catch (error) {
    console.warn('[useSparkKV] Failed to parse storage event value', error)
    return undefined
  }
}

export function useSafeKV<T = string>(key: string, initialValue?: T): UseKVReturn<T> {
  const storageRef = useRef<Storage | null>(null)
  const initializedRef = useRef(false)

  if (storageRef.current === null) {
    storageRef.current = getStorage()
  }

  const [value, setValue] = useState<T | undefined>(() => {
    const stored = readValue<T>(key, storageRef.current)
    if (stored !== undefined) {
      initializedRef.current = true
      return stored
    }

    return initialValue
  })

  useEffect(() => {
    storageRef.current = getStorage()
  }, [])

  useEffect(() => {
    const storage = storageRef.current
    const stored = readValue<T>(key, storage)

    if (stored !== undefined) {
      initializedRef.current = true
      setValue(stored)
      return
    }

    if (!initializedRef.current && initialValue !== undefined) {
      initializedRef.current = true
      setValue(initialValue)
      persistValue(key, initialValue, storage)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialValue intentionally excluded to prevent infinite re-renders with object/array values
  }, [key])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key !== key) {
        return
      }

      const storage = storageRef.current
      if (storage && event.storageArea !== storage) {
        return
      }

      const nextValue = parseStorageEventValue<T>(event)
      if (nextValue === undefined) {
        removeValue(key, storageRef.current)
      } else {
        persistValue(key, nextValue, storageRef.current)
      }
      setValue(nextValue)
    }

    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('storage', handleStorage)
    }
  }, [key])

  const setPersistedValue = useCallback(
    (nextValue: T | ((current?: T) => T)) => {
      setValue((currentValue) => {
        const resolvedValue =
          typeof nextValue === 'function'
            ? (nextValue as (current?: T) => T)(currentValue)
            : nextValue

        persistValue(key, resolvedValue, storageRef.current)
        return resolvedValue
      })
    },
    [key]
  )

  const deleteValue = useCallback(() => {
    removeValue(key, storageRef.current)
    setValue(undefined)
    initializedRef.current = false
  }, [key])

  return useMemo(
    () => [value, setPersistedValue, deleteValue] as const,
    [value, setPersistedValue, deleteValue]
  )
}

export { useSafeKV as useKV }
