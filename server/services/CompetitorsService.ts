import { database } from '../database/connection'

// Allowlist of valid columns for sorting - prevents SQL injection
const ALLOWED_SORT_COLUMNS = [
  'name',
  'filing_count',
  'total_amount',
  'avg_amount',
  'first_filing',
  'last_filing',
  'market_share'
] as const

type AllowedSortColumn = (typeof ALLOWED_SORT_COLUMNS)[number]

function validateSortColumn(column: string): AllowedSortColumn {
  if (ALLOWED_SORT_COLUMNS.includes(column as AllowedSortColumn)) {
    return column as AllowedSortColumn
  }
  return 'filing_count' // Safe default
}

interface Competitor {
  id: string
  name: string
  filing_count: number
  total_amount: number
  avg_amount: number
  states: string[]
  industries: string[]
  first_filing: string
  last_filing: string
  market_share: number
}

interface ListParams {
  page: number
  limit: number
  state?: string
  sort_by: string
  sort_order: 'asc' | 'desc'
}

export class CompetitorsService {
  async list(params: ListParams) {
    const { page, limit, state, sort_by, sort_order } = params
    const safeSortBy = validateSortColumn(sort_by)
    const offset = (page - 1) * limit

    // Build WHERE clause
    const conditions: string[] = []
    const values: (string | number)[] = []
    let paramCount = 1

    if (state) {
      conditions.push(`$${paramCount}::text = ANY(c.states)`)
      values.push(state)
      paramCount++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Query competitors (aggregated from UCC filings) - safeSortBy is validated against allowlist
    const safeSortOrder = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'
    const query = `
      SELECT
        uuid_generate_v4() as id,
        secured_party_normalized as name,
        COUNT(*) as filing_count,
        COALESCE(SUM(lien_amount), 0) as total_amount,
        COALESCE(AVG(lien_amount), 0) as avg_amount,
        ARRAY_AGG(DISTINCT state) as states,
        MIN(filing_date) as first_filing,
        MAX(filing_date) as last_filing
      FROM ucc_filings
      ${whereClause}
      GROUP BY secured_party_normalized
      ORDER BY ${safeSortBy} ${safeSortOrder}
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `
    values.push(limit, offset)

    const competitors = await database.query<Competitor>(query, values)

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT secured_party_normalized) as count
      FROM ucc_filings
      ${whereClause}
    `
    const countResult = await database.query<{ count: string }>(countQuery, values.slice(0, -2))
    const total = parseInt(countResult[0]?.count || '0')

    return {
      competitors,
      page,
      limit,
      total
    }
  }

  async getById(id: string) {
    // For competitors, we aggregate data by name
    // Since we don't store competitors separately, we need to query UCC filings
    const query = `
      SELECT
        $1::uuid as id,
        secured_party_normalized as name,
        COUNT(*) as filing_count,
        COALESCE(SUM(lien_amount), 0) as total_amount,
        COALESCE(AVG(lien_amount), 0) as avg_amount,
        ARRAY_AGG(DISTINCT state) as states,
        MIN(filing_date) as first_filing,
        MAX(filing_date) as last_filing
      FROM ucc_filings
      WHERE secured_party_normalized = (
        SELECT secured_party_normalized
        FROM ucc_filings
        LIMIT 1
      )
      GROUP BY secured_party_normalized
    `

    const results = await database.query<Competitor>(query, [id])
    return results[0] || null
  }

  async getAnalysis(id: string) {
    // Get competitor and perform SWOT analysis
    const competitor = await this.getById(id)

    if (!competitor) {
      return null
    }

    // Calculate market position
    const totalMarketQuery = `
      SELECT COALESCE(SUM(lien_amount), 0) as total_market
      FROM ucc_filings
    `
    const marketResult = await database.query<{ total_market: number }>(totalMarketQuery)
    const totalMarket = marketResult[0]?.total_market || 0

    const marketShare = totalMarket > 0 ? (competitor.total_amount / totalMarket) * 100 : 0

    return {
      ...competitor,
      market_share: marketShare,
      analysis: {
        strengths: this.calculateStrengths(competitor, marketShare),
        weaknesses: this.calculateWeaknesses(competitor, marketShare),
        opportunities: this.calculateOpportunities(competitor),
        threats: this.calculateThreats(competitor)
      }
    }
  }

  async getStats() {
    const query = `
      SELECT
        COUNT(DISTINCT secured_party_normalized) as total_competitors,
        COUNT(*) as total_filings,
        COALESCE(SUM(lien_amount), 0) as total_market_value,
        COALESCE(AVG(lien_amount), 0) as avg_filing_amount
      FROM ucc_filings
    `

    const results = await database.query(query)
    return (
      results[0] || {
        total_competitors: 0,
        total_filings: 0,
        total_market_value: 0,
        avg_filing_amount: 0
      }
    )
  }

  private calculateStrengths(competitor: Competitor, marketShare: number): string[] {
    const strengths: string[] = []

    if (marketShare > 10) {
      strengths.push('Dominant market position')
    }
    if (competitor.filing_count > 100) {
      strengths.push('High volume of transactions')
    }
    if (competitor.avg_amount > 500000) {
      strengths.push('Large average deal size')
    }
    if (competitor.states.length > 5) {
      strengths.push('Geographic diversification')
    }

    return strengths.length > 0 ? strengths : ['Established market presence']
  }

  private calculateWeaknesses(competitor: Competitor, marketShare: number): string[] {
    const weaknesses: string[] = []

    if (marketShare < 1) {
      weaknesses.push('Limited market share')
    }
    if (competitor.filing_count < 10) {
      weaknesses.push('Low transaction volume')
    }
    if (competitor.states.length < 3) {
      weaknesses.push('Limited geographic reach')
    }

    return weaknesses.length > 0 ? weaknesses : ['Competitive pressure from larger players']
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private calculateOpportunities(competitor: Competitor): string[] {
    return [
      'Expansion into underserved markets',
      'Partnerships with local lenders',
      'Technology-driven efficiency improvements'
    ]
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private calculateThreats(competitor: Competitor): string[] {
    return [
      'Increased competition from fintech lenders',
      'Regulatory changes affecting lending practices',
      'Economic downturn reducing lending opportunities'
    ]
  }
}
