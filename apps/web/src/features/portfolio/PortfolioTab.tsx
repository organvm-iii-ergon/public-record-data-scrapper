import { PortfolioMonitor } from '@/components/PortfolioMonitor'
import { PortfolioCompany } from '@public-records/core'

interface PortfolioTabProps {
  portfolio: PortfolioCompany[]
}

export function PortfolioTab({ portfolio }: PortfolioTabProps) {
  return <PortfolioMonitor companies={portfolio} />
}
