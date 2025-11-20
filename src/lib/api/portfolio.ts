import { PortfolioCompany } from '@/lib/types'
import { apiRequest } from './client'

export async function fetchPortfolio(signal?: AbortSignal): Promise<PortfolioCompany[]> {
  return apiRequest<PortfolioCompany[]>('/portfolio', { signal })
}
