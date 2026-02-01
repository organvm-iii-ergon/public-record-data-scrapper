import { PortfolioMonitor } from '@/components/PortfolioMonitor'
import { PortfolioCompany } from '@/lib/types'

interface PortfolioTabProps {
  portfolio: PortfolioCompany[]
}

export function PortfolioTab({ portfolio }: PortfolioTabProps) {
  return <PortfolioMonitor companies={portfolio} />
}
