import { useState, useEffect, useMemo, useCallback } from 'react'
import { useKV } from '@github/spark/hooks'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatsOverview } from '@/components/StatsOverview'
import { ProspectCard } from '@/components/ProspectCard'
import { ProspectDetailDialog } from '@/components/ProspectDetailDialog'
import { CompetitorChart } from '@/components/CompetitorChart'
import { PortfolioMonitor } from '@/components/PortfolioMonitor'
import { AdvancedFilters, AdvancedFilterState, initialFilters } from '@/components/AdvancedFilters'
import { StaleDataWarning } from '@/components/StaleDataWarning'
import { BatchOperations } from '@/components/BatchOperations'
import { SortControls, SortField, SortDirection } from '@/components/SortControls'
import { LegacySearch } from '@/components/LegacySearch'
import {
  generateProspects,
  generateCompetitorData,
  generatePortfolioCompanies,
  generateDashboardStats
} from '@/lib/mockData'
import { Prospect, CompetitorData, PortfolioCompany, IndustryType, ProspectNote, FollowUpReminder, OutreachEmail } from '@/lib/types'
import { exportProspects, ExportFormat } from '@/lib/exportUtils'
import {
  Target,
  ChartBar,
  Heart,
  ArrowClockwise,
  MagnifyingGlass,
  Robot,
  ChartLineUp
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { AgenticDashboard } from '@/components/AgenticDashboard'
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard'
import { useAgenticEngine } from '@/hooks/use-agentic-engine'
import { SystemContext, PerformanceMetrics, UserAction } from '@/lib/agentic/types'
import { ThemeToggle } from '@/components/ThemeToggle'

// API Imports
import {
  fetchProspects,
  claimProspect,
  unclaimProspect,
  batchClaimProspects,
  deleteProspects as deleteProspectsApi
} from '@/lib/api/prospects'
import { fetchCompetitors } from '@/lib/api/competitors'
import { fetchPortfolio } from '@/lib/api/portfolio'
import { fetchUserActions, logUserAction } from '@/lib/api/userActions'

// Simple UUID generator using crypto API
function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() :
    `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

function App() {
  const [prospects, setProspects, _deleteProspects] = useKV<Prospect[]>('ucc-prospects', [])
  const [competitors, setCompetitors] = useKV<CompetitorData[]>('competitor-data', [])
  const [portfolio, setPortfolio] = useKV<PortfolioCompany[]>('portfolio-companies', [])

  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [industryFilter, setIndustryFilter] = useState<string>('all')
  const [stateFilter, setStateFilter] = useState<string>('all')
  const [minScore, setMinScore] = useState<number>(0)
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilterState>(initialFilters)
  const [selectedProspectIds, setSelectedProspectIds] = useState<Set<string>>(new Set())
  const [lastDataRefresh, setLastDataRefresh] = useKV<string>('last-data-refresh', new Date().toISOString())
  const [sortField, setSortField] = useState<SortField>('priorityScore')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [exportFormat, setExportFormat] = useKV<ExportFormat>('export-format', 'json')
  const [userActions, setUserActions] = useKV<UserAction[]>('user-actions', [])
  
  // New state from PR #140
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const useMockData =
    import.meta.env.DEV &&
    ['1', 'true', 'yes'].includes(String(import.meta.env.VITE_USE_MOCK_DATA ?? '').toLowerCase())

  // State from Main (Notes/Reminders)
  const [notes, setNotes] = useKV<ProspectNote[]>('prospect-notes', [])
  const [reminders, setReminders] = useKV<FollowUpReminder[]>('prospect-reminders', [])
  // const [outreachEmails, setOutreachEmails] = useKV<OutreachEmail[]>('outreach-emails', [])

  // Agentic Engine Integration
  const systemContext: SystemContext = useMemo(() => ({
    prospects: prospects || [],
    competitors: competitors || [],
    portfolio: portfolio || [],
    userActions: userActions || [],
    performanceMetrics: {
      avgResponseTime: 450,
      errorRate: 0.02,
      userSatisfactionScore: 7.5,
      dataFreshnessScore: 85
    } as PerformanceMetrics,
    timestamp: new Date().toISOString()
  }), [prospects, competitors, portfolio, userActions])

  const agentic = useAgenticEngine(systemContext, {
    enabled: true,
    autonomousExecutionEnabled: false, // Disabled by default for safety
    safetyThreshold: 80
  })

  // Fetch Data (From PR #140 - API Aware)
  const fetchData = useCallback(
    async ({ signal, silent }: { signal?: AbortSignal; silent?: boolean } = {}) => {
      if (!silent) {
        setIsLoading(true)
      }
      setLoadError(null)

      try {
        if (useMockData) {
          const [mockProspects, mockCompetitors, mockPortfolio] = [
            generateProspects(24),
            generateCompetitorData(),
            generatePortfolioCompanies(15)
          ]

          if (signal?.aborted) {
            return false
          }

          setProspects(mockProspects)
          setCompetitors(mockCompetitors)
          setPortfolio(mockPortfolio)
          setLastDataRefresh(new Date().toISOString())
          return true
        }

        const [liveProspects, liveCompetitors, livePortfolio, liveUserActions] = await Promise.all([
          fetchProspects(signal),
          fetchCompetitors(signal),
          fetchPortfolio(signal),
          fetchUserActions(signal)
        ])

        if (signal?.aborted) {
          return false
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

        const message = error instanceof Error ? error.message : 'Failed to load data'
        setLoadError(message)
        console.error('Failed to load datasets', error)
        return false
      } finally {
        if (!silent && !signal?.aborted) {
          setIsLoading(false)
        }
      }
    },
    [useMockData, setProspects, setCompetitors, setPortfolio, setUserActions, setLastDataRefresh]
  )

  useEffect(() => {
    const controller = new AbortController()
    void fetchData({ signal: controller.signal })
    return () => controller.abort()
  }, [fetchData])

  const stats = useMemo(() => {
    if (!prospects || !portfolio || prospects.length === 0 || portfolio.length === 0) {
      return null
    }

    try {
      return generateDashboardStats(prospects, portfolio)
    } catch (error) {
      console.error('Failed to generate dashboard stats', error)
      return null
    }
  }, [prospects, portfolio])

  // Track user actions for agentic analysis
  const trackAction = useCallback(
    async (type: string, details: Record<string, any> = {}) => {
      const newAction: UserAction = {
        type,
        timestamp: new Date().toISOString(),
        details
      }

      setUserActions((current) => [...(current ?? []), newAction].slice(-100))

      if (useMockData) {
        return
      }

      try {
        await logUserAction(newAction)
      } catch (error) {
        console.error('Failed to persist user action', error)
      }
    },
    [setUserActions, useMockData]
  )

  const handleRefreshData = useCallback(async () => {
    const success = await fetchData()

    if (success) {
      void trackAction('refresh-data')
      toast.success('Data refreshed', {
        description: useMockData
          ? 'Mock data regenerated for offline demo mode.'
          : 'Latest datasets synchronized from ingestion services.'
      })
    } else {
      toast.error('Refresh failed', {
        description: loadError ?? 'Unable to refresh data from the server.'
      })
    }
  }, [fetchData, loadError, trackAction, useMockData])

  const handleProspectSelect = (prospect: Prospect) => {
    setSelectedProspect(prospect)
    setDialogOpen(true)
    void trackAction('prospect-select', { prospectId: prospect.id })
  }

  const handleClaimLead = async (prospect: Prospect) => {
    const user = 'Current User'
    const today = new Date().toISOString().split('T')[0]

    try {
      const updatedProspect = useMockData
        ? {
            ...prospect,
            status: 'claimed',
            claimedBy: user,
            claimedDate: today
          }
        : await claimProspect(prospect.id, user)

      setProspects((currentProspects) => {
        const list = currentProspects ?? []
        const exists = list.some(p => p.id === updatedProspect.id)
        if (!exists) {
          return [...list, updatedProspect]
        }
        return list.map(p => (p.id === updatedProspect.id ? updatedProspect : p))
      })

      setSelectedProspect(null)
      setDialogOpen(false)
      void trackAction('claim', { prospectId: prospect.id })
      toast.success('Lead claimed successfully', {
        description: `${updatedProspect.companyName} has been added to your pipeline.`
      })
    } catch (error) {
      console.error('Failed to claim prospect', error)
      toast.error('Unable to claim lead', {
        description: error instanceof Error
          ? error.message
          : 'An unexpected error occurred while claiming the lead.'
      })
    }
  }

  const handleUnclaimLead = async (prospect: Prospect) => {
    try {
      const updatedProspect = useMockData
        ? {
            ...prospect,
            status: 'new',
            claimedBy: undefined,
            claimedDate: undefined
          }
        : await unclaimProspect(prospect.id)

      setProspects((currentProspects) => {
        const list = currentProspects ?? []
        const exists = list.some(p => p.id === updatedProspect.id)
        if (!exists) {
          return list
        }
        return list.map(p => (p.id === updatedProspect.id ? updatedProspect : p))
      })

      toast.info('Lead unclaimed', {
        description: `${updatedProspect.companyName} is now available for claiming.`
      })
      void trackAction('unclaim', { prospectId: prospect.id })
    } catch (error) {
      console.error('Failed to unclaim prospect', error)
      toast.error('Unable to unclaim lead', {
        description: error instanceof Error
          ? error.message
          : 'An unexpected error occurred while unclaiming the lead.'
      })
    }
  }

  const handleExportProspect = (prospect: Prospect) => {
    handleExportProspects([prospect])
  }

  const handleExportProspects = (prospectsToExport: Prospect[]) => {
    try {
      const filterInfo = searchQuery || industryFilter !== 'all' || stateFilter !== 'all' || minScore > 0
        ? 'filtered'
        : undefined

      if (!exportFormat) {
        toast.error('Export failed', {
          description: 'No export format specified'
        })
        return
      }

      exportProspects(prospectsToExport, exportFormat, filterInfo)

      const formatLabel = exportFormat.toUpperCase()
      toast.success(`Prospect(s) exported as ${formatLabel}`, {
        description: `${prospectsToExport.length} lead(s) exported successfully.`
      })
      void trackAction('export-prospects', {
        format: exportFormat,
        count: prospectsToExport.length,
        filtered: Boolean(filterInfo)
      })
    } catch (error) {
      toast.error('Export failed', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  const handleBatchClaim = async (ids: string[]) => {
    if (ids.length === 0) return

    const user = 'Current User'
    const today = new Date().toISOString().split('T')[0]

    if (useMockData) {
      setProspects((currentProspects) => {
        if (!currentProspects) return []
        return currentProspects.map(p =>
          ids.includes(p.id) && p.status !== 'claimed'
            ? { ...p, status: 'claimed', claimedBy: user, claimedDate: today }
            : p
        )
      })

      toast.success(`${ids.length} leads claimed`, {
        description: 'Selected leads have been added to your pipeline.'
      })
      void trackAction('batch-claim', { prospectIds: ids })
      return
    }

    try {
      const updatedProspects = await batchClaimProspects(ids, user)
      const updates = new Map(updatedProspects.map(p => [p.id, p]))

      setProspects((currentProspects) => {
        const list = currentProspects ?? []
        return list.map(p => updates.get(p.id) ?? p)
      })

      toast.success(`${ids.length} leads claimed`, {
        description: 'Selected leads have been added to your pipeline.'
      })
      void trackAction('batch-claim', { prospectIds: ids })
    } catch (error) {
      console.error('Failed to batch claim prospects', error)
      toast.error('Unable to claim selected leads', {
        description: error instanceof Error
          ? error.message
          : 'An unexpected error occurred while claiming the selected leads.'
      })
    }
  }

  const handleBatchExport = (ids: string[]) => {
    const prospectsToExport = (prospects || []).filter(p => ids.includes(p.id))
    handleExportProspects(prospectsToExport)
  }

  const handleBatchDelete = async (ids: string[]) => {
    if (ids.length === 0) return

    if (useMockData) {
      setProspects((currentProspects) => {
        if (!currentProspects) return []
        return currentProspects.filter(p => !ids.includes(p.id))
      })

      toast.info(`${ids.length} prospects removed`, {
        description: 'Selected prospects have been removed from the list.'
      })
      void trackAction('batch-delete', { prospectIds: ids })
      return
    }

    try {
      await deleteProspectsApi(ids)
      setProspects((currentProspects) => {
        if (!currentProspects) return []
        return currentProspects.filter(p => !ids.includes(p.id))
      })

      toast.info(`${ids.length} prospects removed`, {
        description: 'Selected prospects have been removed from the list.'
      })
      void trackAction('batch-delete', { prospectIds: ids })
    } catch (error) {
      console.error('Failed to delete prospects', error)
      toast.error('Unable to delete selected prospects', {
        description: error instanceof Error
          ? error.message
          : 'An unexpected error occurred while deleting the selected prospects.'
      })
    }
  }

  const handleAddNote = (note: Omit<ProspectNote, 'id' | 'createdAt' | 'createdBy'>) => {
    const newNote: ProspectNote = {
      ...note,
      id: generateId(),
      createdBy: 'Current User',
      createdAt: new Date().toISOString()
    }

    setNotes((current) => [...(current || []), newNote])
  }

  const handleDeleteNote = (noteId: string) => {
    setNotes((current) => (current || []).filter(n => n.id !== noteId))
  }

  const handleAddReminder = (reminder: Omit<FollowUpReminder, 'id' | 'createdAt' | 'createdBy' | 'completed'>) => {
    const newReminder: FollowUpReminder = {
      ...reminder,
      id: generateId(),
      createdBy: 'Current User',
      createdAt: new Date().toISOString(),
      completed: false
    }

    setReminders((current) => [...(current || []), newReminder])
  }

  const handleCompleteReminder = (reminderId: string) => {
    setReminders((current) => {
      if (!current) return []
      return current.map(r => {
        if (r.id === reminderId) {
          return {
            ...r,
            completed: !r.completed,
            completedAt: !r.completed ? new Date().toISOString() : undefined
          }
        }
        return r
      })
    })
  }

  const handleDeleteReminder = (reminderId: string) => {
    setReminders((current) => (current || []).filter(r => r.id !== reminderId))
  }

  const handleSendEmail = (email: Omit<OutreachEmail, 'id' | 'createdAt' | 'createdBy'>) => {
    const newEmail: OutreachEmail = {
      ...email,
      id: generateId(),
      createdBy: 'Current User',
      createdAt: new Date().toISOString()
    }

    // setOutreachEmails((current) => [...(current || []), newEmail])
    trackAction('send-email', { prospectId: email.prospectId, templateId: email.templateId })
  }

  const filteredAndSortedProspects = useMemo(() => {
    const filtered = (prospects || []).filter(p => {
      const matchesSearch = p.companyName.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesIndustry = industryFilter === 'all' || p.industry === industryFilter
      const matchesState = stateFilter === 'all' || p.state === stateFilter
      const matchesScore = p.priorityScore >= minScore

      const matchesHealthGrade = advancedFilters.healthGrades.length === 0 ||
        advancedFilters.healthGrades.includes(p.healthScore.grade)

      const matchesStatus = advancedFilters.statuses.length === 0 ||
        advancedFilters.statuses.includes(p.status)

      const matchesSignalType = advancedFilters.signalTypes.length === 0 ||
        p.growthSignals.some(s => advancedFilters.signalTypes.includes(s.type))

      const matchesSentiment = advancedFilters.sentimentTrends.length === 0 ||
        advancedFilters.sentimentTrends.includes(p.healthScore.sentimentTrend)

      const matchesSignalCount = p.growthSignals.length >= advancedFilters.minSignalCount

      const yearsSinceDefault = Math.floor(p.timeSinceDefault / 365)
      const matchesDefaultAge = yearsSinceDefault >= advancedFilters.defaultAgeRange[0] &&
        yearsSinceDefault <= advancedFilters.defaultAgeRange[1]

      const revenue = p.estimatedRevenue || 0
      const matchesRevenue = revenue >= advancedFilters.revenueRange[0] &&
        revenue <= advancedFilters.revenueRange[1]

      const matchesViolations = advancedFilters.hasViolations === null ||
        (advancedFilters.hasViolations === true && p.healthScore.violationCount > 0) ||
        (advancedFilters.hasViolations === false && p.healthScore.violationCount === 0)

      return matchesSearch && matchesIndustry && matchesState && matchesScore &&
        matchesHealthGrade && matchesStatus && matchesSignalType && matchesSentiment &&
        matchesSignalCount && matchesDefaultAge && matchesRevenue && matchesViolations
    })

    return filtered.sort((a, b) => {
      let compareValue = 0

      switch (sortField) {
        case 'priorityScore':
          compareValue = a.priorityScore - b.priorityScore
          break
        case 'healthScore':
          compareValue = a.healthScore.score - b.healthScore.score
          break
        case 'signalCount':
          compareValue = a.growthSignals.length - b.growthSignals.length
          break
        case 'defaultAge':
          compareValue = a.timeSinceDefault - b.timeSinceDefault
          break
        case 'companyName':
          compareValue = a.companyName.localeCompare(b.companyName)
          break
      }

      return sortDirection === 'desc' ? -compareValue : compareValue
    })
  }, [prospects, searchQuery, industryFilter, stateFilter, minScore, advancedFilters, sortField, sortDirection])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (advancedFilters.healthGrades.length > 0) count++
    if (advancedFilters.statuses.length > 0) count++
    if (advancedFilters.signalTypes.length > 0) count++
    if (advancedFilters.sentimentTrends.length > 0) count++
    if (advancedFilters.minSignalCount > 0) count++
    if (advancedFilters.defaultAgeRange[0] > 0 || advancedFilters.defaultAgeRange[1] < 7) count++
    if (advancedFilters.revenueRange[0] > 0 || advancedFilters.revenueRange[1] < 10000000) count++
    if (advancedFilters.hasViolations !== null) count++
    return count
  }, [advancedFilters])

  const industries: IndustryType[] = ['restaurant', 'retail', 'construction', 'healthcare', 'manufacturing', 'services', 'technology']
  const states = Array.from(new Set((prospects || []).map(p => p.state))).sort()

  return (
    <div className="min-h-screen">
      <header className="mica-effect border-b-2 border-primary/20 sticky top-0 z-50 shadow-xl shadow-primary/10">
        <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-5">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-white truncate bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                UCC-MCA Intelligence Platform
              </h1>
              <p className="text-xs sm:text-sm text-white/80 hidden sm:block font-medium">
                Automated merchant cash advance opportunity discovery
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <ThemeToggle />
              <Button
                variant="outline"
                onClick={handleRefreshData}
                size="sm"
                className="glass-effect border-white/30 text-white hover:bg-white/10 hover:border-white/50"
              >
                <ArrowClockwise size={16} weight="bold" className="sm:mr-2" />
                <span className="hidden sm:inline">Refresh Data</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
        <div className="space-y-4 sm:space-y-6 md:space-y-8">
          {loadError && (
            <div className="glass-effect border border-red-500/40 rounded-lg p-4 text-red-100 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <p className="font-semibold">Failed to load live data</p>
                <p className="text-sm text-red-100/80">{loadError}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void fetchData()}
                className="border-red-500/60 text-red-100 hover:bg-red-500/20"
              >
                Retry
              </Button>
            </div>
          )}

          {isLoading && (
            <div className="glass-effect border border-white/20 rounded-lg p-4 text-sm text-white/80">
              Loading live data from ingestion services...
            </div>
          )}

          {stats ? (
            <StatsOverview stats={stats} />
          ) : (
            !isLoading && (
              <div className="glass-effect border border-white/10 rounded-lg p-4 text-sm text-white/70">
                No aggregated metrics are available yet. Refresh to pull the latest insights.
              </div>
            )
          )}

          {lastDataRefresh && (
            <StaleDataWarning
              lastUpdated={lastDataRefresh}
              onRefresh={handleRefreshData}
            />
          )}

          <Tabs defaultValue="prospects" className="w-full">
            <TabsList className="glass-effect grid w-full grid-cols-3 sm:grid-cols-6 mb-4 sm:mb-6 gap-1 sm:gap-0 h-auto sm:h-10 p-1">
              <TabsTrigger value="prospects" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2 sm:py-0">
                <Target size={16} weight="fill" className="sm:w-[18px] sm:h-[18px]" />
                <span className="hidden xs:inline">Prospects</span>
              </TabsTrigger>
              <TabsTrigger value="portfolio" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2 sm:py-0">
                <Heart size={16} weight="fill" className="sm:w-[18px] sm:h-[18px]" />
                <span className="hidden xs:inline">Portfolio</span>
              </TabsTrigger>
              <TabsTrigger value="intelligence" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2 sm:py-0">
                <ChartBar size={16} weight="fill" className="sm:w-[18px] sm:h-[18px]" />
                <span className="hidden xs:inline">Intelligence</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2 sm:py-0">
                <ChartLineUp size={16} weight="fill" className="sm:w-[18px] sm:h-[18px]" />
                <span className="hidden xs:inline">Analytics</span>
              </TabsTrigger>
              <TabsTrigger value="requalification" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2 sm:py-0">
                <ArrowClockwise size={16} weight="fill" className="sm:w-[18px] sm:h-[18px]" />
                <span className="hidden xs:inline">Re-qual</span>
              </TabsTrigger>
              <TabsTrigger value="agentic" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2 sm:py-0">
                <Robot size={16} weight="fill" className="sm:w-[18px] sm:h-[18px]" />
                <span className="hidden xs:inline">Agentic</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="prospects" className="space-y-4 sm:space-y-6">
              <div className="flex flex-col gap-3 sm:gap-4">
                <div className="relative flex-1">
                  <MagnifyingGlass
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70"
                  />
                  <Input
                    placeholder="Search companies..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 glass-effect border-white/30 text-white placeholder:text-white/50 h-10 sm:h-11"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Select value={industryFilter} onValueChange={setIndustryFilter}>
                    <SelectTrigger className="flex-1 min-w-[140px] sm:w-[180px] glass-effect border-white/30 text-white h-10 sm:h-11">
                      <SelectValue placeholder="Industry" />
                    </SelectTrigger>
                    <SelectContent className="glass-effect border-white/30">
                      <SelectItem value="all">All Industries</SelectItem>
                      {industries.map(ind => (
                        <SelectItem key={ind} value={ind} className="capitalize">
                          {ind}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={stateFilter} onValueChange={setStateFilter}>
                    <SelectTrigger className="flex-1 min-w-[100px] sm:w-[140px] glass-effect border-white/30 text-white h-10 sm:h-11">
                      <SelectValue placeholder="State" />
                    </SelectTrigger>
                    <SelectContent className="glass-effect border-white/30">
                      <SelectItem value="all">All States</SelectItem>
                      {states.map(state => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={minScore.toString()} onValueChange={(val) => setMinScore(Number(val))}>
                    <SelectTrigger className="flex-1 min-w-[120px] sm:w-[140px] glass-effect border-white/30 text-white h-10 sm:h-11">
                      <SelectValue placeholder="Min Score" />
                    </SelectTrigger>
                    <SelectContent className="glass-effect border-white/30">
                      <SelectItem value="0">Any Score</SelectItem>
                      <SelectItem value="50">50+</SelectItem>
                      <SelectItem value="70">70+ (High)</SelectItem>
                      <SelectItem value="85">85+ (Elite)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={exportFormat} onValueChange={(val) => setExportFormat(val as ExportFormat)}>
                    <SelectTrigger className="flex-1 min-w-[110px] sm:w-[130px] glass-effect border-white/30 text-white h-10 sm:h-11">
                      <SelectValue placeholder="Export Format" />
                    </SelectTrigger>
                    <SelectContent className="glass-effect border-white/30">
                      <SelectItem value="json">Export: JSON</SelectItem>
                      <SelectItem value="csv">Export: CSV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <div className="text-xs sm:text-sm text-white/70">
                      Showing {filteredAndSortedProspects.length} of {(prospects || []).length} prospects
                    </div>
                    <SortControls
                      sortField={sortField}
                      sortDirection={sortDirection}
                      onSortChange={(field, direction) => {
                        setSortField(field)
                        setSortDirection(direction)
                      }}
                    />
                  </div>
                  <AdvancedFilters
                    filters={advancedFilters}
                    onFiltersChange={setAdvancedFilters}
                    activeFilterCount={activeFilterCount}
                  />
                </div>

                <BatchOperations
                  prospects={filteredAndSortedProspects}
                  selectedIds={selectedProspectIds}
                  onSelectionChange={setSelectedProspectIds}
                  onBatchClaim={handleBatchClaim}
                  onBatchExport={handleBatchExport}
                  onBatchDelete={handleBatchDelete}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                  {filteredAndSortedProspects.map(prospect => {
                    const isSelected = selectedProspectIds.has(prospect.id)
                    return (
                      <div key={prospect.id} className="relative">
                        <div className="absolute top-3 sm:top-4 left-3 sm:left-4 z-10">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              const newSelected = new Set(selectedProspectIds)
                              if (checked) {
                                newSelected.add(prospect.id)
                              } else {
                                newSelected.delete(prospect.id)
                              }
                              setSelectedProspectIds(newSelected)
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="glass-effect border-white/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          />
                        </div>
                        <ProspectCard
                          prospect={prospect}
                          onSelect={handleProspectSelect}
                        />
                      </div>
                    )
                  })}
                </div>

                {filteredAndSortedProspects.length === 0 && (
                  <div className="text-center py-12 text-white/70 glass-effect rounded-lg p-8">
                    No prospects match your current filters
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="portfolio" className="space-y-4 sm:space-y-6">
              <PortfolioMonitor companies={portfolio || []} />
            </TabsContent>

            <TabsContent value="intelligence" className="space-y-4 sm:space-y-6">
              <div className="glass-effect p-4 sm:p-6 rounded-lg">
                <h2 className="text-xl sm:text-2xl font-semibold mb-2 text-white">Competitor Intelligence</h2>
                <p className="text-white/70 mb-4 sm:mb-6 text-sm sm:text-base">
                  Market analysis of UCC filing activity by secured parties
                </p>
                <CompetitorChart data={competitors || []} />
              </div>
              <LegacySearch />
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4 sm:space-y-6">
              <AnalyticsDashboard
                prospects={prospects || []}
                portfolio={portfolio || []}
              />
            </TabsContent>

            <TabsContent value="requalification" className="space-y-4 sm:space-y-6">
              <div className="text-center py-8 sm:py-12 glass-effect rounded-lg p-6 sm:p-8">
                <ArrowClockwise size={40} weight="fill" className="mx-auto mb-4 text-white/70 sm:w-12 sm:h-12" />
                <h3 className="text-lg sm:text-xl font-semibold mb-2 text-white">Lead Re-qualification Engine</h3>
                <p className="text-white/70 mb-4 sm:mb-6 max-w-md mx-auto text-sm sm:text-base">
                  Upload dead leads to detect new growth signals and recompute opportunity scores
                </p>
                <Button size="lg" className="h-10 sm:h-11">
                  Upload Lead List
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="agentic" className="space-y-4 sm:space-y-6">
              <AgenticDashboard
                agentic={agentic}
                competitors={competitors || []}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <ProspectDetailDialog
        prospect={selectedProspect}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onClaim={handleClaimLead}
        onUnclaim={handleUnclaimLead}
        onExport={handleExportProspect}
        notes={notes || []}
        reminders={reminders || []}
        onAddNote={handleAddNote}
        onDeleteNote={handleDeleteNote}
        onAddReminder={handleAddReminder}
        onCompleteReminder={handleCompleteReminder}
        onDeleteReminder={handleDeleteReminder}
        onSendEmail={handleSendEmail}
      />
    </div>
  )
}

export default App