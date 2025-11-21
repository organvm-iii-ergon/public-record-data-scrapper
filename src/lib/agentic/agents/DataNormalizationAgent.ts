/**
 * Data Normalization Agent
 * 
 * Canonicalizes, standardizes, and deduplicates data from multiple sources
 */

import { BaseAgent } from '../BaseAgent'
import { AgentAnalysis, SystemContext, AgentTask, AgentTaskResult, Finding, ImprovementSuggestion } from '../types'

export class DataNormalizationAgent extends BaseAgent {
  constructor() {
    super('data-normalization', 'Data Normalization Agent', [
      'Company name canonicalization',
      'Address normalization',
      'Date standardization',
      'Collateral type mapping',
      'Fuzzy matching and deduplication',
      'Data validation'
    ])
  }

  async analyze(context: SystemContext): Promise<AgentAnalysis> {
    const findings: Finding[] = []
    const improvements: ImprovementSuggestion[] = []

    // Check for data quality issues
    const inconsistentData = this.checkDataConsistency(context)
    if (inconsistentData.length > 0) {
      findings.push(this.createFinding(
        'data-quality',
        'warning',
        `Found ${inconsistentData.length} prospects with inconsistent data`,
        { inconsistentData: inconsistentData.slice(0, 5) }
      ))
    }

    return this.createAnalysis(findings, improvements)
  }

  /**
   * Execute a normalization task
   */
  async executeTask(task: AgentTask): Promise<AgentTaskResult> {
    const { type, payload } = task

    try {
      switch (type) {
        case 'normalize-company-name':
          return this.normalizeCompanyName(payload.name)
        case 'normalize-address':
          return this.normalizeAddress(payload.address)
        case 'normalize-date':
          return this.normalizeDate(payload.date)
        case 'normalize-data':
          return this.normalizeData(payload.data)
        case 'deduplicate':
          return this.deduplicateRecords(payload.records)
        default:
          return {
            success: false,
            error: `Unknown task type: ${type}`,
            timestamp: new Date().toISOString()
          }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Normalize company name
   */
  private normalizeCompanyName(name: string): AgentTaskResult {
    let normalized = name.trim()

    // Remove common suffixes
    const suffixes = [
      'LLC', 'L.L.C.', 'L.L.C', 'L L C',
      'Inc', 'Inc.', 'Incorporated',
      'Corp', 'Corp.', 'Corporation',
      'Ltd', 'Ltd.', 'Limited',
      'Co', 'Co.', 'Company',
      'LLP', 'L.L.P.'
    ]

    // Remove suffixes (case insensitive)
    const suffixPattern = new RegExp(`\\b(${suffixes.join('|')})\\b\\.?$`, 'i')
    normalized = normalized.replace(suffixPattern, '').trim()

    // Remove extra whitespace
    normalized = normalized.replace(/\s+/g, ' ')

    // Convert to title case
    normalized = this.toTitleCase(normalized)

    // Remove special characters except &, -, and '
    normalized = normalized.replace(/[^a-zA-Z0-9\s&\-']/g, '')

    return {
      success: true,
      data: {
        original: name,
        normalized,
        changes: name !== normalized
      },
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Normalize address
   */
  private normalizeAddress(address: string): AgentTaskResult {
    let normalized = address.trim()

    // Standardize street abbreviations
    const streetAbbreviations: Record<string, string> = {
      'Street': 'St',
      'Avenue': 'Ave',
      'Boulevard': 'Blvd',
      'Drive': 'Dr',
      'Road': 'Rd',
      'Lane': 'Ln',
      'Court': 'Ct',
      'Circle': 'Cir',
      'Place': 'Pl',
      'Square': 'Sq',
      'Highway': 'Hwy',
      'Parkway': 'Pkwy'
    }

    Object.entries(streetAbbreviations).forEach(([full, abbr]) => {
      const pattern = new RegExp(`\\b${full}\\b`, 'gi')
      normalized = normalized.replace(pattern, abbr)
    })

    // Standardize directions
    const directions: Record<string, string> = {
      'North': 'N',
      'South': 'S',
      'East': 'E',
      'West': 'W',
      'Northeast': 'NE',
      'Northwest': 'NW',
      'Southeast': 'SE',
      'Southwest': 'SW'
    }

    Object.entries(directions).forEach(([full, abbr]) => {
      const pattern = new RegExp(`\\b${full}\\b`, 'gi')
      normalized = normalized.replace(pattern, abbr)
    })

    // Remove extra whitespace
    normalized = normalized.replace(/\s+/g, ' ')

    return {
      success: true,
      data: {
        original: address,
        normalized,
        changes: address !== normalized
      },
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Normalize date to ISO 8601 format
   */
  private normalizeDate(date: string | Date): AgentTaskResult {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date
      
      if (isNaN(dateObj.getTime())) {
        throw new Error('Invalid date')
      }

      const normalized = dateObj.toISOString()

      return {
        success: true,
        data: {
          original: date,
          normalized,
          timestamp: dateObj.getTime()
        },
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to normalize date: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Normalize all data in a record
   */
  private normalizeData(data: Record<string, any>): AgentTaskResult {
    const normalized: Record<string, any> = { ...data }

    // Normalize company name if present
    if (normalized.companyName) {
      const result = this.normalizeCompanyName(normalized.companyName)
      if (result.success && result.data) {
        normalized.companyName = result.data.normalized
      }
    }

    // Normalize addresses
    if (normalized.address) {
      const result = this.normalizeAddress(normalized.address)
      if (result.success && result.data) {
        normalized.address = result.data.normalized
      }
    }

    // Normalize dates
    const dateFields = ['filingDate', 'defaultDate', 'detectedDate', 'lastUpdated']
    dateFields.forEach(field => {
      if (normalized[field]) {
        const result = this.normalizeDate(normalized[field])
        if (result.success && result.data) {
          normalized[field] = result.data.normalized
        }
      }
    })

    // Normalize state codes to uppercase
    if (normalized.state) {
      normalized.state = normalized.state.toUpperCase()
    }

    return {
      success: true,
      data: {
        original: data,
        normalized,
        fieldsNormalized: Object.keys(normalized).filter(k => 
          JSON.stringify(data[k]) !== JSON.stringify(normalized[k])
        )
      },
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Deduplicate records using fuzzy matching
   */
  private deduplicateRecords(records: any[]): AgentTaskResult {
    const unique: any[] = []
    const duplicates: any[] = []

    records.forEach(record => {
      const isDuplicate = unique.some(existing => 
        this.calculateSimilarity(record, existing) > 0.85
      )

      if (isDuplicate) {
        duplicates.push(record)
      } else {
        unique.push(record)
      }
    })

    return {
      success: true,
      data: {
        original: records.length,
        unique: unique.length,
        duplicates: duplicates.length,
        deduplicationRate: ((duplicates.length / records.length) * 100).toFixed(1) + '%',
        uniqueRecords: unique,
        duplicateRecords: duplicates
      },
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Calculate similarity between two records
   */
  private calculateSimilarity(record1: any, record2: any): number {
    // Simple similarity calculation based on company name
    const name1 = (record1.companyName || '').toLowerCase()
    const name2 = (record2.companyName || '').toLowerCase()

    if (!name1 || !name2) return 0

    // Levenshtein distance-based similarity
    const distance = this.levenshteinDistance(name1, name2)
    const maxLength = Math.max(name1.length, name2.length)
    return 1 - (distance / maxLength)
  }

  /**
   * Calculate Levenshtein distance
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
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }

  /**
   * Convert string to title case
   */
  private toTitleCase(str: string): string {
    return str.replace(/\w\S*/g, txt => 
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    )
  }

  /**
   * Check data consistency in context
   */
  private checkDataConsistency(context: SystemContext): any[] {
    const inconsistent: any[] = []

    context.prospects.forEach(prospect => {
      const issues: string[] = []

      // Check for missing required fields
      if (!prospect.companyName) issues.push('missing company name')
      if (!prospect.state) issues.push('missing state')

      // Check date formats
      if (prospect.defaultDate && isNaN(new Date(prospect.defaultDate).getTime())) {
        issues.push('invalid default date')
      }

      if (issues.length > 0) {
        inconsistent.push({
          id: prospect.id,
          companyName: prospect.companyName,
          issues
        })
      }
    })

    return inconsistent
  }
}
