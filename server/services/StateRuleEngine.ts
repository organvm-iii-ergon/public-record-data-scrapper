/**
 * State-Specific Rule Engine
 *
 * Implements jurisdictional data normalization, entity standardization, statutory
 * lapse calculation, and validation rules across US states for UCC filings.
 *
 * Capabilities:
 * - Filing Number Validation & Normalization: State-specific regex patterns and formats
 *   (e.g., CA, TX, FL, NY, NJ, IL, PA, OH, GA, NC, MI).
 * - Entity Name & DBA Standardization: Normalizes corporate legal suffixes (LLC, INC, CORP, LP)
 *   and extracts trade names (DBA, D/B/A, F/K/A, A/K/A).
 * - Statutory Lapse & Expiration Engine: Computes Article 9 lapse dates (+5 years default,
 *   with overrides for public finance, transmitting utilities, and state statutory provisions).
 * - Collateral Standardization: Categorizes collateral clauses (future receivables/MCA,
 *   blanket all-assets, inventory, equipment, accounts).
 * - Address & Jurisdiction Normalization: Validates postal abbreviations, street suffixes,
 *   and postal codes.
 * - Extensible Rule Registry: Supports dynamic runtime registration of state-specific rules.
 *
 * @module server/services/StateRuleEngine
 */

import type {
  UCCFiling as CollectedUCCFiling,
  Party as CollectedParty
} from '../../apps/web/src/lib/collectors/types'

export interface ValidationError {
  field: string
  code: string
  message: string
  severity: 'error' | 'fatal'
}

export interface ValidationWarning {
  field: string
  code: string
  message: string
}

export interface RuleValidationResult {
  valid: boolean
  state: string
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface EntityNameDetails {
  raw: string
  clean: string
  legalName: string
  dba?: string
  fka?: string
  entityType?: 'LLC' | 'INC' | 'CORP' | 'LP' | 'LLP' | 'PLLC' | 'CO' | 'INDIVIDUAL' | 'OTHER'
  isOrganization: boolean
}

export interface CollateralAnalysis {
  normalizedDescription: string
  isAllAssets: boolean
  hasFutureReceivables: boolean
  hasEquipment: boolean
  hasInventory: boolean
  hasAccounts: boolean
  hasChattelPaper: boolean
  categories: string[]
  disclosureRequiredStates: string[]
}

export interface StateRuleConfig {
  state: string
  name: string
  filingNumberPattern: RegExp
  filingNumberExample: string
  standardLapseYears: number
  hasTransmittingUtilityExemption: boolean
  disclosureLawEffectiveDate?: string
  normalizeFilingNumber?: (raw: string) => string
  customValidator?: (filing: Partial<CollectedUCCFiling>) => {
    errors?: ValidationError[]
    warnings?: ValidationWarning[]
  }
}

export interface ProcessedFilingResult {
  normalized: CollectedUCCFiling
  validation: RuleValidationResult
  entityDetails: {
    debtor: EntityNameDetails
    securedParty: EntityNameDetails
  }
  collateralAnalysis: CollateralAnalysis
}

export class StateRuleEngine {
  private rules: Map<string, StateRuleConfig> = new Map()

  constructor() {
    this.registerDefaultRules()
  }

  /**
   * Register standard rules for major commercial UCC jurisdictions.
   */
  private registerDefaultRules(): void {
    // California (CA)
    this.registerRule({
      state: 'CA',
      name: 'California',
      filingNumberPattern: /^(?:\d{2}-\d{8}|\d{12}|UCC-\d{10,12})$/i,
      filingNumberExample: '24-00123456 or 202412345678',
      standardLapseYears: 5,
      hasTransmittingUtilityExemption: true,
      disclosureLawEffectiveDate: '2022-12-09', // CA SB 1235 Commercial Financing Disclosures
      normalizeFilingNumber: (raw) => {
        const digits = raw.replace(/\D/g, '')
        if (digits.length === 10) {
          return `${digits.slice(0, 2)}-${digits.slice(2)}`
        }
        return raw.trim().toUpperCase()
      }
    })

    // Texas (TX)
    this.registerRule({
      state: 'TX',
      name: 'Texas',
      filingNumberPattern: /^(?:\d{10,14}|\d{4}-\d{6,8}|TX-\d{8,12})$/i,
      filingNumberExample: '202400123456 or 24-123456',
      standardLapseYears: 5,
      hasTransmittingUtilityExemption: true,
      normalizeFilingNumber: (raw) =>
        raw
          .trim()
          .replace(/[^\w-]/g, '')
          .toUpperCase()
    })

    // Florida (FL)
    this.registerRule({
      state: 'FL',
      name: 'Florida',
      filingNumberPattern: /^(?:\d{12}|\d{4}-\d{6,8}|FL\d{10})$/i,
      filingNumberExample: '202412345678',
      standardLapseYears: 5,
      hasTransmittingUtilityExemption: true,
      normalizeFilingNumber: (raw) => raw.trim().replace(/\D/g, '')
    })

    // New York (NY)
    this.registerRule({
      state: 'NY',
      name: 'New York',
      filingNumberPattern: /^(?:\d{4}-\d{6,8}|\d{8,12}|NY-\d{8})$/i,
      filingNumberExample: '2024-123456',
      standardLapseYears: 5,
      hasTransmittingUtilityExemption: true,
      disclosureLawEffectiveDate: '2023-02-01', // NY CFDL Commercial Finance Disclosure Law
      normalizeFilingNumber: (raw) => raw.trim().toUpperCase()
    })

    // New Jersey (NJ)
    this.registerRule({
      state: 'NJ',
      name: 'New Jersey',
      filingNumberPattern: /^(?:\d{8,12}|NJ-\d{6,10})$/i,
      filingNumberExample: '2024123456',
      standardLapseYears: 5,
      hasTransmittingUtilityExemption: true
    })

    // Illinois (IL)
    this.registerRule({
      state: 'IL',
      name: 'Illinois',
      filingNumberPattern: /^(?:\d{7,12}|IL-\d{6,10}|\d{4}-\d{6,8})$/i,
      filingNumberExample: '2024-1234567',
      standardLapseYears: 5,
      hasTransmittingUtilityExemption: true
    })

    // Pennsylvania (PA)
    this.registerRule({
      state: 'PA',
      name: 'Pennsylvania',
      filingNumberPattern: /^(?:\d{8,12}|\d{4}-\d{6,8})$/i,
      filingNumberExample: '2024-123456',
      standardLapseYears: 5,
      hasTransmittingUtilityExemption: true
    })

    // Ohio (OH)
    this.registerRule({
      state: 'OH',
      name: 'Ohio',
      filingNumberPattern: /^(?:\d{7,12}|OH\d{8,10})$/i,
      filingNumberExample: '20241234567',
      standardLapseYears: 5,
      hasTransmittingUtilityExemption: true
    })

    // Georgia (GA)
    this.registerRule({
      state: 'GA',
      name: 'Georgia',
      filingNumberPattern: /^(?:\d{8,12}|\d{3}-\d{4}-\d{6})$/i,
      filingNumberExample: '2024-123456',
      standardLapseYears: 5,
      hasTransmittingUtilityExemption: true,
      disclosureLawEffectiveDate: '2024-01-01'
    })

    // North Carolina (NC)
    this.registerRule({
      state: 'NC',
      name: 'North Carolina',
      filingNumberPattern: /^(?:\d{8,12}|\d{4}-\d{6,8})$/i,
      filingNumberExample: '2024001234',
      standardLapseYears: 5,
      hasTransmittingUtilityExemption: true
    })

    // Michigan (MI)
    this.registerRule({
      state: 'MI',
      name: 'Michigan',
      filingNumberPattern: /^(?:\d{8,12}|MI-\d{6,10})$/i,
      filingNumberExample: '2024123456',
      standardLapseYears: 5,
      hasTransmittingUtilityExemption: true
    })

    // Universal Fallback (*)
    this.registerRule({
      state: '*',
      name: 'Universal US UCC Article 9 Rule',
      filingNumberPattern: /^[A-Z0-9-]{6,30}$/i,
      filingNumberExample: 'UCC-2024-123456',
      standardLapseYears: 5,
      hasTransmittingUtilityExemption: true
    })
  }

  /**
   * Register or override a state rule definition dynamically.
   */
  registerRule(rule: StateRuleConfig): void {
    this.rules.set(rule.state.toUpperCase(), rule)
  }

  /**
   * Retrieve the rule configuration for a given state, falling back to universal '*'.
   */
  getRule(stateCode: string): StateRuleConfig {
    const normalized = (stateCode || '').trim().toUpperCase()
    return this.rules.get(normalized) || this.rules.get('*')!
  }

  /**
   * Standardize and parse entity details including legal suffix normalization and DBA extraction.
   */
  normalizeEntityName(rawName: string): EntityNameDetails {
    if (!rawName || typeof rawName !== 'string') {
      return {
        raw: '',
        clean: '',
        legalName: 'UNKNOWN',
        isOrganization: false
      }
    }

    const trimmed = rawName.trim().replace(/\s{2,}/g, ' ')
    let clean = trimmed.replace(/[.,;:]$/, '').trim()

    // DBA / FKA extraction
    let dba: string | undefined
    let fka: string | undefined

    const dbaMatch = clean.match(
      /^(.*?)\s+(?:D\/?B\/?A|DOING\s+BUSINESS\s+AS|T\/?A|TRADING\s+AS)\s+(.*?)$/i
    )
    if (dbaMatch) {
      clean = dbaMatch[1].trim()
      dba = dbaMatch[2].trim()
    }

    const fkaMatch = clean.match(
      /^(.*?)\s+(?:F\/?K\/?A|FORMERLY\s+KNOWN\s+AS|A\/?K\/?A|ALSO\s+KNOWN\s+AS)\s+(.*?)$/i
    )
    if (fkaMatch) {
      clean = fkaMatch[1].trim()
      fka = fkaMatch[2].trim()
    }

    // Standardize corporate suffixes
    let entityType: EntityNameDetails['entityType'] = 'OTHER'
    let isOrganization = true

    if (/(?:\bL\.?L\.?C\.?|\bLIMITED\s+LIABILITY\s+CO(?:MPANY)?\b)/i.test(clean)) {
      clean = clean.replace(/(?:\bL\.?L\.?C\.?|\bLIMITED\s+LIABILITY\s+CO(?:MPANY)?\b)/i, 'LLC')
      entityType = 'LLC'
    } else if (
      /(?:\bP\.?L\.?L\.?C\.?|\bPROFESSIONAL\s+LIMITED\s+LIABILITY\s+CO(?:MPANY)?\b)/i.test(clean)
    ) {
      clean = clean.replace(
        /(?:\bP\.?L\.?L\.?C\.?|\bPROFESSIONAL\s+LIMITED\s+LIABILITY\s+CO(?:MPANY)?\b)/i,
        'PLLC'
      )
      entityType = 'PLLC'
    } else if (/(?:\bINCORPORATED\b|\bINC(?:\.|\b))/i.test(clean)) {
      clean = clean.replace(/(?:\bINCORPORATED\b|\bINC(?:\.|\b))/i, 'INC')
      entityType = 'INC'
    } else if (/(?:\bCORPORATION\b|\bCORP(?:\.|\b))/i.test(clean)) {
      clean = clean.replace(/(?:\bCORPORATION\b|\bCORP(?:\.|\b))/i, 'CORP')
      entityType = 'CORP'
    } else if (/(?:\bLIMITED\s+PARTNERSHIP\b|\bL\.?P\.?(?!\w))/i.test(clean)) {
      clean = clean.replace(/(?:\bLIMITED\s+PARTNERSHIP\b|\bL\.?P\.?(?!\w))/i, 'LP')
      entityType = 'LP'
    } else if (/(?:\bL\.?L\.?P\.?(?!\w))/i.test(clean)) {
      clean = clean.replace(/(?:\bL\.?L\.?P\.?(?!\w))/i, 'LLP')
      entityType = 'LLP'
    } else if (
      /(?:\bCOMPANY\b|\bCO(?:\.|\b))/i.test(clean) &&
      !/\b(?:LLC|INC|CORP)\b/i.test(clean)
    ) {
      clean = clean.replace(/(?:\bCOMPANY\b|\bCO(?:\.|\b))/i, 'CO')
      entityType = 'CO'
    } else if (
      !/(?:LLC|INC|CORP|CO|LP|BANK|CAPITAL|FUND|CREDIT|SERVICES|MANAGEMENT|GROUP)/i.test(clean)
    ) {
      // Likely an individual
      if (clean.includes(',')) {
        // "Smith, John A" -> "John A Smith"
        const parts = clean.split(',').map((p) => p.trim())
        if (parts.length === 2) {
          clean = `${parts[1]} ${parts[0]}`.trim()
        }
      }
      isOrganization = false
      entityType = 'INDIVIDUAL'
    }

    return {
      raw: rawName,
      clean: clean.toUpperCase(),
      legalName: clean.toUpperCase(),
      dba: dba ? dba.toUpperCase() : undefined,
      fka: fka ? fka.toUpperCase() : undefined,
      entityType,
      isOrganization
    }
  }

  /**
   * Normalize street address, state postal code, and zip.
   */
  normalizeAddress(
    addressStr?: string,
    defaultState?: string
  ): {
    street?: string
    city?: string
    state?: string
    postalCode?: string
    formatted: string
  } {
    if (!addressStr) {
      return {
        state: defaultState ? defaultState.toUpperCase() : undefined,
        formatted: defaultState ? defaultState.toUpperCase() : ''
      }
    }

    let cleaned = addressStr.trim().replace(/\s{2,}/g, ' ')

    // Normalize street suffixes
    cleaned = cleaned
      .replace(/\bSTREET\b/i, 'ST')
      .replace(/\bAVENUE\b/i, 'AVE')
      .replace(/\bBOULEVARD\b/i, 'BLVD')
      .replace(/\bROAD\b/i, 'RD')
      .replace(/\bLANE\b/i, 'LN')
      .replace(/\bDRIVE\b/i, 'DR')
      .replace(/\bHIGHWAY\b/i, 'HWY')
      .replace(/\bSUITE\b/i, 'STE')
      .replace(/\bFLOOR\b/i, 'FL')
      .replace(/\bAPARTMENT\b/i, 'APT')

    // Extract state and postal code
    const stateZipMatch = cleaned.match(/\b([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\b/)
    const state = stateZipMatch?.[1]?.toUpperCase() || defaultState?.toUpperCase()
    const postalCode = stateZipMatch?.[2]

    return {
      street: cleaned,
      state,
      postalCode,
      formatted: cleaned.toUpperCase()
    }
  }

  /**
   * Calculate exact UCC Article 9 lapse date based on filing date and state rules.
   */
  calculateExpirationDate(
    filingDate: string,
    stateCode: string,
    options: { isTransmittingUtility?: boolean; isPublicFinance?: boolean } = {}
  ): string | undefined {
    if (!filingDate) return undefined

    const rule = this.getRule(stateCode)

    // Transmitting utilities under Article 9-515(f) do not lapse until terminated
    if (options.isTransmittingUtility && rule.hasTransmittingUtilityExemption) {
      return undefined
    }

    let years = rule.standardLapseYears || 5
    if (options.isPublicFinance) {
      years = 30
    }

    const match = filingDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      const targetYear = parseInt(match[1], 10) + years
      const month = match[2]
      let day = match[3]
      if (month === '02' && day === '29') {
        const isLeap = (targetYear % 4 === 0 && targetYear % 100 !== 0) || targetYear % 400 === 0
        if (!isLeap) {
          day = '28'
        }
      }
      return `${targetYear}-${month}-${day}`
    }

    const d = new Date(filingDate)
    if (Number.isNaN(d.getTime())) return undefined

    d.setUTCFullYear(d.getUTCFullYear() + years)
    return d.toISOString().slice(0, 10)
  }

  /**
   * Analyze and normalize collateral descriptions.
   */
  analyzeCollateral(rawCollateral: string, stateCode?: string): CollateralAnalysis {
    const text = (rawCollateral || '').trim().replace(/\s{2,}/g, ' ')

    const isAllAssets =
      /all\s+(?:assets|personal\s+property)|blanket\s+lien|now\s+owned\s+or\s+hereafter\s+acquired/i.test(
        text
      )
    const hasFutureReceivables =
      /future\s+receivables|future\s+sales|sales\s+proceeds|merchant\s+cash\s+advance|card\s+receivables|electronic\s+payment\s+rights|factoring/i.test(
        text
      )
    const hasEquipment = /equipment|machinery|vehicles|chattel/i.test(text)
    const hasInventory = /inventory|goods|raw\s+materials/i.test(text)
    const hasAccounts = /accounts|accounts\s+receivable|general\s+intangibles/i.test(text)
    const hasChattelPaper = /chattel\s+paper|instruments|investment\s+property/i.test(text)

    const categories: string[] = []
    if (isAllAssets) categories.push('all-assets')
    if (hasFutureReceivables) categories.push('future-receivables')
    if (hasAccounts) categories.push('accounts')
    if (hasEquipment) categories.push('equipment')
    if (hasInventory) categories.push('inventory')
    if (hasChattelPaper) categories.push('chattel-paper')

    const disclosureRequiredStates: string[] = []
    if (hasFutureReceivables) {
      // States requiring commercial financing disclosure (e.g. CA, NY, GA, UT)
      if (['CA', 'NY', 'GA', 'UT', 'VA', 'FL'].includes(stateCode?.toUpperCase() || '')) {
        disclosureRequiredStates.push(stateCode!.toUpperCase())
      }
    }

    return {
      normalizedDescription:
        text || (isAllAssets ? 'ALL ASSETS OF THE DEBTOR.' : 'COMMERCIAL COLLATERAL.'),
      isAllAssets,
      hasFutureReceivables,
      hasEquipment,
      hasInventory,
      hasAccounts,
      hasChattelPaper,
      categories,
      disclosureRequiredStates
    }
  }

  /**
   * Validate filing against state-specific rules.
   */
  validate(filing: Partial<CollectedUCCFiling>, stateCode?: string): RuleValidationResult {
    const state = (filing.state || stateCode || 'US').trim().toUpperCase()
    const rule = this.getRule(state)
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // 1. Filing number validation
    if (!filing.filingNumber) {
      errors.push({
        field: 'filingNumber',
        code: 'REQUIRED_FIELD_MISSING',
        message: 'Filing number is required.',
        severity: 'error'
      })
    } else {
      const normalizedNumber = rule.normalizeFilingNumber
        ? rule.normalizeFilingNumber(filing.filingNumber)
        : filing.filingNumber.trim()

      if (!rule.filingNumberPattern.test(normalizedNumber)) {
        warnings.push({
          field: 'filingNumber',
          code: 'NON_STANDARD_FORMAT',
          message: `Filing number "${filing.filingNumber}" does not match standard ${rule.name} format (e.g. ${rule.filingNumberExample}).`
        })
      }
    }

    // 2. Filing date validation
    if (!filing.filingDate) {
      errors.push({
        field: 'filingDate',
        code: 'REQUIRED_FIELD_MISSING',
        message: 'Filing date is required.',
        severity: 'error'
      })
    } else {
      const filingDate = new Date(filing.filingDate)
      if (Number.isNaN(filingDate.getTime())) {
        errors.push({
          field: 'filingDate',
          code: 'INVALID_DATE',
          message: `Filing date "${filing.filingDate}" is not a valid date.`,
          severity: 'error'
        })
      } else {
        const now = new Date()
        if (filingDate > now) {
          warnings.push({
            field: 'filingDate',
            code: 'FUTURE_DATE',
            message: `Filing date "${filing.filingDate}" is in the future.`
          })
        }
      }
    }

    // 3. Debtor validation
    if (!filing.debtor || !filing.debtor.name || filing.debtor.name.trim().length === 0) {
      errors.push({
        field: 'debtor.name',
        code: 'REQUIRED_FIELD_MISSING',
        message: 'Debtor name is required.',
        severity: 'error'
      })
    } else if (filing.debtor.name.length < 2) {
      warnings.push({
        field: 'debtor.name',
        code: 'SUSPICIOUSLY_SHORT',
        message: `Debtor name "${filing.debtor.name}" is unusually short.`
      })
    }

    // 4. Secured Party validation
    if (
      !filing.securedParty ||
      !filing.securedParty.name ||
      filing.securedParty.name.trim().length === 0
    ) {
      errors.push({
        field: 'securedParty.name',
        code: 'REQUIRED_FIELD_MISSING',
        message: 'Secured party name is required.',
        severity: 'error'
      })
    }

    // 5. Collateral validation
    if (!filing.collateral || filing.collateral.trim().length === 0) {
      warnings.push({
        field: 'collateral',
        code: 'EMPTY_COLLATERAL',
        message: 'Collateral description is empty.'
      })
    }

    // 6. Custom state validator
    if (rule.customValidator) {
      const customResult = rule.customValidator(filing)
      if (customResult.errors) errors.push(...customResult.errors)
      if (customResult.warnings) warnings.push(...customResult.warnings)
    }

    return {
      valid: errors.length === 0,
      state,
      errors,
      warnings
    }
  }

  /**
   * Apply all state-specific normalizations and validations to a filing.
   */
  process(filing: CollectedUCCFiling, stateCode?: string): ProcessedFilingResult {
    const state = (filing.state || stateCode || 'US').trim().toUpperCase()
    const rule = this.getRule(state)

    // Normalize filing number
    const normalizedFilingNumber = rule.normalizeFilingNumber
      ? rule.normalizeFilingNumber(filing.filingNumber)
      : filing.filingNumber.trim()

    // Normalize entities
    const debtorDetails = this.normalizeEntityName(filing.debtor.name)
    const securedDetails = this.normalizeEntityName(filing.securedParty.name)

    // Normalize addresses
    const debtorAddress = this.normalizeAddress(filing.debtor.address, state)
    const securedAddress = this.normalizeAddress(filing.securedParty.address)

    // Analyze and normalize collateral
    const collateralAnalysis = this.analyzeCollateral(filing.collateral, state)

    // Calculate/verify expiration date
    const expirationDate =
      filing.expirationDate ||
      this.calculateExpirationDate(filing.filingDate, state, {
        isTransmittingUtility: /transmitting\s+utility/i.test(filing.collateral || '')
      })

    const normalizedDebtor: CollectedParty = {
      name: debtorDetails.clean,
      address: debtorAddress.formatted || undefined,
      organizationType: debtorDetails.isOrganization ? 'corporation' : 'individual'
    }

    const normalizedSecuredParty: CollectedParty = {
      name: securedDetails.clean,
      address: securedAddress.formatted || undefined,
      organizationType: securedDetails.isOrganization ? 'corporation' : 'individual'
    }

    const normalizedFiling: CollectedUCCFiling = {
      ...filing,
      filingNumber: normalizedFilingNumber,
      state,
      debtor: normalizedDebtor,
      securedParty: normalizedSecuredParty,
      collateral: collateralAnalysis.normalizedDescription,
      expirationDate,
      rawData: {
        ...filing.rawData,
        stateRuleApplied: state,
        entityDetails: {
          debtorType: debtorDetails.entityType,
          debtorDba: debtorDetails.dba,
          securedPartyType: securedDetails.entityType
        },
        collateralCategories: collateralAnalysis.categories,
        disclosureRequiredStates: collateralAnalysis.disclosureRequiredStates
      }
    }

    const validation = this.validate(normalizedFiling, state)

    return {
      normalized: normalizedFiling,
      validation,
      entityDetails: {
        debtor: debtorDetails,
        securedParty: securedDetails
      },
      collateralAnalysis
    }
  }

  /**
   * Process a batch of filings.
   */
  processBatch(
    filings: CollectedUCCFiling[],
    stateCode?: string
  ): {
    filings: CollectedUCCFiling[]
    results: ProcessedFilingResult[]
    passedCount: number
    failedCount: number
    warningCount: number
  } {
    const results = filings.map((f) => this.process(f, stateCode))
    const passedCount = results.filter((r) => r.validation.valid).length
    const failedCount = results.length - passedCount
    const warningCount = results.reduce((acc, r) => acc + r.validation.warnings.length, 0)

    return {
      filings: results.map((r) => r.normalized),
      results,
      passedCount,
      failedCount,
      warningCount
    }
  }
}

export const stateRuleEngine = new StateRuleEngine()
