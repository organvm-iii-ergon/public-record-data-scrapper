/**
 * Academic Network Analyzer
 *
 * Analyzes citation networks, collaboration networks, and research communities
 * Uses graph algorithms to find influential papers, researchers, and trends
 */

import type {
  Paper,
  Citation,
  CitationNetwork,
  Collaboration,
  CollaborationNetwork,
  Community,
  Researcher,
  Team,
  Trend
} from './types'

export class NetworkAnalyzer {
  /**
   * Calculate PageRank for papers in citation network
   */
  calculatePageRank(
    papers: Map<string, Paper>,
    citations: Citation[],
    dampingFactor: number = 0.85,
    iterations: number = 100
  ): Map<string, number> {
    const pageRank = new Map<string, number>()
    const outDegree = new Map<string, number>()

    // Initialize
    papers.forEach((_, paperId) => {
      pageRank.set(paperId, 1.0 / papers.size)
      outDegree.set(paperId, 0)
    })

    // Count out-degrees
    citations.forEach(citation => {
      outDegree.set(citation.from, (outDegree.get(citation.from) || 0) + 1)
    })

    // Iterate PageRank
    for (let i = 0; i < iterations; i++) {
      const newPageRank = new Map<string, number>()

      papers.forEach((_, paperId) => {
        let rank = (1 - dampingFactor) / papers.size

        // Sum contributions from citing papers
        citations.forEach(citation => {
          if (citation.to === paperId) {
            const citingPaperRank = pageRank.get(citation.from) || 0
            const citingPaperOutDegree = outDegree.get(citation.from) || 1
            rank += dampingFactor * (citingPaperRank / citingPaperOutDegree)
          }
        })

        newPageRank.set(paperId, rank)
      })

      // Update
      newPageRank.forEach((rank, paperId) => {
        pageRank.set(paperId, rank)
      })
    }

    return pageRank
  }

  /**
   * Find most influential papers using PageRank
   */
  findInfluentialPapers(network: CitationNetwork, topN: number = 50): Paper[] {
    const pageRank = this.calculatePageRank(network.papers, network.citations)

    const ranked = Array.from(network.papers.values())
      .map(paper => ({
        paper,
        rank: pageRank.get(paper.id) || 0
      }))
      .sort((a, b) => b.rank - a.rank)
      .slice(0, topN)
      .map(item => item.paper)

    return ranked
  }

  /**
   * Find seminal papers (old papers still being cited)
   */
  findSeminalPapers(network: CitationNetwork, minAge: number = 10, topN: number = 50): Paper[] {
    const currentYear = new Date().getFullYear()

    const seminal = Array.from(network.papers.values())
      .filter(paper => {
        const year = parseInt(paper.publicationDate)
        return currentYear - year >= minAge && paper.citationCount > 0
      })
      .sort((a, b) => b.citationCount - a.citationCount)
      .slice(0, topN)

    return seminal
  }

  /**
   * Detect research communities using label propagation algorithm
   */
  detectCommunities(papers: Map<string, Paper>, citations: Citation[]): Community[] {
    // Build adjacency list
    const neighbors = new Map<string, Set<string>>()
    papers.forEach((_, paperId) => {
      neighbors.set(paperId, new Set())
    })

    citations.forEach(citation => {
      neighbors.get(citation.from)?.add(citation.to)
      neighbors.get(citation.to)?.add(citation.from)
    })

    // Initialize labels (each paper starts in its own community)
    const labels = new Map<string, string>()
    papers.forEach((_, paperId) => {
      labels.set(paperId, paperId)
    })

    // Label propagation
    const maxIterations = 100
    for (let iter = 0; iter < maxIterations; iter++) {
      let changed = false
      const paperIds = Array.from(papers.keys())

      // Randomize order
      paperIds.sort(() => Math.random() - 0.5)

      for (const paperId of paperIds) {
        const neighborLabels = new Map<string, number>()

        // Count neighbor labels
        neighbors.get(paperId)?.forEach(neighborId => {
          const label = labels.get(neighborId)!
          neighborLabels.set(label, (neighborLabels.get(label) || 0) + 1)
        })

        // Find most common label
        let maxCount = 0
        let newLabel = labels.get(paperId)!

        neighborLabels.forEach((count, label) => {
          if (count > maxCount) {
            maxCount = count
            newLabel = label
          }
        })

        if (newLabel !== labels.get(paperId)) {
          labels.set(paperId, newLabel)
          changed = true
        }
      }

      if (!changed) break
    }

    // Group papers by community
    const communityPapers = new Map<string, string[]>()
    labels.forEach((label, paperId) => {
      if (!communityPapers.has(label)) {
        communityPapers.set(label, [])
      }
      communityPapers.get(label)!.push(paperId)
    })

    // Create community objects
    const communities: Community[] = []
    let communityId = 1

    communityPapers.forEach((paperIds, label) => {
      if (paperIds.length < 3) return // Skip tiny communities

      const communityAuthorIds = new Set<string>()
      const communityTopics = new Map<string, number>()

      paperIds.forEach(paperId => {
        const paper = papers.get(paperId)!
        paper.authors.forEach(author => communityAuthorIds.add(author.id))
        paper.topics.forEach(topic => {
          communityTopics.set(topic, (communityTopics.get(topic) || 0) + 1)
        })
      })

      // Top topics
      const topTopics = Array.from(communityTopics.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([topic]) => topic)

      // Calculate cohesion (average clustering coefficient)
      const cohesion = this.calculateCohesion(paperIds, neighbors)

      communities.push({
        id: `community-${communityId++}`,
        name: topTopics[0] || `Community ${communityId}`,
        papers: paperIds,
        authors: Array.from(communityAuthorIds),
        topics: topTopics,
        size: paperIds.length,
        cohesion,
        growth: 0 // TODO: Calculate from paper dates
      })
    })

    return communities.sort((a, b) => b.size - a.size)
  }

  /**
   * Calculate cohesion (average clustering coefficient)
   */
  private calculateCohesion(nodeIds: string[], neighbors: Map<string, Set<string>>): number {
    let totalClustering = 0
    let count = 0

    for (const nodeId of nodeIds) {
      const nodeNeighbors = neighbors.get(nodeId)!
      const degree = nodeNeighbors.size

      if (degree < 2) continue

      // Count edges between neighbors
      let edgeCount = 0
      const neighborArray = Array.from(nodeNeighbors)

      for (let i = 0; i < neighborArray.length; i++) {
        for (let j = i + 1; j < neighborArray.length; j++) {
          if (neighbors.get(neighborArray[i])?.has(neighborArray[j])) {
            edgeCount++
          }
        }
      }

      const maxPossibleEdges = (degree * (degree - 1)) / 2
      const clustering = edgeCount / maxPossibleEdges

      totalClustering += clustering
      count++
    }

    return count > 0 ? totalClustering / count : 0
  }

  /**
   * Detect trends in citation network
   */
  detectTrends(papers: Map<string, Paper>, timeWindowYears: number = 5): Trend[] {
    const currentYear = new Date().getFullYear()
    const startYear = currentYear - timeWindowYears

    // Group papers by topic and year
    const topicsByYear = new Map<string, Map<number, number>>()

    papers.forEach(paper => {
      const year = parseInt(paper.publicationDate)
      if (year < startYear) return

      paper.topics.forEach(topic => {
        if (!topicsByYear.has(topic)) {
          topicsByYear.set(topic, new Map())
        }

        const yearMap = topicsByYear.get(topic)!
        yearMap.set(year, (yearMap.get(year) || 0) + 1)
      })
    })

    // Calculate growth rates
    const trends: Trend[] = []

    topicsByYear.forEach((yearMap, topic) => {
      const years = Array.from(yearMap.keys()).sort()
      if (years.length < 2) return

      const firstYearCount = yearMap.get(years[0]) || 0
      const lastYearCount = yearMap.get(years[years.length - 1]) || 0

      if (firstYearCount === 0) return

      const growthRate = ((lastYearCount - firstYearCount) / firstYearCount) * 100

      // Find peak year
      let peakYear = years[0]
      let peakCount = 0

      yearMap.forEach((count, year) => {
        if (count > peakCount) {
          peakCount = count
          peakYear = year
        }
      })

      // Determine status
      let status: Trend['status']
      if (growthRate > 50) {
        status = 'emerging'
      } else if (growthRate > 0) {
        status = 'growing'
      } else if (growthRate > -25) {
        status = 'mature'
      } else {
        status = 'declining'
      }

      // Get paper IDs for this topic
      const paperIds = Array.from(papers.values())
        .filter(p => p.topics.includes(topic))
        .map(p => p.id)

      trends.push({
        topic,
        papers: paperIds,
        growth_rate: growthRate,
        peak_year: peakYear,
        status
      })
    })

    return trends.sort((a, b) => b.growth_rate - a.growth_rate)
  }

  /**
   * Build collaboration network from papers
   */
  buildCollaborationNetwork(papers: Map<string, Paper>): CollaborationNetwork {
    const researchers = new Map<string, Researcher>()
    const collaborations: Collaboration[] = []
    const collaborationMap = new Map<string, Collaboration>()

    // Extract all researchers
    papers.forEach(paper => {
      paper.authors.forEach(author => {
        if (!researchers.has(author.id)) {
          researchers.set(author.id, {
            id: author.id,
            name: author.name,
            affiliations: [], // TODO: Extract from papers
            papers: [],
            topics: [],
            h_index: 0, // TODO: Calculate
            citation_count: 0, // TODO: Sum from papers
            first_publication: paper.publicationDate,
            recent_publication: paper.publicationDate,
            collaborators: [],
            collaboration_count: 0,
            network_size: 0,
            centrality: 0,
            expertise_areas: []
          })
        }

        const researcher = researchers.get(author.id)!
        researcher.papers.push(paper.id)

        // Update date range
        if (paper.publicationDate < researcher.first_publication) {
          researcher.first_publication = paper.publicationDate
        }
        if (paper.publicationDate > researcher.recent_publication) {
          researcher.recent_publication = paper.publicationDate
        }

        // Add topics
        paper.topics.forEach(topic => {
          if (!researcher.topics.includes(topic)) {
            researcher.topics.push(topic)
          }
        })
      })

      // Create collaborations between all author pairs
      for (let i = 0; i < paper.authors.length; i++) {
        for (let j = i + 1; j < paper.authors.length; j++) {
          const author1 = paper.authors[i]
          const author2 = paper.authors[j]

          // Create unique key for collaboration
          const key = [author1.id, author2.id].sort().join('::')

          if (!collaborationMap.has(key)) {
            collaborationMap.set(key, {
              researchers: [author1.id, author2.id],
              papers: [],
              strength: 0,
              firstCollaboration: paper.publicationDate,
              lastCollaboration: paper.publicationDate
            })
          }

          const collab = collaborationMap.get(key)!
          collab.papers.push(paper.id)
          collab.strength++

          if (paper.publicationDate < collab.firstCollaboration) {
            collab.firstCollaboration = paper.publicationDate
          }
          if (paper.publicationDate > collab.lastCollaboration) {
            collab.lastCollaboration = paper.publicationDate
          }
        }
      }
    })

    // Convert collaboration map to array
    collaborationMap.forEach(collab => collaborations.push(collab))

    // Update researcher collaboration counts
    collaborations.forEach(collab => {
      collab.researchers.forEach(researcherId => {
        const researcher = researchers.get(researcherId)!
        researcher.collaboration_count++

        // Add collaborators
        collab.researchers.forEach(otherId => {
          if (otherId !== researcherId && !researcher.collaborators.includes(otherId)) {
            researcher.collaborators.push(otherId)
          }
        })
      })
    })

    // Calculate h-index and citation stats
    researchers.forEach(researcher => {
      // Get all papers for this researcher
      const researcherPapers = researcher.papers
        .map(id => papers.get(id))
        .filter((p): p is Paper => p !== undefined)

      // Calculate total citations
      researcher.citation_count = researcherPapers.reduce(
        (sum, paper) => sum + paper.citationCount,
        0
      )

      // Calculate h-index
      const citations = researcherPapers
        .map(p => p.citationCount)
        .sort((a, b) => b - a)

      let h = 0
      for (let i = 0; i < citations.length; i++) {
        if (citations[i] >= i + 1) {
          h = i + 1
        } else {
          break
        }
      }
      researcher.h_index = h
    })

    // Update network sizes
    researchers.forEach(researcher => {
      researcher.network_size = researcher.collaborators.length
    })

    // Detect teams (frequent collaborators)
    const teams = this.detectTeams(researchers, collaborations, papers)

    return {
      researchers,
      collaborations,
      teams,
      institutions: new Map() // TODO: Extract from papers
    }
  }

  /**
   * Detect research teams (groups of frequent collaborators)
   */
  private detectTeams(
    researchers: Map<string, Researcher>,
    collaborations: Collaboration[],
    papers: Map<string, Paper>
  ): Team[] {
    const teams: Team[] = []

    // Find highly connected groups
    const visited = new Set<string>()

    researchers.forEach((researcher, researcherId) => {
      if (visited.has(researcherId)) return
      if (researcher.collaborators.length < 2) return

      // Start BFS from this researcher
      const team: Set<string> = new Set([researcherId])
      const queue = [researcherId]
      visited.add(researcherId)

      while (queue.length > 0) {
        const current = queue.shift()!
        const currentResearcher = researchers.get(current)!

        // Add frequent collaborators (3+ papers together)
        collaborations.forEach(collab => {
          if (collab.strength < 3) return
          if (!collab.researchers.includes(current)) return

          collab.researchers.forEach(otherId => {
            if (otherId !== current && !visited.has(otherId)) {
              team.add(otherId)
              queue.push(otherId)
              visited.add(otherId)
            }
          })
        })
      }

      if (team.size >= 3) {
        const teamMembers = Array.from(team)
        const teamPapers = new Set<string>()
        const teamTopics = new Map<string, number>()

        teamMembers.forEach(memberId => {
          const member = researchers.get(memberId)!
          member.papers.forEach(paperId => teamPapers.add(paperId))
          member.topics.forEach(topic => {
            teamTopics.set(topic, (teamTopics.get(topic) || 0) + 1)
          })
        })

        const topTopics = Array.from(teamTopics.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([topic]) => topic)

        // Find most connected member as leader
        let leader = teamMembers[0]
        let maxConnections = 0

        teamMembers.forEach(memberId => {
          const connections = researchers.get(memberId)!.collaborators.filter(c =>
            teamMembers.includes(c)
          ).length

          if (connections > maxConnections) {
            maxConnections = connections
            leader = memberId
          }
        })

        // Calculate impact (average citations per paper)
        let totalCitations = 0
        teamPapers.forEach(paperId => {
          const paper = papers.get(paperId)
          if (paper) {
            totalCitations += paper.citationCount
          }
        })

        const impact = teamPapers.size > 0 ? totalCitations / teamPapers.size : 0

        teams.push({
          id: `team-${teams.length + 1}`,
          name: topTopics[0] ? `${topTopics[0]} Team` : `Research Team ${teams.length + 1}`,
          core_members: teamMembers,
          peripheral_members: [],
          leader,
          topics: topTopics,
          papers: Array.from(teamPapers),
          productivity: teamPapers.size / team.size,
          impact
        })
      }
    })

    return teams.sort((a, b) => b.core_members.length - a.core_members.length)
  }

  /**
   * Find shortest path between two papers in citation network
   */
  findShortestPath(
    startPaperId: string,
    endPaperId: string,
    citations: Citation[]
  ): string[] | null {
    // Build adjacency list
    const graph = new Map<string, string[]>()

    citations.forEach(citation => {
      if (!graph.has(citation.from)) {
        graph.set(citation.from, [])
      }
      graph.get(citation.from)!.push(citation.to)

      // Also add reverse edge for bidirectional search
      if (!graph.has(citation.to)) {
        graph.set(citation.to, [])
      }
      graph.get(citation.to)!.push(citation.from)
    })

    // BFS
    const queue: [string, string[]][] = [[startPaperId, [startPaperId]]]
    const visited = new Set<string>([startPaperId])

    while (queue.length > 0) {
      const [current, path] = queue.shift()!

      if (current === endPaperId) {
        return path
      }

      const neighbors = graph.get(current) || []
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push([neighbor, [...path, neighbor]])
        }
      }
    }

    return null // No path found
  }

  /**
   * Calculate betweenness centrality (papers that bridge communities)
   */
  calculateBetweennessCentrality(
    papers: Map<string, Paper>,
    citations: Citation[]
  ): Map<string, number> {
    const betweenness = new Map<string, number>()
    papers.forEach((_, paperId) => betweenness.set(paperId, 0))

    // For each pair of papers, find shortest paths
    const paperIds = Array.from(papers.keys())

    for (let i = 0; i < paperIds.length; i++) {
      for (let j = i + 1; j < paperIds.length; j++) {
        const path = this.findShortestPath(paperIds[i], paperIds[j], citations)

        if (path && path.length > 2) {
          // Increment betweenness for intermediate nodes
          for (let k = 1; k < path.length - 1; k++) {
            betweenness.set(path[k], (betweenness.get(path[k]) || 0) + 1)
          }
        }
      }
    }

    // Normalize
    const n = papers.size
    const normFactor = (n - 1) * (n - 2) / 2

    betweenness.forEach((value, paperId) => {
      betweenness.set(paperId, value / normFactor)
    })

    return betweenness
  }

  /**
   * Find bridge papers (connect different communities)
   */
  findBridgePapers(network: CitationNetwork, topN: number = 20): Paper[] {
    const betweenness = this.calculateBetweennessCentrality(network.papers, network.citations)

    const bridges = Array.from(network.papers.values())
      .map(paper => ({
        paper,
        betweenness: betweenness.get(paper.id) || 0
      }))
      .sort((a, b) => b.betweenness - a.betweenness)
      .slice(0, topN)
      .map(item => item.paper)

    return bridges
  }
}

/**
 * Example usage and analysis
 */
export async function exampleAnalysis(network: CitationNetwork) {
  const analyzer = new NetworkAnalyzer()

  console.log(`\n🕸️  Network Analysis Results`)
  console.log(`${'='.repeat(80)}`)

  // Find influential papers
  console.log(`\n📊 Most Influential Papers (PageRank):`)
  const influential = analyzer.findInfluentialPapers(network, 10)
  influential.forEach((paper, i) => {
    console.log(`${i + 1}. ${paper.title}`)
    console.log(`   Citations: ${paper.citationCount}`)
  })

  // Find seminal papers
  console.log(`\n📜 Seminal Papers (10+ years old, still cited):`)
  const seminal = analyzer.findSeminalPapers(network, 10, 10)
  seminal.forEach((paper, i) => {
    console.log(`${i + 1}. ${paper.title} (${paper.publicationDate})`)
    console.log(`   Citations: ${paper.citationCount}`)
  })

  // Detect communities
  console.log(`\n👥 Research Communities:`)
  const communities = analyzer.detectCommunities(network.papers, network.citations)
  communities.slice(0, 5).forEach((community, i) => {
    console.log(`${i + 1}. ${community.name}`)
    console.log(`   Size: ${community.size} papers`)
    console.log(`   Topics: ${community.topics.slice(0, 3).join(', ')}`)
    console.log(`   Cohesion: ${(community.cohesion * 100).toFixed(1)}%`)
  })

  // Detect trends
  console.log(`\n📈 Trending Topics:`)
  const trends = analyzer.detectTrends(network.papers, 5)
  trends.slice(0, 10).forEach((trend, i) => {
    console.log(`${i + 1}. ${trend.topic} (${trend.status})`)
    console.log(`   Growth: ${trend.growth_rate.toFixed(1)}%`)
    console.log(`   Papers: ${trend.papers.length}`)
  })

  // Build collaboration network
  console.log(`\n🤝 Collaboration Network:`)
  const collabNetwork = analyzer.buildCollaborationNetwork(network.papers)
  console.log(`   Researchers: ${collabNetwork.researchers.size}`)
  console.log(`   Collaborations: ${collabNetwork.collaborations.length}`)
  console.log(`   Teams: ${collabNetwork.teams.length}`)

  // Top teams
  console.log(`\n🏆 Top Research Teams:`)
  collabNetwork.teams.slice(0, 5).forEach((team, i) => {
    console.log(`${i + 1}. ${team.name}`)
    console.log(`   Members: ${team.core_members.length}`)
    console.log(`   Papers: ${team.papers.length}`)
    console.log(`   Productivity: ${team.productivity.toFixed(2)} papers/member`)
  })

  // Find bridge papers
  console.log(`\n🌉 Bridge Papers (connect communities):`)
  const bridges = analyzer.findBridgePapers(network, 5)
  bridges.forEach((paper, i) => {
    console.log(`${i + 1}. ${paper.title}`)
  })

  console.log(`\n${'='.repeat(80)}`)
}
