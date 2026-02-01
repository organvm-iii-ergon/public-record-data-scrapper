import { useMemo } from 'react'
import { SystemContext, PerformanceMetrics } from '@/lib/agentic/types'
import { Prospect, Competitor, PortfolioCompany, UserAction } from '@/lib/types'

interface UseSystemContextOptions {
  prospects: Prospect[]
  competitors: Competitor[]
  portfolio: PortfolioCompany[]
  userActions: UserAction[]
}

/**
 * Creates a memoized SystemContext for the agentic engine.
 * Includes performance metrics with default values.
 */
export function useSystemContext({
  prospects,
  competitors,
  portfolio,
  userActions
}: UseSystemContextOptions): SystemContext {
  return useMemo(
    () => ({
      prospects,
      competitors,
      portfolio,
      userActions,
      performanceMetrics: {
        avgResponseTime: 450,
        errorRate: 0.02,
        userSatisfactionScore: 7.5,
        dataFreshnessScore: 85
      } as PerformanceMetrics,
      timestamp: new Date().toISOString()
    }),
    [prospects, competitors, portfolio, userActions]
  )
}
