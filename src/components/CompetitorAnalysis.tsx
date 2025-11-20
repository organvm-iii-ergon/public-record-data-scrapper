import { ReactNode, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Skeleton } from './ui/skeleton'
import { CompetitorChart } from './CompetitorChart'
import { CompetitorData } from '@/lib/types'
import {
  ArrowDownRight,
  ArrowUpRight,
  ChartPieSlice,
  TrendDown,
  TrendUp,
  UsersThree
} from '@phosphor-icons/react'

interface CompetitorAnalysisProps {
  data: CompetitorData[]
  isLoading?: boolean
  lastUpdated?: string
}

interface CompetitorSnapshot {
  totalFilings: number
  avgDealSize: number
  shareLeader: CompetitorData | null
  shareChallenger: CompetitorData | null
  topMover: CompetitorData | null
  topDecliner: CompetitorData | null
  topGainers: CompetitorData[]
  topLosers: CompetitorData[]
  concentratedShare: number
  stateHotspots: Array<{ state: string; filings: number }>
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value)
}

function formatPercent(value: number) {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

function formatDateLabel(value?: string) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleString()
}

export default function CompetitorAnalysis({ data, isLoading = false, lastUpdated }: CompetitorAnalysisProps) {
  const snapshot = useMemo<CompetitorSnapshot>(() => {
    if (!data || data.length === 0) {
      return {
        totalFilings: 0,
        avgDealSize: 0,
        shareLeader: null,
        shareChallenger: null,
        topMover: null,
        topDecliner: null,
        topGainers: [],
        topLosers: [],
        concentratedShare: 0,
        stateHotspots: []
      }
    }

    const shareSorted = [...data].sort((a, b) => b.marketShare - a.marketShare)
    const trendSorted = [...data].sort((a, b) => b.monthlyTrend - a.monthlyTrend)

    const totalFilings = data.reduce((sum, competitor) => sum + competitor.filingCount, 0)
    const avgDealSize = data.reduce((sum, competitor) => sum + competitor.avgDealSize, 0) / data.length

    const shareLeader = shareSorted[0] ?? null
    const shareChallenger = shareSorted[1] ?? null
    const topMover = trendSorted[0] ?? null
    const topDecliner = trendSorted[trendSorted.length - 1] ?? null

    const topGainers = trendSorted.filter(item => item.monthlyTrend > 0).slice(0, 3)
    const topLosers = [...trendSorted].reverse().filter(item => item.monthlyTrend < 0).slice(0, 3)

    const concentratedShare = shareSorted.slice(0, 3).reduce((sum, item) => sum + item.marketShare, 0)

    const stateHotspots = Object.entries(
      data.reduce<Record<string, number>>((acc, competitor) => {
        acc[competitor.topState] = (acc[competitor.topState] || 0) + competitor.filingCount
        return acc
      }, {})
    )
      .map(([state, filings]) => ({ state, filings }))
      .sort((a, b) => b.filings - a.filings)
      .slice(0, 3)

    return {
      totalFilings,
      avgDealSize,
      shareLeader,
      shareChallenger,
      topMover,
      topDecliner,
      topGainers,
      topLosers,
      concentratedShare,
      stateHotspots
    }
  }, [data])

  const lastUpdatedLabel = useMemo(() => formatDateLabel(lastUpdated), [lastUpdated])

  const insights = useMemo(() => {
    const messages: Array<{ icon: ReactNode; title: string; description: string }> = []

    if (snapshot.topMover && snapshot.topMover.monthlyTrend > 0) {
      messages.push({
        icon: <TrendUp className="h-4 w-4 text-emerald-500" weight="bold" />,
        title: 'Growth Alert',
        description: `${snapshot.topMover.lenderName} is accelerating with ${formatPercent(snapshot.topMover.monthlyTrend)} MoM filings growth. Shore up defenses in ${snapshot.topMover.topState}.`
      })
    }

    if (snapshot.shareLeader && snapshot.shareChallenger) {
      const gap = snapshot.shareLeader.marketShare - snapshot.shareChallenger.marketShare
      messages.push({
        icon: <ChartPieSlice className="h-4 w-4 text-sky-500" weight="bold" />,
        title: 'Market Share Gap',
        description: `${snapshot.shareLeader.lenderName} leads by ${gap.toFixed(1)} pts over ${snapshot.shareChallenger.lenderName}. Target mid-market borrowers to close the gap.`
      })
    }

    if (snapshot.topDecliner && snapshot.topDecliner.monthlyTrend < 0) {
      messages.push({
        icon: <TrendDown className="h-4 w-4 text-rose-500" weight="bold" />,
        title: 'Churn Opportunity',
        description: `${snapshot.topDecliner.lenderName} filings fell ${Math.abs(snapshot.topDecliner.monthlyTrend).toFixed(1)}%. Approach their clients for share capture.`
      })
    }

    if (snapshot.stateHotspots[0]) {
      const hotspot = snapshot.stateHotspots[0]
      messages.push({
        icon: <ArrowUpRight className="h-4 w-4 text-amber-500" weight="bold" />,
        title: 'Regional Heat',
        description: `${hotspot.state} is the busiest state with ${hotspot.filings.toLocaleString()} filings last cycle. Prioritize coverage there.`
      })
    }

    return messages
  }, [snapshot])

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Competitor Analysis</CardTitle>
          <CardDescription>Live intelligence on lender activity, share concentration, and momentum shifts.</CardDescription>
        </div>
        {lastUpdatedLabel && (
          <Badge variant="outline" className="font-mono text-xs">
            Last updated {lastUpdatedLabel}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-24 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-80 rounded-2xl" />
            <div className="grid gap-6 md:grid-cols-2">
              <Skeleton className="h-48 rounded-2xl" />
              <Skeleton className="h-48 rounded-2xl" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-28 rounded-xl" />
              ))}
            </div>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <UsersThree className="h-12 w-12 text-muted-foreground" weight="duotone" />
            <div>
              <h3 className="text-lg font-semibold">No competitor data</h3>
              <p className="text-sm text-muted-foreground">
                Load filings or sync your market feed to unlock competitor intelligence.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border bg-gradient-to-br from-sky-500/10 to-cyan-500/10 p-4">
                <p className="text-xs font-medium text-muted-foreground">Total Filings (Top Cohort)</p>
                <p className="mt-2 text-2xl font-semibold">{snapshot.totalFilings.toLocaleString()}</p>
                {snapshot.topMover && snapshot.topMover.monthlyTrend > 0 && (
                  <p className="mt-1 text-xs text-emerald-500">
                    <TrendUp className="mr-1 inline h-3 w-3" weight="bold" />
                    {snapshot.topMover.lenderName} +{snapshot.topMover.monthlyTrend.toFixed(1)}%
                  </p>
                )}
              </div>
              <div className="rounded-2xl border bg-gradient-to-br from-emerald-500/10 to-lime-500/10 p-4">
                <p className="text-xs font-medium text-muted-foreground">Average Deal Size</p>
                <p className="mt-2 text-2xl font-semibold">{formatCurrency(snapshot.avgDealSize)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Based on {data.length} active lenders
                </p>
              </div>
              <div className="rounded-2xl border bg-gradient-to-br from-fuchsia-500/10 to-purple-500/10 p-4">
                <p className="text-xs font-medium text-muted-foreground">Share Concentration</p>
                <p className="mt-2 text-2xl font-semibold">{snapshot.concentratedShare.toFixed(1)}%</p>
                <p className="mt-1 text-xs text-muted-foreground">Top 3 lenders combined share</p>
              </div>
              <div className="rounded-2xl border bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-4">
                <p className="text-xs font-medium text-muted-foreground">Market Leader</p>
                {snapshot.shareLeader ? (
                  <>
                    <p className="mt-2 text-lg font-semibold leading-tight">{snapshot.shareLeader.lenderName}</p>
                    <p className="text-xs text-muted-foreground">
                      {snapshot.shareLeader.marketShare.toFixed(1)}% share · {snapshot.shareLeader.filingCount.toLocaleString()} filings
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-lg font-semibold">—</p>
                )}
              </div>
            </div>

            <CompetitorChart data={data} />

            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">Top Movers</h3>
                  <Badge variant="outline" className="text-xs">
                    Momentum shifts
                  </Badge>
                </div>
                <div className="mt-4 space-y-4">
                  <div>
                    <h4 className="text-xs font-medium uppercase text-muted-foreground">Gainers</h4>
                    {snapshot.topGainers.length > 0 ? (
                      <ul className="mt-2 space-y-2">
                        {snapshot.topGainers.map(competitor => (
                          <li key={`${competitor.lenderName}-gainer`} className="flex items-center justify-between rounded-lg bg-emerald-500/5 px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{competitor.lenderName}</p>
                              <p className="text-xs text-muted-foreground">{competitor.topState} focus · {competitor.filingCount.toLocaleString()} filings</p>
                            </div>
                            <span className="ml-3 flex items-center text-sm font-semibold text-emerald-500">
                              <ArrowUpRight className="mr-1 h-4 w-4" weight="bold" />
                              {competitor.monthlyTrend.toFixed(1)}%
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">No positive momentum this cycle.</p>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-medium uppercase text-muted-foreground">Decliners</h4>
                    {snapshot.topLosers.length > 0 ? (
                      <ul className="mt-2 space-y-2">
                        {snapshot.topLosers.map(competitor => (
                          <li key={`${competitor.lenderName}-decliner`} className="flex items-center justify-between rounded-lg bg-rose-500/5 px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{competitor.lenderName}</p>
                              <p className="text-xs text-muted-foreground">{competitor.topState} focus · {competitor.filingCount.toLocaleString()} filings</p>
                            </div>
                            <span className="ml-3 flex items-center text-sm font-semibold text-rose-500">
                              <ArrowDownRight className="mr-1 h-4 w-4" weight="bold" />
                              {competitor.monthlyTrend.toFixed(1)}%
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">No significant declines detected.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">Market Share Watchlist</h3>
                  <Badge variant="secondary" className="text-xs uppercase">
                    Focus 5
                  </Badge>
                </div>
                <div className="mt-4 space-y-3">
                  {[...data]
                    .sort((a, b) => b.marketShare - a.marketShare)
                    .slice(0, 5)
                    .map((competitor, index) => (
                      <div key={`${competitor.lenderName}-share`} className="flex items-center justify-between rounded-lg border px-3 py-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] font-mono">
                              #{index + 1}
                            </Badge>
                            <p className="truncate text-sm font-medium">{competitor.lenderName}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {competitor.marketShare.toFixed(1)}% share · Avg deal {formatCurrency(competitor.avgDealSize)}
                          </p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <div className="font-semibold text-sm text-foreground">{competitor.filingCount.toLocaleString()}</div>
                          <div className="flex items-center justify-end gap-1">
                            {competitor.monthlyTrend >= 0 ? (
                              <TrendUp className="h-3.5 w-3.5 text-emerald-500" weight="bold" />
                            ) : (
                              <TrendDown className="h-3.5 w-3.5 text-rose-500" weight="bold" />
                            )}
                            <span className={competitor.monthlyTrend >= 0 ? 'text-emerald-500 font-semibold' : 'text-rose-500 font-semibold'}>
                              {competitor.monthlyTrend.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {insights.length > 0 && (
              <div>
                <h3 className="text-base font-semibold">Actionable Intelligence</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {insights.map((insight, index) => (
                    <div key={index} className="rounded-2xl border bg-muted/40 p-4">
                      <div className="flex items-start gap-3">
                        <div className="rounded-full bg-background p-2 shadow-sm">
                          {insight.icon}
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold">{insight.title}</p>
                          <p className="text-xs text-muted-foreground">{insight.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
