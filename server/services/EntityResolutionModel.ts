/**
 * EntityResolutionModel — deterministic weighted record-linkage scorer
 * for deduplicating and linking corporate entities and individuals across state filings.
 *
 * Applies fixed, reviewable weights to string distance metrics
 * (Jaro-Winkler, Levenshtein, token Jaccard, token containment, Soundex), contextual
 * identifiers (state, address, city, ZIP), and graph signals (shared secured parties,
 * shared principals/guarantors).
 *
 * Assigns an explicit `enrichment_confidence` score bounded in [0.00, 1.00] reflecting
 * the normalized score and evidence density of the match. The weights are not
 * represented as trained or empirically calibrated.
 *
 * @module server/services/EntityResolutionModel
 */

import {
  normalizeCompanyName,
  normalizePersonName,
  jaroWinklerSimilarity,
  levenshteinSimilarity,
  tokenJaccardSimilarity,
  tokenContainmentScore,
  soundex,
  canonicalizeFirstName
} from '@public-records/core/identity'

export interface CorporateRecordInput {
  id?: string
  name: string
  state?: string
  address?: string
  city?: string
  zipCode?: string
  securedParty?: string
  securedParties?: string[]
  principals?: string[]
  filingDate?: string | Date
}

export interface IndividualRecordInput {
  id?: string
  fullName: string
  firstName?: string
  middleName?: string
  lastName?: string
  suffix?: string
  state?: string
  address?: string
  city?: string
  zipCode?: string
  associatedBusiness?: string
  associatedBusinesses?: string[]
  filingIds?: string[]
}

export interface CorporateComparisonFeatures {
  nameJaroWinkler: number
  nameLevenshtein: number
  nameTokenJaccard: number
  nameTokenContainment: number
  exactNormalizedMatch: number
  nameSoundexMatch: number
  stateMatch: number
  addressSimilarity: number
  cityMatch: number
  zipMatch: number
  securedPartyMatch: number
  principalOverlap: number
  filingDateProximity: number
}

export interface IndividualComparisonFeatures {
  lastNameSimilarity: number
  lastNameSoundex: number
  firstNameSimilarity: number
  nicknameMatch: number
  middleMatch: number
  associatedBusinessSimilarity: number
  stateMatch: number
  addressSimilarity: number
}

export interface ModelPrediction {
  /** Legacy field containing the logistic transform of the fixed weighted score. */
  probability: number
  /** Probability scaled to [0, 100]. */
  score: number
  /**
   * Bounded enrichment confidence in [0.00, 1.00], incorporating the weighted score,
   * multi-signal corroboration, and cross-state linkage density.
   */
  enrichment_confidence: number
  /** Whether the match exceeds the configured deterministic linking threshold. */
  isMatch: boolean
  /** Whether the match falls in the ambiguous band requiring human/clerical review. */
  needsReview: boolean
  /** Human-readable rationale summarizing the decisive signals. */
  explanation: string
  /** Feature contribution vector for auditable transparency. */
  featureContributions: Record<string, number>
}

export interface EntityResolutionWeights {
  intercept: number
  weights: Record<string, number>
}

// Default fixed weights for corporate entity resolution
const DEFAULT_CORPORATE_WEIGHTS: EntityResolutionWeights = {
  intercept: -3.4,
  weights: {
    exactNormalizedMatch: 4.5,
    nameTokenContainment: 2.2,
    nameJaroWinkler: 2.6,
    nameTokenJaccard: 1.8,
    nameLevenshtein: 1.2,
    nameSoundexMatch: 0.8,
    securedPartyMatch: 2.5, // Strong MCA signal: same lender on filings
    principalOverlap: 3.0, // Strong signal: matching owner/guarantor
    stateMatch: 0.4,
    addressSimilarity: 2.0,
    cityMatch: 0.9,
    zipMatch: 1.4,
    filingDateProximity: 0.6
  }
}

// Default fixed weights for individual entity resolution
const DEFAULT_INDIVIDUAL_WEIGHTS: EntityResolutionWeights = {
  intercept: -3.6,
  weights: {
    lastNameSimilarity: 3.6,
    lastNameSoundex: 1.4,
    firstNameSimilarity: 2.6,
    nicknameMatch: 1.8,
    middleMatch: 1.0,
    associatedBusinessSimilarity: 3.2, // Strong signal: same affiliated company
    stateMatch: 0.5,
    addressSimilarity: 2.2
  }
}

export class EntityResolutionModel {
  private corporateWeights: EntityResolutionWeights
  private individualWeights: EntityResolutionWeights
  readonly matchThreshold: number
  readonly reviewThreshold: number

  constructor(options?: {
    corporateWeights?: EntityResolutionWeights
    individualWeights?: EntityResolutionWeights
    matchThreshold?: number
    reviewThreshold?: number
  }) {
    this.corporateWeights = options?.corporateWeights ?? DEFAULT_CORPORATE_WEIGHTS
    this.individualWeights = options?.individualWeights ?? DEFAULT_INDIVIDUAL_WEIGHTS
    this.matchThreshold = options?.matchThreshold ?? 0.78
    this.reviewThreshold = options?.reviewThreshold ?? 0.52
  }

  static sigmoid(z: number): number {
    if (z >= 0) {
      const e = Math.exp(-z)
      return 1 / (1 + e)
    }
    const e = Math.exp(z)
    return e / (1 + e)
  }

  /**
   * Extract pairwise features comparing two corporate entity records.
   */
  extractCorporateFeatures(
    e1: CorporateRecordInput,
    e2: CorporateRecordInput
  ): CorporateComparisonFeatures {
    const norm1 = normalizeCompanyName(e1.name)
    const norm2 = normalizeCompanyName(e2.name)

    const exactNormalizedMatch = norm1.length > 0 && norm1 === norm2 ? 1 : 0
    const nameJaroWinkler = jaroWinklerSimilarity(norm1, norm2)
    const nameLevenshtein = levenshteinSimilarity(norm1, norm2)
    const nameTokenJaccard = tokenJaccardSimilarity(norm1, norm2)
    const nameTokenContainment = tokenContainmentScore(norm1, norm2)

    const soundex1 = soundex(norm1)
    const soundex2 = soundex(norm2)
    const nameSoundexMatch = soundex1 === soundex2 ? 1 : 0

    const stateMatch =
      e1.state && e2.state && e1.state.toUpperCase() === e2.state.toUpperCase() ? 1 : 0

    const addr1 = e1.address ? e1.address.trim().toLowerCase() : ''
    const addr2 = e2.address ? e2.address.trim().toLowerCase() : ''
    const addressSimilarity =
      addr1 && addr2
        ? Math.max(jaroWinklerSimilarity(addr1, addr2), tokenJaccardSimilarity(addr1, addr2))
        : 0

    const city1 = e1.city ? e1.city.trim().toLowerCase() : ''
    const city2 = e2.city ? e2.city.trim().toLowerCase() : ''
    const cityMatch = city1 && city2 && city1 === city2 ? 1 : 0

    const zip1 = e1.zipCode ? e1.zipCode.trim().slice(0, 5) : ''
    const zip2 = e2.zipCode ? e2.zipCode.trim().slice(0, 5) : ''
    const zipMatch = zip1 && zip2 && zip1 === zip2 ? 1 : 0

    // Secured party overlap
    const parties1 = new Set<string>()
    if (e1.securedParty) parties1.add(normalizeCompanyName(e1.securedParty))
    if (e1.securedParties) {
      e1.securedParties.forEach((p) => parties1.add(normalizeCompanyName(p)))
    }

    const parties2 = new Set<string>()
    if (e2.securedParty) parties2.add(normalizeCompanyName(e2.securedParty))
    if (e2.securedParties) {
      e2.securedParties.forEach((p) => parties2.add(normalizeCompanyName(p)))
    }

    let securedPartyMatch = 0
    if (parties1.size > 0 && parties2.size > 0) {
      for (const p1 of parties1) {
        if (!p1) continue
        for (const p2 of parties2) {
          if (!p2) continue
          if (p1 === p2 || jaroWinklerSimilarity(p1, p2) > 0.85) {
            securedPartyMatch = 1
            break
          }
        }
        if (securedPartyMatch === 1) break
      }
    }

    // Principal overlap
    const principals1 = (e1.principals || []).map((p) => normalizePersonName(p))
    const principals2 = (e2.principals || []).map((p) => normalizePersonName(p))
    let principalOverlap = 0
    if (principals1.length > 0 && principals2.length > 0) {
      let maxPrincipalSim = 0
      for (const p1 of principals1) {
        for (const p2 of principals2) {
          if (p1.lastName && p2.lastName && p1.lastName === p2.lastName) {
            const firstSim = jaroWinklerSimilarity(p1.canonicalFirstName, p2.canonicalFirstName)
            maxPrincipalSim = Math.max(maxPrincipalSim, firstSim)
          }
        }
      }
      principalOverlap = maxPrincipalSim
    }

    // Filing date proximity
    let filingDateProximity = 0
    if (e1.filingDate && e2.filingDate) {
      const d1 = new Date(e1.filingDate).getTime()
      const d2 = new Date(e2.filingDate).getTime()
      if (!isNaN(d1) && !isNaN(d2)) {
        const daysDiff = Math.abs(d1 - d2) / (1000 * 60 * 60 * 24)
        filingDateProximity = Math.max(0, Math.exp(-daysDiff / 730)) // decay over 2 years
      }
    }

    return {
      nameJaroWinkler,
      nameLevenshtein,
      nameTokenJaccard,
      nameTokenContainment,
      exactNormalizedMatch,
      nameSoundexMatch,
      stateMatch,
      addressSimilarity,
      cityMatch,
      zipMatch,
      securedPartyMatch,
      principalOverlap,
      filingDateProximity
    }
  }

  /**
   * Extract pairwise features comparing two individual entity records.
   */
  extractIndividualFeatures(
    i1: IndividualRecordInput,
    i2: IndividualRecordInput
  ): IndividualComparisonFeatures {
    const p1 = normalizePersonName(i1.fullName)
    const p2 = normalizePersonName(i2.fullName)

    const lastNameSimilarity = jaroWinklerSimilarity(p1.lastName, p2.lastName)
    const lastNameSoundex =
      p1.lastName && p2.lastName && soundex(p1.lastName) === soundex(p2.lastName) ? 1 : 0

    // Compare first names with nickname expansion
    const first1 = p1.canonicalFirstName || canonicalizeFirstName(i1.firstName || '')
    const first2 = p2.canonicalFirstName || canonicalizeFirstName(i2.firstName || '')
    const firstNameSimilarity = jaroWinklerSimilarity(first1, first2)

    const origFirst1 = (p1.firstName || i1.firstName || '').toLowerCase()
    const origFirst2 = (p2.firstName || i2.firstName || '').toLowerCase()
    const nicknameMatch =
      origFirst1 !== origFirst2 && first1.length > 0 && first1 === first2 ? 1 : 0

    // Middle name/initial match
    let middleMatch = 0.5 // Default neutral if not present
    if (p1.middleName && p2.middleName) {
      if (p1.middleName === p2.middleName) {
        middleMatch = 1.0
      } else if (p1.middleName[0] === p2.middleName[0]) {
        middleMatch = 0.85
      } else {
        middleMatch = 0.0 // Contradiction
      }
    }

    // Associated business similarity
    const businesses1 = new Set<string>()
    if (i1.associatedBusiness) businesses1.add(normalizeCompanyName(i1.associatedBusiness))
    if (i1.associatedBusinesses) {
      i1.associatedBusinesses.forEach((b) => businesses1.add(normalizeCompanyName(b)))
    }

    const businesses2 = new Set<string>()
    if (i2.associatedBusiness) businesses2.add(normalizeCompanyName(i2.associatedBusiness))
    if (i2.associatedBusinesses) {
      i2.associatedBusinesses.forEach((b) => businesses2.add(normalizeCompanyName(b)))
    }

    let associatedBusinessSimilarity = 0
    if (businesses1.size > 0 && businesses2.size > 0) {
      for (const b1 of businesses1) {
        if (!b1) continue
        for (const b2 of businesses2) {
          if (!b2) continue
          const sim = Math.max(jaroWinklerSimilarity(b1, b2), tokenContainmentScore(b1, b2))
          associatedBusinessSimilarity = Math.max(associatedBusinessSimilarity, sim)
        }
      }
    }

    const stateMatch =
      i1.state && i2.state && i1.state.toUpperCase() === i2.state.toUpperCase() ? 1 : 0

    const addr1 = i1.address ? i1.address.trim().toLowerCase() : ''
    const addr2 = i2.address ? i2.address.trim().toLowerCase() : ''
    const addressSimilarity =
      addr1 && addr2
        ? Math.max(jaroWinklerSimilarity(addr1, addr2), tokenJaccardSimilarity(addr1, addr2))
        : 0

    return {
      lastNameSimilarity,
      lastNameSoundex,
      firstNameSimilarity,
      nicknameMatch,
      middleMatch,
      associatedBusinessSimilarity,
      stateMatch,
      addressSimilarity
    }
  }

  /**
   * Score a corporate entity comparison.
   */
  predictCorporateMatch(
    features: CorporateComparisonFeatures,
    options?: { isCrossState?: boolean }
  ): ModelPrediction {
    let z = this.corporateWeights.intercept
    const featureContributions: Record<string, number> = {}

    for (const [key, weight] of Object.entries(this.corporateWeights.weights)) {
      const val = (features as unknown as Record<string, number>)[key] ?? 0
      const contribution = weight * val
      z += contribution
      featureContributions[key] = Number(contribution.toFixed(3))
    }

    const probability = EntityResolutionModel.sigmoid(z)
    const score = Math.round(probability * 100)

    // Compute evidence density: how many corroborating signals agree
    let evidenceCount = 0
    if (features.exactNormalizedMatch === 1) evidenceCount += 2
    if (features.nameTokenContainment >= 0.8) evidenceCount += 1
    if (features.securedPartyMatch === 1) evidenceCount += 2 // Cross-filing lender link
    if (features.principalOverlap >= 0.8) evidenceCount += 2 // Cross-filing officer link
    if (
      features.addressSimilarity >= 0.7 ||
      (features.cityMatch === 1 && features.zipMatch === 1)
    ) {
      evidenceCount += 2
    }
    if (features.nameJaroWinkler >= 0.9) evidenceCount += 1

    // Cross-state corroboration bonus:
    // If entities are in different states but match on exact name + secured party or principal,
    // this is a high-value multi-state nexus!
    const isCrossState = options?.isCrossState ?? features.stateMatch === 0
    let crossStateBonus = 0
    if (isCrossState && (features.securedPartyMatch === 1 || features.principalOverlap >= 0.8)) {
      crossStateBonus = 0.08
    }

    // Contradiction penalty: different state AND low name similarity
    let penalty = 0
    if (features.exactNormalizedMatch === 0 && features.nameJaroWinkler < 0.75) {
      penalty += 0.15
    }

    // Deterministic enrichment confidence bounded [0.00, 1.00]
    const rawConfidence =
      probability * 0.85 + (evidenceCount / 10) * 0.15 + crossStateBonus - penalty
    const enrichment_confidence = Number(Math.max(0.0, Math.min(1.0, rawConfidence)).toFixed(2))

    const isMatch = probability >= this.matchThreshold || enrichment_confidence >= 0.8
    const needsReview =
      !isMatch && (probability >= this.reviewThreshold || enrichment_confidence >= 0.55)

    // Construct auditable explanation
    const reasons: string[] = []
    if (features.exactNormalizedMatch === 1) reasons.push('Exact normalized company name match')
    else if (features.nameJaroWinkler >= 0.85)
      reasons.push(`High name similarity (${(features.nameJaroWinkler * 100).toFixed(0)}%)`)
    else if (features.nameTokenContainment >= 0.8)
      reasons.push('Substantial token containment / DBA overlap')

    if (features.securedPartyMatch === 1) reasons.push('Shared secured party / MCA funder')
    if (features.principalOverlap >= 0.8) reasons.push('Shared individual principal/guarantor')
    if (features.addressSimilarity >= 0.7) reasons.push('Matching street address')
    if (features.stateMatch === 1) reasons.push('Same filing state')
    else if (
      isCrossState &&
      (features.securedPartyMatch === 1 || features.principalOverlap >= 0.8)
    ) {
      reasons.push('Linked cross-state entity footprint')
    }

    const explanation =
      reasons.length > 0 ? reasons.join('; ') : 'Insufficient matching features for entity linkage'

    return {
      probability: Number(probability.toFixed(4)),
      score,
      enrichment_confidence,
      isMatch,
      needsReview,
      explanation,
      featureContributions
    }
  }

  /**
   * Score an individual entity comparison.
   */
  predictIndividualMatch(
    features: IndividualComparisonFeatures,
    options?: { isCrossState?: boolean }
  ): ModelPrediction {
    let z = this.individualWeights.intercept
    const featureContributions: Record<string, number> = {}

    for (const [key, weight] of Object.entries(this.individualWeights.weights)) {
      const val = (features as unknown as Record<string, number>)[key] ?? 0
      const contribution = weight * val
      z += contribution
      featureContributions[key] = Number(contribution.toFixed(3))
    }

    // Explicit contradiction penalty (e.g. John A. Smith vs John Z. Smith)
    if (features.middleMatch === 0.0) {
      z -= 3.5
      featureContributions['middleContradiction'] = -3.5
    }

    const probability = EntityResolutionModel.sigmoid(z)
    const score = Math.round(probability * 100)

    let evidenceCount = 0
    if (features.lastNameSimilarity >= 0.95) evidenceCount += 2
    if (features.firstNameSimilarity >= 0.9 || features.nicknameMatch === 1) evidenceCount += 2
    if (features.middleMatch === 1.0) evidenceCount += 1
    if (features.associatedBusinessSimilarity >= 0.8) evidenceCount += 3 // Crucial anchor
    if (features.addressSimilarity >= 0.7) evidenceCount += 2

    const penalty = features.middleMatch === 0.0 ? 0.4 : 0
    const rawConfidence = probability * 0.85 + (evidenceCount / 10) * 0.15 - penalty
    const enrichment_confidence = Number(Math.max(0.0, Math.min(1.0, rawConfidence)).toFixed(2))

    const isMatch =
      features.middleMatch !== 0.0 &&
      (probability >= this.matchThreshold || enrichment_confidence >= 0.8)
    const needsReview =
      !isMatch && (probability >= this.reviewThreshold || enrichment_confidence >= 0.55)

    const reasons: string[] = []
    const isCrossState = options?.isCrossState ?? features.stateMatch === 0
    if (features.lastNameSimilarity >= 0.95) reasons.push('Matching surname')
    if (features.nicknameMatch === 1)
      reasons.push('Matching first name via recognized nickname alias')
    else if (features.firstNameSimilarity >= 0.9) reasons.push('Matching first name')

    if (features.associatedBusinessSimilarity >= 0.8)
      reasons.push('Co-affiliated with identical/related business')
    if (features.addressSimilarity >= 0.7) reasons.push('Matching address')
    if (features.stateMatch === 1) reasons.push('Same state')
    else if (isCrossState && features.associatedBusinessSimilarity >= 0.8) {
      reasons.push('Linked cross-state individual debtor')
    }

    const explanation =
      reasons.length > 0
        ? reasons.join('; ')
        : 'Insufficient matching features for individual linkage'

    return {
      probability: Number(probability.toFixed(4)),
      score,
      enrichment_confidence,
      isMatch,
      needsReview,
      explanation,
      featureContributions
    }
  }

  /**
   * Export model parameters for serialization/persistence.
   */
  exportWeights(): {
    corporateWeights: EntityResolutionWeights
    individualWeights: EntityResolutionWeights
    modelVersion: string
  } {
    return {
      corporateWeights: this.corporateWeights,
      individualWeights: this.individualWeights,
      modelVersion: '1.0.0-fixed-weights'
    }
  }
}
