import { useState, useCallback, useEffect } from 'react'
import { Prospect, CompetitorData, PortfolioCompany, DataTier } from '@public-records/core'
import { UserAction } from '@/lib/agentic/types'
import { fetchProspects } from '@/lib/api/prospects'
import { fetchCompetitors } from '@/lib/api/competitors'
import { fetchPortfolio } from '@/lib/api/portfolio'
import { fetchUserActions } from '@/lib/api/userActions'

export interface UseDataFetchingOptions {
  /** Legacy option is ignored: application data always comes from the API. */
  useMockData?: boolean
  dataTier?: DataTier
}

export interface UseDataFetchingResult {
  prospects: Prospect[]
  competitors: CompetitorData[]
  portfolio: PortfolioCompany[]
  userActions: UserAction[]
  isLoading: boolean
  loadError: string | null
  /** Retained for consumer compatibility; always false. */
  isDemoFallback: boolean
  lastDataRefresh: string
  setProspects: (updater: Prospect[] | ((prev: Prospect[]) => Prospect[])) => void
  setCompetitors: (
    updater: CompetitorData[] | ((prev: CompetitorData[]) => CompetitorData[])
  ) => void
  setPortfolio: (
    updater: PortfolioCompany[] | ((prev: PortfolioCompany[]) => PortfolioCompany[])
  ) => void
  setUserActions: (updater: UserAction[] | ((prev: UserAction[]) => UserAction[])) => void
  fetchData: (options?: { signal?: AbortSignal; silent?: boolean }) => Promise<boolean>
}

export function useDataFetching({
  dataTier = 'oss'
}: UseDataFetchingOptions): UseDataFetchingResult {
  // Do not hydrate business records from unscoped legacy storage: it can contain
  // synthetic records or a previous tenant's data. Reload from the API each mount.
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [competitors, setCompetitors] = useState<CompetitorData[]>([])
  const [portfolio, setPortfolio] = useState<PortfolioCompany[]>([])
  const [userActions, setUserActions] = useState<UserAction[]>([])
  const [lastDataRefresh, setLastDataRefresh] = useState('')

  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const fetchData = useCallback(
    async ({ signal, silent }: { signal?: AbortSignal; silent?: boolean } = {}) => {
      if (!silent) {
        setIsLoading(true)
      }
      setLoadError(null)

      try {
        const [liveProspects, liveCompetitors, livePortfolio, liveUserActions] = await Promise.all([
          fetchProspects(signal, { dataTier }),
          fetchCompetitors(signal, { dataTier }),
          fetchPortfolio(signal, { dataTier }),
          fetchUserActions(signal, { dataTier })
        ])

        if (signal?.aborted) {
          return false
        }

        if (
          ![liveProspects, liveCompetitors, livePortfolio, liveUserActions].every(Array.isArray)
        ) {
          throw new Error('The API returned an invalid dataset. Please retry or contact support.')
        }

        setProspects(liveProspects)
        setCompetitors(liveCompetitors)
        setPortfolio(livePortfolio)
        setUserActions(liveUserActions)
        setLastDataRefresh(new Date().toISOString())
        return true
      } catch (error) {
        if (signal?.aborted) {
          return false
        }

        setProspects([])
        setCompetitors([])
        setPortfolio([])
        setUserActions([])
        setLastDataRefresh('')
        setLoadError(
          error instanceof Error ? error.message : 'Unable to load records from the API.'
        )
        return false
      } finally {
        if (!silent && !signal?.aborted) {
          setIsLoading(false)
        }
      }
    },
    [dataTier, setProspects, setCompetitors, setPortfolio, setUserActions, setLastDataRefresh]
  )

  useEffect(() => {
    const controller = new AbortController()
    void fetchData({ signal: controller.signal })
    return () => controller.abort()
  }, [fetchData])

  return {
    prospects: prospects || [],
    competitors: competitors || [],
    portfolio: portfolio || [],
    userActions: userActions || [],
    isLoading,
    loadError,
    isDemoFallback: false,
    lastDataRefresh,
    setProspects: setProspects as UseDataFetchingResult['setProspects'],
    setCompetitors: setCompetitors as UseDataFetchingResult['setCompetitors'],
    setPortfolio: setPortfolio as UseDataFetchingResult['setPortfolio'],
    setUserActions: setUserActions as UseDataFetchingResult['setUserActions'],
    fetchData
  }
}
