import type { CompetitorData, DataTier } from '@public-records/core'
import { apiRequest } from './client'

export async function fetchCompetitors(
  signal?: AbortSignal,
  options: { dataTier?: DataTier } = {}
): Promise<CompetitorData[]> {
  const headers = options.dataTier ? { 'x-data-tier': options.dataTier } : undefined
  return apiRequest<CompetitorData[]>('/competitors', { signal, headers })
}
