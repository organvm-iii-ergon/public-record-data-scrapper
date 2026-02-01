/**
 * Competitor Analysis Component
 *
 * Visualizes competitor market dynamics and cascades agentic recommendations
 * forward into actionable insights for the user.
 */
import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { ScrollArea } from './ui/scroll-area'
import { TrendUp, ArrowUp, ArrowDown, Users, Target } from '@phosphor-icons/react'
import { CompetitorData } from '@/lib/types'
import { Improvement, ImprovementPriority } from '@/lib/agentic/types'

interface CompetitorAnalysisProps {
  competitors: CompetitorData[]
  improvements: Improvement[]
}

const priorityColors: Record<ImprovementPriority, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-blue-500'
}

const statusColors: Record<Improvement['status'], string> = {
  detected: 'bg-blue-500',
  analyzing: 'bg-cyan-500',
  approved: 'bg-amber-500',
  implementing: 'bg-orange-500',
  testing: 'bg-purple-500',
  completed: 'bg-emerald-500',
  rejected: 'bg-red-500'
}

function formatCurrency(value: number): string {
  return Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value)
}

export default function CompetitorAnalysis({ competitors, improvements }: CompetitorAnalysisProps) {
  const sortedCompetitors = useMemo(
    () => [...competitors].sort((a, b) => b.filingCount - a.filingCount),
    [competitors]
  )

  const totalFilings = useMemo(
    () => sortedCompetitors.reduce((sum, competitor) => sum + competitor.filingCount, 0),
    [sortedCompetitors]
  )

  const growingCompetitors = useMemo(
    () => sortedCompetitors.filter((competitor) => competitor.monthlyTrend >= 0).length,
    [sortedCompetitors]
  )

  const industryCoverage = useMemo(() => {
    const counts = new Map<string, number>()
    sortedCompetitors.forEach((competitor) => {
      competitor.industries.forEach((industry) => {
        counts.set(industry, (counts.get(industry) || 0) + 1)
      })
    })
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
  }, [sortedCompetitors])

  const competitorInsights = useMemo(() => {
    const priorityOrder: Record<ImprovementPriority, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1
    }

    return improvements
      .filter(
        (improvement) =>
          improvement.suggestion &&
          ['strategic', 'competitor-intelligence'].includes(improvement.suggestion.category)
      )
      .sort((a, b) => priorityOrder[b.suggestion.priority] - priorityOrder[a.suggestion.priority])
  }, [improvements])

  if (sortedCompetitors.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Competitor Analysis</CardTitle>
          <CardDescription>
            Market intelligence will populate automatically once competitor data is available.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The agentic engine has not ingested competitor filings yet. Run an analysis cycle to
            generate insights.
          </p>
        </CardContent>
      </Card>
    )
  }

  const topCompetitors = sortedCompetitors.slice(0, 5)
  const leadingCompetitor = sortedCompetitors[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Competitor Analysis</CardTitle>
        <CardDescription>
          Up-to-date market share intelligence with cascaded recommendations from the agentic
          council.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border bg-gradient-to-br from-blue-50 to-cyan-50 p-4 dark:from-blue-950 dark:to-cyan-950">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Total annual filings</span>
              <TrendUp className="h-4 w-4 text-cyan-500" />
            </div>
            <div className="mt-2 text-2xl font-semibold">{totalFilings.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Aggregated from {sortedCompetitors.length} secured party lenders
            </p>
          </div>

          <div className="rounded-xl border bg-gradient-to-br from-emerald-50 to-teal-50 p-4 dark:from-emerald-950 dark:to-teal-950">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Market leader</span>
              <Users className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-semibold">{leadingCompetitor.lenderName}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-emerald-500/60 text-emerald-600 dark:text-emerald-300"
              >
                {leadingCompetitor.marketShare.toFixed(1)}% share
              </Badge>
              <span>Avg deal {formatCurrency(leadingCompetitor.avgDealSize)}</span>
            </p>
          </div>

          <div className="rounded-xl border bg-gradient-to-br from-amber-50 to-orange-50 p-4 dark:from-amber-950 dark:to-orange-950">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Growth outlook</span>
              <Target className="h-4 w-4 text-orange-500" />
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {growingCompetitors}/{sortedCompetitors.length}
            </div>
            <p className="text-xs text-muted-foreground">Competitors with positive monthly trend</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border lg:col-span-2">
            <div className="border-b p-4">
              <h3 className="text-sm font-semibold">Top competitors by filing activity</h3>
              <p className="text-xs text-muted-foreground">
                Market share and trajectory for the leading secured parties
              </p>
            </div>
            <ScrollArea className="max-h-[320px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Competitor</TableHead>
                    <TableHead className="text-right">Filings</TableHead>
                    <TableHead className="text-right">Avg deal</TableHead>
                    <TableHead className="text-right">Market share</TableHead>
                    <TableHead className="text-right">Trend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topCompetitors.map((competitor, index) => {
                    const positiveTrend = competitor.monthlyTrend >= 0
                    return (
                      <TableRow key={competitor.lenderName}>
                        <TableCell className="font-medium">#{index + 1}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{competitor.lenderName}</span>
                            <span className="text-xs text-muted-foreground">
                              Top state: {competitor.topState}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {competitor.filingCount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(competitor.avgDealSize)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-end">
                            <span className="text-sm font-medium">
                              {competitor.marketShare.toFixed(1)}%
                            </span>
                            <Progress
                              value={Math.min(100, competitor.marketShare)}
                              className="mt-1 h-1.5 w-32"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="outline"
                            className={
                              positiveTrend
                                ? 'border-green-500/60 text-green-600 dark:text-green-300'
                                : 'border-red-500/60 text-red-600 dark:text-red-300'
                            }
                          >
                            {positiveTrend ? (
                              <ArrowUp className="mr-1 h-3.5 w-3.5" />
                            ) : (
                              <ArrowDown className="mr-1 h-3.5 w-3.5" />
                            )}
                            {Math.abs(competitor.monthlyTrend).toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>

          <div className="rounded-xl border p-4">
            <h3 className="text-sm font-semibold">Industry coverage</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Dominant niches targeted by active competitors
            </p>
            <div className="space-y-3">
              {industryCoverage.map(([industry, count]) => (
                <div key={industry} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize">{industry}</span>
                    <Badge variant="secondary">{count} competitors</Badge>
                  </div>
                  <Progress value={(count / sortedCompetitors.length) * 100} className="h-1.5" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border">
          <div className="flex items-center justify-between border-b p-4">
            <div>
              <h3 className="text-sm font-semibold">Agentic recommendations</h3>
              <p className="text-xs text-muted-foreground">
                Strategic actions cascaded forward from the council review
              </p>
            </div>
            <Badge variant="outline" className="text-muted-foreground">
              {competitorInsights.length} insights
            </Badge>
          </div>
          <div className="space-y-4 p-4">
            {competitorInsights.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No strategic recommendations have been generated yet. Run a council review to
                surface opportunities.
              </p>
            ) : (
              competitorInsights.map((improvement) => (
                <div
                  key={improvement.id}
                  className="rounded-lg border bg-muted/40 p-4 transition hover:bg-muted/60"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={priorityColors[improvement.suggestion.priority]}>
                      {improvement.suggestion.priority}
                    </Badge>
                    <Badge className={statusColors[improvement.status]}>{improvement.status}</Badge>
                    <span className="text-xs text-muted-foreground">
                      Safety {improvement.suggestion.safetyScore}/100
                    </span>
                  </div>
                  <h4 className="mt-2 text-sm font-semibold">{improvement.suggestion.title}</h4>
                  <p className="text-sm text-muted-foreground">
                    {improvement.suggestion.reasoning}
                  </p>
                  {improvement.result && (
                    <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-300">
                      {improvement.result.feedback}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
