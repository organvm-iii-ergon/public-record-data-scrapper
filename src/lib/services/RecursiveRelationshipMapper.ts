// @ts-nocheck - Experimental features with incomplete type definitions
import type {
  Prospect,
  CompanyGraph,
  CompanyNode,
  CompanyRelationship,
  RelationshipType,
  RecursiveTraversalConfig,
  UCCFiling,
} from '../types'

/**
 * RecursiveRelationshipMapper - Maps company relationships recursively
 * Builds multi-level company networks from UCC filings and other data sources
 */
export class RecursiveRelationshipMapper {
  private prospects: Prospect[]
  private visitedNodes: Set<string> = new Set()
  private discoveredRelationships: Map<string, CompanyRelationship[]> = new Map()

  constructor(prospects: Prospect[]) {
    this.prospects = prospects
  }

  /**
   * Build a complete company relationship graph starting from a root company
   */
  async buildRelationshipGraph(
    rootCompanyId: string,
    config: RecursiveTraversalConfig
  ): Promise<CompanyGraph> {
    const startTime = Date.now()
    this.visitedNodes.clear()
    this.discoveredRelationships.clear()

    const rootProspect = this.prospects.find((p) => p.id === rootCompanyId)
    if (!rootProspect) {
      throw new Error(`Root company ${rootCompanyId} not found`)
    }

    const nodes = new Map<string, CompanyNode>()
    const edges: CompanyRelationship[] = []

    // Recursively traverse the graph
    await this.traverseRecursively(
      rootCompanyId,
      0,
      config,
      nodes,
      edges
    )

    // Calculate metadata
    const metadata = this.calculateGraphMetadata(nodes, edges)

    const graph: CompanyGraph = {
      rootId: rootCompanyId,
      nodes,
      edges,
      maxDepth: config.maxDepth,
      totalNodes: nodes.size,
      totalEdges: edges.length,
      createdAt: new Date().toISOString(),
      metadata,
    }

    console.log(
      `Built relationship graph in ${Date.now() - startTime}ms: ${nodes.size} nodes, ${edges.length} edges`
    )

    return graph
  }

  /**
   * Recursively traverse company relationships
   */
  private async traverseRecursively(
    companyId: string,
    currentDepth: number,
    config: RecursiveTraversalConfig,
    nodes: Map<string, CompanyNode>,
    edges: CompanyRelationship[]
  ): Promise<void> {
    // Base cases
    if (currentDepth > config.maxDepth) return
    if (this.visitedNodes.has(companyId)) return
    if (config.stopConditions?.maxNodes && nodes.size >= config.stopConditions.maxNodes) return

    this.visitedNodes.add(companyId)

    const prospect = this.prospects.find((p) => p.id === companyId)
    if (!prospect) return

    // Create node for current company
    const relationships = await this.discoverRelationships(
      prospect,
      currentDepth,
      config
    )

    const node: CompanyNode = {
      id: companyId,
      companyName: prospect.companyName,
      prospect: config.includeProspectData ? prospect : undefined,
      relationships,
      depth: currentDepth,
      visitedAt: new Date().toISOString(),
    }

    nodes.set(companyId, node)
    edges.push(...relationships)

    // Recursively traverse connected companies
    for (const relationship of relationships) {
      if (config.stopConditions?.maxEdges && edges.length >= config.stopConditions.maxEdges) {
        break
      }

      const nextCompanyId = relationship.toCompanyId
      await this.traverseRecursively(
        nextCompanyId,
        currentDepth + 1,
        config,
        nodes,
        edges
      )
    }
  }

  /**
   * Discover relationships for a given prospect
   */
  private async discoverRelationships(
    prospect: Prospect,
    depth: number,
    config: RecursiveTraversalConfig
  ): Promise<CompanyRelationship[]> {
    const relationships: CompanyRelationship[] = []

    // Check if we've already discovered relationships for this company
    const cached = this.discoveredRelationships.get(prospect.id)
    if (cached) return cached

    // Discover relationships from UCC filings
    if (config.relationshipTypes.includes('common_secured_party')) {
      relationships.push(
        ...this.findCommonSecuredPartyRelationships(prospect, depth)
      )
    }

    if (config.relationshipTypes.includes('guarantor')) {
      relationships.push(...this.findGuarantorRelationships(prospect, depth))
    }

    // Discover relationships from industry
    if (config.relationshipTypes.includes('same_industry')) {
      relationships.push(...this.findSameIndustryRelationships(prospect, depth))
    }

    // Discover parent/subsidiary relationships (from company name patterns)
    if (
      config.relationshipTypes.includes('parent') ||
      config.relationshipTypes.includes('subsidiary')
    ) {
      relationships.push(...this.findParentSubsidiaryRelationships(prospect, depth))
    }

    // Discover affiliate relationships
    if (config.relationshipTypes.includes('affiliate')) {
      relationships.push(...this.findAffiliateRelationships(prospect, depth))
    }

    // Cache discovered relationships
    this.discoveredRelationships.set(prospect.id, relationships)

    return relationships
  }

  /**
   * Find companies with the same secured party (common lender)
   */
  private findCommonSecuredPartyRelationships(
    prospect: Prospect,
    depth: number
  ): CompanyRelationship[] {
    const relationships: CompanyRelationship[] = []
    const securedParties = new Set(
      prospect.uccFilings.map((f) => f.securedParty.toLowerCase())
    )

    for (const other of this.prospects) {
      if (other.id === prospect.id) continue

      const hasCommonSecuredParty = other.uccFilings.some((f) =>
        securedParties.has(f.securedParty.toLowerCase())
      )

      if (hasCommonSecuredParty) {
        const commonFiling = other.uccFilings.find((f) =>
          securedParties.has(f.securedParty.toLowerCase())
        )

        relationships.push({
          fromCompanyId: prospect.id,
          toCompanyId: other.id,
          relationshipType: 'common_secured_party',
          confidence: 0.8,
          sourceFilingId: commonFiling?.id,
          discoveredDate: new Date().toISOString(),
          depth,
          metadata: {
            securedParty: commonFiling?.securedParty,
          },
        })
      }
    }

    return relationships
  }

  /**
   * Find guarantor relationships (from UCC filing patterns)
   */
  private findGuarantorRelationships(
    prospect: Prospect,
    depth: number
  ): CompanyRelationship[] {
    const relationships: CompanyRelationship[] = []

    // Look for cross-collateralization or guarantor patterns in filings
    for (const filing of prospect.uccFilings) {
      // Check if debtor name contains multiple entities
      if (filing.debtorName.includes(' and ') || filing.debtorName.includes(', ')) {
        const entities = this.extractEntitiesFromDebtorName(filing.debtorName)

        for (const entity of entities) {
          const match = this.findProspectByNameFuzzy(entity)
          if (match && match.id !== prospect.id) {
            relationships.push({
              fromCompanyId: prospect.id,
              toCompanyId: match.id,
              relationshipType: 'guarantor',
              confidence: 0.7,
              sourceFilingId: filing.id,
              discoveredDate: new Date().toISOString(),
              depth,
              metadata: {
                debtorName: filing.debtorName,
              },
            })
          }
        }
      }
    }

    return relationships
  }

  /**
   * Find companies in the same industry
   */
  private findSameIndustryRelationships(
    prospect: Prospect,
    depth: number
  ): CompanyRelationship[] {
    const relationships: CompanyRelationship[] = []
    const sameIndustryProspects = this.prospects.filter(
      (p) => p.industry === prospect.industry && p.id !== prospect.id && p.state === prospect.state
    )

    // Limit to top 10 same-industry companies by priority score
    const topSameIndustry = sameIndustryProspects
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 10)

    for (const other of topSameIndustry) {
      relationships.push({
        fromCompanyId: prospect.id,
        toCompanyId: other.id,
        relationshipType: 'same_industry',
        confidence: 0.6,
        discoveredDate: new Date().toISOString(),
        depth,
        metadata: {
          industry: prospect.industry,
          state: prospect.state,
        },
      })
    }

    return relationships
  }

  /**
   * Find parent/subsidiary relationships from company name patterns
   */
  private findParentSubsidiaryRelationships(
    prospect: Prospect,
    depth: number
  ): CompanyRelationship[] {
    const relationships: CompanyRelationship[] = []

    // Common patterns: "ABC Holdings", "ABC Corp", "ABC LLC"
    // Or "XYZ Inc" and "XYZ Services"
    const baseName = this.extractBaseName(prospect.companyName)

    for (const other of this.prospects) {
      if (other.id === prospect.id) continue

      const otherBaseName = this.extractBaseName(other.companyName)

      if (this.areNamesSimilar(baseName, otherBaseName)) {
        // Determine relationship direction
        const isParent = this.isLikelyParent(prospect.companyName)
        const otherIsParent = this.isLikelyParent(other.companyName)

        let relationshipType: RelationshipType
        if (isParent && !otherIsParent) {
          relationshipType = 'subsidiary'
        } else if (!isParent && otherIsParent) {
          relationshipType = 'parent'
        } else {
          relationshipType = 'affiliate'
        }

        relationships.push({
          fromCompanyId: prospect.id,
          toCompanyId: other.id,
          relationshipType,
          confidence: 0.75,
          discoveredDate: new Date().toISOString(),
          depth,
          metadata: {
            baseName,
          },
        })
      }
    }

    return relationships
  }

  /**
   * Find affiliate relationships
   */
  private findAffiliateRelationships(
    prospect: Prospect,
    depth: number
  ): CompanyRelationship[] {
    const relationships: CompanyRelationship[] = []

    // Affiliates are companies with similar names but different legal entities
    const baseName = this.extractBaseName(prospect.companyName)

    for (const other of this.prospects) {
      if (other.id === prospect.id) continue

      const otherBaseName = this.extractBaseName(other.companyName)

      if (
        this.areNamesSimilar(baseName, otherBaseName) &&
        prospect.industry === other.industry
      ) {
        relationships.push({
          fromCompanyId: prospect.id,
          toCompanyId: other.id,
          relationshipType: 'affiliate',
          confidence: 0.65,
          discoveredDate: new Date().toISOString(),
          depth,
          metadata: {
            baseName,
            industry: prospect.industry,
          },
        })
      }
    }

    return relationships
  }

  /**
   * Calculate graph metadata (risk concentration, network health, etc.)
   */
  private calculateGraphMetadata(
    nodes: Map<string, CompanyNode>,
    edges: CompanyRelationship[]
  ): {
    riskConcentration: number
    networkHealth: 'A' | 'B' | 'C' | 'D' | 'F'
    totalExposure: number
  } {
    let totalExposure = 0
    let totalHealthScore = 0
    let healthCount = 0

    for (const node of nodes.values()) {
      if (node.prospect) {
        totalExposure += node.prospect.estimatedRevenue || 0
        totalHealthScore += node.prospect.healthScore.score
        healthCount++
      }
    }

    const avgHealthScore = healthCount > 0 ? totalHealthScore / healthCount : 0

    // Risk concentration: ratio of edges to nodes (higher = more interconnected = higher risk)
    const riskConcentration = nodes.size > 0 ? edges.length / nodes.size : 0

    // Convert avg health score to grade
    let networkHealth: 'A' | 'B' | 'C' | 'D' | 'F'
    if (avgHealthScore >= 90) networkHealth = 'A'
    else if (avgHealthScore >= 80) networkHealth = 'B'
    else if (avgHealthScore >= 70) networkHealth = 'C'
    else if (avgHealthScore >= 60) networkHealth = 'D'
    else networkHealth = 'F'

    return {
      riskConcentration,
      networkHealth,
      totalExposure,
    }
  }

  /**
   * Extract entities from a debtor name string
   */
  private extractEntitiesFromDebtorName(debtorName: string): string[] {
    return debtorName
      .split(/\s+and\s+|,\s*/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  }

  /**
   * Find prospect by name using fuzzy matching
   */
  private findProspectByNameFuzzy(name: string): Prospect | undefined {
    const normalizedName = name.toLowerCase().trim()
    return this.prospects.find((p) =>
      p.companyName.toLowerCase().includes(normalizedName)
    )
  }

  /**
   * Extract base name from company name (remove legal suffixes)
   */
  private extractBaseName(companyName: string): string {
    return companyName
      .replace(/\s+(Inc|LLC|Corp|Corporation|Ltd|Limited|Holdings|Group|LP|LLP|PC|PA)\.?$/i, '')
      .trim()
      .toLowerCase()
  }

  /**
   * Check if two names are similar
   */
  private areNamesSimilar(name1: string, name2: string): boolean {
    const normalized1 = name1.toLowerCase().trim()
    const normalized2 = name2.toLowerCase().trim()

    // Exact match
    if (normalized1 === normalized2) return true

    // One contains the other
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      return true
    }

    // Levenshtein distance (simple implementation)
    const distance = this.levenshteinDistance(normalized1, normalized2)
    const maxLength = Math.max(normalized1.length, normalized2.length)
    const similarity = 1 - distance / maxLength

    return similarity >= 0.8
  }

  /**
   * Check if company name suggests it's a parent company
   */
  private isLikelyParent(companyName: string): boolean {
    const parentKeywords = ['holdings', 'group', 'corporation', 'international']
    const lowerName = companyName.toLowerCase()
    return parentKeywords.some((keyword) => lowerName.includes(keyword))
  }

  /**
   * Simple Levenshtein distance implementation
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }

  /**
   * Get all companies related to a given company (direct connections only)
   */
  getRelatedCompanies(
    companyId: string,
    graph: CompanyGraph,
    relationshipTypes?: RelationshipType[]
  ): CompanyNode[] {
    const relatedNodes: CompanyNode[] = []
    const edges = graph.edges.filter((e) => {
      const matchesCompany = e.fromCompanyId === companyId
      const matchesType = relationshipTypes
        ? relationshipTypes.includes(e.relationshipType)
        : true
      return matchesCompany && matchesType
    })

    for (const edge of edges) {
      const node = graph.nodes.get(edge.toCompanyId)
      if (node) {
        relatedNodes.push(node)
      }
    }

    return relatedNodes
  }

  /**
   * Find all paths between two companies
   */
  findPaths(
    fromCompanyId: string,
    toCompanyId: string,
    graph: CompanyGraph,
    maxPathLength: number = 5
  ): CompanyRelationship[][] {
    const paths: CompanyRelationship[][] = []
    const visited = new Set<string>()

    const dfs = (
      currentId: string,
      targetId: string,
      currentPath: CompanyRelationship[],
      depth: number
    ) => {
      if (depth > maxPathLength) return
      if (currentId === targetId) {
        paths.push([...currentPath])
        return
      }

      visited.add(currentId)

      const outgoingEdges = graph.edges.filter((e) => e.fromCompanyId === currentId)
      for (const edge of outgoingEdges) {
        if (!visited.has(edge.toCompanyId)) {
          currentPath.push(edge)
          dfs(edge.toCompanyId, targetId, currentPath, depth + 1)
          currentPath.pop()
        }
      }

      visited.delete(currentId)
    }

    dfs(fromCompanyId, toCompanyId, [], 0)
    return paths
  }

  /**
   * Calculate centrality metrics for nodes in the graph
   */
  calculateCentrality(graph: CompanyGraph): Map<string, number> {
    const centrality = new Map<string, number>()

    // Degree centrality: number of connections
    for (const node of graph.nodes.values()) {
      const outDegree = graph.edges.filter((e) => e.fromCompanyId === node.id).length
      const inDegree = graph.edges.filter((e) => e.toCompanyId === node.id).length
      centrality.set(node.id, outDegree + inDegree)
    }

    return centrality
  }

  /**
   * Identify clusters in the graph
   */
  identifyClusters(graph: CompanyGraph): Map<number, Set<string>> {
    const clusters = new Map<number, Set<string>>()
    const visited = new Set<string>()
    let clusterId = 0

    const bfs = (startId: string): Set<string> => {
      const cluster = new Set<string>()
      const queue = [startId]

      while (queue.length > 0) {
        const currentId = queue.shift()!
        if (visited.has(currentId)) continue

        visited.add(currentId)
        cluster.add(currentId)

        // Add connected nodes
        const connectedEdges = graph.edges.filter(
          (e) => e.fromCompanyId === currentId || e.toCompanyId === currentId
        )

        for (const edge of connectedEdges) {
          const nextId =
            edge.fromCompanyId === currentId ? edge.toCompanyId : edge.fromCompanyId
          if (!visited.has(nextId)) {
            queue.push(nextId)
          }
        }
      }

      return cluster
    }

    for (const node of graph.nodes.values()) {
      if (!visited.has(node.id)) {
        const cluster = bfs(node.id)
        clusters.set(clusterId++, cluster)
      }
    }

    return clusters
  }
}
