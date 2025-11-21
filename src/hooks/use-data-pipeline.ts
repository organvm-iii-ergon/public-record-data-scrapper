/**
 * Data Pipeline Hook
 *
 * React hook for integrating data ingestion and enrichment pipeline
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Prospect } from '@/lib/types'
import {
  DataRefreshScheduler,
  SchedulerEvent,
  SchedulerStatus
} from '@/lib/services'
import { getDataPipelineConfig, featureFlags } from '@/lib/config/dataPipeline'
import { generateProspects } from '@/lib/mockData'
import {
  initDatabaseService,
  fetchProspects,
  hasDatabaseData
} from '@/lib/services/databaseService'

export interface DataPipelineState {
  prospects: Prospect[]
  loading: boolean
  error: string | null
  schedulerStatus: SchedulerStatus | null
  lastUpdate: string | null
}

export interface DataPipelineActions {
  refresh: () => Promise<void>
  startScheduler: () => void
  stopScheduler: () => void
  refreshProspect: (prospectId: string) => Promise<void>
  triggerIngestion: () => Promise<void>
}

export function useDataPipeline(): DataPipelineState & DataPipelineActions {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)

  const schedulerRef = useRef<DataRefreshScheduler | null>(null)

  /**
   * Initialize data pipeline
   */
  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true)
        setError(null)

        if (featureFlags.useMockData) {
          // Use mock data
          console.log('Using mock data (VITE_USE_MOCK_DATA=true)')
          const mockProspects = generateProspects(100)
          setProspects(mockProspects)
          setLastUpdate(new Date().toISOString())
        } else {
          // Use database
          console.log('Initializing database connection...')

          // Initialize database service
          await initDatabaseService()

          // Check if database has data
          const hasData = await hasDatabaseData()

          if (hasData) {
            console.log('Loading prospects from database...')
            const dbProspects = await fetchProspects()
            setProspects(dbProspects)
            setLastUpdate(new Date().toISOString())
            console.log(`Loaded ${dbProspects.length} prospects from database`)
          } else {
            console.warn('No data in database. Run `npm run db:seed` to seed sample data.')
            setError('No data in database. Please seed data or switch to mock mode.')
          }
        }

        setLoading(false)
      } catch (err) {
        console.error('Failed to initialize data pipeline:', err)
        setError(err instanceof Error ? err.message : 'Failed to initialize data pipeline')
        setLoading(false)

        // Fallback to mock data on error
        console.log('Falling back to mock data due to error')
        const mockProspects = generateProspects(100)
        setProspects(mockProspects)
      }
    }

    initialize()

    // Cleanup
    return () => {
      if (schedulerRef.current) {
        schedulerRef.current.stop()
      }
    }
  }, [])

  /**
   * Handle scheduler events
   */
  const handleSchedulerEvent = useCallback((event: SchedulerEvent) => {
    console.log('Scheduler event:', event)

    switch (event.type) {
      case 'ingestion-completed':
      case 'enrichment-completed':
      case 'refresh-completed':
        if (schedulerRef.current) {
          setProspects(schedulerRef.current.getProspects())
          setSchedulerStatus(schedulerRef.current.getStatus())
          setLastUpdate(new Date().toISOString())
        }
        break

      case 'error':
        setError(event.error || 'Unknown scheduler error')
        break
    }
  }, [])

  /**
   * Manually refresh all data
   */
  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      if (featureFlags.useMockData) {
        // Regenerate mock data
        const mockProspects = generateProspects(100)
        setProspects(mockProspects)
        setLastUpdate(new Date().toISOString())
      } else {
        // Refresh from database
        const dbProspects = await fetchProspects()
        setProspects(dbProspects)
        setLastUpdate(new Date().toISOString())
        console.log(`Refreshed ${dbProspects.length} prospects from database`)
      }

      setLoading(false)
    } catch (err) {
      console.error('Refresh failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to refresh data')
      setLoading(false)
    }
  }, [])

  /**
   * Start the scheduler
   */
  const startScheduler = useCallback(() => {
    if (schedulerRef.current && !featureFlags.useMockData) {
      schedulerRef.current.start()
      setSchedulerStatus(schedulerRef.current.getStatus())
    }
  }, [])

  /**
   * Stop the scheduler
   */
  const stopScheduler = useCallback(() => {
    if (schedulerRef.current) {
      schedulerRef.current.stop()
      setSchedulerStatus(schedulerRef.current.getStatus())
    }
  }, [])

  /**
   * Refresh a specific prospect
   */
  const refreshProspect = useCallback(async (prospectId: string) => {
    try {
      if (!featureFlags.useMockData && schedulerRef.current) {
        const refreshed = await schedulerRef.current.refreshProspect(prospectId)
        if (refreshed) {
          setProspects(prev =>
            prev.map(p => (p.id === prospectId ? refreshed : p))
          )
          setLastUpdate(new Date().toISOString())
        }
      }
    } catch (err) {
      console.error('Failed to refresh prospect:', err)
      setError(err instanceof Error ? err.message : 'Failed to refresh prospect')
    }
  }, [])

  /**
   * Manually trigger ingestion
   */
  const triggerIngestion = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      if (!featureFlags.useMockData && schedulerRef.current) {
        await schedulerRef.current.triggerIngestion()
        setProspects(schedulerRef.current.getProspects())
        setSchedulerStatus(schedulerRef.current.getStatus())
        setLastUpdate(new Date().toISOString())
      }

      setLoading(false)
    } catch (err) {
      console.error('Ingestion failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to trigger ingestion')
      setLoading(false)
    }
  }, [])

  return {
    prospects,
    loading,
    error,
    schedulerStatus,
    lastUpdate,
    refresh,
    startScheduler,
    stopScheduler,
    refreshProspect,
    triggerIngestion
  }
}
