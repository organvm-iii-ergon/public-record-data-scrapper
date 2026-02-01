export type HealthGrade = 'A' | 'B' | 'C' | 'D' | 'F'
export type SignalType = 'hiring' | 'permit' | 'contract' | 'expansion' | 'equipment'
export type ProspectStatus = 'new' | 'claimed' | 'contacted' | 'qualified' | 'dead'
export type IndustryType =
  | 'restaurant'
  | 'retail'
  | 'construction'
  | 'healthcare'
  | 'manufacturing'
  | 'services'
  | 'technology'
export type DataTier = 'oss' | 'paid'

export interface UCCFiling {
  id: string
  filingDate: string
  debtorName: string
  securedParty: string
  state: string
  lienAmount?: number
  status: 'active' | 'terminated' | 'lapsed'
  filingType: 'UCC-1' | 'UCC-3'
}

export interface GrowthSignal {
  id: string
  type: SignalType
  description: string
  detectedDate: string
  sourceUrl?: string
  score: number
  confidence: number
  mlConfidence?: number // ML model confidence in signal validity (0-100)
}

export interface HealthScore {
  grade: HealthGrade
  score: number
  sentimentTrend: 'improving' | 'stable' | 'declining'
  reviewCount: number
  avgSentiment: number
  violationCount: number
  lastUpdated: string
}

export interface MLScoring {
  confidence: number // Overall ML confidence in prospect quality (0-100)
  recoveryLikelihood: number // Predicted likelihood of default recovery (0-100)
  modelVersion: string
  lastUpdated: string
  factors: {
    healthTrend: number
    signalQuality: number
    industryRisk: number
    timeToRecovery: number
    financialStability: number
  }
}

export interface Prospect {
  id: string
  companyName: string
  industry: IndustryType
  state: string
  status: ProspectStatus
  priorityScore: number
  defaultDate: string
  timeSinceDefault: number
  lastFilingDate?: string
  uccFilings: UCCFiling[]
  growthSignals: GrowthSignal[]
  healthScore: HealthScore
  narrative: string
  estimatedRevenue?: number
  claimedBy?: string
  claimedDate?: string
  mlScoring?: MLScoring // ML confidence and recovery prediction
}

export interface CompetitorData {
  lenderName: string
  filingCount: number
  avgDealSize: number
  marketShare: number
  industries: IndustryType[]
  topState: string
  monthlyTrend: number
}

export interface PortfolioCompany {
  id: string
  companyName: string
  fundingDate: string
  fundingAmount: number
  currentStatus: 'performing' | 'watch' | 'at-risk' | 'default'
  healthScore: HealthScore
  lastAlertDate?: string
}

export interface RequalificationLead {
  id: string
  originalProspect: Prospect
  newSignals: GrowthSignal[]
  netScore: number
  recommendation: 'revive' | 'dismiss'
  reasoning: string
}

export interface DashboardStats {
  totalProspects: number
  highValueProspects: number
  avgPriorityScore: number
  newSignalsToday: number
  portfolioAtRisk: number
  avgHealthGrade: string
}

export interface ProspectNote {
  id: string
  prospectId: string
  content: string
  createdBy: string
  createdAt: string
  updatedAt?: string
}

export interface FollowUpReminder {
  id: string
  prospectId: string
  dueDate: string
  priority: 'low' | 'medium' | 'high'
  description: string
  completed: boolean
  createdBy: string
  createdAt: string
  completedAt?: string
}

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  category: 'initial-outreach' | 'follow-up' | 'recovery-offer' | 'check-in'
  variables: string[] // e.g., ['companyName', 'priorityScore', 'industryType']
}

export interface OutreachEmail {
  id: string
  prospectId: string
  templateId: string
  subject: string
  body: string
  status: 'draft' | 'sent' | 'scheduled'
  sentAt?: string
  scheduledFor?: string
  createdBy: string
  createdAt: string
}

// Recursive & Advanced Feature Types
export interface CompanyNode {
  id: string
  name: string
  prospect?: Prospect
  depth: number
  relationshipType: 'parent' | 'subsidiary' | 'affiliate' | 'common_secured_party'
}

export interface CompanyGraph {
  root: CompanyNode
  nodes: CompanyNode[]
  edges: Array<{ from: string; to: string; type: string }>
  depth: number
  totalCompanies: number
}

export interface RecursiveTraversalConfig {
  maxDepth: number
  relationshipTypes: string[]
  includeProspectData: boolean
  stopConditions?: {
    maxCompanies?: number
    maxBranches?: number
  }
}

export interface PersonalizedRecommendation {
  prospectId: string
  score: number
  reasoning: string
  factors: {
    industryMatch: number
    scoreAlignment: number
    signalStrength: number
    networkValue: number
  }
  action: 'claim' | 'watch' | 'research'
  priority: 'high' | 'medium' | 'low'
}

export interface GenerativeContext {
  prospect: Prospect
  marketData?: unknown[]
  relationships?: CompanyGraph
  historicalSignals?: unknown[]
  industryTrends?: unknown[]
}

export interface GenerativeInsight {
  category: string
  text: string
  confidence: number
  sources: string[]
}

export interface GenerativeNarrative {
  prospectId: string
  summary: string
  keyInsights: GenerativeInsight[]
  riskFactors: string[]
  opportunities: string[]
  recommendedActions: string[]
  generatedAt: string
}

export interface SignalChain {
  signals: GrowthSignal[]
  correlation: number
  predictedNext: SignalType[]
  confidence: number
  narrative: string
}

export interface RecursiveSignalConfig {
  maxDepth: number
  minConfidence: number
  signalTriggers: Record<SignalType, SignalType[]>
  correlationThreshold: number
}

export interface ReportSection {
  title: string
  content: string
  insights: GenerativeInsight[]
  visualizations?: Visualization[]
}

export interface Visualization {
  type: 'chart' | 'graph' | 'table' | 'map'
  data: unknown
  config: Record<string, unknown>
}

export interface GenerativeReport {
  id: string
  type: 'portfolio' | 'market' | 'prospect' | 'competitive'
  title: string
  summary: string
  sections: ReportSection[]
  generatedAt: string
  generatedFor: string
}

export interface RecursiveEnrichmentResult {
  prospectId: string
  depth: number
  enrichments: Array<{
    source: string
    data: unknown
    confidence: number
  }>
  totalDataPoints: number
  completeness: number
}

export interface NetworkRequalification {
  leadId: string
  originalScore: number
  networkScore: number
  finalScore: number
  networkValue: number
  recommendation: 'revive' | 'dismiss'
  reasoning: string
  relatedCompanies: string[]
}

export interface UserProfile {
  userId: string
  preferences: {
    industries: IndustryType[]
    minScore: number
    maxDistance?: number
    autoRefresh: boolean
  }
  actionHistory: Array<{
    type: string
    timestamp: string
    data: unknown
  }>
  savedFilters: Array<{
    id: string
    name: string
    config: unknown
  }>
  dashboardLayout: unknown
  notificationSettings: {
    email: boolean
    desktop: boolean
    frequency: 'realtime' | 'daily' | 'weekly'
  }
}

export type IndustryTrend = {
  industry: IndustryType
  trend: 'growing' | 'stable' | 'declining'
  data: unknown[]
}

export type ImprovementCategory =
  | 'performance'
  | 'security'
  | 'usability'
  | 'data-quality'
  | 'feature-enhancement'
  | 'strategic'
  | 'competitor-intelligence'
  | 'competitor-analysis'
  | 'threat-analysis'
  | 'opportunity-analysis'
  | 'strategic-recommendation'
