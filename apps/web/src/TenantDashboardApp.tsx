import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { ArrowClockwise, X } from '@phosphor-icons/react'
import { Button } from '@public-records/ui/button'
import { Tabs, TabsContent } from '@public-records/ui/tabs'
import type { DataTier, Prospect } from '@public-records/core'
import { toast } from 'sonner'

import { StatsOverview } from '@/components/StatsOverview'
import { StaleDataWarning } from '@/components/StaleDataWarning'
import { LoadingAndErrorState, MobileBottomNav, TabNavigation } from '@/components/layout'
import { CompetitorChart } from '@/components/CompetitorChart'
import { ProspectsTab } from '@/features/prospects'
import { PortfolioTab } from '@/features/portfolio'
import { AnalyticsTab } from '@/features/analytics'
import { RequalificationTab } from '@/features/requalification'
import { AgenticTab } from '@/features/agentic'
import { useProspectFilters } from '@/hooks/useProspectFilters'
import { useProspectSorting } from '@/hooks/useProspectSorting'
import { useProspectSelection } from '@/hooks/useProspectSelection'
import { useDataFetching } from '@/hooks/useDataFetching'
import { useAgenticEngine } from '@/hooks/use-agentic-engine'
import { useSystemContext } from '@/hooks/useSystemContext'
import { generateDashboardStats } from '@/lib/dashboardStats'
import type { ExportFormat } from '@/lib/exportUtils'

function PremiumSurface({ dataTier, children }: { dataTier: DataTier; children: ReactNode }) {
  if (dataTier === 'paid') return <>{children}</>
  return (
    <div className="glass-effect rounded-lg border border-white/10 p-8 text-center">
      <h2 className="text-xl font-semibold text-white">Premium tenant surface</h2>
      <p className="mt-2 text-white/70">
        Your authenticated tenant subscription does not include this surface.
      </p>
    </div>
  )
}

export default function TenantDashboardApp() {
  const data = useDataFetching({ useMockData: false })
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json')
  const filters = useProspectFilters(data.prospects)
  const sorting = useProspectSorting(filters.filteredProspects)
  const selection = useProspectSelection()
  const systemContext = useSystemContext({
    prospects: data.prospects,
    competitors: data.competitors,
    portfolio: data.portfolio,
    userActions: data.userActions
  })
  const agentic = useAgenticEngine(systemContext, {
    enabled: true,
    autonomousExecutionEnabled: false,
    safetyThreshold: 80
  })
  const stats = useMemo(() => {
    if (data.prospects.length === 0 || data.portfolio.length === 0) return null
    try {
      return generateDashboardStats(data.prospects, data.portfolio)
    } catch {
      return null
    }
  }, [data.prospects, data.portfolio])
  const { fetchData, loadError } = data
  const refresh = useCallback(async () => {
    const success = await fetchData()
    if (success) toast.success('Tenant data refreshed')
    else toast.error('Refresh failed', { description: loadError ?? 'Unable to load tenant data.' })
  }, [fetchData, loadError])
  const noOp = useCallback(() => undefined, [])

  return (
    <div className="min-h-screen">
      <header className="glass-effect sticky top-0 z-40 border-b border-white/10">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold text-white">UCC MCA Tenant Dashboard</h1>
            <p className="text-xs text-white/60">Authenticated authoritative records</p>
          </div>
          <Button variant="outline" onClick={() => void refresh()} disabled={data.isLoading}>
            <ArrowClockwise size={18} />
            Refresh
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-3 py-4 pb-20 sm:px-4 sm:py-6 md:px-6 md:py-8 md:pb-8">
        <div className="space-y-4 sm:space-y-6 md:space-y-8">
          <LoadingAndErrorState
            isLoading={data.isLoading}
            loadError={data.loadError}
            isDemoFallback={false}
            onRetry={() => void data.fetchData()}
          />
          {stats && <StatsOverview stats={stats} />}
          {data.lastDataRefresh && (
            <StaleDataWarning lastUpdated={data.lastDataRefresh} onRefresh={refresh} />
          )}

          <Tabs defaultValue="prospects" className="w-full">
            <TabNavigation tenantDashboard />
            <TabsContent value="prospects" className="space-y-4 sm:space-y-6">
              <ProspectsTab
                readOnly
                prospects={data.prospects}
                filteredProspects={sorting.sortedProspects}
                totalCount={data.prospects.length}
                searchQuery={filters.searchQuery}
                industryFilter={filters.industryFilter}
                stateFilter={filters.stateFilter}
                minScore={filters.minScore}
                advancedFilters={filters.advancedFilters}
                activeFilterCount={filters.activeFilterCount}
                industries={filters.industries}
                states={filters.states}
                sortField={sorting.sortField}
                sortDirection={sorting.sortDirection}
                selectedIds={selection.selectedIds}
                exportFormat={exportFormat}
                onSearchChange={filters.setSearchQuery}
                onIndustryChange={filters.setIndustryFilter}
                onStateChange={filters.setStateFilter}
                onMinScoreChange={filters.setMinScore}
                onAdvancedFiltersChange={filters.setAdvancedFilters}
                onSortChange={sorting.handleSortChange}
                onSelectionChange={selection.setSelectedIds}
                onExportFormatChange={setExportFormat}
                onProspectSelect={setSelectedProspect}
                onBatchClaim={noOp}
                onBatchExport={noOp}
                onBatchDelete={noOp}
              />
              {selectedProspect && (
                <section className="glass-effect relative rounded-lg border border-white/10 p-5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-3 top-3"
                    onClick={() => setSelectedProspect(null)}
                    aria-label="Close prospect details"
                  >
                    <X size={18} />
                  </Button>
                  <h2 className="pr-10 text-xl font-semibold text-white">
                    {selectedProspect.companyName}
                  </h2>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-white/60">Industry</dt>
                      <dd className="text-white">{selectedProspect.industry}</dd>
                    </div>
                    <div>
                      <dt className="text-white/60">State</dt>
                      <dd className="text-white">{selectedProspect.state}</dd>
                    </div>
                    <div>
                      <dt className="text-white/60">Priority score</dt>
                      <dd className="text-white">{selectedProspect.priorityScore}</dd>
                    </div>
                  </dl>
                  <p className="mt-4 text-sm text-white/80">{selectedProspect.narrative}</p>
                </section>
              )}
            </TabsContent>

            <TabsContent value="portfolio" className="space-y-4 sm:space-y-6">
              <PortfolioTab portfolio={data.portfolio} />
            </TabsContent>

            <TabsContent value="intelligence" className="space-y-4 sm:space-y-6">
              <PremiumSurface dataTier={data.dataTier}>
                <div className="glass-effect rounded-lg p-4 sm:p-6">
                  <h2 className="text-xl font-semibold text-white sm:text-2xl">
                    Competitor Intelligence
                  </h2>
                  <p className="mb-6 mt-2 text-white/70">
                    Tenant-scoped UCC filing activity by secured party
                  </p>
                  <CompetitorChart data={data.competitors} />
                </div>
              </PremiumSurface>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4 sm:space-y-6">
              <PremiumSurface dataTier={data.dataTier}>
                <AnalyticsTab
                  prospects={data.prospects}
                  portfolio={data.portfolio}
                  dataTier={data.dataTier}
                  usePreviewData={false}
                />
              </PremiumSurface>
            </TabsContent>

            <TabsContent value="requalification" className="space-y-4 sm:space-y-6">
              <PremiumSurface dataTier={data.dataTier}>
                <RequalificationTab prospects={data.prospects} />
              </PremiumSurface>
            </TabsContent>

            <TabsContent value="agentic" className="space-y-4 sm:space-y-6">
              <PremiumSurface dataTier={data.dataTier}>
                <AgenticTab agentic={agentic} competitors={data.competitors} />
              </PremiumSurface>
            </TabsContent>
            <MobileBottomNav tenantDashboard />
          </Tabs>
        </div>
      </main>
    </div>
  )
}
