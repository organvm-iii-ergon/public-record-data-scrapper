// Database types and interfaces

export interface UCCFiling {
  id: string
  external_id: string
  filing_date: Date
  debtor_name: string
  debtor_name_normalized: string
  secured_party: string
  secured_party_normalized: string
  state: string
  lien_amount?: number
  status: 'active' | 'terminated' | 'lapsed'
  filing_type: 'UCC-1' | 'UCC-3'
  source: string
  raw_data?: Record<string, unknown>
  created_at: Date
  updated_at: Date
}

export interface Prospect {
  id: string
  company_name: string
  company_name_normalized: string
  industry:
    | 'restaurant'
    | 'retail'
    | 'construction'
    | 'healthcare'
    | 'manufacturing'
    | 'services'
    | 'technology'
  state: string
  status: 'new' | 'claimed' | 'contacted' | 'qualified' | 'dead'
  priority_score: number
  default_date: Date
  time_since_default: number
  last_filing_date?: Date
  narrative?: string
  estimated_revenue?: number
  claimed_by?: string
  claimed_date?: Date
  created_at: Date
  updated_at: Date
  last_enriched_at?: Date
  enrichment_confidence?: number
}

export interface GrowthSignal {
  id: string
  prospect_id: string
  type: 'hiring' | 'permit' | 'contract' | 'expansion' | 'equipment'
  description: string
  detected_date: Date
  source_url?: string
  score: number
  confidence: number
  raw_data?: Record<string, unknown>
  created_at: Date
}

export interface HealthScore {
  id: string
  prospect_id: string
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  score: number
  sentiment_trend: 'improving' | 'stable' | 'declining'
  review_count: number
  avg_sentiment: number
  violation_count: number
  recorded_date: Date
  raw_data?: Record<string, unknown>
  created_at: Date
}

export interface Competitor {
  id: string
  lender_name: string
  lender_name_normalized: string
  filing_count: number
  avg_deal_size?: number
  market_share?: number
  industries?: string[]
  top_state?: string
  monthly_trend?: number
  last_updated: Date
  created_at: Date
}

export interface PortfolioCompany {
  id: string
  company_name: string
  company_name_normalized: string
  funding_date: Date
  funding_amount: number
  current_status: 'performing' | 'watch' | 'at-risk' | 'default'
  last_alert_date?: Date
  created_at: Date
  updated_at: Date
}

export interface IngestionLog {
  id: string
  source: string
  status: 'success' | 'partial' | 'failed'
  records_found: number
  records_processed: number
  errors?: Record<string, unknown>
  processing_time_ms?: number
  started_at: Date
  completed_at?: Date
  metadata?: Record<string, unknown>
}

export interface EnrichmentLog {
  id: string
  prospect_id: string
  status: 'success' | 'partial' | 'failed'
  enriched_fields?: string[]
  errors?: Record<string, unknown>
  confidence?: number
  processing_time_ms?: number
  started_at: Date
  completed_at?: Date
  metadata?: Record<string, unknown>
}

export interface SchemaMigration {
  id: number
  version: string
  name: string
  applied_at: Date
}
