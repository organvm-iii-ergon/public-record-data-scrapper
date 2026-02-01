export type HealthGrade = 'A' | 'B' | 'C' | 'D' | 'F'
export type SignalType = 'hiring' | 'permit' | 'contract' | 'expansion' | 'equipment'
export type ProspectStatus = 'new' | 'claimed' | 'contacted' | 'qualified' | 'dead' | 'closed-won' | 'closed-lost' | 'unclaimed'
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

// ============================================================================
// Broker OS Types (Multi-tenancy, CRM, Deals, Communications, Compliance)
// ============================================================================

// Multi-tenancy
export type SubscriptionTier = 'free' | 'starter' | 'professional' | 'enterprise'
export type UserRole = 'admin' | 'manager' | 'broker' | 'viewer'

export interface Organization {
  id: string
  name: string
  slug: string
  settings: Record<string, unknown>
  subscriptionTier: SubscriptionTier
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface User {
  id: string
  orgId: string
  email: string
  emailVerified: boolean
  firstName?: string
  lastName?: string
  phone?: string
  avatarUrl?: string
  role: UserRole
  isActive: boolean
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

// CRM / Contacts
export type ContactRole = 'owner' | 'ceo' | 'cfo' | 'controller' | 'manager' | 'bookkeeper' | 'other'
export type ContactMethod = 'email' | 'phone' | 'mobile' | 'sms'
export type ContactRelationship = 'owner' | 'decision_maker' | 'influencer' | 'employee' | 'advisor' | 'other'

export interface Contact {
  id: string
  orgId: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
  phoneExt?: string
  mobile?: string
  title?: string
  role?: ContactRole
  preferredContactMethod: ContactMethod
  timezone: string
  notes?: string
  tags: string[]
  source?: string
  isActive: boolean
  lastContactedAt?: string
  createdBy?: string
  createdAt: string
  updatedAt: string
}

export interface ProspectContact {
  id: string
  prospectId: string
  contactId: string
  isPrimary: boolean
  relationship: ContactRelationship
  createdAt: string
}

export type ActivityType =
  | 'call_outbound' | 'call_inbound' | 'call_missed'
  | 'email_sent' | 'email_received' | 'email_opened' | 'email_clicked'
  | 'sms_sent' | 'sms_received'
  | 'meeting_scheduled' | 'meeting_completed' | 'meeting_cancelled'
  | 'note' | 'task_created' | 'task_completed'
  | 'status_change' | 'document_sent' | 'document_signed'

export interface ContactActivity {
  id: string
  contactId: string
  prospectId?: string
  userId?: string
  activityType: ActivityType
  subject?: string
  description?: string
  outcome?: string
  durationSeconds?: number
  metadata: Record<string, unknown>
  scheduledAt?: string
  completedAt?: string
  createdAt: string
}

// Deals
export type DealPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TerminalType = 'won' | 'lost' | 'withdrawn'

export interface DealStage {
  id: string
  orgId: string
  name: string
  slug: string
  description?: string
  stageOrder: number
  isTerminal: boolean
  terminalType?: TerminalType
  color?: string
  autoActions: Record<string, unknown>
  createdAt: string
}

export interface Lender {
  id: string
  orgId: string
  name: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  buyBox: Record<string, unknown>
  commissionRate?: number
  avgApprovalTimeHours?: number
  notes?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Deal {
  id: string
  orgId: string
  prospectId?: string
  contactId?: string
  lenderId?: string
  stageId: string
  assignedTo?: string
  dealNumber?: string
  amountRequested?: number
  amountApproved?: number
  amountFunded?: number
  termMonths?: number
  factorRate?: number
  dailyPayment?: number
  weeklyPayment?: number
  totalPayback?: number
  commissionAmount?: number
  useOfFunds?: string
  useOfFundsDetails?: string
  bankConnected: boolean
  averageDailyBalance?: number
  monthlyRevenue?: number
  nsfCount?: number
  existingPositions?: number
  priority: DealPriority
  probability?: number
  expectedCloseDate?: string
  actualCloseDate?: string
  lostReason?: string
  lostNotes?: string
  submittedAt?: string
  approvedAt?: string
  fundedAt?: string
  createdAt: string
  updatedAt: string
}

export type DocumentType =
  | 'application' | 'bank_statement' | 'tax_return' | 'voided_check'
  | 'drivers_license' | 'business_license' | 'landlord_letter'
  | 'contract' | 'signed_contract' | 'disclosure' | 'signed_disclosure'
  | 'other'

export interface DealDocument {
  id: string
  dealId: string
  documentType: DocumentType
  fileName: string
  filePath: string
  fileSize?: number
  mimeType?: string
  isRequired: boolean
  uploadedBy?: string
  uploadedAt: string
  verifiedBy?: string
  verifiedAt?: string
  metadata: Record<string, unknown>
}

// Communications
export type CommunicationChannel = 'email' | 'sms' | 'call'
export type CommunicationDirection = 'inbound' | 'outbound'
export type CommunicationStatus =
  | 'pending' | 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked'
  | 'bounced' | 'failed' | 'answered' | 'no_answer' | 'voicemail' | 'busy'

export type TemplateCategory =
  | 'initial_outreach' | 'follow_up' | 'application_request'
  | 'document_request' | 'approval_notification' | 'funding_notification'
  | 'check_in' | 'renewal' | 'other'

export interface CommunicationTemplate {
  id: string
  orgId: string
  name: string
  description?: string
  channel: CommunicationChannel | 'call_script'
  category?: TemplateCategory
  subject?: string
  body: string
  variables: string[]
  isActive: boolean
  createdBy?: string
  createdAt: string
  updatedAt: string
}

export interface Communication {
  id: string
  orgId: string
  contactId?: string
  prospectId?: string
  dealId?: string
  templateId?: string
  sentBy?: string
  channel: CommunicationChannel
  direction: CommunicationDirection
  fromAddress?: string
  toAddress?: string
  ccAddresses?: string[]
  bccAddresses?: string[]
  subject?: string
  fromPhone?: string
  toPhone?: string
  body?: string
  bodyHtml?: string
  attachments: Array<{ name: string; url: string; size: number; mimeType: string }>
  status: CommunicationStatus
  statusReason?: string
  callDurationSeconds?: number
  callRecordingUrl?: string
  externalId?: string
  openedAt?: string
  clickedAt?: string
  deliveredAt?: string
  failedAt?: string
  failureReason?: string
  scheduledFor?: string
  sentAt?: string
  metadata: Record<string, unknown>
  createdAt: string
}

// Compliance
export type ConsentType =
  | 'express_written' | 'prior_express' | 'transactional'
  | 'marketing_email' | 'marketing_sms' | 'marketing_call'
  | 'data_sharing' | 'terms_of_service' | 'privacy_policy'

export type CollectionMethod =
  | 'web_form' | 'phone_recording' | 'signed_document'
  | 'email_opt_in' | 'sms_opt_in' | 'verbal' | 'imported'

export type DisclosureStatus =
  | 'draft' | 'generated' | 'sent' | 'viewed' | 'signed' | 'expired' | 'superseded'

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical'
export type AlertStatus = 'open' | 'acknowledged' | 'investigating' | 'resolved' | 'false_positive'

export interface DisclosureRequirement {
  id: string
  state: string
  regulationName: string
  effectiveDate: string
  expiryDate?: string
  requiredFields: string[]
  calculationRules: Record<string, unknown>
  templateUrl?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface Disclosure {
  id: string
  orgId: string
  dealId: string
  requirementId?: string
  state: string
  regulationName: string
  version: string
  fundingAmount: number
  totalDollarCost: number
  financeCharge?: number
  termDays?: number
  paymentFrequency?: string
  paymentAmount?: number
  numberOfPayments?: number
  aprEquivalent?: number
  disclosureData: Record<string, unknown>
  documentUrl?: string
  documentHash?: string
  signatureRequired: boolean
  signatureUrl?: string
  signatureId?: string
  signedAt?: string
  signedBy?: string
  signedIp?: string
  signatureImageUrl?: string
  status: DisclosureStatus
  sentAt?: string
  viewedAt?: string
  expiresAt?: string
  generatedBy?: string
  createdAt: string
  updatedAt: string
}

export interface ConsentRecord {
  id: string
  orgId: string
  contactId: string
  consentType: ConsentType
  channel?: CommunicationChannel | 'mail' | 'all'
  isGranted: boolean
  consentText?: string
  consentVersion?: string
  collectionMethod: CollectionMethod
  collectionUrl?: string
  recordingUrl?: string
  documentUrl?: string
  ipAddress?: string
  userAgent?: string
  evidence?: Record<string, unknown>
  grantedAt: string
  expiresAt?: string
  revokedAt?: string
  revokedReason?: string
  collectedBy?: string
  createdAt: string
}

export interface AuditLog {
  id: string
  orgId?: string
  userId?: string
  action: string
  entityType: string
  entityId?: string
  changes?: Record<string, { old: unknown; new: unknown }>
  beforeState?: Record<string, unknown>
  afterState?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  requestId?: string
  createdAt: string
}

export interface ComplianceAlert {
  id: string
  orgId: string
  alertType: string
  severity: AlertSeverity
  dealId?: string
  contactId?: string
  communicationId?: string
  title: string
  description?: string
  remediationSteps?: string
  status: AlertStatus
  acknowledgedBy?: string
  acknowledgedAt?: string
  resolvedBy?: string
  resolvedAt?: string
  resolutionNotes?: string
  createdAt: string
  updatedAt: string
}
