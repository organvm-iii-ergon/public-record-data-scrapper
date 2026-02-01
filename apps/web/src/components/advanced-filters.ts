import type { HealthGrade, SignalType, ProspectStatus } from '@public-records/core'

export interface AdvancedFilterState {
  healthGrades: HealthGrade[]
  statuses: ProspectStatus[]
  signalTypes: SignalType[]
  sentimentTrends: ('improving' | 'stable' | 'declining')[]
  minSignalCount: number
  defaultAgeRange: [number, number]
  revenueRange: [number, number]
  hasViolations: boolean | null
}

export const initialFilters: AdvancedFilterState = {
  healthGrades: [],
  statuses: [],
  signalTypes: [],
  sentimentTrends: [],
  minSignalCount: 0,
  defaultAgeRange: [0, 7],
  revenueRange: [0, 10000000],
  hasViolations: null
}
