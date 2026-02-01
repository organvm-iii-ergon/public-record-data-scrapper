import { AnalyticsDashboard } from '@/components/AnalyticsDashboard'
import { Prospect, PortfolioCompany } from '@/lib/types'

interface AnalyticsTabProps {
  prospects: Prospect[]
  portfolio: PortfolioCompany[]
}

export function AnalyticsTab({ prospects, portfolio }: AnalyticsTabProps) {
  return <AnalyticsDashboard prospects={prospects} portfolio={portfolio} />
}
