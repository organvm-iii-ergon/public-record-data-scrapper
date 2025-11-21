/**
 * Academic Research Data Types
 *
 * Core interfaces for automated knowledge production and network building
 */

export interface Author {
  id: string
  name: string
  affiliations: string[]
  email?: string
  orcid?: string
  h_index?: number
  citation_count?: number
  paper_count?: number
}

export interface Paper {
  id: string
  title: string
  abstract: string
  authors: Author[]
  publicationDate: string
  venue?: string // Journal or conference
  venueType?: 'journal' | 'conference' | 'preprint' | 'workshop'
  doi?: string
  arxiv_id?: string
  pubmed_id?: string
  urls: string[]

  // Content
  fullText?: string
  sections?: {
    introduction?: string
    methods?: string
    results?: string
    discussion?: string
    conclusions?: string
  }

  // Classification
  fields: string[]
  topics: string[]
  keywords: string[]

  // Metrics
  citationCount: number
  influentialCitationCount?: number // Semantic Scholar's metric
  references: string[] // Paper IDs
  citedBy: string[] // Paper IDs

  // Extracted knowledge
  entities?: Entity[]
  claims?: Claim[]
  methods?: Method[]
  datasets?: Dataset[]
}

export interface Entity {
  id: string
  type: 'concept' | 'method' | 'dataset' | 'software' | 'chemical' | 'gene' | 'institution'
  name: string
  description?: string
  aliases: string[]
  papers: string[] // Paper IDs where mentioned
}

export interface Claim {
  id: string
  paperId: string
  text: string
  type: 'main' | 'supporting' | 'contradicting'
  evidence: Evidence[]
  confidence: number // 0-1
}

export interface Evidence {
  type: 'experimental' | 'observational' | 'theoretical' | 'cited'
  description: string
  strength: 'strong' | 'moderate' | 'weak'
  source?: string // Paper ID if cited
}

export interface Method {
  id: string
  name: string
  description: string
  papers: string[] // Papers using this method
  variants: string[] // Alternative names
}

export interface Dataset {
  id: string
  name: string
  description: string
  url?: string
  size?: string
  papers: string[] // Papers using this dataset
}

export interface Citation {
  from: string // Citing paper ID
  to: string // Cited paper ID
  context?: string // Text around citation
  intent?: 'background' | 'method' | 'result' | 'comparison'
  sentiment?: 'positive' | 'neutral' | 'negative'
}

export interface CitationNetwork {
  papers: Map<string, Paper>
  citations: Citation[]
  communities: Community[]
  influentialPapers: Paper[]
  seminalPapers: Paper[]
  trends: Trend[]
}

export interface Community {
  id: string
  name: string
  papers: string[]
  authors: string[]
  topics: string[]
  size: number
  cohesion: number // 0-1, how tightly connected
  growth: number // Papers per year
}

export interface Trend {
  topic: string
  papers: string[]
  growth_rate: number // % increase per year
  peak_year?: number
  status: 'emerging' | 'growing' | 'mature' | 'declining'
}

export interface Collaboration {
  researchers: string[] // Researcher IDs
  papers: string[] // Paper IDs
  strength: number // Number of collaborations
  firstCollaboration: string // Date
  lastCollaboration: string // Date
}

export interface CollaborationNetwork {
  researchers: Map<string, Researcher>
  collaborations: Collaboration[]
  teams: Team[]
  institutions: Map<string, Institution>
}

export interface Researcher {
  id: string
  name: string
  affiliations: Institution[]
  email?: string
  website?: string

  // Research profile
  papers: string[]
  topics: string[]
  h_index: number
  citation_count: number
  first_publication: string
  recent_publication: string

  // Network
  collaborators: string[] // Researcher IDs
  collaboration_count: number
  network_size: number
  centrality: number // In collaboration network

  // Expertise
  expertise_areas: ExpertiseArea[]
}

export interface ExpertiseArea {
  topic: string
  level: 'expert' | 'proficient' | 'familiar'
  evidence: {
    paper_count: number
    citation_count: number
    h_index: number
    recency: number // Years since last paper
  }
}

export interface Team {
  id: string
  name: string
  core_members: string[] // Frequent collaborators
  peripheral_members: string[] // Occasional collaborators
  leader?: string
  institution?: string
  topics: string[]
  papers: string[]
  productivity: number // Papers per year
  impact: number // Average citations
}

export interface Institution {
  id: string
  name: string
  type: 'university' | 'research_institute' | 'company' | 'hospital'
  country: string
  city?: string

  // Research profile
  researchers: string[]
  papers: string[]
  topics: string[]
  collaborations: string[] // Institution IDs

  // Metrics
  paper_count: number
  citation_count: number
  h_index: number
}

export interface Conference {
  id: string
  name: string
  acronym: string
  field: string
  prestige: 'A*' | 'A' | 'B' | 'C'
  acceptance_rate: number // 0-1

  // Metrics
  h5_index: number
  typical_attendance: number

  // Papers
  years: Map<number, ConferenceYear>

  // Network
  related_conferences: string[]
  feeder_conferences: string[]
  workshop_conferences: string[]
}

export interface ConferenceYear {
  year: number
  location: string
  papers: string[]
  attendance: number
  topics: Topic[]
}

export interface Topic {
  id: string
  name: string
  aliases: string[]
  description?: string
  papers: string[]
  related_topics: string[]
  parent_topic?: string
  subtopics: string[]
}

export interface Gap {
  id: string
  description: string
  field: string
  type: 'methodological' | 'empirical' | 'theoretical'
  papers_identifying: string[]
  importance: 'high' | 'medium' | 'low'
  difficulty: 'hard' | 'medium' | 'easy'
  funding_available: boolean
}

export interface Hypothesis {
  id: string
  statement: string
  field: string
  type: 'cross_domain' | 'contradiction_resolution' | 'gap_filling' |
        'analogical' | 'trend_extrapolation'

  // Support
  based_on: string[] // Paper IDs
  similar_hypotheses: string[]

  // Evaluation
  novelty: number // 0-1
  testability: number // 0-1
  impact: number // 0-1, if true
  feasibility: number // 0-1, to test

  // Research design
  proposed_method?: string
  required_resources?: string
  estimated_cost?: number
  estimated_duration?: number // months
}

export interface LiteratureReview {
  id: string
  topic: string
  generated_date: string
  papers_reviewed: string[]
  paper_count: number

  // Content
  sections: {
    introduction: string
    background: string
    methods: string // Review methodology
    findings: ReviewFindings
    discussion: string
    conclusions: string
    future_research: string[]
  }

  // Metadata
  references: string[] // Bibliography
  figures: Figure[]
  tables: Table[]
  word_count: number
}

export interface ReviewFindings {
  consensus: Finding[]
  controversies: Controversy[]
  gaps: Gap[]
  trends: Trend[]
  clusters: PaperCluster[]
}

export interface Finding {
  statement: string
  support_level: 'strong' | 'moderate' | 'weak'
  supporting_papers: string[]
  quality: 'high' | 'medium' | 'low'
}

export interface Controversy {
  topic: string
  positions: Position[]
  resolution_status: 'resolved' | 'ongoing' | 'unclear'
}

export interface Position {
  stance: string
  supporting_papers: string[]
  evidence_quality: number // 0-1
  proponents: string[] // Researcher IDs
}

export interface PaperCluster {
  id: string
  name: string
  papers: string[]
  common_theme: string
  methodology?: string
  findings?: string
}

export interface Figure {
  id: string
  type: 'chart' | 'diagram' | 'network' | 'table'
  title: string
  description: string
  data?: any
  url?: string
}

export interface Table {
  id: string
  title: string
  headers: string[]
  rows: string[][]
  notes?: string
}

export interface MetaAnalysis {
  id: string
  topic: string
  question: string
  generated_date: string

  // Studies
  studies_identified: number
  studies_included: number
  studies_excluded: number
  exclusion_reasons: Map<string, number>

  // Results
  effect_size: EffectSize
  heterogeneity: Heterogeneity
  publication_bias: PublicationBias
  subgroups?: SubgroupAnalysis[]

  // Quality
  quality_assessment: QualityAssessment
  risk_of_bias: RiskOfBias

  // Report
  report: string // PRISMA-compliant report
  forest_plot: Figure
  funnel_plot: Figure
}

export interface EffectSize {
  type: 'cohens_d' | 'odds_ratio' | 'correlation' | 'risk_ratio'
  pooled_estimate: number
  confidence_interval: [number, number]
  p_value: number
  significance: boolean
}

export interface Heterogeneity {
  i2: number // 0-100%
  tau2: number
  q_statistic: number
  p_value: number
  interpretation: 'low' | 'moderate' | 'high'
}

export interface PublicationBias {
  detected: boolean
  egger_test_p: number
  trim_and_fill_adjustment: number
  funnel_asymmetry: boolean
}

export interface SubgroupAnalysis {
  variable: string
  groups: SubgroupResult[]
  between_group_difference: number
  p_value: number
}

export interface SubgroupResult {
  group_name: string
  studies: number
  effect_size: number
  confidence_interval: [number, number]
}

export interface QualityAssessment {
  tool: string // e.g., "Cochrane Risk of Bias", "Newcastle-Ottawa"
  studies: Map<string, number> // Study ID -> Quality score
  average_quality: number
}

export interface RiskOfBias {
  low: number // Count
  moderate: number
  high: number
  unclear: number
  domains: Map<string, BiasAssessment> // Domain -> Assessment
}

export interface BiasAssessment {
  domain: string
  level: 'low' | 'moderate' | 'high' | 'unclear'
  explanation: string
}

// API Response types for different data sources

export interface ArXivPaper {
  id: string
  updated: string
  published: string
  title: string
  summary: string
  authors: { name: string }[]
  categories: string[]
  pdf_url: string
  doi?: string
}

export interface SemanticScholarPaper {
  paperId: string
  title: string
  abstract: string
  year: number
  authors: {
    authorId: string
    name: string
  }[]
  venue: string
  citationCount: number
  referenceCount: number
  influentialCitationCount: number
  fieldsOfStudy: string[]
  publicationTypes: string[]
  url: string
  externalIds?: {
    ArXiv?: string
    DOI?: string
    PubMed?: string
  }
}

export interface PubMedArticle {
  pmid: string
  title: string
  abstract: string
  authors: string[]
  journal: string
  pubdate: string
  doi?: string
  pmc?: string // PubMed Central ID
  mesh_terms: string[] // Medical Subject Headings
}

// Collector configuration

export interface CollectorConfig {
  source: 'arxiv' | 'semantic_scholar' | 'pubmed' | 'google_scholar'
  rate_limit: number // Requests per minute
  batch_size: number
  api_key?: string
  fields?: string[]
  categories?: string[]
  start_date?: string
  end_date?: string
}

// Query types

export interface SearchQuery {
  query: string
  fields?: string[]
  authors?: string[]
  start_date?: string
  end_date?: string
  limit?: number
  offset?: number
}

export interface CollectorResult {
  papers: Paper[]
  total: number
  query: SearchQuery
  source: string
  collected_at: string
}
