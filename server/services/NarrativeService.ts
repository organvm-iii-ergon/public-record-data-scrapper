/**
 * Narrative Generator Service
 *
 * Generates broker-ready stories and talking points from prospect data.
 * Transforms raw data into actionable sales intelligence including:
 * - Compelling narratives for sales calls
 * - Whale opportunity detection
 * - Talking points and conversation starters
 * - Risk factor summaries
 * - Growth signal interpretations
 *
 * Example output:
 * "ABC Construction defaulted 4 years ago but remains Active with 3 growth signals.
 *  Recent permit activity and hiring suggests expansion. Ideal for 2nd position funding."
 */

import { database } from '../database/connection'

/**
 * Prospect data for narrative generation
 */
export interface NarrativeProspectData {
  id: string
  companyName: string
  industry: string
  state: string
  defaultDate?: string
  daysSinceDefault: number
  status: string

  // Scoring
  intentScore: number
  healthScore: number
  positionScore: number
  compositeScore: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'

  // UCC Data
  totalFilings: number
  activeFilings: number
  lapsedFilings: number
  terminatedFilings: number
  lastFilingDate?: string
  daysSinceLastFiling: number

  // Growth Signals
  growthSignals: GrowthSignal[]

  // Health Metrics
  reviewCount: number
  avgRating: number
  sentimentTrend: 'improving' | 'stable' | 'declining'
  violationCount: number
  yearsInBusiness: number

  // Stack Position
  estimatedStackPosition: number
  knownCompetitorPositions: string[]

  // Revenue (if available)
  estimatedRevenue?: number
  revenueConfidence?: number
}

export interface GrowthSignal {
  type: 'hiring' | 'permit' | 'contract' | 'expansion' | 'equipment'
  description: string
  detectedDate: string
  score: number
  confidence: number
}

/**
 * Generated narrative output
 */
export interface ProspectNarrative {
  prospectId: string
  companyName: string

  // Main narrative
  summary: string
  detailedNarrative: string

  // Talking points for sales calls
  talkingPoints: TalkingPoint[]

  // Whale detection
  isWhaleOpportunity: boolean
  whaleScore?: number
  whaleReasons?: string[]

  // Risk summary
  riskFactors: RiskFactor[]
  riskLevel: 'low' | 'medium' | 'high'

  // Growth interpretation
  growthAnalysis: string
  topGrowthSignals: GrowthSignal[]

  // Stack position insight
  stackInsight: string
  suggestedPosition: string

  // Recommended approach
  approachRecommendation: 'aggressive' | 'standard' | 'cautious' | 'pass'
  approachReasoning: string

  // Call opener suggestions
  callOpeners: string[]

  // Objection handlers
  potentialObjections: ObjectionHandler[]

  generatedAt: string
}

export interface TalkingPoint {
  category: 'strength' | 'opportunity' | 'caution' | 'question'
  point: string
  priority: number
}

export interface RiskFactor {
  factor: string
  severity: 'low' | 'medium' | 'high'
  mitigation?: string
}

export interface ObjectionHandler {
  objection: string
  response: string
  supportingData?: string
}

/**
 * Whale detection criteria
 */
interface WhaleDetectionConfig {
  minDaysSinceDefault: number
  maxActiveFilings: number
  minGrowthSignals: number
  minHealthScore: number
  minEstimatedRevenue?: number
}

const DEFAULT_WHALE_CONFIG: WhaleDetectionConfig = {
  minDaysSinceDefault: 1095, // 3+ years
  maxActiveFilings: 2,
  minGrowthSignals: 2,
  minHealthScore: 60
}

/**
 * Industry-specific narrative templates
 */
const INDUSTRY_INSIGHTS: Record<string, {
  commonNeeds: string[]
  seasonalPatterns: string
  typicalUseCases: string[]
}> = {
  restaurant: {
    commonNeeds: ['equipment upgrades', 'inventory financing', 'expansion capital', 'renovation funding'],
    seasonalPatterns: 'Higher demand before busy seasons (summer, holidays)',
    typicalUseCases: ['POS system upgrades', 'kitchen equipment', 'second location', 'outdoor seating expansion']
  },
  retail: {
    commonNeeds: ['inventory financing', 'seasonal stock', 'store improvements', 'marketing capital'],
    seasonalPatterns: 'Peak demand before Q4 holiday season',
    typicalUseCases: ['holiday inventory', 'store renovation', 'e-commerce expansion', 'marketing campaigns']
  },
  construction: {
    commonNeeds: ['equipment purchases', 'project financing', 'payroll bridge', 'materials inventory'],
    seasonalPatterns: 'Higher demand in spring for summer projects',
    typicalUseCases: ['heavy equipment', 'vehicle fleet', 'bonding requirements', 'project startup costs']
  },
  healthcare: {
    commonNeeds: ['equipment financing', 'practice expansion', 'technology upgrades', 'staffing'],
    seasonalPatterns: 'Generally consistent year-round',
    typicalUseCases: ['medical equipment', 'EMR systems', 'new location', 'staff hiring']
  },
  manufacturing: {
    commonNeeds: ['equipment upgrades', 'inventory financing', 'expansion capital', 'working capital'],
    seasonalPatterns: 'Varies by specific industry segment',
    typicalUseCases: ['machinery upgrades', 'raw materials', 'warehouse expansion', 'automation equipment']
  },
  services: {
    commonNeeds: ['working capital', 'equipment', 'marketing', 'expansion'],
    seasonalPatterns: 'Generally consistent, may vary by service type',
    typicalUseCases: ['marketing campaigns', 'technology investments', 'hiring', 'new service offerings']
  },
  technology: {
    commonNeeds: ['equipment', 'talent acquisition', 'marketing', 'R&D'],
    seasonalPatterns: 'Generally consistent year-round',
    typicalUseCases: ['server infrastructure', 'development team expansion', 'product launch', 'marketing']
  }
}

export class NarrativeService {
  private whaleConfig: WhaleDetectionConfig

  constructor(whaleConfig: Partial<WhaleDetectionConfig> = {}) {
    this.whaleConfig = { ...DEFAULT_WHALE_CONFIG, ...whaleConfig }
  }

  /**
   * Generate full narrative for a prospect
   */
  async generateNarrative(prospectId: string): Promise<ProspectNarrative> {
    // Fetch prospect data
    const data = await this.fetchProspectData(prospectId)

    // Generate components
    const summary = this.generateSummary(data)
    const detailedNarrative = this.generateDetailedNarrative(data)
    const talkingPoints = this.generateTalkingPoints(data)
    const whaleAnalysis = this.detectWhaleOpportunity(data)
    const riskAnalysis = this.analyzeRisks(data)
    const growthAnalysis = this.analyzeGrowth(data)
    const stackInsight = this.generateStackInsight(data)
    const approach = this.determineApproach(data, riskAnalysis.riskLevel, whaleAnalysis.isWhale)
    const callOpeners = this.generateCallOpeners(data)
    const objectionHandlers = this.generateObjectionHandlers(data)

    return {
      prospectId,
      companyName: data.companyName,
      summary,
      detailedNarrative,
      talkingPoints,
      isWhaleOpportunity: whaleAnalysis.isWhale,
      whaleScore: whaleAnalysis.score,
      whaleReasons: whaleAnalysis.reasons,
      riskFactors: riskAnalysis.factors,
      riskLevel: riskAnalysis.riskLevel,
      growthAnalysis: growthAnalysis.analysis,
      topGrowthSignals: growthAnalysis.topSignals,
      stackInsight: stackInsight.insight,
      suggestedPosition: stackInsight.suggestedPosition,
      approachRecommendation: approach.recommendation,
      approachReasoning: approach.reasoning,
      callOpeners,
      potentialObjections: objectionHandlers,
      generatedAt: new Date().toISOString()
    }
  }

  /**
   * Generate concise summary
   */
  private generateSummary(data: NarrativeProspectData): string {
    const parts: string[] = []

    // Company and default history
    if (data.defaultDate && data.daysSinceDefault > 0) {
      const years = Math.round(data.daysSinceDefault / 365)
      if (years >= 1) {
        parts.push(`${data.companyName} defaulted ${years} year${years > 1 ? 's' : ''} ago but remains ${data.status}`)
      } else {
        const months = Math.round(data.daysSinceDefault / 30)
        parts.push(`${data.companyName} defaulted ${months} month${months > 1 ? 's' : ''} ago`)
      }
    } else {
      parts.push(`${data.companyName} is a ${data.industry} business in ${data.state}`)
    }

    // Growth signals
    if (data.growthSignals.length > 0) {
      parts.push(`with ${data.growthSignals.length} growth signal${data.growthSignals.length > 1 ? 's' : ''}`)
    }

    // Stack position hint
    if (data.estimatedStackPosition <= 1) {
      parts.push('- ideal for 1st position funding')
    } else if (data.estimatedStackPosition <= 2) {
      parts.push(`- potential ${data.estimatedStackPosition === 2 ? '2nd' : '3rd+'} position opportunity`)
    }

    return parts.join(' ') + '.'
  }

  /**
   * Generate detailed narrative
   */
  private generateDetailedNarrative(data: NarrativeProspectData): string {
    const paragraphs: string[] = []

    // Opening paragraph - business overview
    paragraphs.push(this.generateBusinessOverview(data))

    // Financial history paragraph
    paragraphs.push(this.generateFinancialHistoryParagraph(data))

    // Current health paragraph
    paragraphs.push(this.generateHealthParagraph(data))

    // Growth signals paragraph
    if (data.growthSignals.length > 0) {
      paragraphs.push(this.generateGrowthParagraph(data))
    }

    // Opportunity paragraph
    paragraphs.push(this.generateOpportunityParagraph(data))

    return paragraphs.join('\n\n')
  }

  /**
   * Generate business overview paragraph
   */
  private generateBusinessOverview(data: NarrativeProspectData): string {
    const industryInsight = INDUSTRY_INSIGHTS[data.industry]
    let overview = `${data.companyName} is a ${data.industry} business operating in ${data.state}`

    if (data.yearsInBusiness > 0) {
      overview += ` with ${data.yearsInBusiness} years in business`
    }

    if (data.estimatedRevenue) {
      const revenueStr = this.formatRevenue(data.estimatedRevenue)
      overview += `. Estimated annual revenue: ${revenueStr}`
      if (data.revenueConfidence && data.revenueConfidence < 70) {
        overview += ' (estimate confidence: moderate)'
      }
    }

    overview += '.'

    if (industryInsight) {
      overview += ` ${data.industry.charAt(0).toUpperCase() + data.industry.slice(1)} businesses typically need funding for ${industryInsight.commonNeeds.slice(0, 2).join(' and ')}.`
    }

    return overview
  }

  /**
   * Generate financial history paragraph
   */
  private generateFinancialHistoryParagraph(data: NarrativeProspectData): string {
    let paragraph = ''

    if (data.defaultDate) {
      const years = Math.round(data.daysSinceDefault / 365)
      const defaultDateStr = new Date(data.defaultDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

      if (years >= 3) {
        paragraph = `The company experienced a default in ${defaultDateStr}, but ${years} years have passed since then, indicating potential recovery.`
      } else if (years >= 1) {
        paragraph = `A default occurred in ${defaultDateStr} (${years} year${years > 1 ? 's' : ''} ago). While still relatively recent, the business continues to operate.`
      } else {
        paragraph = `Recent default in ${defaultDateStr}. Exercise caution - recovery timeline is still early.`
      }
    }

    // UCC history
    if (data.totalFilings > 0) {
      paragraph += ` UCC history shows ${data.totalFilings} total filing${data.totalFilings > 1 ? 's' : ''}`
      if (data.activeFilings > 0) {
        paragraph += ` with ${data.activeFilings} currently active`
      }
      if (data.terminatedFilings > 0) {
        paragraph += ` and ${data.terminatedFilings} terminated (paid off)`
      }
      paragraph += '.'
    } else {
      paragraph += ' No prior UCC filings on record - potentially a first-time borrower.'
    }

    return paragraph
  }

  /**
   * Generate health paragraph
   */
  private generateHealthParagraph(data: NarrativeProspectData): string {
    let paragraph = `Current health indicators: Grade ${data.grade} (score: ${data.healthScore}/100).`

    if (data.reviewCount > 0) {
      paragraph += ` Online reputation shows ${data.avgRating.toFixed(1)}/5 rating across ${data.reviewCount} reviews`
      if (data.sentimentTrend === 'improving') {
        paragraph += ' with improving sentiment trend'
      } else if (data.sentimentTrend === 'declining') {
        paragraph += ', though sentiment is declining'
      }
      paragraph += '.'
    }

    if (data.violationCount > 0) {
      paragraph += ` Note: ${data.violationCount} regulatory violation${data.violationCount > 1 ? 's' : ''} on record.`
    }

    return paragraph
  }

  /**
   * Generate growth signals paragraph
   */
  private generateGrowthParagraph(data: NarrativeProspectData): string {
    const signals = data.growthSignals.slice(0, 3) // Top 3 signals
    const signalDescriptions = signals.map(s => {
      const typeLabel = this.getSignalTypeLabel(s.type)
      return `${typeLabel}: ${s.description}`
    })

    let paragraph = `Growth indicators detected: ${signalDescriptions.join('; ')}.`

    // Interpret the signals
    const hasHiring = signals.some(s => s.type === 'hiring')
    const hasPermit = signals.some(s => s.type === 'permit')
    const hasExpansion = signals.some(s => s.type === 'expansion')

    if (hasHiring && hasExpansion) {
      paragraph += ' The combination of hiring activity and expansion signals suggests active business growth.'
    } else if (hasPermit) {
      paragraph += ' Permit activity often precedes significant capital expenditures.'
    } else if (hasHiring) {
      paragraph += ' Hiring activity indicates growing operational capacity.'
    }

    return paragraph
  }

  /**
   * Generate opportunity paragraph
   */
  private generateOpportunityParagraph(data: NarrativeProspectData): string {
    const industryInsight = INDUSTRY_INSIGHTS[data.industry]
    let paragraph = ''

    // Stack position opportunity
    if (data.estimatedStackPosition === 1) {
      paragraph = 'With no current positions, this represents a clean 1st position opportunity.'
    } else if (data.estimatedStackPosition === 2) {
      paragraph = `Currently has ${data.activeFilings} active position${data.activeFilings > 1 ? 's' : ''}. Potential 2nd position opportunity.`
    } else {
      paragraph = `Multiple existing positions (estimated ${data.estimatedStackPosition}th position). Consider carefully for stack placement.`
    }

    // Industry-specific timing
    if (industryInsight) {
      paragraph += ` ${industryInsight.seasonalPatterns}.`
    }

    // Recommended use of funds
    if (industryInsight) {
      const useCases = industryInsight.typicalUseCases.slice(0, 2).join(' or ')
      paragraph += ` Common funding uses in ${data.industry}: ${useCases}.`
    }

    return paragraph
  }

  /**
   * Generate talking points
   */
  private generateTalkingPoints(data: NarrativeProspectData): TalkingPoint[] {
    const points: TalkingPoint[] = []

    // Strengths
    if (data.yearsInBusiness >= 5) {
      points.push({
        category: 'strength',
        point: `${data.yearsInBusiness} years in business shows stability and resilience`,
        priority: 1
      })
    }

    if (data.healthScore >= 70) {
      points.push({
        category: 'strength',
        point: 'Strong health score indicates solid business fundamentals',
        priority: 2
      })
    }

    if (data.terminatedFilings > 0) {
      points.push({
        category: 'strength',
        point: `History of ${data.terminatedFilings} paid-off financing shows repayment capability`,
        priority: 1
      })
    }

    if (data.sentimentTrend === 'improving') {
      points.push({
        category: 'strength',
        point: 'Improving customer sentiment trend - business is gaining momentum',
        priority: 3
      })
    }

    // Opportunities
    for (const signal of data.growthSignals.slice(0, 3)) {
      points.push({
        category: 'opportunity',
        point: `${this.getSignalTypeLabel(signal.type)}: ${signal.description}`,
        priority: signal.score > 70 ? 1 : 2
      })
    }

    if (data.estimatedStackPosition <= 2) {
      points.push({
        category: 'opportunity',
        point: `Favorable stack position (${data.estimatedStackPosition === 1 ? '1st' : '2nd'} position available)`,
        priority: 1
      })
    }

    // Cautions
    if (data.daysSinceDefault < 730) { // Less than 2 years
      points.push({
        category: 'caution',
        point: 'Relatively recent default - verify recovery evidence',
        priority: 1
      })
    }

    if (data.violationCount > 0) {
      points.push({
        category: 'caution',
        point: `${data.violationCount} regulatory violation(s) on record - discuss during due diligence`,
        priority: 2
      })
    }

    if (data.activeFilings >= 3) {
      points.push({
        category: 'caution',
        point: `${data.activeFilings} active positions - verify payment capacity`,
        priority: 1
      })
    }

    // Questions to ask
    points.push({
      category: 'question',
      point: 'What is the primary use of funds being considered?',
      priority: 1
    })

    if (data.growthSignals.length > 0) {
      const signalTypes = [...new Set(data.growthSignals.map(s => s.type))]
      if (signalTypes.includes('hiring')) {
        points.push({
          category: 'question',
          point: 'How many new positions are you looking to fill?',
          priority: 2
        })
      }
      if (signalTypes.includes('expansion')) {
        points.push({
          category: 'question',
          point: 'Tell me about your expansion plans - new location or service lines?',
          priority: 2
        })
      }
    }

    // Sort by priority
    return points.sort((a, b) => a.priority - b.priority)
  }

  /**
   * Detect whale opportunity
   */
  private detectWhaleOpportunity(data: NarrativeProspectData): {
    isWhale: boolean
    score?: number
    reasons?: string[]
  } {
    const reasons: string[] = []
    let score = 0

    // Check criteria
    if (data.daysSinceDefault >= this.whaleConfig.minDaysSinceDefault) {
      score += 25
      reasons.push(`${Math.round(data.daysSinceDefault / 365)}+ years since default`)
    }

    if (data.activeFilings <= this.whaleConfig.maxActiveFilings) {
      score += 20
      reasons.push('Low current positions (room for funding)')
    }

    if (data.growthSignals.length >= this.whaleConfig.minGrowthSignals) {
      score += 25
      reasons.push(`${data.growthSignals.length} active growth signals`)
    }

    if (data.healthScore >= this.whaleConfig.minHealthScore) {
      score += 20
      reasons.push('Strong health indicators')
    }

    if (this.whaleConfig.minEstimatedRevenue && data.estimatedRevenue &&
        data.estimatedRevenue >= this.whaleConfig.minEstimatedRevenue) {
      score += 10
      reasons.push(`Revenue ${this.formatRevenue(data.estimatedRevenue)}+`)
    }

    const isWhale = score >= 70

    return isWhale
      ? { isWhale: true, score, reasons }
      : { isWhale: false }
  }

  /**
   * Analyze risks
   */
  private analyzeRisks(data: NarrativeProspectData): {
    factors: RiskFactor[]
    riskLevel: 'low' | 'medium' | 'high'
  } {
    const factors: RiskFactor[] = []

    // Recent default
    if (data.daysSinceDefault < 365) {
      factors.push({
        factor: 'Default less than 1 year ago',
        severity: 'high',
        mitigation: 'Require larger down payment or collateral'
      })
    } else if (data.daysSinceDefault < 730) {
      factors.push({
        factor: 'Default less than 2 years ago',
        severity: 'medium',
        mitigation: 'Verify consistent revenue for past 6 months'
      })
    }

    // Stack depth
    if (data.activeFilings >= 4) {
      factors.push({
        factor: `${data.activeFilings} active positions - heavily leveraged`,
        severity: 'high',
        mitigation: 'Verify payment-to-revenue ratio is under 20%'
      })
    } else if (data.activeFilings >= 2) {
      factors.push({
        factor: `${data.activeFilings} active positions`,
        severity: 'medium',
        mitigation: 'Request bank statements to verify cash flow'
      })
    }

    // Violations
    if (data.violationCount >= 3) {
      factors.push({
        factor: `${data.violationCount} regulatory violations`,
        severity: 'high',
        mitigation: 'Investigate nature and resolution of violations'
      })
    } else if (data.violationCount > 0) {
      factors.push({
        factor: `${data.violationCount} regulatory violation(s)`,
        severity: 'medium',
        mitigation: 'Verify violations are resolved'
      })
    }

    // Declining sentiment
    if (data.sentimentTrend === 'declining') {
      factors.push({
        factor: 'Declining customer sentiment',
        severity: 'medium',
        mitigation: 'Review recent reviews for specific issues'
      })
    }

    // Low health score
    if (data.healthScore < 40) {
      factors.push({
        factor: `Low health score (${data.healthScore})`,
        severity: 'high',
        mitigation: 'Require additional documentation and due diligence'
      })
    } else if (data.healthScore < 60) {
      factors.push({
        factor: `Below-average health score (${data.healthScore})`,
        severity: 'medium'
      })
    }

    // Determine overall risk level
    const highCount = factors.filter(f => f.severity === 'high').length
    const mediumCount = factors.filter(f => f.severity === 'medium').length

    let riskLevel: 'low' | 'medium' | 'high'
    if (highCount >= 2 || (highCount >= 1 && mediumCount >= 2)) {
      riskLevel = 'high'
    } else if (highCount >= 1 || mediumCount >= 2) {
      riskLevel = 'medium'
    } else {
      riskLevel = 'low'
    }

    return { factors, riskLevel }
  }

  /**
   * Analyze growth signals
   */
  private analyzeGrowth(data: NarrativeProspectData): {
    analysis: string
    topSignals: GrowthSignal[]
  } {
    const topSignals = data.growthSignals.slice(0, 3)

    if (topSignals.length === 0) {
      return {
        analysis: 'No recent growth signals detected. May indicate stable but not expanding business.',
        topSignals: []
      }
    }

    const signalTypes = [...new Set(topSignals.map(s => s.type))]
    let analysis = ''

    if (signalTypes.includes('hiring') && signalTypes.includes('expansion')) {
      analysis = 'Strong growth trajectory with both hiring and expansion activity. Business is actively investing in growth - ideal time for financing.'
    } else if (signalTypes.includes('permit') && (signalTypes.includes('equipment') || signalTypes.includes('expansion'))) {
      analysis = 'Physical expansion underway based on permit activity. May have immediate capital needs for build-out or equipment.'
    } else if (signalTypes.includes('hiring')) {
      analysis = 'Hiring activity suggests growing operations and potentially increased revenue. Working capital may be needed for payroll expansion.'
    } else if (signalTypes.includes('contract')) {
      analysis = 'New contract wins indicate growing demand. May need financing to fulfill larger orders or projects.'
    } else {
      analysis = `Growth signals detected: ${signalTypes.map(t => this.getSignalTypeLabel(t)).join(', ')}. Business shows signs of activity and potential growth.`
    }

    return { analysis, topSignals }
  }

  /**
   * Generate stack position insight
   */
  private generateStackInsight(data: NarrativeProspectData): {
    insight: string
    suggestedPosition: string
  } {
    let insight = ''
    let suggestedPosition = ''

    if (data.activeFilings === 0) {
      insight = 'Clean slate - no current positions. This is a 1st position opportunity with maximum security.'
      suggestedPosition = '1st'
    } else if (data.activeFilings === 1) {
      if (data.knownCompetitorPositions.length > 0) {
        insight = `One existing position held by ${data.knownCompetitorPositions[0]}. 2nd position available.`
      } else {
        insight = 'Single existing position. 2nd position opportunity available.'
      }
      suggestedPosition = '2nd'
    } else if (data.activeFilings === 2) {
      insight = `Two existing positions. 3rd position may be viable depending on payment capacity.`
      suggestedPosition = '3rd'
    } else {
      insight = `${data.activeFilings} existing positions - heavily stacked. Proceed with caution or consider waiting for payoffs.`
      suggestedPosition = `${data.activeFilings + 1}th (cautious)`
    }

    // Add competitor info if available
    if (data.knownCompetitorPositions.length > 1) {
      insight += ` Known lenders in stack: ${data.knownCompetitorPositions.join(', ')}.`
    }

    return { insight, suggestedPosition }
  }

  /**
   * Determine recommended approach
   */
  private determineApproach(
    data: NarrativeProspectData,
    riskLevel: 'low' | 'medium' | 'high',
    isWhale: boolean
  ): {
    recommendation: 'aggressive' | 'standard' | 'cautious' | 'pass'
    reasoning: string
  } {
    // High score, whale opportunity, low risk = aggressive
    if (isWhale && riskLevel === 'low' && data.compositeScore >= 70) {
      return {
        recommendation: 'aggressive',
        reasoning: 'High-value opportunity with strong fundamentals. Prioritize this prospect for immediate outreach.'
      }
    }

    // Good score, acceptable risk = standard
    if (data.compositeScore >= 55 && riskLevel !== 'high') {
      return {
        recommendation: 'standard',
        reasoning: 'Solid prospect with acceptable risk profile. Standard due diligence and competitive offer recommended.'
      }
    }

    // Moderate score or medium risk = cautious
    if (data.compositeScore >= 40 || (riskLevel === 'medium' && data.compositeScore >= 50)) {
      return {
        recommendation: 'cautious',
        reasoning: 'Proceed with enhanced due diligence. Consider conservative terms or additional requirements.'
      }
    }

    // Poor score or high risk = pass
    return {
      recommendation: 'pass',
      reasoning: 'Risk factors outweigh potential opportunity. Recommend waiting for improved indicators or declining.'
    }
  }

  /**
   * Generate call opener suggestions
   */
  private generateCallOpeners(data: NarrativeProspectData): string[] {
    const openers: string[] = []

    // Industry-specific opener
    const industryInsight = INDUSTRY_INSIGHTS[data.industry]
    if (industryInsight) {
      openers.push(
        `Hi, this is [Name] - I work with ${data.industry} businesses on growth financing. I noticed ${data.companyName} has been active recently and wanted to reach out.`
      )
    }

    // Growth signal opener
    if (data.growthSignals.length > 0) {
      const topSignal = data.growthSignals[0]
      openers.push(
        `I came across ${data.companyName} and saw some exciting activity - looks like you're ${this.getSignalActionPhrase(topSignal.type)}. I help businesses like yours access capital for growth.`
      )
    }

    // Recovery/second chance opener (if applicable)
    if (data.daysSinceDefault >= 1095) { // 3+ years
      openers.push(
        `Hi, I specialize in working with established businesses that have overcome challenges. ${data.companyName} has been around for a while, and I'd love to discuss how we might help with your current goals.`
      )
    }

    // Direct value proposition
    openers.push(
      `Hi, I'm reaching out because ${data.companyName} fits the profile of businesses we can typically help with fast, flexible funding. Do you have 2 minutes to hear how we might be able to support your growth?`
    )

    return openers
  }

  /**
   * Generate objection handlers
   */
  private generateObjectionHandlers(data: NarrativeProspectData): ObjectionHandler[] {
    const handlers: ObjectionHandler[] = []

    // "We had issues in the past"
    if (data.defaultDate) {
      handlers.push({
        objection: "We had some financing issues in the past",
        response: `I understand, and actually that's one reason I reached out. We specialize in working with businesses that have navigated challenges and come out stronger. Your ${Math.round(data.daysSinceDefault / 365)} years of continued operation shows resilience.`,
        supportingData: `${data.terminatedFilings} previously paid-off positions, ${data.growthSignals.length} recent growth signals`
      })
    }

    // "We already have financing"
    if (data.activeFilings > 0) {
      handlers.push({
        objection: "We already have financing in place",
        response: "That's actually common among the businesses we work with. Many use a second or third position to fund specific growth initiatives without disturbing their existing arrangements. What projects are you considering?",
        supportingData: `Current stack: ${data.activeFilings} position(s), suggested position: ${data.estimatedStackPosition + 1}`
      })
    }

    // "The rates are too high"
    handlers.push({
      objection: "MCA rates are too high",
      response: "I hear that concern often. The key is looking at the cost relative to the opportunity. If this funding helps you capture a contract or expand faster, the ROI can far exceed the cost. What opportunity are you trying to capture?"
    })

    // "We don't need money right now"
    if (data.growthSignals.length > 0) {
      const signalPhrase = data.growthSignals[0].type === 'hiring' ? 'hiring' :
                          data.growthSignals[0].type === 'expansion' ? 'expanding' :
                          data.growthSignals[0].type === 'permit' ? 'working on permits' : 'growing'
      handlers.push({
        objection: "We don't need money right now",
        response: `Totally understand. I noticed you're ${signalPhrase} - businesses often find that having a funding partner established before they need it speeds things up when opportunities arise. Would it be helpful to have an approval in place for when the timing is right?`
      })
    }

    // "Let me think about it"
    handlers.push({
      objection: "Let me think about it",
      response: "Of course. Would it be helpful if I sent you a quick summary of what we discussed and potential terms? That way you have something concrete to review. When would be a good time to follow up?"
    })

    return handlers
  }

  /**
   * Fetch prospect data from database
   */
  private async fetchProspectData(prospectId: string): Promise<NarrativeProspectData> {
    // Fetch main prospect record
    const [prospect] = await database.query<{
      id: string
      company_name: string
      industry: string
      state: string
      status: string
      default_date: string
      time_since_default: number
      priority_score: number
      estimated_revenue: number
    }>(
      `SELECT id, company_name, industry, state, status, default_date,
              time_since_default, priority_score, estimated_revenue
       FROM prospects WHERE id = $1`,
      [prospectId]
    )

    if (!prospect) {
      throw new Error(`Prospect not found: ${prospectId}`)
    }

    // Fetch UCC filings
    const filings = await database.query<{
      status: string
      filing_date: string
      secured_party: string
    }>(
      `SELECT uf.status, uf.filing_date, uf.secured_party_name as secured_party
       FROM ucc_filings uf
       JOIN prospect_ucc_filings puf ON uf.id = puf.ucc_filing_id
       WHERE puf.prospect_id = $1
       ORDER BY uf.filing_date DESC`,
      [prospectId]
    )

    // Fetch health score
    const [healthData] = await database.query<{
      score: number
      sentiment_trend: string
      review_count: number
      avg_sentiment: number
      violation_count: number
    }>(
      `SELECT score, sentiment_trend, review_count, avg_sentiment, violation_count
       FROM health_scores
       WHERE prospect_id = $1
       ORDER BY recorded_date DESC
       LIMIT 1`,
      [prospectId]
    )

    // Fetch growth signals
    const signals = await database.query<{
      type: string
      description: string
      detected_date: string
      score: number
      confidence: number
    }>(
      `SELECT type, description, detected_date, score, confidence
       FROM growth_signals
       WHERE prospect_id = $1
       ORDER BY score DESC, detected_date DESC
       LIMIT 5`,
      [prospectId]
    )

    // Calculate metrics
    const activeFilings = filings.filter(f => f.status === 'active').length
    const lapsedFilings = filings.filter(f => f.status === 'lapsed').length
    const terminatedFilings = filings.filter(f => f.status === 'terminated').length

    const lastFilingDate = filings[0]?.filing_date
    const daysSinceLastFiling = lastFilingDate
      ? Math.floor((Date.now() - new Date(lastFilingDate).getTime()) / (1000 * 60 * 60 * 24))
      : 9999

    // Extract known competitors from secured parties
    const knownCompetitorPositions = filings
      .filter(f => f.status === 'active')
      .map(f => f.secured_party)
      .filter(Boolean)

    return {
      id: prospect.id,
      companyName: prospect.company_name,
      industry: prospect.industry,
      state: prospect.state,
      defaultDate: prospect.default_date,
      daysSinceDefault: prospect.time_since_default || 0,
      status: prospect.status,

      // Scores (would come from ScoringService in practice)
      intentScore: 0, // Would be calculated
      healthScore: healthData?.score || 50,
      positionScore: 100 - activeFilings * 15,
      compositeScore: prospect.priority_score,
      grade: this.getGrade(prospect.priority_score),

      totalFilings: filings.length,
      activeFilings,
      lapsedFilings,
      terminatedFilings,
      lastFilingDate,
      daysSinceLastFiling,

      growthSignals: signals.map(s => ({
        type: s.type as GrowthSignal['type'],
        description: s.description,
        detectedDate: s.detected_date,
        score: s.score,
        confidence: s.confidence
      })),

      reviewCount: healthData?.review_count || 0,
      avgRating: healthData?.avg_sentiment ? healthData.avg_sentiment * 5 : 3,
      sentimentTrend: (healthData?.sentiment_trend as 'improving' | 'stable' | 'declining') || 'stable',
      violationCount: healthData?.violation_count || 0,
      yearsInBusiness: 3, // Would need enrichment data

      estimatedStackPosition: activeFilings + 1,
      knownCompetitorPositions,

      estimatedRevenue: prospect.estimated_revenue,
      revenueConfidence: prospect.estimated_revenue ? 70 : undefined
    }
  }

  /**
   * Helper: Get grade from score
   */
  private getGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 80) return 'A'
    if (score >= 65) return 'B'
    if (score >= 50) return 'C'
    if (score >= 35) return 'D'
    return 'F'
  }

  /**
   * Helper: Format revenue
   */
  private formatRevenue(amount: number): string {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`
    }
    return `$${amount}`
  }

  /**
   * Helper: Get signal type label
   */
  private getSignalTypeLabel(type: GrowthSignal['type']): string {
    const labels: Record<GrowthSignal['type'], string> = {
      hiring: 'Hiring Activity',
      permit: 'Permit Activity',
      contract: 'Contract Win',
      expansion: 'Expansion Signal',
      equipment: 'Equipment Purchase'
    }
    return labels[type] || type
  }

  /**
   * Helper: Get signal action phrase
   */
  private getSignalActionPhrase(type: GrowthSignal['type']): string {
    const phrases: Record<GrowthSignal['type'], string> = {
      hiring: 'hiring and growing your team',
      permit: 'working on some new projects',
      contract: 'winning new business',
      expansion: 'expanding operations',
      equipment: 'investing in equipment'
    }
    return phrases[type] || 'growing'
  }
}

// Export singleton instance
export const narrativeService = new NarrativeService()
