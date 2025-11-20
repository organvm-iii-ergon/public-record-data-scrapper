/**
 * Type definitions for Recursive Intelligence features
 * Supports: Recursive enrichment, Self-learning models, Data source discovery, Recursive competitor analysis
 */

// ==================== RECURSIVE ENRICHMENT ====================

export type EnrichmentStrategy =
  | 'contact_discovery'
  | 'network_expansion'
  | 'signal_amplification'
  | 'relationship_mapping'
  | 'historical_analysis'
  | 'social_graph'
  | 'financial_deep_dive'
  | 'regulatory_research';

export interface RecursiveEnrichmentConfig {
  maxDepth: number; // Maximum recursion depth (default: 5)
  confidenceThreshold: number; // Minimum confidence to recurse (0-1)
  expansionStrategies: EnrichmentStrategy[];
  learningEnabled: boolean; // Learn which paths are most valuable
  costLimit: number; // Max cost per enrichment chain (dollars)
  timeLimit: number; // Max time per enrichment chain (seconds)
  parallelization: number; // Max parallel enrichment branches
}

export interface EnrichmentNode {
  id: string;
  prospectId: string;
  enrichmentType: string;
  depth: number;
  parentNodeId?: string;
  data: any;
  confidence: number; // 0-1
  valueScore: number; // How valuable this enrichment proved (learned over time)
  cost: number; // Cost of this enrichment (API calls, etc.)
  childNodes: EnrichmentNode[];
  discoveredAt: Date;
  source: string; // Where data came from
  metadata: EnrichmentMetadata;
}

export interface EnrichmentMetadata {
  dataQuality: number; // 0-1
  freshness: Date; // When data was last updated at source
  reliability: number; // 0-1, based on source reliability
  verificationStatus: 'unverified' | 'partially_verified' | 'verified';
  verificationMethod?: string;
}

export interface EnrichmentResult {
  nodeId: string;
  success: boolean;
  dataDiscovered: any;
  confidence: number;
  childOpportunities: EnrichmentOpportunity[]; // What we could enrich next
  cost: number;
  timeMs: number;
}

export interface EnrichmentOpportunity {
  strategy: EnrichmentStrategy;
  estimatedValue: number; // 0-1
  estimatedCost: number;
  estimatedConfidence: number;
  priority: number; // Calculated based on value/cost ratio
  reasoning: string;
}

export interface EnrichmentTree {
  prospectId: string;
  rootNode: EnrichmentNode;
  totalNodes: number;
  maxDepth: number;
  totalCost: number;
  totalValue: number; // Calculated value score
  startedAt: Date;
  completedAt?: Date;
  status: 'running' | 'completed' | 'paused' | 'failed';
}

// ==================== RECURSIVE COMPETITOR ANALYSIS ====================

export type CompetitorTier = 'direct' | 'indirect' | 'emerging' | 'adjacent_market';
export type StrategicPosition = 'dominant' | 'growing' | 'declining' | 'niche' | 'disruptor';

export interface CompetitorNode {
  id: string;
  name: string;
  depth: number; // 0 = direct competitor, 1 = competitor's competitor, etc.
  tier: CompetitorTier;
  marketShare: number; // 0-100
  filingVolume: number;
  averageDealSize: number;
  growthRate: number; // YoY growth percentage
  competitiveThreats: CompetitorNode[];
  sharedClients: string[]; // Prospect IDs
  opportunities: OpportunityAnalysis[];
  strategicPosition: StrategicPosition;
  metadata: CompetitorMetadata;
}

export interface CompetitorMetadata {
  foundedYear?: number;
  headquarters?: string;
  employeeCount?: number;
  fundingRaised?: number;
  technologies: string[];
  strengths: string[];
  weaknesses: string[];
  recentActivity: CompetitorActivity[];
}

export interface CompetitorActivity {
  activityType: 'filing' | 'funding' | 'expansion' | 'partnership' | 'acquisition' | 'product_launch';
  description: string;
  date: Date;
  impact: 'positive' | 'negative' | 'neutral';
  significance: 'low' | 'medium' | 'high';
}

export interface OpportunityAnalysis {
  opportunityId: string;
  type: 'white_space' | 'underserved_segment' | 'pricing_gap' | 'service_gap' | 'technology_gap';
  description: string;
  estimatedValue: number; // dollars
  confidence: number; // 0-1
  actionableSteps: ActionableStep[];
  timeToCapture: string; // e.g., '3 months', '1 year'
  requiredInvestment: number;
  competitiveResponse: string; // How competitors might react
}

export interface ActionableStep {
  step: string;
  description: string;
  priority: number;
  estimatedEffort: string;
  dependencies: string[];
  successMetrics: string[];
}

export interface CompetitorNetwork {
  centerCompany: string; // Our company
  nodes: CompetitorNode[];
  edges: CompetitorRelationship[];
  totalMarketSize: number;
  ourMarketShare: number;
  opportunityValue: number;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  analysisDate: Date;
}

export interface CompetitorRelationship {
  fromCompanyId: string;
  toCompanyId: string;
  relationshipType: 'competes_with' | 'partners_with' | 'acquired' | 'spun_off_from';
  strength: number; // 0-1
  description?: string;
}

// ==================== SELF-LEARNING MODELS ====================

export type ModelType =
  | 'conversion_prediction'
  | 'deal_size_prediction'
  | 'time_to_close'
  | 'churn_risk'
  | 'optimal_pricing'
  | 'contact_timing'
  | 'channel_effectiveness'
  | 'sentiment_prediction';

export type ModelStatus = 'training' | 'validating' | 'deployed' | 'archived' | 'failed';

export interface LearningModel {
  modelId: string;
  modelType: ModelType;
  version: number;
  status: ModelStatus;
  accuracy: number; // 0-1
  precision: number; // 0-1
  recall: number; // 0-1
  f1Score: number; // 0-1
  trainingDataSize: number;
  lastTrainedAt: Date;
  features: ModelFeature[];
  outcomes: ModelOutcome[];
  improvementHistory: ModelVersion[];
  configuration: ModelConfiguration;
}

export interface ModelFeature {
  name: string;
  type: 'numeric' | 'categorical' | 'boolean' | 'text' | 'date';
  importance: number; // 0-1, feature importance score
  description: string;
  transformation?: string; // Any transformation applied
}

export interface ModelOutcome {
  outcomeId: string;
  prospectId: string;
  userId?: string;
  timestamp: Date;
  prediction: number;
  actualOutcome: number;
  error: number;
  absoluteError: number;
  features: Record<string, any>;
  feedbackProvided: boolean;
  feedbackType?: 'correct' | 'incorrect' | 'partially_correct';
}

export interface ModelVersion {
  version: number;
  trainedAt: Date;
  accuracy: number;
  trainingDataSize: number;
  changes: string[];
  improvementOverPrevious: number; // percentage
  deploymentDate?: Date;
  retiredDate?: Date;
}

export interface ModelConfiguration {
  algorithm: string; // e.g., 'random_forest', 'neural_network', 'xgboost'
  hyperparameters: Record<string, any>;
  crossValidationFolds: number;
  testSplitRatio: number;
  balancingStrategy?: 'oversample' | 'undersample' | 'smote';
  featureSelection?: string;
}

export interface RetrainingConfig {
  automaticRetraining: boolean;
  minNewOutcomes: number; // Retrain after N new outcomes
  minAccuracyImprovement: number; // Only deploy if accuracy improves by X%
  abTestNewModels: boolean; // A/B test before full deployment
  retrainingSchedule?: string; // Cron expression
  rollbackOnRegression: boolean; // Rollback if accuracy decreases
}

export interface ModelPrediction {
  predictionId: string;
  modelId: string;
  modelVersion: number;
  prospectId: string;
  predictedValue: number;
  confidence: number; // 0-1
  confidenceInterval?: [number, number];
  featureValues: Record<string, any>;
  explanation: PredictionExplanation;
  timestamp: Date;
}

export interface PredictionExplanation {
  topFeatures: FeatureContribution[];
  reasoning: string;
  similarCases: string[]; // IDs of similar historical cases
  uncertaintyFactors: string[];
}

export interface FeatureContribution {
  feature: string;
  value: any;
  contribution: number; // -1 to 1, positive = increased prediction
  importance: number; // 0-1
}

// ==================== DATA SOURCE DISCOVERY ====================

export type SourceType =
  | 'api'
  | 'web_portal'
  | 'database'
  | 'file_feed'
  | 'web_scraper'
  | 'third_party_provider';

export type DiscoveryMethod =
  | 'web_crawl'
  | 'api_directory'
  | 'competitor_analysis'
  | 'academic_research'
  | 'user_suggestion'
  | 'automated_search';

export interface DataSourceDiscovery {
  discoveryId: string;
  discoveryMethods: DiscoveryMethodConfig[];
  evaluationCriteria: SourceEvaluationCriteria;
  autoIntegration: boolean; // Automatically integrate high-value sources
  humanApprovalRequired: boolean;
  discoverySchedule: string; // Cron expression
  lastRunAt?: Date;
  discoveredSources: DiscoveredSource[];
}

export interface DiscoveryMethodConfig {
  type: DiscoveryMethod;
  enabled: boolean;
  schedule: string; // Cron expression
  parameters: Record<string, any>;
  priority: number;
}

export interface DiscoveredSource {
  sourceId: string;
  name: string;
  url: string;
  sourceType: SourceType;
  dataTypes: string[]; // e.g., ['ucc_filings', 'company_info', 'financials']
  estimatedValue: number; // 0-1, calculated by discovery engine
  costEstimate: number; // dollars per month
  integrationComplexity: 'low' | 'medium' | 'high';
  reliabilityScore: number; // 0-1
  freshnessScore: number; // 0-1, how up-to-date is data
  coverageScore: number; // 0-1, how much data is available
  status: 'discovered' | 'evaluating' | 'integrating' | 'active' | 'rejected';
  discoveryMethod: DiscoveryMethod;
  discoveredAt: Date;
  evaluation?: SourceEvaluation;
  integrationStatus?: IntegrationStatus;
}

export interface SourceEvaluationCriteria {
  minReliability: number; // 0-1
  minFreshness: number; // 0-1
  minCoverage: number; // 0-1
  maxCost: number; // dollars per month
  maxIntegrationTime: number; // days
  requiredDataTypes: string[];
  blockedDomains: string[];
}

export interface SourceEvaluation {
  evaluationId: string;
  sourceId: string;
  evaluatedAt: Date;
  scores: {
    reliability: number;
    freshness: number;
    coverage: number;
    dataQuality: number;
    uniqueness: number; // How much unique data vs. duplicates
  };
  sampleData: any[];
  costAnalysis: CostAnalysis;
  recommendation: 'integrate' | 'monitor' | 'reject';
  reasoning: string;
}

export interface CostAnalysis {
  setupCost: number;
  monthlyCost: number;
  perRequestCost?: number;
  estimatedMonthlyRequests: number;
  estimatedTotalMonthlyCost: number;
  roi: number; // Return on investment estimate
}

export interface IntegrationStatus {
  integrationId: string;
  sourceId: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'planning' | 'developing' | 'testing' | 'deploying' | 'completed' | 'failed';
  progress: number; // 0-100
  tasks: IntegrationTask[];
  errors: string[];
}

export interface IntegrationTask {
  taskId: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignedTo?: string;
  estimatedHours: number;
  actualHours?: number;
}

// ==================== RECURSIVE GRAPH MAPPING ====================

export type NodeType = 'company' | 'person' | 'lender' | 'industry' | 'location';
export type RelationType =
  | 'filed_against'
  | 'lent_to'
  | 'works_at'
  | 'subsidiary_of'
  | 'partner_with'
  | 'competes_with'
  | 'supplier_to'
  | 'customer_of';

export interface KnowledgeGraph {
  graphId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: GraphMetadata;
  indices: GraphIndices;
}

export interface GraphNode {
  nodeId: string;
  nodeType: NodeType;
  name: string;
  properties: Record<string, any>;
  depth: number; // Distance from seed node
  importance: number; // PageRank or similar
  discoveredAt: Date;
  lastUpdated: Date;
}

export interface GraphEdge {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  relationType: RelationType;
  weight: number; // Strength of relationship
  properties: Record<string, any>;
  confidence: number; // 0-1
  discoveredAt: Date;
}

export interface GraphMetadata {
  totalNodes: number;
  totalEdges: number;
  maxDepth: number;
  centerNodeId: string;
  createdAt: Date;
  lastExpanded: Date;
}

export interface GraphIndices {
  nodesByType: Record<NodeType, string[]>;
  nodesByName: Record<string, string>;
  edgesByType: Record<RelationType, string[]>;
}

export interface GraphQuery {
  queryType: 'find_path' | 'find_neighbors' | 'find_clusters' | 'find_patterns';
  parameters: Record<string, any>;
}

export interface GraphQueryResult {
  queryId: string;
  results: any[];
  executionTimeMs: number;
  resultCount: number;
}

// ==================== RECURSIVE ENGINE INTERFACES ====================

export interface RecursiveEnrichmentEngine {
  enrichProspect(
    prospectId: string,
    config: RecursiveEnrichmentConfig
  ): Promise<EnrichmentTree>;

  expandNode(
    nodeId: string,
    strategy: EnrichmentStrategy
  ): Promise<EnrichmentResult>;

  evaluateOpportunities(
    nodeId: string
  ): Promise<EnrichmentOpportunity[]>;

  learnFromOutcome(
    treeId: string,
    outcome: 'success' | 'failure',
    value: number
  ): Promise<void>;

  getTreeStatus(treeId: string): Promise<EnrichmentTree>;

  pauseEnrichment(treeId: string): Promise<void>;

  resumeEnrichment(treeId: string): Promise<void>;
}

export interface RecursiveCompetitorAnalyzer {
  analyzeCompetitor(
    competitorName: string,
    maxDepth: number
  ): Promise<CompetitorNode>;

  buildCompetitorNetwork(centerCompany: string): Promise<CompetitorNetwork>;

  identifyOpportunities(
    network: CompetitorNetwork
  ): Promise<OpportunityAnalysis[]>;

  trackCompetitorActivity(
    competitorId: string
  ): Promise<CompetitorActivity[]>;

  predictMarketChanges(
    network: CompetitorNetwork
  ): Promise<MarketPrediction[]>;
}

export interface MarketPrediction {
  predictionId: string;
  description: string;
  probability: number; // 0-1
  timeframe: string; // e.g., '3 months', '1 year'
  impact: 'positive' | 'negative' | 'neutral';
  magnitude: number; // 1-10
  requiredActions: string[];
}

export interface SelfLearningEngine {
  trainModel(
    modelType: ModelType,
    trainingData: any[]
  ): Promise<LearningModel>;

  predict(
    modelId: string,
    features: Record<string, any>
  ): Promise<ModelPrediction>;

  recordOutcome(
    predictionId: string,
    actualOutcome: number
  ): Promise<void>;

  evaluateModel(modelId: string): Promise<ModelEvaluation>;

  compareModels(modelIds: string[]): Promise<ModelComparison>;

  autoRetrain(modelId: string): Promise<LearningModel>;

  explainPrediction(predictionId: string): Promise<PredictionExplanation>;
}

export interface ModelEvaluation {
  modelId: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  confusionMatrix?: number[][];
  rocCurve?: { fpr: number[]; tpr: number[] };
  featureImportance: FeatureContribution[];
  recommendations: string[];
}

export interface ModelComparison {
  models: LearningModel[];
  winner: string; // model ID
  metrics: Record<string, Record<string, number>>; // modelId -> metric -> value
  recommendation: string;
}

export interface DataSourceDiscoveryEngine {
  runDiscovery(
    method: DiscoveryMethod,
    parameters: any
  ): Promise<DiscoveredSource[]>;

  evaluateSource(sourceId: string): Promise<SourceEvaluation>;

  integrateSource(
    sourceId: string,
    automate: boolean
  ): Promise<IntegrationStatus>;

  monitorSources(): Promise<SourceHealthReport[]>;

  suggestNewSources(
    basedOnNeeds: string[]
  ): Promise<DiscoveredSource[]>;
}

export interface SourceHealthReport {
  sourceId: string;
  health: 'healthy' | 'degraded' | 'down';
  uptime: number; // percentage
  errorRate: number; // percentage
  averageLatency: number; // ms
  costThisMonth: number;
  valueThisMonth: number;
  recommendations: string[];
}

export interface RecursiveGraphEngine {
  buildGraph(seedNodeId: string, maxDepth: number): Promise<KnowledgeGraph>;

  expandGraph(
    graphId: string,
    nodeId: string,
    relationTypes: RelationType[]
  ): Promise<GraphNode[]>;

  query(
    graphId: string,
    query: GraphQuery
  ): Promise<GraphQueryResult>;

  findPath(
    graphId: string,
    fromNodeId: string,
    toNodeId: string
  ): Promise<GraphNode[]>;

  findClusters(graphId: string): Promise<NodeCluster[]>;

  detectPatterns(graphId: string): Promise<GraphPattern[]>;
}

export interface NodeCluster {
  clusterId: string;
  nodes: string[]; // node IDs
  centrality: number; // How central/important this cluster is
  description: string;
  commonProperties: Record<string, any>;
}

export interface GraphPattern {
  patternId: string;
  patternType: string;
  description: string;
  instances: GraphPatternInstance[];
  frequency: number;
  significance: number; // 0-1
}

export interface GraphPatternInstance {
  nodes: string[];
  edges: string[];
  properties: Record<string, any>;
}

export default {};
