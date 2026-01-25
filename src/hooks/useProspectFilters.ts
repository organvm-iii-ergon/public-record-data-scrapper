import { useState, useMemo } from 'react'
import { Prospect, IndustryType } from '@/lib/types'
import { AdvancedFilterState, initialFilters } from '@/components/AdvancedFilters'

export interface ProspectFiltersState {
  searchQuery: string
  industryFilter: string
  stateFilter: string
  minScore: number
  advancedFilters: AdvancedFilterState
}

export interface ProspectFiltersActions {
  setSearchQuery: (query: string) => void
  setIndustryFilter: (industry: string) => void
  setStateFilter: (state: string) => void
  setMinScore: (score: number) => void
  setAdvancedFilters: (filters: AdvancedFilterState) => void
  resetFilters: () => void
}

export function useProspectFilters(prospects: Prospect[]) {
  const [searchQuery, setSearchQuery] = useState('')
  const [industryFilter, setIndustryFilter] = useState<string>('all')
  const [stateFilter, setStateFilter] = useState<string>('all')
  const [minScore, setMinScore] = useState<number>(0)
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilterState>(initialFilters)

  const filteredProspects = useMemo(() => {
    return prospects.filter((p) => {
      const matchesSearch = p.companyName.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesIndustry = industryFilter === 'all' || p.industry === industryFilter
      const matchesState = stateFilter === 'all' || p.state === stateFilter
      const matchesScore = p.priorityScore >= minScore

      const matchesHealthGrade =
        advancedFilters.healthGrades.length === 0 ||
        advancedFilters.healthGrades.includes(p.healthScore.grade)

      const matchesStatus =
        advancedFilters.statuses.length === 0 || advancedFilters.statuses.includes(p.status)

      const matchesSignalType =
        advancedFilters.signalTypes.length === 0 ||
        p.growthSignals.some((s) => advancedFilters.signalTypes.includes(s.type))

      const matchesSentiment =
        advancedFilters.sentimentTrends.length === 0 ||
        advancedFilters.sentimentTrends.includes(p.healthScore.sentimentTrend)

      const matchesSignalCount = p.growthSignals.length >= advancedFilters.minSignalCount

      const yearsSinceDefault = Math.floor(p.timeSinceDefault / 365)
      const matchesDefaultAge =
        yearsSinceDefault >= advancedFilters.defaultAgeRange[0] &&
        yearsSinceDefault <= advancedFilters.defaultAgeRange[1]

      const revenue = p.estimatedRevenue || 0
      const matchesRevenue =
        revenue >= advancedFilters.revenueRange[0] && revenue <= advancedFilters.revenueRange[1]

      const matchesViolations =
        advancedFilters.hasViolations === null ||
        (advancedFilters.hasViolations === true && p.healthScore.violationCount > 0) ||
        (advancedFilters.hasViolations === false && p.healthScore.violationCount === 0)

      return (
        matchesSearch &&
        matchesIndustry &&
        matchesState &&
        matchesScore &&
        matchesHealthGrade &&
        matchesStatus &&
        matchesSignalType &&
        matchesSentiment &&
        matchesSignalCount &&
        matchesDefaultAge &&
        matchesRevenue &&
        matchesViolations
      )
    })
  }, [prospects, searchQuery, industryFilter, stateFilter, minScore, advancedFilters])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (advancedFilters.healthGrades.length > 0) count++
    if (advancedFilters.statuses.length > 0) count++
    if (advancedFilters.signalTypes.length > 0) count++
    if (advancedFilters.sentimentTrends.length > 0) count++
    if (advancedFilters.minSignalCount > 0) count++
    if (advancedFilters.defaultAgeRange[0] > 0 || advancedFilters.defaultAgeRange[1] < 7) count++
    if (advancedFilters.revenueRange[0] > 0 || advancedFilters.revenueRange[1] < 10000000) count++
    if (advancedFilters.hasViolations !== null) count++
    return count
  }, [advancedFilters])

  const industries: IndustryType[] = [
    'restaurant',
    'retail',
    'construction',
    'healthcare',
    'manufacturing',
    'services',
    'technology'
  ]

  const states = useMemo(
    () => Array.from(new Set(prospects.map((p) => p.state))).sort(),
    [prospects]
  )

  const resetFilters = () => {
    setSearchQuery('')
    setIndustryFilter('all')
    setStateFilter('all')
    setMinScore(0)
    setAdvancedFilters(initialFilters)
  }

  return {
    // State
    searchQuery,
    industryFilter,
    stateFilter,
    minScore,
    advancedFilters,
    // Derived
    filteredProspects,
    activeFilterCount,
    industries,
    states,
    // Actions
    setSearchQuery,
    setIndustryFilter,
    setStateFilter,
    setMinScore,
    setAdvancedFilters,
    resetFilters
  }
}
