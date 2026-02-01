import type { DataTier, PortfolioCompany } from '@public-records/core'
import { apiRequest } from './client'

export async function fetchPortfolio(
  signal?: AbortSignal,
  options: { dataTier?: DataTier } = {}
): Promise<PortfolioCompany[]> {
  const headers = options.dataTier ? { 'x-data-tier': options.dataTier } : undefined
  return apiRequest<PortfolioCompany[]>('/portfolio', { signal, headers })
}
