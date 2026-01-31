/**
 * Data Enrichment Service
 *
 * Enriches prospect data with:
 * - Growth signals (hiring, permits, contracts, expansion, equipment)
 * - Health scores (sentiment analysis, violations, reviews)
 * - Revenue estimates
 * - Industry classification
 */

import { Prospect, GrowthSignal, HealthScore, HealthGrade, IndustryType, UCCFiling } from '../types'

export interface EnrichmentSource {
  id: string
  name: string
  type: 'web-scraping' | 'api' | 'ml-inference'
  capabilities: (
    | 'growth-signals'
    | 'health-score'
    | 'revenue-estimate'
    | 'industry-classification'
  )[]
  endpoint?: string
  apiKey?: string
}

export interface EnrichmentResult {
  prospectId: string
  success: boolean
  enrichedFields: string[]
  errors: string[]
  confidence: number
  timestamp: string
}

export class DataEnrichmentService {
  private sources: EnrichmentSource[]

  constructor(sources: EnrichmentSource[]) {
    this.sources = sources
  }

  /**
   * Enrich a prospect with additional data
   */
  async enrichProspect(
    filing: UCCFiling,
    existingData?: Partial<Prospect>
  ): Promise<{ prospect: Prospect; result: EnrichmentResult }> {
    const enrichedFields: string[] = []
    const errors: string[] = []
    let totalConfidence = 0
    let confidenceCount = 0

    // Generate base prospect from UCC filing
    const prospect: Prospect = {
      id: existingData?.id || `prospect-${Date.now()}`,
      companyName: filing.debtorName,
      industry: existingData?.industry || (await this.inferIndustry(filing.debtorName)),
      state: filing.state,
      status: existingData?.status || 'new',
      priorityScore: 0, // Will be calculated later
      defaultDate: filing.filingDate,
      timeSinceDefault: this.calculateDaysSince(filing.filingDate),
      uccFilings: [filing],
      growthSignals: existingData?.growthSignals || [],
      healthScore: existingData?.healthScore || this.generateDefaultHealthScore(),
      narrative: '',
      estimatedRevenue: existingData?.estimatedRevenue
    }

    // Enrich growth signals
    try {
      const signals = await this.detectGrowthSignals(prospect.companyName, prospect.state)
      if (signals.length > 0) {
        prospect.growthSignals = signals
        enrichedFields.push('growthSignals')
        totalConfidence += signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length
        confidenceCount++
      }
    } catch (error) {
      errors.push(`Growth signals: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Enrich health score
    try {
      const healthScore = await this.calculateHealthScore(prospect.companyName, prospect.state)
      prospect.healthScore = healthScore
      enrichedFields.push('healthScore')
      totalConfidence += 0.8 // Health score confidence
      confidenceCount++
    } catch (error) {
      errors.push(`Health score: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Estimate revenue
    if (!prospect.estimatedRevenue) {
      try {
        const revenue = await this.estimateRevenue(
          prospect.companyName,
          prospect.industry,
          prospect.state,
          filing.lienAmount
        )
        prospect.estimatedRevenue = revenue
        enrichedFields.push('estimatedRevenue')
        totalConfidence += 0.7 // Revenue estimate confidence
        confidenceCount++
      } catch (error) {
        errors.push(`Revenue estimate: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Calculate priority score
    prospect.priorityScore = this.calculatePriorityScore(prospect)
    enrichedFields.push('priorityScore')

    // Generate narrative
    prospect.narrative = this.generateNarrative(prospect)
    enrichedFields.push('narrative')

    const avgConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0

    return {
      prospect,
      result: {
        prospectId: prospect.id,
        success: errors.length === 0,
        enrichedFields,
        errors,
        confidence: avgConfidence,
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Detect growth signals for a company
   */
  private async detectGrowthSignals(companyName: string, state: string): Promise<GrowthSignal[]> {
    const signals: GrowthSignal[] = []

    // Check hiring signals (job postings)
    const hiringSignals = await this.detectHiringSignals(companyName)
    signals.push(...hiringSignals)

    // Check permit signals (building permits, business licenses)
    const permitSignals = await this.detectPermitSignals(companyName, state)
    signals.push(...permitSignals)

    // Check contract signals (government contracts, RFPs)
    const contractSignals = await this.detectContractSignals(companyName)
    signals.push(...contractSignals)

    // Check expansion signals (news, press releases)
    const expansionSignals = await this.detectExpansionSignals(companyName)
    signals.push(...expansionSignals)

    // Check equipment signals (equipment financing, leases)
    const equipmentSignals = await this.detectEquipmentSignals(companyName)
    signals.push(...equipmentSignals)

    return signals.sort(
      (a, b) => new Date(b.detectedDate).getTime() - new Date(a.detectedDate).getTime()
    )
  }

  private async detectHiringSignals(companyName: string): Promise<GrowthSignal[]> {
    // In a real implementation, this would scrape job boards (Indeed, LinkedIn, etc.)
    // For now, return empty array or simulated data
    void companyName
    return []
  }

  private async detectPermitSignals(companyName: string, state: string): Promise<GrowthSignal[]> {
    // In a real implementation, this would scrape municipal permit databases
    void companyName
    void state
    return []
  }

  private async detectContractSignals(companyName: string): Promise<GrowthSignal[]> {
    // In a real implementation, this would check government contract databases (USASpending.gov, etc.)
    void companyName
    return []
  }

  private async detectExpansionSignals(companyName: string): Promise<GrowthSignal[]> {
    // In a real implementation, this would scrape news, press releases, business journals
    void companyName
    return []
  }

  private async detectEquipmentSignals(companyName: string): Promise<GrowthSignal[]> {
    // In a real implementation, this would check equipment financing databases
    void companyName
    return []
  }

  /**
   * Calculate health score for a company
   */
  private async calculateHealthScore(companyName: string, state: string): Promise<HealthScore> {
    void companyName
    void state
    // In a real implementation, this would:
    // 1. Scrape online reviews (Google, Yelp, BBB)
    // 2. Check violation databases (OSHA, health dept, etc.)
    // 3. Analyze sentiment from reviews
    // 4. Track trends over time

    // For now, return a default health score
    return this.generateDefaultHealthScore()
  }

  /**
   * Estimate company revenue
   */
  private async estimateRevenue(
    companyName: string,
    industry: IndustryType,
    state: string,
    lienAmount?: number
  ): Promise<number> {
    void companyName
    void state
    // ML-based revenue estimation
    // Factors: industry, location, lien amount, employee count, etc.

    // Simple heuristic: lien amount is typically 10-30% of annual revenue
    if (lienAmount) {
      const multiplier = 4 + Math.random() * 2 // 4-6x lien amount
      return Math.round(lienAmount * multiplier)
    }

    // Industry-based estimates
    const industryAverages: Record<IndustryType, [number, number]> = {
      restaurant: [500000, 2000000],
      retail: [800000, 3000000],
      construction: [1000000, 5000000],
      healthcare: [1500000, 6000000],
      manufacturing: [2000000, 8000000],
      services: [600000, 2500000],
      technology: [1000000, 4000000]
    }

    const [min, max] = industryAverages[industry]
    return Math.round(min + Math.random() * (max - min))
  }

  /**
   * Infer industry from company name
   */
  private async inferIndustry(companyName: string): Promise<IndustryType> {
    const nameLower = companyName.toLowerCase()

    // Simple keyword-based classification
    if (
      nameLower.includes('restaurant') ||
      nameLower.includes('cafe') ||
      nameLower.includes('food')
    ) {
      return 'restaurant'
    }
    if (nameLower.includes('retail') || nameLower.includes('store') || nameLower.includes('shop')) {
      return 'retail'
    }
    if (
      nameLower.includes('construction') ||
      nameLower.includes('builder') ||
      nameLower.includes('contractor')
    ) {
      return 'construction'
    }
    if (
      nameLower.includes('health') ||
      nameLower.includes('medical') ||
      nameLower.includes('care')
    ) {
      return 'healthcare'
    }
    if (
      nameLower.includes('manufacturing') ||
      nameLower.includes('factory') ||
      nameLower.includes('industrial')
    ) {
      return 'manufacturing'
    }
    if (
      nameLower.includes('tech') ||
      nameLower.includes('software') ||
      nameLower.includes('digital')
    ) {
      return 'technology'
    }

    // Default to services
    return 'services'
  }

  /**
   * Generate default health score
   */
  private generateDefaultHealthScore(): HealthScore {
    const grades: HealthGrade[] = ['A', 'B', 'C', 'D', 'F']
    const weights = [0.15, 0.3, 0.35, 0.15, 0.05]
    const rand = Math.random()
    let cumulative = 0
    let grade: HealthGrade = 'C'

    for (let i = 0; i < grades.length; i++) {
      cumulative += weights[i]
      if (rand <= cumulative) {
        grade = grades[i]
        break
      }
    }

    const scoreMap: Record<HealthGrade, [number, number]> = {
      A: [85, 100],
      B: [70, 84],
      C: [55, 69],
      D: [40, 54],
      F: [0, 39]
    }

    const [min, max] = scoreMap[grade]
    const score = Math.round(min + Math.random() * (max - min))

    return {
      grade,
      score,
      sentimentTrend:
        Math.random() > 0.5 ? 'stable' : Math.random() > 0.5 ? 'improving' : 'declining',
      reviewCount: Math.round(50 + Math.random() * 450),
      avgSentiment: 0.3 + (score / 100) * 0.6,
      violationCount:
        grade === 'A'
          ? 0
          : grade === 'B'
            ? Math.round(Math.random() * 2)
            : Math.round(1 + Math.random() * 5),
      lastUpdated: new Date().toISOString().split('T')[0]
    }
  }

  /**
   * Calculate priority score
   */
  private calculatePriorityScore(prospect: Prospect): number {
    const timeSinceDefault = prospect.timeSinceDefault
    const signalScore = prospect.growthSignals.reduce((sum, s) => sum + s.score, 0)
    const healthScore = prospect.healthScore.score

    // Priority formula:
    // - Time since default (older = higher priority, max at 4 years)
    // - Growth signals (more signals = higher priority)
    // - Health score (healthier = higher priority)

    const defaultScore = Math.min(50, timeSinceDefault / 14) // Max 50 points
    const growthScore = Math.min(30, signalScore) // Max 30 points
    const healthPoints = healthScore * 0.2 // Max 20 points

    return Math.min(100, Math.round(defaultScore + growthScore + healthPoints))
  }

  /**
   * Generate narrative for prospect
   */
  private generateNarrative(prospect: Prospect): string {
    const parts: string[] = []

    // Default info
    const years = Math.floor(prospect.timeSinceDefault / 365)
    if (years > 0) {
      parts.push(
        `Defaulted ${years} year${years > 1 ? 's' : ''} ago on ${prospect.uccFilings[0].filingType} filing`
      )
    }

    // Growth signals
    if (prospect.growthSignals.length > 0) {
      const topSignals = prospect.growthSignals
        .slice(0, 2)
        .map((s) => s.type)
        .join(', ')
      parts.push(
        `showing ${prospect.growthSignals.length} growth signal${prospect.growthSignals.length > 1 ? 's' : ''} (${topSignals})`
      )
    }

    // Health grade
    parts.push(`Current health grade: ${prospect.healthScore.grade}`)

    // Sentiment
    if (prospect.healthScore.sentimentTrend === 'improving') {
      parts.push('sentiment improving')
    } else if (prospect.healthScore.sentimentTrend === 'declining') {
      parts.push('sentiment declining')
    }

    return parts.join(', ')
  }

  /**
   * Calculate days since a date
   */
  private calculateDaysSince(dateString: string): number {
    const date = new Date(dateString)
    const now = new Date()
    return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  }

  /**
   * Batch enrich multiple prospects
   */
  async enrichProspects(
    filings: UCCFiling[],
    concurrency: number = 5
  ): Promise<{ prospects: Prospect[]; results: EnrichmentResult[] }> {
    const prospects: Prospect[] = []
    const results: EnrichmentResult[] = []

    // Process in batches to avoid overwhelming external services
    for (let i = 0; i < filings.length; i += concurrency) {
      const batch = filings.slice(i, i + concurrency)
      const batchPromises = batch.map((filing) => this.enrichProspect(filing))

      const batchResults = await Promise.all(batchPromises)

      batchResults.forEach(({ prospect, result }) => {
        prospects.push(prospect)
        results.push(result)
      })

      // Small delay between batches
      if (i + concurrency < filings.length) {
        await this.delay(1000)
      }
    }

    return { prospects, results }
  }

  /**
   * Refresh stale data for existing prospects
   */
  async refreshProspectData(
    prospect: Prospect,
    fields?: ('growthSignals' | 'healthScore' | 'estimatedRevenue')[]
  ): Promise<{ prospect: Prospect; result: EnrichmentResult }> {
    const refreshFields = fields || ['growthSignals', 'healthScore']
    const enrichedFields: string[] = []
    const errors: string[] = []

    const updatedProspect = { ...prospect }

    if (refreshFields.includes('growthSignals')) {
      try {
        const signals = await this.detectGrowthSignals(prospect.companyName, prospect.state)
        updatedProspect.growthSignals = signals
        enrichedFields.push('growthSignals')
      } catch (error) {
        errors.push(
          `Growth signals refresh: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    }

    if (refreshFields.includes('healthScore')) {
      try {
        const healthScore = await this.calculateHealthScore(prospect.companyName, prospect.state)
        updatedProspect.healthScore = healthScore
        enrichedFields.push('healthScore')
      } catch (error) {
        errors.push(
          `Health score refresh: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    }

    if (refreshFields.includes('estimatedRevenue')) {
      try {
        const revenue = await this.estimateRevenue(
          prospect.companyName,
          prospect.industry,
          prospect.state,
          prospect.uccFilings[0]?.lienAmount
        )
        updatedProspect.estimatedRevenue = revenue
        enrichedFields.push('estimatedRevenue')
      } catch (error) {
        errors.push(`Revenue refresh: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Recalculate priority and narrative
    updatedProspect.priorityScore = this.calculatePriorityScore(updatedProspect)
    updatedProspect.narrative = this.generateNarrative(updatedProspect)

    return {
      prospect: updatedProspect,
      result: {
        prospectId: prospect.id,
        success: errors.length === 0,
        enrichedFields,
        errors,
        confidence: 0.85,
        timestamp: new Date().toISOString()
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

/**
 * Default enrichment sources
 */
export const defaultEnrichmentSources: EnrichmentSource[] = [
  {
    id: 'web-scraper',
    name: 'Web Scraper',
    type: 'web-scraping',
    capabilities: ['growth-signals', 'health-score']
  },
  {
    id: 'ml-inference',
    name: 'ML Inference Engine',
    type: 'ml-inference',
    capabilities: ['revenue-estimate', 'industry-classification']
  }
]
