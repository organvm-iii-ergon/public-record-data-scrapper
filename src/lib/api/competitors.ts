import { CompetitorData } from '@/lib/types'
import { apiRequest } from './client'

export async function fetchCompetitors(signal?: AbortSignal): Promise<CompetitorData[]> {
  return apiRequest<CompetitorData[]>('/competitors', { signal })
}
