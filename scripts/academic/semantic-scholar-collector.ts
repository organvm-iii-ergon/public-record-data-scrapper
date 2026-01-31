/**
 * Semantic Scholar API Collector
 *
 * Free academic paper API with 200M+ papers across all fields
 * Rate limit: 100 requests/5 minutes for free tier
 * Docs: https://api.semanticscholar.org/api-docs/
 */

import type {
  Paper,
  Author,
  SearchQuery,
  CollectorResult,
  SemanticScholarPaper,
  Citation,
  CitationNetwork
} from './types'

const BASE_URL = 'https://api.semanticscholar.org/graph/v1'

type RequestParams = Record<string, string | number | boolean | undefined>

type SemanticScholarSearchResponse = {
  data: SemanticScholarPaper[]
  total: number
}

type SemanticScholarCitationItem = {
  citingPaper?: { paperId?: string }
  citedPaper?: { paperId?: string }
  contexts?: string[]
  intents?: string[]
}

type SemanticScholarCitationsResponse = {
  data?: SemanticScholarCitationItem[]
}

type SemanticScholarAuthorResponse = {
  papers?: SemanticScholarPaper[]
}

type SemanticScholarRecommendationsResponse = {
  recommendedPapers?: SemanticScholarPaper[]
}

type SemanticScholarPaperDetailsResponse = SemanticScholarPaper & {
  citations?: SemanticScholarCitationItem[]
  references?: SemanticScholarCitationItem[]
}

export class SemanticScholarCollector {
  private apiKey?: string
  private rateLimit: number = 100 // Requests per 5 minutes
  private lastRequest: number = 0
  private requestCount: number = 0

  constructor(config?: { apiKey?: string }) {
    this.apiKey = config?.apiKey
  }

  /**
   * Rate limiting
   */
  private async waitForRateLimit(): Promise<void> {
    const now = Date.now()
    const fiveMinutes = 5 * 60 * 1000

    // Reset counter every 5 minutes
    if (now - this.lastRequest > fiveMinutes) {
      this.requestCount = 0
      this.lastRequest = now
    }

    // If we've hit limit, wait
    if (this.requestCount >= this.rateLimit) {
      const waitTime = fiveMinutes - (now - this.lastRequest)
      console.log(`Rate limit reached. Waiting ${Math.round(waitTime / 1000)}s...`)
      await new Promise((resolve) => setTimeout(resolve, waitTime))
      this.requestCount = 0
      this.lastRequest = Date.now()
    }

    this.requestCount++
  }

  /**
   * Make API request
   */
  private async request(endpoint: string, params: RequestParams = {}): Promise<unknown> {
    await this.waitForRateLimit()

    const url = new URL(`${BASE_URL}${endpoint}`)
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value))
      }
    })

    const headers: Record<string, string> = {
      Accept: 'application/json'
    }

    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey
    }

    const response = await fetch(url.toString(), { headers })

    if (!response.ok) {
      throw new Error(`Semantic Scholar API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Convert Semantic Scholar format to our format
   */
  private convertPaper(ssPaper: SemanticScholarPaper): Paper {
    const authors: Author[] = ssPaper.authors.map((a) => ({
      id: a.authorId,
      name: a.name,
      affiliations: [],
      h_index: undefined,
      citation_count: undefined,
      paper_count: undefined
    }))

    return {
      id: ssPaper.paperId,
      title: ssPaper.title,
      abstract: ssPaper.abstract || '',
      authors,
      publicationDate: String(ssPaper.year),
      venue: ssPaper.venue,
      doi: ssPaper.externalIds?.DOI,
      arxiv_id: ssPaper.externalIds?.ArXiv,
      pubmed_id: ssPaper.externalIds?.PubMed,
      urls: [ssPaper.url],
      fields: ssPaper.fieldsOfStudy || [],
      topics: [],
      keywords: [],
      citationCount: ssPaper.citationCount || 0,
      influentialCitationCount: ssPaper.influentialCitationCount || 0,
      references: [],
      citedBy: []
    }
  }

  /**
   * Search for papers
   */
  async searchPapers(query: SearchQuery): Promise<CollectorResult> {
    console.log(`🔍 Searching Semantic Scholar: "${query.query}"`)

    const params: RequestParams = {
      query: query.query,
      limit: query.limit || 100,
      offset: query.offset || 0,
      fields:
        'paperId,title,abstract,year,authors,venue,citationCount,referenceCount,influentialCitationCount,fieldsOfStudy,publicationTypes,url,externalIds'
    }

    if (query.fields && query.fields.length > 0) {
      params.fieldsOfStudy = query.fields.join(',')
    }

    if (query.start_date) {
      params.year = `${query.start_date.slice(0, 4)}-`
    }

    const result = (await this.request('/paper/search', params)) as SemanticScholarSearchResponse
    const data = result.data ?? []

    const papers = data.map((p: SemanticScholarPaper) => this.convertPaper(p))

    console.log(`✅ Found ${papers.length} papers (total: ${result.total || papers.length})`)

    return {
      papers,
      total: result.total || papers.length,
      query,
      source: 'semantic_scholar',
      collected_at: new Date().toISOString()
    }
  }

  /**
   * Get paper details including citations
   */
  async getPaperDetails(paperId: string): Promise<Paper> {
    const params = {
      fields:
        'paperId,title,abstract,year,authors,venue,citationCount,referenceCount,influentialCitationCount,fieldsOfStudy,publicationTypes,url,externalIds,citations,references'
    }

    const result = (await this.request(
      `/paper/${paperId}`,
      params
    )) as SemanticScholarPaperDetailsResponse

    const paper = this.convertPaper(result as SemanticScholarPaper)

    // Add citations and references
    if (result.citations) {
      paper.citedBy = result.citations
        .map((c) => c.citingPaper?.paperId)
        .filter((id): id is string => Boolean(id))
    }

    if (result.references) {
      paper.references = result.references
        .map((r) => r.citedPaper?.paperId)
        .filter((id): id is string => Boolean(id))
    }

    return paper
  }

  /**
   * Get papers by author
   */
  async getAuthorPapers(authorId: string, limit: number = 100): Promise<Paper[]> {
    const params = {
      fields:
        'papers.paperId,papers.title,papers.abstract,papers.year,papers.authors,papers.venue,papers.citationCount,papers.influentialCitationCount',
      limit
    }

    const result = (await this.request(
      `/author/${authorId}`,
      params
    )) as SemanticScholarAuthorResponse

    const papers = result.papers ?? []

    return papers.map((p: SemanticScholarPaper) => this.convertPaper(p))
  }

  /**
   * Get paper recommendations (similar papers)
   */
  async getRecommendations(paperId: string, limit: number = 10): Promise<Paper[]> {
    const params = {
      fields: 'paperId,title,abstract,year,authors,venue,citationCount,influentialCitationCount',
      limit
    }

    const result = (await this.request(
      `/recommendations/v1/papers/forpaper/${paperId}`,
      params
    )) as SemanticScholarRecommendationsResponse

    const papers = result.recommendedPapers ?? []

    return papers.map((p: SemanticScholarPaper) => this.convertPaper(p))
  }

  /**
   * Get citations for a paper
   */
  async getCitations(paperId: string, limit: number = 1000): Promise<Citation[]> {
    const params = {
      fields: 'contexts,intents,isInfluential,paperId,title',
      limit
    }

    const result = (await this.request(
      `/paper/${paperId}/citations`,
      params
    )) as SemanticScholarCitationsResponse

    const citations: Citation[] = (result.data ?? [])
      .map((c) => ({
        from: c.citingPaper?.paperId,
        to: paperId,
        context: c.contexts?.[0],
        intent: c.intents?.[0] as Citation['intent'],
        sentiment: undefined
      }))
      .filter((citation): citation is Citation => Boolean(citation.from))

    return citations
  }

  /**
   * Get references from a paper
   */
  async getReferences(paperId: string, limit: number = 1000): Promise<Citation[]> {
    const params = {
      fields: 'contexts,intents,isInfluential,paperId,title',
      limit
    }

    const result = (await this.request(
      `/paper/${paperId}/references`,
      params
    )) as SemanticScholarCitationsResponse

    const citations: Citation[] = (result.data ?? [])
      .map((c) => ({
        from: paperId,
        to: c.citedPaper?.paperId,
        context: c.contexts?.[0],
        intent: c.intents?.[0] as Citation['intent'],
        sentiment: undefined
      }))
      .filter((citation): citation is Citation => Boolean(citation.to))

    return citations
  }

  /**
   * Build citation network for a topic
   */
  async buildCitationNetwork(topic: string, maxPapers: number = 100): Promise<CitationNetwork> {
    console.log(`\n🕸️  Building citation network for: "${topic}"`)

    // Step 1: Find papers on topic
    const searchResult = await this.searchPapers({
      query: topic,
      limit: maxPapers
    })

    console.log(`📚 Found ${searchResult.papers.length} papers`)

    // Step 2: Get details for each paper (including citations)
    const papers = new Map<string, Paper>()
    const citations: Citation[] = []

    for (const paper of searchResult.papers) {
      console.log(`  📄 Processing: ${paper.title.slice(0, 60)}...`)

      try {
        const detailedPaper = await this.getPaperDetails(paper.id)
        papers.set(detailedPaper.id, detailedPaper)

        // Get citation context
        const paperCitations = await this.getCitations(paper.id, 100)
        citations.push(...paperCitations)

        // Small delay to be respectful
        await new Promise((resolve) => setTimeout(resolve, 100))
      } catch (error) {
        console.log(`    ⚠️  Error: ${error}`)
      }
    }

    console.log(`\n✅ Network built:`)
    console.log(`   Papers: ${papers.size}`)
    console.log(`   Citations: ${citations.length}`)

    return {
      papers,
      citations,
      communities: [], // To be computed later
      influentialPapers: [], // To be computed later
      seminalPapers: [], // To be computed later
      trends: [] // To be computed later
    }
  }

  /**
   * Track trending topics in a field
   */
  async getTrendingTopics(field: string, years: number = 5): Promise<Map<string, number>> {
    const currentYear = new Date().getFullYear()
    const startYear = currentYear - years

    const topics = new Map<string, number>()

    // Search for recent papers in field
    const result = await this.searchPapers({
      query: field,
      start_date: `${startYear}-01-01`,
      limit: 1000
    })

    // Count topic frequencies
    result.papers.forEach((paper) => {
      paper.fields.forEach((topic) => {
        topics.set(topic, (topics.get(topic) || 0) + 1)
      })
    })

    return topics
  }

  /**
   * Find influential papers in a field
   */
  async getInfluentialPapers(field: string, limit: number = 50): Promise<Paper[]> {
    const result = await this.searchPapers({
      query: field,
      limit: 1000
    })

    // Sort by influential citations
    const sortedPapers = result.papers.sort(
      (a, b) => (b.influentialCitationCount || 0) - (a.influentialCitationCount || 0)
    )

    return sortedPapers.slice(0, limit)
  }

  /**
   * Find papers by multiple authors (potential collaboration)
   */
  async findCollaborations(authorIds: string[]): Promise<Paper[]> {
    const authorPapers = await Promise.all(authorIds.map((id) => this.getAuthorPapers(id)))

    // Find papers with multiple authors from the list
    const collaborations: Paper[] = []

    authorPapers[0].forEach((paper) => {
      const paperAuthorIds = new Set(paper.authors.map((a) => a.id))
      const matchCount = authorIds.filter((id) => paperAuthorIds.has(id)).length

      if (matchCount >= 2) {
        collaborations.push(paper)
      }
    })

    return collaborations
  }

  /**
   * Get bulk paper data for analysis
   */
  async bulkCollectByField(
    field: string,
    totalLimit: number = 10000,
    batchSize: number = 100
  ): Promise<Paper[]> {
    console.log(`\n📦 Bulk collecting papers in "${field}"`)
    console.log(`   Target: ${totalLimit} papers in batches of ${batchSize}`)

    const allPapers: Paper[] = []
    let offset = 0

    while (allPapers.length < totalLimit) {
      const remaining = totalLimit - allPapers.length
      const limit = Math.min(batchSize, remaining)

      console.log(`   Collecting batch ${Math.floor(offset / batchSize) + 1} (offset: ${offset})`)

      try {
        const result = await this.searchPapers({
          query: field,
          limit,
          offset
        })

        if (result.papers.length === 0) {
          console.log(`   No more papers available`)
          break
        }

        allPapers.push(...result.papers)
        offset += limit

        console.log(`   Progress: ${allPapers.length}/${totalLimit}`)

        // Rate limiting delay
        await new Promise((resolve) => setTimeout(resolve, 500))
      } catch (error) {
        console.error(`   Error: ${error}`)
        break
      }
    }

    console.log(`\n✅ Collected ${allPapers.length} papers total`)

    return allPapers
  }
}

/**
 * Example usage
 */
export async function exampleUsage() {
  const collector = new SemanticScholarCollector()

  // Search for papers
  const searchResult = await collector.searchPapers({
    query: 'machine learning interpretability',
    limit: 10
  })

  console.log(`\nFound ${searchResult.papers.length} papers:`)
  searchResult.papers.forEach((p) => {
    console.log(`- ${p.title} (${p.citationCount} citations)`)
  })

  // Get paper details
  if (searchResult.papers.length > 0) {
    const paperId = searchResult.papers[0].id
    const details = await collector.getPaperDetails(paperId)
    console.log(`\nPaper details:`)
    console.log(`  Citations: ${details.citedBy.length}`)
    console.log(`  References: ${details.references.length}`)
  }

  // Build citation network
  const network = await collector.buildCitationNetwork('neural networks', 20)
  console.log(`\nCitation network:`)
  console.log(`  Papers: ${network.papers.size}`)
  console.log(`  Citation edges: ${network.citations.length}`)
}
