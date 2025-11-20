# Recursive, Generative & Personalized Features

This document outlines the comprehensive set of recursive, generative, and personalized features added to the Public Record Data Scraper platform.

## Table of Contents

1. [Overview](#overview)
2. [Recursive Features](#recursive-features)
3. [Generative Features](#generative-features)
4. [Personalized Features](#personalized-features)
5. [Usage Examples](#usage-examples)
6. [Architecture](#architecture)
7. [API Reference](#api-reference)

---

## Overview

This platform now includes advanced AI-powered features that leverage:
- **Recursive algorithms** for deep relationship mapping, signal chaining, and iterative enrichment
- **Generative AI** for narrative creation, insights, and report generation
- **Personalization** through behavioral learning and recommendation engines

### Key Capabilities

- **Recursive Company Relationship Graphs**: Multi-level network mapping of corporate relationships
- **Generative AI Narratives**: LLM-powered prospect analysis and insights
- **Personalized Recommendations**: ML-based prospect matching using user behavior
- **Recursive Signal Detection**: Automated discovery of correlated growth signals
- **Generative Report Builder**: AI-powered custom reports with visualizations
- **Recursive Enrichment Pipeline**: Self-optimizing data enhancement
- **Network-Aware Lead Requalification**: Relationship-based opportunity discovery
- **User Profile Learning**: Behavioral pattern recognition and preference adaptation

---

## Recursive Features

### 1. Recursive Company Relationship Mapper

**Purpose**: Build multi-level company relationship graphs from UCC filings and corporate data.

**Key Features**:
- Discovers 9 types of relationships: parent, subsidiary, affiliate, guarantor, common secured party, cross collateral, same industry, supplier, customer
- Configurable recursion depth (default: 3 levels)
- Automatic cycle detection and visited node tracking
- Network health and risk concentration metrics
- Cluster identification and centrality calculations

**Implementation**: `src/lib/services/RecursiveRelationshipMapper.ts`

**Usage**:
```typescript
import { RecursiveRelationshipMapper } from './services/RecursiveRelationshipMapper'

const mapper = new RecursiveRelationshipMapper(prospects)
const graph = await mapper.buildRelationshipGraph('prospect-123', {
  maxDepth: 3,
  relationshipTypes: ['parent', 'subsidiary', 'common_secured_party'],
  includeProspectData: true,
  stopConditions: { maxNodes: 100 }
})

console.log(`Network: ${graph.totalNodes} companies, ${graph.totalEdges} connections`)
console.log(`Risk concentration: ${graph.metadata.riskConcentration}`)
```

**Output**:
- `CompanyGraph` with nodes, edges, and metadata
- Network statistics (health grade, total exposure, risk concentration)
- Relationship paths and cluster identification

---

### 2. Recursive Signal Detection & Chaining

**Purpose**: Detect correlated growth signals and build signal chains recursively.

**Key Features**:
- Identifies 5 signal types: hiring, permit, contract, expansion, equipment
- Three relationship types: triggered_by, correlated_with, implies
- Configurable trigger rules and correlation thresholds
- Signal prediction based on current patterns
- Historical pattern analysis across prospects

**Implementation**: `src/lib/services/RecursiveSignalDetector.ts`

**Usage**:
```typescript
import { RecursiveSignalDetector } from './services/RecursiveSignalDetector'

const detector = new RecursiveSignalDetector(prospects)
const chains = await detector.detectSignalChains('prospect-123', {
  maxDepth: 3,
  minConfidence: 0.5,
  signalTriggers: {
    hiring: ['expansion', 'equipment'],
    expansion: ['equipment', 'permit']
  },
  correlationThreshold: 0.6
})

// Get strongest signal chain
const topChain = chains[0]
console.log(`Chain strength: ${topChain.chainStrength}`)
console.log(`Root signal: ${topChain.rootSignal.type}`)
console.log(`Chained signals: ${topChain.chainedSignals.length}`)
```

**Output**:
- `SignalChain[]` with root signals and chained signals
- Chain strength and confidence metrics
- Discovery paths showing recursion trace

---

### 3. Recursive Enrichment Engine

**Purpose**: Adaptively enrich prospect data with recursive strategy planning.

**Key Features**:
- Analyzes data gaps and plans enrichment steps
- Adaptive re-planning based on enrichment results
- Dependency-aware step execution
- 6 enrichment types: revenue, industry, signals, health, relationships, market
- Calculates data completeness and confidence improvements

**Implementation**: `src/lib/services/RecursiveEnrichmentEngine.ts`

**Usage**:
```typescript
import { RecursiveEnrichmentEngine } from './services/RecursiveEnrichmentEngine'

const engine = new RecursiveEnrichmentEngine(prospects)
const result = await engine.enrichProspectRecursively('prospect-123', 3)

console.log(`Data completeness improved by: ${result.improvements.dataCompleteness}%`)
console.log(`New fields added: ${result.improvements.newFieldsAdded.join(', ')}`)
console.log(`Executed ${result.executedSteps.length} steps in ${result.duration}ms`)
```

**Output**:
- `RecursiveEnrichmentResult` with original and enriched prospect
- Improvement metrics (data completeness, confidence increase)
- List of executed enrichment steps

---

### 4. Recursive Lead Requalification

**Purpose**: Network-aware lead requalification with recursive relationship traversal.

**Key Features**:
- Requalifies dead leads based on new signals
- Recursively checks related companies in network
- Generates network-based recommendations (cross-sell, cluster approach)
- Calculates total network opportunity value
- Revival threshold: 60+ net score, 1+ new signals

**Implementation**: `src/lib/services/RecursiveLeadRequalifier.ts`

**Usage**:
```typescript
import { RecursiveLeadRequalifier } from './services/RecursiveLeadRequalifier'

const requalifier = new RecursiveLeadRequalifier(prospects, relationshipMapper)
const result = await requalifier.requalifyWithNetwork('dead-lead-456', 2)

console.log(`Total opportunity value: $${result.totalOpportunityValue.toLocaleString()}`)
console.log(`Requalified ${result.requalifiedLeads.length} leads`)
console.log(`Recommendations: ${result.recommendations.length}`)

// Check revival recommendations
const revivals = result.requalifiedLeads.filter(l => l.recommendation === 'revive')
console.log(`${revivals.length} leads recommended for revival`)
```

**Output**:
- `NetworkRequalification` with all requalified leads
- Network graph showing relationships
- Strategic recommendations (cross-sell, upsell, cluster approach)

---

## Generative Features

### 1. Generative Narrative Engine

**Purpose**: AI-powered prospect narratives using LLM (Claude 3.5 Sonnet).

**Key Features**:
- Comprehensive prospect analysis with 7 sections
- Contextual insights using market data, relationships, signals, trends
- Personalization based on user preferences
- Mock mode for development (no API key required)
- Confidence scoring based on narrative completeness

**Implementation**: `src/lib/services/GenerativeNarrativeEngine.ts`

**Usage**:
```typescript
import { GenerativeNarrativeEngine } from './services/GenerativeNarrativeEngine'

const engine = new GenerativeNarrativeEngine()
const narrative = await engine.generateNarrative({
  prospect,
  marketData,
  relationships: companyGraph,
  industryTrends
})

console.log(narrative.sections.summary)
console.log(`Key findings: ${narrative.sections.keyFindings.join(', ')}`)
console.log(`Recommended actions: ${narrative.sections.recommendedActions.join(', ')}`)
console.log(`Confidence: ${(narrative.confidence * 100).toFixed(0)}%`)
```

**Narrative Sections**:
1. **Summary**: 2-3 sentence executive summary
2. **Key Findings**: 3-5 most important insights
3. **Opportunity Analysis**: Detailed opportunity assessment
4. **Risk Factors**: Key risks to consider
5. **Recommended Actions**: Specific next steps
6. **Market Context**: Market positioning analysis
7. **Competitive Landscape**: Competitive dynamics

---

### 2. Generative Insights

**Purpose**: Automated insight generation across multiple prospects.

**Key Features**:
- 4 insight types: opportunity, risk, trend, recommendation
- Pattern analysis (industry distribution, signal correlations, health trends)
- Confidence and impact scoring
- Evidence tracking for each insight
- Automatic prioritization by impact and confidence

**Usage**:
```typescript
const insights = await engine.generateInsights(prospects, marketData, relationships)

// Filter high-impact insights
const highImpact = insights.filter(i => i.impact === 'high')
console.log(`${highImpact.length} high-impact insights generated`)

// Group by type
const opportunities = insights.filter(i => i.type === 'opportunity')
const risks = insights.filter(i => i.type === 'risk')
```

---

### 3. Generative Report Builder

**Purpose**: AI-powered custom report generation with insights and visualizations.

**Key Features**:
- 4 report types: Portfolio, Market, Prospect, Competitive
- Automatic section generation with AI insights
- Markdown, HTML, and PDF format support
- Built-in visualizations (charts, graphs, tables)
- Customizable date ranges and filters

**Implementation**: `src/lib/services/GenerativeReportBuilder.ts`

**Usage**:
```typescript
import { GenerativeReportBuilder } from './services/GenerativeReportBuilder'

const builder = new GenerativeReportBuilder(
  prospects,
  narrativeEngine,
  competitorData,
  relationshipGraphs
)

// Generate portfolio report
const report = await builder.generatePortfolioReport(
  { start: '2024-01-01', end: '2024-12-31' },
  'user-123'
)

console.log(report.title)
console.log(`${report.sections.length} sections`)
console.log(`${report.insights.length} insights included`)
console.log(`Report content: ${report.content.length} characters`)
```

**Report Types**:

1. **Portfolio Report**: Executive summary, performance analysis, risk assessment, growth opportunities
2. **Market Report**: Market overview, competitive landscape, trends, opportunity analysis
3. **Prospect Report**: Company profile, financials, growth signals, network analysis, recommendations
4. **Competitive Report**: Competitor overview, market position, deal flow, strategic opportunities

---

## Personalized Features

### 1. Personalized Recommendation Engine

**Purpose**: ML-powered prospect recommendations based on user behavior.

**Key Features**:
- 5 match factors: industry, score, signal, behavior, network (weighted scoring)
- Learns from claim patterns and outcomes
- Historical success tracking by industry
- Deal size preference learning
- Network-aware recommendations (connected prospects boost score)

**Implementation**: `src/lib/services/PersonalizedRecommendationEngine.ts`

**Usage**:
```typescript
import { PersonalizedRecommendationEngine } from './services/PersonalizedRecommendationEngine'

const engine = new PersonalizedRecommendationEngine(
  userProfile,
  prospects,
  relationshipGraphs
)

const recommendations = await engine.generateRecommendations(20, {
  excludeClaimed: true,
  minScore: 60,
  industries: ['technology', 'healthcare']
})

// Top recommendation
const top = recommendations[0]
console.log(`${top.prospect.companyName}: ${top.score.toFixed(1)} score`)
console.log(`Reasons: ${top.reasons.map(r => r.description).join('; ')}`)
```

**Match Factors**:
- **Industry Match** (25%): Preferred industries, historical success
- **Score Match** (20%): Proximity to user's typical claims
- **Signal Match** (20%): Preferred signal types, signal count bonus
- **Behavior Match** (20%): Claim patterns, deal size fit
- **Network Match** (15%): Relationships to claimed prospects

---

### 2. User Profile Manager

**Purpose**: Comprehensive user profile management with behavioral learning.

**Key Features**:
- Preference management (industries, states, score thresholds, signal types)
- Automatic behavioral pattern learning
- Custom filter saving and management
- Dashboard layout customization
- Notification preferences
- Profile import/export

**Implementation**: `src/lib/services/UserProfileManager.ts`

**Usage**:
```typescript
import { UserProfileManager } from './services/UserProfileManager'

const manager = new UserProfileManager()
const profile = manager.getUserProfile('user-123')

// Update preferences manually
manager.updatePreferences('user-123', {
  industries: ['technology', 'healthcare'],
  minPriorityScore: 70,
  preferredSignalTypes: ['hiring', 'expansion']
})

// Record user action (automatic learning)
manager.recordAction('user-123', {
  type: 'claim',
  prospectId: 'prospect-456',
  prospectData: {
    industry: 'technology',
    priorityScore: 85,
    signalTypes: ['hiring', 'expansion'],
    estimatedRevenue: 2500000
  },
  outcome: 'success'
})

// Auto-learn preferences from behavior
manager.learnPreferences('user-123')

// Get analytics
const analytics = manager.getProfileAnalytics('user-123')
console.log(`Conversion rate: ${(analytics.conversionRate * 100).toFixed(1)}%`)
console.log(`Most frequent industry: ${analytics.mostFrequentIndustry}`)
```

**Behavioral Learning**:
- Tracks claim patterns by industry, score, signals
- Calculates conversion rates and success metrics
- Identifies successful industries automatically
- Learns preferred deal sizes from claims
- Auto-updates preferences based on patterns

---

### 3. Dashboard Layout Customization

**Purpose**: Personalized dashboard with drag-and-drop widgets.

**Features**:
- 7 widget types: prospects, stats, signals, portfolio, competitors, recommendations, insights
- Grid-based layout (12 columns)
- Custom widget positioning and sizing
- Theme selection (light, dark, auto)
- Layout persistence per user

**Usage**:
```typescript
manager.updateDashboardLayout('user-123', {
  widgets: [
    {
      id: 'recommendations',
      type: 'recommendations',
      position: { x: 0, y: 0 },
      size: { width: 6, height: 4 },
      config: { limit: 10 }
    },
    {
      id: 'signals',
      type: 'signals',
      position: { x: 6, y: 0 },
      size: { width: 6, height: 4 },
      config: {}
    }
  ],
  columns: 12,
  theme: 'dark'
})
```

---

## Usage Examples

### Complete Workflow Example

```typescript
import { useRecursiveIntelligence } from './hooks/useRecursiveFeatures'

function ProspectIntelligence() {
  const intelligence = useRecursiveIntelligence(prospects, 'user-123')

  useEffect(() => {
    async function analyze() {
      // 1. Build relationship graph
      const graph = await intelligence.relationshipGraphs.buildGraph('prospect-123', {
        maxDepth: 3
      })

      // 2. Detect signal chains
      const chains = await intelligence.signalChains.detectChains('prospect-123')

      // 3. Enrich prospect data
      const enriched = await intelligence.enrichment.enrichProspect('prospect-123', 3)

      // 4. Generate AI narrative
      const narrative = await intelligence.narratives.generateNarrative(prospect, {
        relationships: graph,
        historicalSignals: chains
      })

      // 5. Get personalized recommendations
      const recs = await intelligence.recommendations.generateRecommendations(20)

      // 6. Requalify dead leads in network
      const requalification = await intelligence.requalification.requalifyLead('prospect-123', 2)

      // 7. Generate comprehensive report
      const report = await intelligence.reports.generateReport('prospect', {
        prospectId: 'prospect-123',
        userId: 'user-123'
      })

      console.log('Analysis complete!')
    }

    analyze()
  }, [])

  return <div>Loading intelligence...</div>
}
```

### Batch Processing Example

```typescript
// Batch enrich all unclaimed prospects
const unclaimedIds = prospects
  .filter(p => !p.claimedBy)
  .map(p => p.id)

const enrichmentEngine = new RecursiveEnrichmentEngine(prospects)
const results = await enrichmentEngine.batchEnrich(unclaimedIds, 2, 5)

console.log(`Enriched ${results.length} prospects`)
const avgImprovement = results.reduce((sum, r) => sum + r.improvements.dataCompleteness, 0) / results.length
console.log(`Average improvement: ${avgImprovement.toFixed(1)}%`)
```

---

## Architecture

### Service Layer

```
src/lib/services/
├── RecursiveRelationshipMapper.ts    # Relationship graph building
├── GenerativeNarrativeEngine.ts      # AI narrative generation
├── PersonalizedRecommendationEngine.ts # ML recommendations
├── RecursiveSignalDetector.ts        # Signal chain detection
├── GenerativeReportBuilder.ts        # Report generation
├── RecursiveEnrichmentEngine.ts      # Data enrichment
├── RecursiveLeadRequalifier.ts       # Lead requalification
└── UserProfileManager.ts             # User profile management
```

### Type Definitions

```
src/lib/types.ts                       # 40+ new types added
├── CompanyGraph, CompanyNode, CompanyRelationship
├── GenerativeNarrative, GenerativeInsight
├── PersonalizedRecommendation, UserProfile
├── SignalChain, ChainedSignal
├── GenerativeReport, ReportSection
├── EnrichmentPlan, RecursiveEnrichmentResult
├── NetworkRequalification, NetworkRecommendation
└── ... and more
```

### React Hooks

```
src/lib/hooks/useRecursiveFeatures.ts
├── useRelationshipGraph()            # Relationship mapping
├── usePersonalizedRecommendations()  # Personalized recs
├── useGenerativeNarrative()          # AI narratives
├── useSignalChains()                 # Signal detection
├── useGenerativeReports()            # Report generation
├── useRecursiveEnrichment()          # Data enrichment
├── useNetworkRequalification()       # Lead requalification
├── useUserProfile()                  # Profile management
└── useRecursiveIntelligence()        # All-in-one hook
```

---

## API Reference

### RecursiveRelationshipMapper

```typescript
class RecursiveRelationshipMapper {
  constructor(prospects: Prospect[])

  buildRelationshipGraph(
    rootCompanyId: string,
    config: RecursiveTraversalConfig
  ): Promise<CompanyGraph>

  getRelatedCompanies(
    companyId: string,
    graph: CompanyGraph,
    relationshipTypes?: RelationshipType[]
  ): CompanyNode[]

  findPaths(
    fromCompanyId: string,
    toCompanyId: string,
    graph: CompanyGraph,
    maxPathLength?: number
  ): CompanyRelationship[][]

  calculateCentrality(graph: CompanyGraph): Map<string, number>

  identifyClusters(graph: CompanyGraph): Map<number, Set<string>>
}
```

### GenerativeNarrativeEngine

```typescript
class GenerativeNarrativeEngine {
  constructor(apiEndpoint?: string, apiKey?: string)

  generateNarrative(
    context: GenerativeContext,
    userPreferences?: {...}
  ): Promise<GenerativeNarrative>

  generateInsights(
    prospects: Prospect[],
    marketData?: CompetitorData[],
    relationships?: Map<string, CompanyGraph>
  ): Promise<GenerativeInsight[]>

  generatePersonalizedNarrative(
    prospect: Prospect,
    userBehavior: {...}
  ): Promise<string>
}
```

### PersonalizedRecommendationEngine

```typescript
class PersonalizedRecommendationEngine {
  constructor(
    userProfile: UserProfile,
    prospects: Prospect[],
    relationshipGraphs?: Map<string, CompanyGraph>
  )

  generateRecommendations(
    limit?: number,
    filters?: {...}
  ): Promise<PersonalizedRecommendation[]>

  learnFromAction(action: {...}): Promise<UserProfile>

  getSimilarProspects(
    referenceProspectId: string,
    limit?: number
  ): Promise<Prospect[]>
}
```

### RecursiveSignalDetector

```typescript
class RecursiveSignalDetector {
  constructor(prospects: Prospect[])

  detectSignalChains(
    prospectId: string,
    config: RecursiveSignalConfig
  ): Promise<SignalChain[]>

  analyzeSignalClusters(
    config: RecursiveSignalConfig
  ): Promise<{
    clusters: Map<string, Prospect[]>
    patterns: {...}[]
  }>

  predictNextSignals(
    prospectId: string,
    config: RecursiveSignalConfig
  ): Promise<{
    signalType: SignalType
    probability: number
    reasoning: string
    basedOn: GrowthSignal[]
  }[]>

  static getDefaultConfig(): RecursiveSignalConfig
}
```

### UserProfileManager

```typescript
class UserProfileManager {
  constructor()

  getUserProfile(userId: string): UserProfile

  updatePreferences(
    userId: string,
    preferences: Partial<UserProfile['preferences']>
  ): UserProfile

  recordAction(userId: string, action: {...}): UserProfile

  saveFilter(userId: string, filter: {...}): UserProfile

  updateDashboardLayout(userId: string, layout: DashboardLayout): UserProfile

  updateNotificationSettings(
    userId: string,
    settings: Partial<NotificationSettings>
  ): UserProfile

  learnPreferences(userId: string): UserProfile

  getProfileAnalytics(userId: string): {...}

  exportProfile(userId: string): string

  importProfile(userId: string, profileData: string): UserProfile
}
```

---

## Configuration

### Environment Variables

```bash
# Generative AI
VITE_LLM_API_ENDPOINT=https://api.anthropic.com/v1/messages
VITE_ANTHROPIC_API_KEY=your-api-key-here

# Feature Flags
VITE_ENABLE_RECURSIVE_FEATURES=true
VITE_ENABLE_GENERATIVE_NARRATIVES=true
VITE_ENABLE_PERSONALIZATION=true
```

### Default Configurations

**Relationship Mapping**:
```typescript
{
  maxDepth: 3,
  relationshipTypes: ['parent', 'subsidiary', 'affiliate', 'common_secured_party'],
  includeProspectData: true,
  stopConditions: { maxNodes: 100, maxEdges: 500 }
}
```

**Signal Detection**:
```typescript
{
  maxDepth: 3,
  minConfidence: 0.5,
  correlationThreshold: 0.6,
  signalTriggers: {
    hiring: ['expansion', 'equipment'],
    expansion: ['equipment', 'permit', 'hiring'],
    permit: ['equipment', 'expansion'],
    contract: ['hiring', 'expansion'],
    equipment: ['hiring']
  }
}
```

---

## Performance Considerations

### Optimization Strategies

1. **Batch Processing**: Use batch methods for multiple prospects
2. **Caching**: Results are cached automatically in hooks
3. **Concurrency Control**: Configurable concurrency limits in batch operations
4. **Stop Conditions**: Set max nodes/edges to prevent runaway recursion
5. **Lazy Loading**: Only build graphs/chains when needed
6. **Mock Mode**: Use mock data during development to avoid API costs

### Recommended Limits

- **Recursion Depth**: 2-3 levels for most use cases
- **Network Size**: Max 100 nodes, 500 edges
- **Batch Size**: 5-10 concurrent operations
- **API Rate Limits**: Respect LLM provider limits (mock mode as fallback)

---

## Future Enhancements

### Planned Features

1. **Real-time Signal Detection**: WebSocket-based live signal updates
2. **Advanced ML Models**: Fine-tuned models for industry classification
3. **Collaborative Filtering**: Cross-user recommendation improvements
4. **Graph Visualizations**: Interactive network diagrams
5. **A/B Testing Framework**: Test recommendation algorithms
6. **Multi-tenant Support**: Isolate profiles per organization
7. **API Gateway**: RESTful API for external integrations
8. **Mobile App**: Native iOS/Android with offline support

---

## Contributing

When adding new recursive/generative features:

1. Add types to `src/lib/types.ts`
2. Create service in `src/lib/services/`
3. Add React hook in `src/lib/hooks/useRecursiveFeatures.ts`
4. Update this documentation
5. Add tests covering recursion edge cases
6. Include performance benchmarks

---

## License

MIT License - see LICENSE file for details

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/ivi374forivi/public-record-data-scrapper/issues
- Documentation: This file
- Examples: See `Usage Examples` section above
