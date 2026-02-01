import { AnalyticsDashboard } from '@/components/AnalyticsDashboard'
import { Prospect, PortfolioCompany } from '@public-records/core'

interface AnalyticsTabProps {
  prospects: Prospect[]
  portfolio: PortfolioCompany[]
}

export function AnalyticsTab({ prospects, portfolio }: AnalyticsTabProps) {
  return <AnalyticsDashboard prospects={prospects} portfolio={portfolio} />
}
