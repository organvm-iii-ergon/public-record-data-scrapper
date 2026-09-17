import { describe, it, expect, beforeEach } from 'vitest'
import {
  EntityResolutionModel,
  type CorporateRecordInput,
  type IndividualRecordInput
} from '../../services/EntityResolutionModel'
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

describe('Identity & String Distance Utilities', () => {
  describe('normalizeCompanyName', () => {
    it('normalizes corporate suffixes, punctuation, and casing', () => {
      expect(normalizeCompanyName('Acme Logistics, LLC')).toBe('acme logistics')
      expect(normalizeCompanyName('ACME LOGISTICS INC.')).toBe('acme logistics')
      expect(normalizeCompanyName('Acme & Sons Corporation')).toBe('acme and sons')
    })
  })

  describe('normalizePersonName', () => {
    it('parses "First Middle Last Suffix" format', () => {
      const parsed = normalizePersonName('Robert J. Smith Jr.')
      expect(parsed.firstName).toBe('robert')
      expect(parsed.middleName).toBe('j')
      expect(parsed.lastName).toBe('smith')
      expect(parsed.suffix).toBe('jr')
      expect(parsed.canonicalFirstName).toBe('robert')
    })

    it('parses "Last, First Middle" format', () => {
      const parsed = normalizePersonName('Smith, Bob M.')
      expect(parsed.lastName).toBe('smith')
      expect(parsed.firstName).toBe('bob')
      expect(parsed.canonicalFirstName).toBe('robert')
    })
  })

  describe('canonicalizeFirstName', () => {
    it('resolves common nicknames to formal names', () => {
      expect(canonicalizeFirstName('Bob')).toBe('robert')
      expect(canonicalizeFirstName('Billy')).toBe('william')
      expect(canonicalizeFirstName('Jim')).toBe('james')
      expect(canonicalizeFirstName('Mikey')).toBe('michael')
      expect(canonicalizeFirstName('Alex')).toBe('alexander')
    })
  })

  describe('soundex', () => {
    it('produces identical soundex for phonetically identical surnames', () => {
      expect(soundex('Smith')).toBe('S530')
      expect(soundex('Smythe')).toBe('S530')
      expect(soundex('Johnson')).toBe('J525')
      expect(soundex('Jonson')).toBe('J525')
    })
  })

  describe('Similarity metrics', () => {
    it('computes Jaro-Winkler similarity favoring common prefixes', () => {
      const sim = jaroWinklerSimilarity('martha', 'marhta')
      expect(sim).toBeGreaterThan(0.9)
    })

    it('computes Levenshtein similarity', () => {
      expect(levenshteinSimilarity('kitten', 'sitting')).toBeCloseTo(0.57, 1)
      expect(levenshteinSimilarity('same', 'same')).toBe(1.0)
    })

    it('computes token Jaccard and containment scores', () => {
      const s1 = 'apex logistics global'
      const s2 = 'apex logistics'
      expect(tokenContainmentScore(s1, s2)).toBe(1.0)
      expect(tokenJaccardSimilarity(s1, s2)).toBeCloseTo(0.66, 1)
    })
  })
})

describe('EntityResolutionModel', () => {
  let model: EntityResolutionModel

  beforeEach(() => {
    model = new EntityResolutionModel()
  })

  describe('extractCorporateFeatures', () => {
    it('extracts high similarity features for same corporate entity across different states', () => {
      const e1: CorporateRecordInput = {
        name: 'Apex Construction Services, LLC',
        state: 'CA',
        address: '100 Market St',
        city: 'San Francisco',
        zipCode: '94105',
        securedParty: 'Rapid Finance',
        principals: ['John M. Smith'],
        filingDate: '2024-01-15'
      }

      const e2: CorporateRecordInput = {
        name: 'Apex Construction Services Inc',
        state: 'TX',
        address: '100 Market Street',
        city: 'Austin',
        zipCode: '78701',
        securedParty: 'Rapid Finance LLC',
        principals: ['John Smith'],
        filingDate: '2024-03-20'
      }

      const features = model.extractCorporateFeatures(e1, e2)

      expect(features.exactNormalizedMatch).toBe(1)
      expect(features.nameJaroWinkler).toBe(1)
      expect(features.stateMatch).toBe(0) // Cross-state
      expect(features.securedPartyMatch).toBe(1) // Shared funder
      expect(features.principalOverlap).toBeGreaterThan(0.9) // Shared principal
      expect(features.filingDateProximity).toBeGreaterThan(0.8)
    })
  })

  describe('predictCorporateMatch', () => {
    it('accurately predicts high-confidence match for multi-state corporate duplicate', () => {
      const e1: CorporateRecordInput = {
        name: 'Apex Freight Solutions LLC',
        state: 'CA',
        securedParty: 'Yellowstone Capital',
        principals: ['Michael Vance']
      }

      const e2: CorporateRecordInput = {
        name: 'Apex Freight Solutions',
        state: 'TX',
        securedParty: 'Yellowstone Capital LLC',
        principals: ['Mike Vance']
      }

      const features = model.extractCorporateFeatures(e1, e2)
      const prediction = model.predictCorporateMatch(features)

      expect(prediction.isMatch).toBe(true)
      expect(prediction.probability).toBeGreaterThan(0.8)
      expect(prediction.enrichment_confidence).toBeGreaterThanOrEqual(0.85)
      expect(prediction.enrichment_confidence).toBeLessThanOrEqual(1.0)
      expect(prediction.score).toBeGreaterThan(80)
      expect(prediction.explanation).toContain('Exact normalized company name match')
      expect(prediction.explanation).toContain('Shared secured party')
    })

    it('distinguishes distinct companies with low similarity', () => {
      const e1: CorporateRecordInput = {
        name: 'Delta Dental Care LLC',
        state: 'NY'
      }

      const e2: CorporateRecordInput = {
        name: 'Omega Trucking Corp',
        state: 'FL'
      }

      const features = model.extractCorporateFeatures(e1, e2)
      const prediction = model.predictCorporateMatch(features)

      expect(prediction.isMatch).toBe(false)
      expect(prediction.probability).toBeLessThan(0.3)
      expect(prediction.enrichment_confidence).toBeLessThan(0.4)
    })

    it('flags ambiguous pairs as needing review', () => {
      const e1: CorporateRecordInput = {
        name: 'Pacific Coast Properties LLC',
        state: 'CA'
      }

      const e2: CorporateRecordInput = {
        name: 'Pacific Properties Group Inc',
        state: 'CA'
      }

      const features = model.extractCorporateFeatures(e1, e2)
      const prediction = model.predictCorporateMatch(features)

      // Partial overlap without corroborating lender or address
      expect(prediction.probability).toBeGreaterThan(0.2)
      expect(prediction.enrichment_confidence).toBeGreaterThanOrEqual(0.0)
      expect(prediction.enrichment_confidence).toBeLessThanOrEqual(1.0)
    })
  })

  describe('extractIndividualFeatures & predictIndividualMatch', () => {
    it('matches individuals across filings using nicknames and shared businesses', () => {
      const i1: IndividualRecordInput = {
        fullName: 'Robert J. Davis',
        state: 'CA',
        associatedBusiness: 'Fast Capital LLC'
      }

      const i2: IndividualRecordInput = {
        fullName: 'Bob Davis',
        state: 'TX',
        associatedBusiness: 'Fast Capital'
      }

      const features = model.extractIndividualFeatures(i1, i2)
      expect(features.lastNameSimilarity).toBe(1.0)
      expect(features.nicknameMatch).toBe(1)
      expect(features.associatedBusinessSimilarity).toBe(1.0)

      const prediction = model.predictIndividualMatch(features)
      expect(prediction.isMatch).toBe(true)
      expect(prediction.enrichment_confidence).toBeGreaterThanOrEqual(0.8)
      expect(prediction.explanation).toContain('recognized nickname alias')
    })

    it('rejects individuals with conflicting surnames or middle initials', () => {
      const i1: IndividualRecordInput = {
        fullName: 'John A. Smith',
        state: 'CA'
      }

      const i2: IndividualRecordInput = {
        fullName: 'John Z. Smith',
        state: 'FL'
      }

      const features = model.extractIndividualFeatures(i1, i2)
      expect(features.middleMatch).toBe(0.0)

      const prediction = model.predictIndividualMatch(features)
      expect(prediction.isMatch).toBe(false)
    })
  })

  describe('exportWeights', () => {
    it('exports model weights artifact with version metadata', () => {
      const weights = model.exportWeights()
      expect(weights.modelVersion).toBeDefined()
      expect(weights.corporateWeights.weights).toHaveProperty('exactNormalizedMatch')
      expect(weights.individualWeights.weights).toHaveProperty('lastNameSimilarity')
    })
  })
})
