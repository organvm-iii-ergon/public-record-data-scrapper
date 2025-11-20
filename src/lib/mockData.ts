import { 
  Prospect, 
  GrowthSignal, 
  HealthScore, 
  CompetitorData, 
  PortfolioCompany,
  DashboardStats,
  IndustryType,
  HealthGrade,
  SignalType
} from './types'

const INDUSTRIES: IndustryType[] = ['restaurant', 'retail', 'construction', 'healthcare', 'manufacturing', 'services', 'technology']
const STATES = ['NY', 'CA', 'TX', 'FL', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI']
const SIGNAL_TYPES: SignalType[] = ['hiring', 'permit', 'contract', 'expansion', 'equipment']

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomDate(daysAgo: number, variance: number = 0): string {
  const days = daysAgo + (variance > 0 ? randomInt(-variance, variance) : 0)
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().split('T')[0]
}

export function generateHealthScore(): HealthScore {
  const grades: HealthGrade[] = ['A', 'B', 'C', 'D', 'F']
  const weights = [0.25, 0.35, 0.25, 0.10, 0.05]
  const rand = Math.random()
  let cumulative = 0
  let grade: HealthGrade = 'B'
  
  for (let i = 0; i < grades.length; i++) {
    cumulative += weights[i]
    if (rand <= cumulative) {
      grade = grades[i]
      break
    }
  }

  const scoreMap: Record<HealthGrade, [number, number]> = {
    'A': [85, 100],
    'B': [70, 84],
    'C': [55, 69],
    'D': [40, 54],
    'F': [0, 39]
  }

  const [min, max] = scoreMap[grade]
  const score = randomInt(min, max)
  
  return {
    grade,
    score,
    sentimentTrend: randomElement(['improving', 'stable', 'declining'] as const),
    reviewCount: randomInt(50, 500),
    avgSentiment: 0.3 + (score / 100) * 0.6,
    violationCount: grade === 'A' ? 0 : grade === 'B' ? randomInt(0, 1) : randomInt(1, 5),
    lastUpdated: randomDate(randomInt(1, 7))
  }
}

export function generateGrowthSignals(count: number): GrowthSignal[] {
  const signals: GrowthSignal[] = []
  const descriptions: Record<SignalType, string[]> = {
    hiring: [
      'Posted 5 new positions for expansion team',
      'Hiring manager and operations staff',
      'Seeking sales team for new territory',
      'Multiple job openings across departments'
    ],
    permit: [
      'Filed building permit for new 3,000 sq ft location',
      'Renovation permit approved for facility expansion',
      'Commercial permit for equipment installation',
      'Construction permit for second location'
    ],
    contract: [
      'Awarded $200K municipal contract',
      'Signed multi-year service agreement',
      'Won competitive bid for regional project',
      'New supply contract with Fortune 500 company'
    ],
    expansion: [
      'Announced opening of third location',
      'Expanding operations to two new states',
      'Launching new product line',
      'Acquired competitor business'
    ],
    equipment: [
      'Purchased commercial kitchen equipment',
      'Leased fleet of delivery vehicles',
      'Installed new manufacturing machinery',
      'Upgraded point-of-sale systems across locations'
    ]
  }

  for (let i = 0; i < count; i++) {
    const type = randomElement(SIGNAL_TYPES)
    const score = type === 'expansion' ? randomInt(20, 30) : 
                  type === 'contract' ? randomInt(18, 28) :
                  type === 'permit' ? randomInt(15, 25) :
                  type === 'equipment' ? randomInt(12, 22) : randomInt(10, 20)
    
    signals.push({
      id: `signal-${Date.now()}-${i}`,
      type,
      description: randomElement(descriptions[type]),
      detectedDate: randomDate(randomInt(5, 60)),
      sourceUrl: `https://example.com/source/${i}`,
      score,
      confidence: 0.7 + Math.random() * 0.25
    })
  }

  return signals.sort((a, b) => new Date(b.detectedDate).getTime() - new Date(a.detectedDate).getTime())
}

export function generateProspects(count: number): Prospect[] {
  const prospects: Prospect[] = []
  const companyPrefixes = ['Apex', 'Summit', 'Premier', 'Elite', 'Prime', 'Crown', 'Heritage', 'Landmark', 'Victory', 'Horizon']
  const companySuffixes = ['Restaurant Group', 'Retail LLC', 'Construction Co', 'Healthcare Services', 'Manufacturing Inc', 'Solutions LLC', 'Technologies Inc']

  for (let i = 0; i < count; i++) {
    const industry = randomElement(INDUSTRIES)
    const state = randomElement(STATES)
    const defaultDate = randomDate(randomInt(1200, 1800), 200)
    const timeSinceDefault = Math.floor((Date.now() - new Date(defaultDate).getTime()) / (1000 * 60 * 60 * 24))
    const signalCount = randomInt(0, 5)
    const growthSignals = generateGrowthSignals(signalCount)
    const healthScore = generateHealthScore()
    
    const totalSignalScore = growthSignals.reduce((sum, s) => sum + s.score, 0)
    const basePriority = Math.min(100, (timeSinceDefault / 14) + totalSignalScore + healthScore.score * 0.3)
    const priorityScore = Math.round(basePriority)

    const narrativeParts: string[] = []
    if (timeSinceDefault > 1095) {
      narrativeParts.push(`Defaulted ${Math.floor(timeSinceDefault / 365)} years ago on equipment financing`)
    }
    if (growthSignals.length > 0) {
      const topSignals = growthSignals.slice(0, 2).map(s => s.type).join(', ')
      narrativeParts.push(`showing ${growthSignals.length} growth signals (${topSignals})`)
    }
    narrativeParts.push(`Current health grade: ${healthScore.grade}`)

    prospects.push({
      id: `prospect-${1000 + i}`,
      companyName: `${randomElement(companyPrefixes)} ${randomElement(companySuffixes)}`,
      industry,
      state,
      status: Math.random() > 0.8 ? 'claimed' : 'new',
      priorityScore,
      defaultDate,
      timeSinceDefault,
      lastFilingDate: Math.random() > 0.7 ? randomDate(randomInt(1500, 2000)) : undefined,
      uccFilings: [{
        id: `ucc-${i}`,
        filingDate: defaultDate,
        debtorName: `${randomElement(companyPrefixes)} ${randomElement(companySuffixes)}`,
        securedParty: randomElement(['Capital Finance Corp', 'Business Lending LLC', 'Equipment Leasing Inc', 'MCA Direct']),
        state,
        lienAmount: randomInt(50000, 500000),
        status: 'lapsed',
        filingType: 'UCC-1'
      }],
      growthSignals,
      healthScore,
      narrative: narrativeParts.join(', '),
      estimatedRevenue: randomInt(500000, 5000000),
      claimedBy: Math.random() > 0.8 ? 'Sales Team' : undefined,
      claimedDate: Math.random() > 0.8 ? randomDate(randomInt(1, 30)) : undefined
    })
  }

  return prospects.sort((a, b) => b.priorityScore - a.priorityScore)
}

export function generateCompetitorData(): CompetitorData[] {
  const lenders = [
    'Capital Finance Corp',
    'Business Lending LLC',
    'Rapid Funding Partners',
    'MCA Direct',
    'Commercial Capital Group',
    'Advance America Business',
    'Merchant Growth Capital',
    'Fast Track Funding',
    'Strategic Finance Solutions',
    'Enterprise Lending Network'
  ]

  return lenders.map((lenderName, i) => {
    const filingCount = randomInt(50, 500)
    const avgDealSize = randomInt(75000, 350000)
    const marketShare = Math.round((filingCount / 2000) * 100 * 10) / 10
    
    return {
      lenderName,
      filingCount,
      avgDealSize,
      marketShare,
      industries: INDUSTRIES.slice(0, randomInt(2, 5)),
      topState: randomElement(STATES),
      monthlyTrend: -10 + Math.random() * 30
    }
  }).sort((a, b) => b.filingCount - a.filingCount)
}

export function generatePortfolioCompanies(count: number): PortfolioCompany[] {
  const companies: PortfolioCompany[] = []
  const companyPrefixes = ['Metro', 'Central', 'Regional', 'United', 'Superior', 'Quality']
  const companySuffixes = ['Builders', 'Services', 'Enterprises', 'Industries', 'Group']

  for (let i = 0; i < count; i++) {
    const healthScore = generateHealthScore()
    const currentStatus = 
      healthScore.grade === 'A' || healthScore.grade === 'B' ? 'performing' :
      healthScore.grade === 'C' ? 'watch' :
      healthScore.grade === 'D' ? 'at-risk' : 'default'

    companies.push({
      id: `portfolio-${i}`,
      companyName: `${randomElement(companyPrefixes)} ${randomElement(companySuffixes)}`,
      fundingDate: randomDate(randomInt(90, 730)),
      fundingAmount: randomInt(100000, 750000),
      currentStatus,
      healthScore,
      lastAlertDate: currentStatus === 'at-risk' ? randomDate(randomInt(1, 7)) : undefined
    })
  }

  return companies
}

export function generateDashboardStats(prospects: Prospect[], portfolio: PortfolioCompany[]): DashboardStats {
  const totalProspects = prospects.length
  const totalPortfolio = portfolio.length

  const highValueProspects = totalProspects > 0 ? prospects.filter(p => p.priorityScore >= 70).length : 0
  const avgPriorityScore = totalProspects > 0
    ? Math.round(prospects.reduce((sum, p) => sum + p.priorityScore, 0) / totalProspects)
    : 0

  const newSignalsToday = prospects.reduce((sum, p) => {
    const todaySignals = p.growthSignals.filter(s => {
      const daysDiff = (Date.now() - new Date(s.detectedDate).getTime()) / (1000 * 60 * 60 * 24)
      return daysDiff < 1
    })
    return sum + todaySignals.length
  }, 0)

  const portfolioAtRisk = totalPortfolio > 0
    ? portfolio.filter(c => c.currentStatus === 'at-risk' || c.currentStatus === 'default').length
    : 0

  const avgHealthGrade = (() => {
    if (totalPortfolio === 0) {
      return 'N/A'
    }

    const gradeScoreTotal = portfolio.reduce((sum, c) => {
      const gradeValues: Record<HealthGrade, number> = { 'A': 4, 'B': 3, 'C': 2, 'D': 1, 'F': 0 }
      return sum + gradeValues[c.healthScore.grade]
    }, 0)

    const avgGradeScore = gradeScoreTotal / totalPortfolio

    return avgGradeScore >= 3.5 ? 'A-' : avgGradeScore >= 2.5 ? 'B' : avgGradeScore >= 1.5 ? 'C' : 'D'
  })()

  return {
    totalProspects,
    highValueProspects,
    avgPriorityScore,
    newSignalsToday,
    portfolioAtRisk,
    avgHealthGrade
  }
}
