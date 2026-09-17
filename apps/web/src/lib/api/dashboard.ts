import type { CompetitorData, DataTier, PortfolioCompany, Prospect } from '@public-records/core'
import type { UserAction } from '@/lib/agentic/types'
import { apiRequest } from './client'

export interface DashboardSnapshot {
  prospects: Prospect[]
  competitors: CompetitorData[]
  portfolio: PortfolioCompany[]
  userActions: UserAction[]
  dataTier: DataTier
}

function records(value: unknown, name: string): Record<string, unknown>[] {
  if (
    !Array.isArray(value) ||
    value.some((entry) => !entry || typeof entry !== 'object' || Array.isArray(entry))
  ) {
    throw new Error(`The dashboard returned an invalid ${name} collection.`)
  }
  return value as Record<string, unknown>[]
}

export async function fetchDashboard(signal?: AbortSignal): Promise<DashboardSnapshot> {
  const value = await apiRequest<unknown>('/dashboard', { signal })
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The dashboard returned an invalid snapshot.')
  }
  const snapshot = value as Record<string, unknown>
  if (snapshot.dataTier !== 'oss' && snapshot.dataTier !== 'paid') {
    throw new Error('The dashboard returned an invalid subscription tier.')
  }
  return {
    prospects: records(snapshot.prospects, 'prospects') as unknown as Prospect[],
    competitors: records(snapshot.competitors, 'competitors') as unknown as CompetitorData[],
    portfolio: records(snapshot.portfolio, 'portfolio') as unknown as PortfolioCompany[],
    userActions: records(snapshot.userActions, 'user actions') as unknown as UserAction[],
    dataTier: snapshot.dataTier
  }
}

export async function logDashboardAction(
  action: UserAction,
  signal?: AbortSignal
): Promise<UserAction> {
  return apiRequest<UserAction>('/dashboard/actions', { method: 'POST', body: action, signal })
}
