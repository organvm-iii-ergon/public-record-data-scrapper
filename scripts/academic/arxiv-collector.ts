/**
 * arXiv API Collector
 *
 * Free preprint server for Physics, Math, CS, Biology, Finance, etc.
 * 2M+ papers, updated daily
 * API: https://arxiv.org/help/api/
 * Rate limit: 1 request every 3 seconds recommended
 */

import type {
  Paper,
  Author,
  SearchQuery,
  CollectorResult,
  ArXivPaper
} from './types'

const BASE_URL = 'http://export.arxiv.org/api/query'

// arXiv category mappings
export const ARXIV_CATEGORIES = {
  // Computer Science
  'cs.AI': 'Artificial Intelligence',
  'cs.CL': 'Computation and Language',
  'cs.CV': 'Computer Vision',
  'cs.LG': 'Machine Learning',
  'cs.NE': 'Neural and Evolutionary Computing',
  'cs.RO': 'Robotics',
  'cs.SY': 'Systems and Control',

  // Physics
  'physics.comp-ph': 'Computational Physics',
  'physics.data-an': 'Data Analysis',
  'astro-ph': 'Astrophysics',
  'cond-mat': 'Condensed Matter',
  'gr-qc': 'General Relativity',
  'hep-ex': 'High Energy Physics - Experiment',
  'hep-th': 'High Energy Physics - Theory',
  'quant-ph': 'Quantum Physics',

  // Mathematics
  'math.AG': 'Algebraic Geometry',
  'math.AT': 'Algebraic Topology',
  'math.CO': 'Combinatorics',
  'math.LO': 'Logic',
  'math.NT': 'Number Theory',
  'math.PR': 'Probability',
  'math.ST': 'Statistics Theory',

  // Quantitative Biology
  'q-bio.BM': 'Biomolecules',
  'q-bio.CB': 'Cell Behavior',
  'q-bio.GN': 'Genomics',
  'q-bio.MN': 'Molecular Networks',
  'q-bio.NC': 'Neurons and Cognition',
  'q-bio.QM': 'Quantitative Methods',

  // Quantitative Finance
  'q-fin.CP': 'Computational Finance',
  'q-fin.EC': 'Economics',
  'q-fin.MF': 'Mathematical Finance',
  'q-fin.PM': 'Portfolio Management',
  'q-fin.RM': 'Risk Management',
  'q-fin.TR': 'Trading and Market Microstructure',

  // Statistics
  'stat.AP': 'Applications',
  'stat.CO': 'Computation',
  'stat.ML': 'Machine Learning',
  'stat.ME': 'Methodology',
  'stat.TH': 'Theory'
}

export class ArXivCollector {
  private requestDelay = 3000 // 3 seconds between requests
  private lastRequest = 0

  /**
   * Rate limiting - arXiv asks for 3 second delay
   */
  private async waitForRateLimit(): Promise<void> {
    const now = Date.now()
    const elapsed = now - this.lastRequest
    const remaining = this.requestDelay - elapsed

    if (remaining > 0) {
      await new Promise(resolve => setTimeout(resolve, remaining))
    }

    this.lastRequest = Date.now()
  }

  /**
   * Build search query string for arXiv API
   */
  private buildSearchQuery(query: SearchQuery): string {
    const parts: string[] = []

    // Main query
    if (query.query) {
      parts.push(`all:${query.query}`)
    }

    // Field/category filter
    if (query.fields && query.fields.length > 0) {
      const cats = query.fields.map(f => `cat:${f}`).join(' OR ')
      parts.push(`(${cats})`)
    }

    // Author filter
    if (query.authors && query.authors.length > 0) {
      const authors = query.authors.map(a => `au:"${a}"`).join(' OR ')
      parts.push(`(${authors})`)
    }

    return parts.join(' AND ')
  }

  /**
   * Parse arXiv XML response
   */
  private parseXML(xml: string): ArXivPaper[] {
    const papers: ArXivPaper[] = []

    // Simple XML parsing (in production, use a proper XML parser)
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
    const entries = xml.match(entryRegex) || []

    for (const entry of entries) {
      try {
        const paper: ArXivPaper = {
          id: this.extractTag(entry, 'id'),
          updated: this.extractTag(entry, 'updated'),
          published: this.extractTag(entry, 'published'),
          title: this.extractTag(entry, 'title').replace(/\s+/g, ' ').trim(),
          summary: this.extractTag(entry, 'summary').replace(/\s+/g, ' ').trim(),
          authors: this.extractAuthors(entry),
          categories: this.extractCategories(entry),
          pdf_url: this.extractPdfUrl(entry),
          doi: this.extractDoi(entry)
        }

        papers.push(paper)
      } catch (error) {
        console.error('Error parsing entry:', error)
      }
    }

    return papers
  }

  private extractTag(xml: string, tag: string): string {
    const match = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`, 's'))
    return match ? match[1].trim() : ''
  }

  private extractAuthors(xml: string): { name: string }[] {
    const authorRegex = /<author>[\s\S]*?<name>(.*?)<\/name>[\s\S]*?<\/author>/g
    const authors: { name: string }[] = []
    let match

    while ((match = authorRegex.exec(xml)) !== null) {
      authors.push({ name: match[1].trim() })
    }

    return authors
  }

  private extractCategories(xml: string): string[] {
    const categoryRegex = /<category\s+term="([^"]+)"/g
    const categories: string[] = []
    let match

    while ((match = categoryRegex.exec(xml)) !== null) {
      categories.push(match[1])
    }

    return categories
  }

  private extractPdfUrl(xml: string): string {
    const match = xml.match(/<link\s+title="pdf"\s+href="([^"]+)"/)
    return match ? match[1] : ''
  }

  private extractDoi(xml: string): string | undefined {
    const match = xml.match(/<arxiv:doi[^>]*>([^<]+)<\/arxiv:doi>/)
    return match ? match[1] : undefined
  }

  /**
   * Convert arXiv paper to our format
   */
  private convertPaper(arxivPaper: ArXivPaper): Paper {
    // Extract arXiv ID from URL
    const arxivId = arxivPaper.id.split('/abs/').pop() || arxivPaper.id

    const authors: Author[] = arxivPaper.authors.map(a => ({
      id: a.name.toLowerCase().replace(/\s+/g, '-'),
      name: a.name,
      affiliations: []
    }))

    return {
      id: `arxiv:${arxivId}`,
      title: arxivPaper.title,
      abstract: arxivPaper.summary,
      authors,
      publicationDate: arxivPaper.published,
      venue: 'arXiv',
      venueType: 'preprint',
      arxiv_id: arxivId,
      doi: arxivPaper.doi,
      urls: [arxivPaper.pdf_url, arxivPaper.id],
      fields: arxivPaper.categories,
      topics: arxivPaper.categories.map(c => ARXIV_CATEGORIES[c as keyof typeof ARXIV_CATEGORIES] || c),
      keywords: [],
      citationCount: 0, // arXiv doesn't provide citation counts
      references: [],
      citedBy: []
    }
  }

  /**
   * Search arXiv papers
   */
  async searchPapers(query: SearchQuery): Promise<CollectorResult> {
    console.log(`🔍 Searching arXiv: "${query.query}"`)

    await this.waitForRateLimit()

    const searchQuery = this.buildSearchQuery(query)
    const start = query.offset || 0
    const maxResults = query.limit || 100

    const url = new URL(BASE_URL)
    url.searchParams.append('search_query', searchQuery)
    url.searchParams.append('start', String(start))
    url.searchParams.append('max_results', String(maxResults))
    url.searchParams.append('sortBy', 'lastUpdatedDate')
    url.searchParams.append('sortOrder', 'descending')

    const response = await fetch(url.toString())

    if (!response.ok) {
      throw new Error(`arXiv API error: ${response.status}`)
    }

    const xml = await response.text()

    // Extract total results from XML
    const totalMatch = xml.match(/<opensearch:totalResults[^>]*>(\d+)<\/opensearch:totalResults>/)
    const total = totalMatch ? parseInt(totalMatch[1]) : 0

    const arxivPapers = this.parseXML(xml)
    const papers = arxivPapers.map(p => this.convertPaper(p))

    console.log(`✅ Found ${papers.length} papers (total: ${total})`)

    return {
      papers,
      total,
      query,
      source: 'arxiv',
      collected_at: new Date().toISOString()
    }
  }

  /**
   * Get paper by arXiv ID
   */
  async getPaperById(arxivId: string): Promise<Paper> {
    await this.waitForRateLimit()

    const url = `${BASE_URL}?id_list=${arxivId}`
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`arXiv API error: ${response.status}`)
    }

    const xml = await response.text()
    const arxivPapers = this.parseXML(xml)

    if (arxivPapers.length === 0) {
      throw new Error(`Paper not found: ${arxivId}`)
    }

    return this.convertPaper(arxivPapers[0])
  }

  /**
   * Get papers by author
   */
  async getPapersByAuthor(authorName: string, limit: number = 100): Promise<Paper[]> {
    const result = await this.searchPapers({
      query: '',
      authors: [authorName],
      limit
    })

    return result.papers
  }

  /**
   * Get recent papers in a category
   */
  async getRecentPapers(category: string, days: number = 7, limit: number = 100): Promise<Paper[]> {
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)

    const result = await this.searchPapers({
      query: '',
      fields: [category],
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      limit
    })

    return result.papers
  }

  /**
   * Bulk collect papers from a category
   */
  async bulkCollectByCategory(
    category: string,
    totalLimit: number = 10000,
    batchSize: number = 100
  ): Promise<Paper[]> {
    console.log(`\n📦 Bulk collecting arXiv papers in "${category}"`)
    console.log(`   Category: ${ARXIV_CATEGORIES[category as keyof typeof ARXIV_CATEGORIES] || category}`)
    console.log(`   Target: ${totalLimit} papers in batches of ${batchSize}`)

    const allPapers: Paper[] = []
    let offset = 0

    while (allPapers.length < totalLimit) {
      const remaining = totalLimit - allPapers.length
      const limit = Math.min(batchSize, remaining)

      console.log(`   Collecting batch ${Math.floor(offset / batchSize) + 1} (offset: ${offset})`)

      try {
        const result = await this.searchPapers({
          query: '',
          fields: [category],
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

      } catch (error) {
        console.error(`   Error: ${error}`)
        break
      }
    }

    console.log(`\n✅ Collected ${allPapers.length} papers total`)

    return allPapers
  }

  /**
   * Track daily new submissions in categories
   */
  async getDailyNewSubmissions(categories: string[]): Promise<Map<string, Paper[]>> {
    console.log(`\n📅 Getting today's new submissions`)

    const today = new Date().toISOString().split('T')[0]
    const submissions = new Map<string, Paper[]>()

    for (const category of categories) {
      console.log(`   Category: ${category}`)

      try {
        const papers = await this.getRecentPapers(category, 1, 1000)
        submissions.set(category, papers)

        console.log(`     ✅ ${papers.length} new papers`)

      } catch (error) {
        console.error(`     ❌ Error: ${error}`)
        submissions.set(category, [])
      }
    }

    return submissions
  }

  /**
   * Find cross-domain papers (papers in multiple categories)
   */
  async findCrossDomainPapers(
    category1: string,
    category2: string,
    limit: number = 100
  ): Promise<Paper[]> {
    console.log(`\n🔀 Finding cross-domain papers: ${category1} + ${category2}`)

    const result = await this.searchPapers({
      query: '',
      fields: [category1, category2],
      limit
    })

    // Filter for papers that have BOTH categories
    const crossDomain = result.papers.filter(paper =>
      paper.fields.includes(category1) && paper.fields.includes(category2)
    )

    console.log(`✅ Found ${crossDomain.length} cross-domain papers`)

    return crossDomain
  }

  /**
   * Monitor trending topics (most papers submitted recently)
   */
  async getTrendingTopics(
    mainCategory: string,
    days: number = 30
  ): Promise<Map<string, number>> {
    console.log(`\n📈 Finding trending topics in ${mainCategory} (last ${days} days)`)

    const papers = await this.getRecentPapers(mainCategory, days, 1000)

    // Count papers by subcategory
    const topicCounts = new Map<string, number>()

    papers.forEach(paper => {
      paper.fields.forEach(field => {
        topicCounts.set(field, (topicCounts.get(field) || 0) + 1)
      })
    })

    // Sort by count
    const sorted = Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)

    sorted.forEach(([topic, count]) => {
      const name = ARXIV_CATEGORIES[topic as keyof typeof ARXIV_CATEGORIES] || topic
      console.log(`   ${name}: ${count} papers`)
    })

    return new Map(sorted)
  }
}

/**
 * Example usage
 */
export async function exampleUsage() {
  const collector = new ArXivCollector()

  // Search for papers
  const result = await collector.searchPapers({
    query: 'large language models',
    fields: ['cs.CL', 'cs.AI'],
    limit: 10
  })

  console.log(`\nFound ${result.papers.length} papers:`)
  result.papers.forEach(p => {
    console.log(`- ${p.title}`)
    console.log(`  Authors: ${p.authors.map(a => a.name).join(', ')}`)
    console.log(`  Categories: ${p.fields.join(', ')}`)
  })

  // Get recent papers
  const recent = await collector.getRecentPapers('cs.LG', 7, 20)
  console.log(`\n${recent.length} recent Machine Learning papers`)

  // Find cross-domain papers
  const crossDomain = await collector.findCrossDomainPapers('cs.AI', 'q-bio.QM', 50)
  console.log(`\n${crossDomain.length} papers at intersection of AI and Biology`)

  // Track trending topics
  await collector.getTrendingTopics('cs', 30)
}
