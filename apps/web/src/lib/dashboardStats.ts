import type { Prospect, PortfolioCompany, DashboardStats, HealthGrade } from '@public-records/core'

export function generateDashboardStats(
  prospects: Prospect[],
  portfolio: PortfolioCompany[]
): DashboardStats {
  const highValueProspects = prospects.filter((p) => p.priorityScore >= 70).length
  const avgPriorityScore =
    prospects.length === 0
      ? 0
      : Math.round(prospects.reduce((sum, p) => sum + p.priorityScore, 0) / prospects.length)
  const newSignalsToday = prospects.reduce((sum, p) => {
    const todaySignals = p.growthSignals.filter((s) => {
      const daysDiff = (Date.now() - new Date(s.detectedDate).getTime()) / (1000 * 60 * 60 * 24)
      return daysDiff < 1
    })
    return sum + todaySignals.length
  }, 0)
  const portfolioAtRisk = portfolio.filter(
    (c) => c.currentStatus === 'at-risk' || c.currentStatus === 'default'
  ).length

  const avgGradeScore =
    portfolio.length === 0
      ? 0
      : portfolio.reduce((sum, c) => {
          const gradeValues: Record<HealthGrade, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 }
          return sum + gradeValues[c.healthScore.grade]
        }, 0) / portfolio.length

  const avgHealthGrade =
    portfolio.length === 0
      ? 'N/A'
      : avgGradeScore >= 3.5
        ? 'A-'
        : avgGradeScore >= 2.5
          ? 'B'
          : avgGradeScore >= 1.5
            ? 'C'
            : 'D'

  return {
    totalProspects: prospects.length,
    highValueProspects,
    avgPriorityScore,
    newSignalsToday,
    portfolioAtRisk,
    avgHealthGrade
  }
}
