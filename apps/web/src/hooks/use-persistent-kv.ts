import { useCallback, useEffect, useMemo, useState } from 'react'

type SetStateAction<T> = T | ((previous?: T) => T)

type StoredValue<T> = T | undefined

const STORAGE_PREFIX = 'prds:'
const memoryStore = new Map<string, unknown>()

function isBrowserEnvironment(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function readFromStorage<T>(key: string, isBrowser: boolean): StoredValue<T> {
  if (isBrowser) {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw === null) return undefined
      return JSON.parse(raw) as T
    } catch (error) {
      console.warn(`Failed to read persisted value for key "${key}":`, error)
      return undefined
    }
  }

  if (memoryStore.has(key)) {
    return memoryStore.get(key) as T
  }

  return undefined
}

function writeToStorage<T>(key: string, value: StoredValue<T>, isBrowser: boolean): void {
  if (isBrowser) {
    try {
      if (value === undefined) {
        window.localStorage.removeItem(key)
      } else {
        window.localStorage.setItem(key, JSON.stringify(value))
      }
      return
    } catch (error) {
      console.warn(
        `Failed to persist value for key "${key}". Falling back to in-memory storage.`,
        error
      )
    }
  }

  if (value === undefined) {
    memoryStore.delete(key)
  } else {
    memoryStore.set(key, value)
  }
}

export function usePersistentKV<T = string>(
  key: string,
  initialValue?: T
): readonly [StoredValue<T>, (newValue: SetStateAction<T>) => void, () => void] {
  const storageKey = useMemo(() => `${STORAGE_PREFIX}${key}`, [key])
  const isBrowser = isBrowserEnvironment()

  const [value, setValue] = useState<StoredValue<T>>(() => {
    const stored = readFromStorage<T>(storageKey, isBrowser)
    if (stored !== undefined) {
      return stored
    }

    if (initialValue !== undefined) {
      writeToStorage<T>(storageKey, initialValue, isBrowser)
      return initialValue
    }

    return initialValue
  })

  const setPersistedValue = useCallback(
    (update: SetStateAction<T>) => {
      setValue((previous) => {
        const nextValue =
          typeof update === 'function' ? (update as (previous?: T) => T)(previous) : update

        writeToStorage<T>(storageKey, nextValue, isBrowser)
        return nextValue
      })
    },
    [isBrowser, storageKey]
  )

  const deleteValue = useCallback(() => {
    writeToStorage<T>(storageKey, undefined, isBrowser)
    setValue(undefined)
  }, [isBrowser, storageKey])

  useEffect(() => {
    if (!isBrowser) return

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return

      if (event.newValue === null) {
        setValue(undefined)
        return
      }

      try {
        setValue(event.newValue ? (JSON.parse(event.newValue) as T) : undefined)
      } catch (error) {
        console.warn(`Failed to parse storage event for key "${storageKey}":`, error)
        setValue(undefined)
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [isBrowser, storageKey])

  return [value, setPersistedValue, deleteValue]
}

export { usePersistentKV as useKV }
