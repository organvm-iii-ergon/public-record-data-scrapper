/**
 * Entry Point Agent - Specialized agent for different data source entry points
 *
 * Entry points include:
 * - Public APIs (REST, GraphQL, SOAP)
 * - Web Portals (HTML scraping)
 * - Database connections (direct DB access)
 * - File uploads (CSV, JSON, XML)
 * - Webhooks (real-time notifications)
 */

import { BaseAgent } from '../../BaseAgent'
import type {
  Agent,
  AgentAnalysis,
  SystemContext,
  ImprovementSuggestion,
  Finding
} from '../../types'

export type EntryPointType = 'api' | 'portal' | 'database' | 'file' | 'webhook'

export interface EntryPointConfig {
  id: string
  name: string
  type: EntryPointType
  endpoint: string
  authRequired: boolean
  authMethod?: 'api-key' | 'oauth2' | 'basic' | 'jwt'
  rateLimit: {
    requestsPerSecond: number
    requestsPerMinute: number
    requestsPerHour: number
  }
  dataFormat: 'json' | 'xml' | 'csv' | 'html' | 'binary'
  reliability: number // 0-100
  averageResponseTime: number // milliseconds
  costPerRequest?: number // dollars
}

export class EntryPointAgent extends BaseAgent implements Agent {
  private config: EntryPointConfig
  private customId: string
  private metrics: {
    totalRequests: number
    successfulRequests: number
    failedRequests: number
    averageLatency: number
    lastRequestTime: string
    uptime: number
  }

  constructor(config: EntryPointConfig) {
    const customId = config.id
    const agentName = config.name
    const capabilities = [
      `Collect from ${config.name} via ${config.type.charAt(0).toUpperCase() + config.type.slice(1)}`,
      `Parse ${config.dataFormat.toUpperCase()} format`,
      config.authRequired && config.authMethod
        ? `Handle ${config.authMethod
            .split('-')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ')} authentication`
        : 'Public access (no auth required)',
      `Rate limit: ${config.rateLimit.requestsPerMinute} req/min`,
      'Monitor endpoint health',
      'Detect schema changes'
    ]

    super('entry-point-collector', agentName, capabilities)
    this.customId = customId

    this.config = config
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      lastRequestTime: new Date().toISOString(),
      uptime: 100
    }
  }

  async analyze(context: SystemContext): Promise<AgentAnalysis> {
    void context
    const findings: Finding[] = []
    const improvements: ImprovementSuggestion[] = []

    // Check endpoint reliability
    const successRate =
      this.metrics.totalRequests > 0
        ? (this.metrics.successfulRequests / this.metrics.totalRequests) * 100
        : 100

    if (successRate < 95) {
      findings.push({
        id: `${this.customId}-low-reliability`,
        category: 'performance',
        severity: 'critical',
        description: `${this.config.name} success rate is ${Math.round(successRate)}%`,
        evidence: {
          successRate,
          totalRequests: this.metrics.totalRequests,
          failedRequests: this.metrics.failedRequests
        }
      })

      improvements.push({
        id: `${this.customId}-improve-reliability`,
        category: 'performance',
        priority: 'critical',
        title: `Improve ${this.config.name} reliability`,
        description: `Entry point showing ${Math.round(successRate)}% success rate`,
        reasoning: 'Low reliability leads to data gaps and missed opportunities',
        estimatedImpact: `Restore to 95%+ success rate, recover ${this.metrics.failedRequests} failed requests`,
        automatable: this.config.type === 'api',
        safetyScore: 85,
        implementation: {
          steps: [
            'Add retry logic with exponential backoff',
            'Implement circuit breaker pattern',
            'Add request timeout handling',
            'Set up fallback data sources',
            'Monitor error patterns'
          ],
          risks: [
            'May increase overall latency',
            'Could hit rate limits with retries',
            'Fallback source may have different data structure'
          ],
          rollbackPlan: [
            'Disable retry logic',
            'Remove circuit breaker',
            'Revert to direct requests'
          ],
          validationCriteria: [
            'Success rate above 95%',
            'Average latency below 2000ms',
            'No duplicate data from retries'
          ]
        }
      })
    }

    // Check latency
    if (this.metrics.averageLatency > 5000) {
      findings.push({
        id: `${this.customId}-high-latency`,
        category: 'performance',
        severity: 'warning',
        description: `${this.config.name} average latency is ${this.metrics.averageLatency}ms`,
        evidence: { latency: this.metrics.averageLatency }
      })

      improvements.push({
        id: `${this.customId}-reduce-latency`,
        category: 'performance',
        priority: 'medium',
        title: `Optimize ${this.config.name} request performance`,
        description: `High latency (${this.metrics.averageLatency}ms) slowing data collection`,
        reasoning: 'Faster data collection enables real-time lead qualification',
        estimatedImpact: 'Reduce latency to under 2000ms',
        automatable: true,
        safetyScore: 90
      })
    }

    // Check cost efficiency (if applicable)
    if (this.config.costPerRequest && this.metrics.totalRequests > 1000) {
      const totalCost = this.metrics.totalRequests * this.config.costPerRequest

      if (totalCost > 100) {
        findings.push({
          id: `${this.customId}-high-cost`,
          category: 'performance',
          severity: 'info',
          description: `${this.config.name} has cost $${totalCost.toFixed(2)} for ${this.metrics.totalRequests} requests`,
          evidence: { totalCost, costPerRequest: this.config.costPerRequest }
        })

        improvements.push({
          id: `${this.customId}-optimize-cost`,
          category: 'performance',
          priority: 'low',
          title: `Optimize ${this.config.name} request costs`,
          description: `Consider caching or batching to reduce ${this.metrics.totalRequests} requests`,
          reasoning: `At $${this.config.costPerRequest}/request, costs can be optimized`,
          estimatedImpact: `Reduce monthly costs by 30-50% through caching`,
          automatable: true,
          safetyScore: 95
        })
      }
    }

    // Type-specific analysis
    const typeSpecificAnalysis = this.analyzeByType(context)
    findings.push(...typeSpecificAnalysis.findings)
    improvements.push(...typeSpecificAnalysis.improvements)

    return {
      agentId: this.customId,
      agentRole: this.role,
      findings,
      improvements,
      timestamp: new Date().toISOString()
    }
  }

  private analyzeByType(context: SystemContext): {
    findings: Finding[]
    improvements: ImprovementSuggestion[]
  } {
    void context
    const findings: Finding[] = []
    const improvements: ImprovementSuggestion[] = []

    switch (this.config.type) {
      case 'api':
        // Check API version, rate limits, authentication
        if (this.config.authRequired && !this.config.authMethod) {
          findings.push({
            id: `${this.customId}-missing-auth`,
            category: 'security',
            severity: 'critical',
            description: `${this.config.name} requires auth but no method specified`,
            evidence: { authRequired: true, authMethod: undefined }
          })
        }
        break

      case 'portal':
        // Check for HTML structure changes, CAPTCHA, login requirements
        findings.push({
          id: `${this.customId}-portal-check`,
          category: 'data-quality',
          severity: 'info',
          description: `${this.config.name} portal should be monitored for structure changes`,
          evidence: { type: 'portal', endpoint: this.config.endpoint }
        })
        break

      case 'database':
        // Check connection pool, query performance, index usage
        if (this.metrics.averageLatency > 1000) {
          improvements.push({
            id: `${this.customId}-optimize-queries`,
            category: 'performance',
            priority: 'high',
            title: `Optimize ${this.config.name} database queries`,
            description: 'Slow queries detected, consider indexing or query optimization',
            reasoning: 'Database performance directly impacts user experience',
            estimatedImpact:
              'Reduce query time from ' + this.metrics.averageLatency + 'ms to <500ms',
            automatable: false,
            safetyScore: 70
          })
        }
        break

      case 'webhook':
        // Check webhook delivery, retry logic, payload validation
        findings.push({
          id: `${this.customId}-webhook-monitoring`,
          category: 'data-quality',
          severity: 'info',
          description: `${this.config.name} webhook should validate payloads`,
          evidence: { type: 'webhook' }
        })
        break
    }

    return { findings, improvements }
  }

  async collect(params?: Record<string, unknown>): Promise<unknown[]> {
    console.log(`[${this.customId}] Collecting data from ${this.config.name}`, params)
    this.metrics.totalRequests++
    this.metrics.lastRequestTime = new Date().toISOString()
    return []
  }

  getMetrics() {
    return { ...this.metrics }
  }

  updateMetrics(updates: Partial<typeof this.metrics>): void {
    this.metrics = { ...this.metrics, ...updates }
  }

  getConfig() {
    return { ...this.config }
  }
}

// Predefined entry point configurations
export const ENTRY_POINT_CONFIGS: EntryPointConfig[] = [
  {
    id: 'ucc-national-api',
    name: 'UCC National Database API',
    type: 'api',
    endpoint: 'https://api.ucc-filings.com/v1',
    authRequired: true,
    authMethod: 'api-key',
    rateLimit: { requestsPerSecond: 10, requestsPerMinute: 500, requestsPerHour: 10000 },
    dataFormat: 'json',
    reliability: 99.5,
    averageResponseTime: 250,
    costPerRequest: 0.01
  },
  {
    id: 'secretary-of-state-portal',
    name: 'Secretary of State Web Portal',
    type: 'portal',
    endpoint: 'https://www.sos.state.*.us',
    authRequired: false,
    rateLimit: { requestsPerSecond: 1, requestsPerMinute: 30, requestsPerHour: 500 },
    dataFormat: 'html',
    reliability: 85,
    averageResponseTime: 2000
  },
  {
    id: 'commercial-ucc-database',
    name: 'Commercial UCC Database',
    type: 'database',
    endpoint: 'postgresql://ucc-db.example.com:5432/ucc',
    authRequired: true,
    authMethod: 'basic',
    rateLimit: { requestsPerSecond: 100, requestsPerMinute: 5000, requestsPerHour: 100000 },
    dataFormat: 'json',
    reliability: 99.9,
    averageResponseTime: 50,
    costPerRequest: 0.001
  },
  {
    id: 'business-data-api',
    name: 'Business Intelligence API',
    type: 'api',
    endpoint: 'https://api.businessdata.com/v2',
    authRequired: true,
    authMethod: 'oauth2',
    rateLimit: { requestsPerSecond: 5, requestsPerMinute: 200, requestsPerHour: 5000 },
    dataFormat: 'json',
    reliability: 98,
    averageResponseTime: 500,
    costPerRequest: 0.05
  },
  {
    id: 'filing-webhook',
    name: 'Real-time Filing Notifications',
    type: 'webhook',
    endpoint: 'https://webhook.filings.com/notify',
    authRequired: true,
    authMethod: 'jwt',
    rateLimit: { requestsPerSecond: 50, requestsPerMinute: 1000, requestsPerHour: 10000 },
    dataFormat: 'json',
    reliability: 95,
    averageResponseTime: 100
  }
]

export class EntryPointAgentFactory {
  private agents: Map<string, EntryPointAgent> = new Map()

  createAllEntryPointAgents(): Map<string, EntryPointAgent> {
    for (const config of ENTRY_POINT_CONFIGS) {
      const agent = new EntryPointAgent(config)
      this.agents.set(config.id, agent)
    }
    return this.agents
  }

  createEntryPointAgent(id: string): EntryPointAgent | undefined {
    const config = ENTRY_POINT_CONFIGS.find((c) => c.id === id)
    if (!config) {
      return undefined
    }
    const agent = new EntryPointAgent(config)
    this.agents.set(config.id, agent)
    return agent
  }

  createCustomEntryPointAgent(config: EntryPointConfig): EntryPointAgent {
    const agent = new EntryPointAgent(config)
    this.agents.set(config.id, agent)
    return agent
  }

  getAgent(id: string): EntryPointAgent | undefined {
    return this.agents.get(id)
  }

  getAllAgents(): Map<string, EntryPointAgent> {
    return new Map(this.agents)
  }

  getAgentsByType(type: EntryPointType): EntryPointAgent[] {
    return Array.from(this.agents.values()).filter((agent) => agent.getConfig().type === type)
  }

  clear(): void {
    this.agents.clear()
  }
}

export const entryPointAgentFactory = new EntryPointAgentFactory()
