import { v4 as uuidv4 } from 'uuid'
import { database } from '../../database/connection'

/**
 * Test data factories for creating consistent test data
 */

export interface CreateProspectParams {
  companyName?: string
  state?: string
  industry?: string
  lienAmount?: number
  riskScore?: number
  status?: string
}

export interface CreatePortfolioCompanyParams {
  companyName?: string
  fundedAmount?: number
  healthScore?: number
  healthGrade?: string
  healthTrend?: string
  state?: string
  industry?: string
}

export interface CreateUCCFilingParams {
  debtorName?: string
  securedParty?: string
  state?: string
  lienAmount?: number
}

export class TestDataFactory {
  /**
   * Create a test prospect
   */
  static async createProspect(params: CreateProspectParams = {}) {
    const prospectData = {
      id: uuidv4(),
      company_name: params.companyName || `Test Company ${Math.random().toString(36).substring(7)}`,
      state: params.state || 'NY',
      industry: params.industry || 'Technology',
      lien_amount: params.lienAmount || 500000,
      risk_score: params.riskScore || 75,
      status: params.status || 'active'
    }

    await database.query(
      `INSERT INTO prospects (id, company_name, state, industry, lien_amount, risk_score, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [
        prospectData.id,
        prospectData.company_name,
        prospectData.state,
        prospectData.industry,
        prospectData.lien_amount,
        prospectData.risk_score,
        prospectData.status
      ]
    )

    return prospectData
  }

  /**
   * Create multiple test prospects
   */
  static async createProspects(count: number, params: CreateProspectParams = {}) {
    const prospects = []
    for (let i = 0; i < count; i++) {
      prospects.push(await this.createProspect(params))
    }
    return prospects
  }

  /**
   * Create a test portfolio company
   */
  static async createPortfolioCompany(params: CreatePortfolioCompanyParams = {}) {
    const companyData = {
      id: uuidv4(),
      company_name:
        params.companyName || `Portfolio Company ${Math.random().toString(36).substring(7)}`,
      funded_amount: params.fundedAmount || 1000000,
      funded_date: new Date(),
      current_health_score: params.healthScore || 85,
      health_grade: params.healthGrade || 'B',
      health_trend: params.healthTrend || 'stable',
      state: params.state || 'CA',
      industry: params.industry || 'Manufacturing'
    }

    await database.query(
      `INSERT INTO portfolio_companies (
        id, company_name, funded_amount, funded_date, current_health_score,
        health_grade, health_trend, state, industry, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
      [
        companyData.id,
        companyData.company_name,
        companyData.funded_amount,
        companyData.funded_date,
        companyData.current_health_score,
        companyData.health_grade,
        companyData.health_trend,
        companyData.state,
        companyData.industry
      ]
    )

    return companyData
  }

  /**
   * Create a test UCC filing
   */
  static async createUCCFiling(params: CreateUCCFilingParams = {}) {
    const filingData = {
      id: uuidv4(),
      debtor_name: params.debtorName || `Debtor ${Math.random().toString(36).substring(7)}`,
      secured_party: params.securedParty || 'Test Lender LLC',
      secured_party_normalized: (params.securedParty || 'Test Lender LLC').toUpperCase(),
      state: params.state || 'NY',
      filing_number: `UCC-${Math.random().toString(36).substring(7).toUpperCase()}`,
      filing_date: new Date(),
      lien_amount: params.lienAmount || 250000
    }

    await database.query(
      `INSERT INTO ucc_filings (
        id, debtor_name, secured_party, secured_party_normalized, state,
        filing_number, filing_date, lien_amount, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
      [
        filingData.id,
        filingData.debtor_name,
        filingData.secured_party,
        filingData.secured_party_normalized,
        filingData.state,
        filingData.filing_number,
        filingData.filing_date,
        filingData.lien_amount
      ]
    )

    return filingData
  }

  /**
   * Create growth signals for a prospect or portfolio company
   */
  static async createGrowthSignal(
    targetId: string,
    type: 'hiring' | 'permits' | 'contracts' | 'expansion' | 'equipment',
    isPortfolioCompany: boolean = false
  ) {
    const signalData = {
      id: uuidv4(),
      type,
      description: `Test ${type} signal`,
      detected_date: new Date()
    }

    const column = isPortfolioCompany ? 'portfolio_company_id' : 'prospect_id'

    await database.query(
      `INSERT INTO growth_signals (id, ${column}, type, description, detected_date, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [signalData.id, targetId, signalData.type, signalData.description, signalData.detected_date]
    )

    return signalData
  }

  /**
   * Create health score record
   */
  static async createHealthScore(
    targetId: string,
    score: number,
    isPortfolioCompany: boolean = false
  ) {
    const healthData = {
      id: uuidv4(),
      score,
      grade: this.calculateGrade(score),
      trend: 'stable' as const,
      violations_count: 0,
      sentiment_score: 0.8,
      recorded_at: new Date()
    }

    const column = isPortfolioCompany ? 'portfolio_company_id' : 'prospect_id'

    await database.query(
      `INSERT INTO health_scores (
        id, ${column}, score, grade, trend, violations_count,
        sentiment_score, recorded_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        healthData.id,
        targetId,
        healthData.score,
        healthData.grade,
        healthData.trend,
        healthData.violations_count,
        healthData.sentiment_score,
        healthData.recorded_at
      ]
    )

    return healthData
  }

  private static calculateGrade(score: number): string {
    if (score >= 90) return 'A'
    if (score >= 80) return 'B'
    if (score >= 70) return 'C'
    if (score >= 60) return 'D'
    return 'F'
  }
}
