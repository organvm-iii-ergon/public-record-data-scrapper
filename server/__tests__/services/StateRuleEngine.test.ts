import { describe, it, expect } from 'vitest'
import {
  StateRuleEngine,
  stateRuleEngine,
  type StateRuleConfig
} from '../../services/StateRuleEngine'
import type { UCCFiling as CollectedUCCFiling } from '../../../apps/web/src/lib/collectors/types'

describe('StateRuleEngine (#478)', () => {
  const engine = new StateRuleEngine()

  describe('Entity Name Normalization & DBA Extraction', () => {
    it('normalizes corporate suffixes and extracts DBAs', () => {
      const result = engine.normalizeEntityName('Apex Logistics L.L.C. d/b/a Speedy Freight')

      expect(result.clean).toBe('APEX LOGISTICS LLC')
      expect(result.legalName).toBe('APEX LOGISTICS LLC')
      expect(result.dba).toBe('SPEEDY FREIGHT')
      expect(result.entityType).toBe('LLC')
      expect(result.isOrganization).toBe(true)
    })

    it('normalizes INC and CORP suffixes and extracts FKA', () => {
      const result = engine.normalizeEntityName(
        'Summit Technologies Incorporated formerly known as Tech One Corp.'
      )

      expect(result.clean).toBe('SUMMIT TECHNOLOGIES INC')
      expect(result.fka).toBe('TECH ONE CORP')
      expect(result.entityType).toBe('INC')
      expect(result.isOrganization).toBe(true)
    })

    it('removes alias separator punctuation and matches PLLC before LLC', () => {
      const dba = engine.normalizeEntityName('Acme, Inc., d/b/a Foo')
      const pllc = engine.normalizeEntityName('Smith Professional Limited Liability Company')

      expect(dba.clean).toBe('ACME, INC')
      expect(dba.dba).toBe('FOO')
      expect(pllc.clean).toBe('SMITH PLLC')
      expect(pllc.entityType).toBe('PLLC')
    })

    it('normalizes individual names formatted as LastName, FirstName', () => {
      const result = engine.normalizeEntityName('Doe, Johnathan A')

      expect(result.clean).toBe('JOHNATHAN A DOE')
      expect(result.entityType).toBe('INDIVIDUAL')
      expect(result.isOrganization).toBe(false)
    })
  })

  describe('State-Specific Filing Number Normalization', () => {
    it('normalizes California 10-digit filing numbers to YY-XXXXXXXX format', () => {
      const rule = engine.getRule('CA')
      expect(rule.normalizeFilingNumber).toBeDefined()

      const normalized = rule.normalizeFilingNumber!('2400123456')
      expect(normalized).toBe('24-00123456')
      expect(rule.filingNumberPattern.test(normalized)).toBe(true)
    })

    it('cleans and validates Texas filing numbers', () => {
      const rule = engine.getRule('TX')
      expect(rule.normalizeFilingNumber).toBeDefined()

      const normalized = rule.normalizeFilingNumber!(' 2024-00123456 ')
      expect(normalized).toBe('2024-00123456')
      expect(rule.filingNumberPattern.test('202400123456')).toBe(true)
    })

    it('strips non-digits from Florida filing numbers', () => {
      const rule = engine.getRule('FL')
      expect(rule.normalizeFilingNumber).toBeDefined()

      const normalized = rule.normalizeFilingNumber!('FL-2024-12345678')
      expect(normalized).toBe('202412345678')
      expect(rule.filingNumberPattern.test(normalized)).toBe(true)
    })

    it('accepts the advertised Georgia filing-number format', () => {
      const result = engine.validate({
        filingNumber: '2024-123456',
        filingDate: '2024-01-15',
        state: 'GA',
        debtor: { name: 'DEBTOR LLC' },
        securedParty: { name: 'BANK CORP' },
        collateral: 'All assets'
      })

      expect(result.warnings.some((warning) => warning.code === 'NON_STANDARD_FORMAT')).toBe(false)
    })
  })

  describe('Statutory Lapse & Expiration Calculation', () => {
    it('calculates standard 5-year lapse date for UCC-1', () => {
      const expiration = engine.calculateExpirationDate('2024-05-15', 'CA')
      expect(expiration).toBe('2029-05-15')
    })

    it('exempts transmitting utilities from lapsing', () => {
      const expiration = engine.calculateExpirationDate('2024-05-15', 'TX', {
        isTransmittingUtility: true
      })
      expect(expiration).toBeUndefined()
    })

    it('applies 30-year duration for public finance transactions', () => {
      const expiration = engine.calculateExpirationDate('2024-05-15', 'NY', {
        isPublicFinance: true
      })
      expect(expiration).toBe('2054-05-15')
    })

    it('rejects calendar-invalid dates instead of fabricating lapse dates', () => {
      expect(engine.calculateExpirationDate('2024-02-31', 'CA')).toBeUndefined()
      const result = engine.validate({
        filingNumber: '24-00123456',
        filingDate: '2024-02-31',
        state: 'CA',
        debtor: { name: 'DEBTOR LLC' },
        securedParty: { name: 'BANK CORP' },
        collateral: 'All assets'
      })
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'filingDate', code: 'INVALID_DATE' })
      )
    })
  })

  describe('Collateral Analysis & Disclosure Tagging', () => {
    it('identifies MCA future receivables and flags states requiring commercial financing disclosures', () => {
      const analysis = engine.analyzeCollateral(
        'All accounts, future receivables, sales proceeds, and electronic payments.',
        'CA'
      )

      expect(analysis.hasFutureReceivables).toBe(true)
      expect(analysis.isAllAssets).toBe(false)
      expect(analysis.categories).toContain('future-receivables')
      expect(analysis.categories).toContain('accounts')
      expect(analysis.disclosureRequiredStates).toContain('CA')
    })

    it('identifies blanket all-assets liens with equipment and inventory', () => {
      const analysis = engine.analyzeCollateral(
        'All personal property now owned or hereafter acquired including inventory, goods, and machinery.'
      )

      expect(analysis.isAllAssets).toBe(true)
      expect(analysis.hasEquipment).toBe(true)
      expect(analysis.hasInventory).toBe(true)
      expect(analysis.categories).toContain('all-assets')
    })

    it('does not classify chattel paper as equipment', () => {
      const analysis = engine.analyzeCollateral('All chattel paper and instruments')
      expect(analysis.hasChattelPaper).toBe(true)
      expect(analysis.hasEquipment).toBe(false)
    })
  })

  describe('Filing Validation Rules', () => {
    it('validates a complete, compliant filing successfully', () => {
      const validFiling: CollectedUCCFiling = {
        filingNumber: '24-00123456',
        filingType: 'UCC-1',
        filingDate: '2024-02-10',
        state: 'CA',
        status: 'active',
        debtor: {
          name: 'BLUE HORIZON CORP',
          address: '100 OCEAN AVE, SAN FRANCISCO, CA 94102'
        },
        securedParty: {
          name: 'PACIFIC CAPITAL PARTNERS LLC',
          address: '500 MARKET ST, SAN FRANCISCO, CA 94105'
        },
        collateral: 'All inventory and equipment.'
      }

      const result = engine.validate(validFiling, 'CA')
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('flags missing required fields with errors', () => {
      const invalidFiling: Partial<CollectedUCCFiling> = {
        state: 'TX'
      }

      const result = engine.validate(invalidFiling, 'TX')
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'filingNumber')).toBe(true)
      expect(result.errors.some((e) => e.field === 'filingDate')).toBe(true)
      expect(result.errors.some((e) => e.field === 'debtor.name')).toBe(true)
      expect(result.errors.some((e) => e.field === 'securedParty.name')).toBe(true)
    })

    it('flags future filing dates with warnings', () => {
      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)

      const filing: Partial<CollectedUCCFiling> = {
        filingNumber: '202400123456',
        filingDate: futureDate.toISOString().slice(0, 10),
        state: 'TX',
        debtor: { name: 'TEST CORP' },
        securedParty: { name: 'TEST BANK' },
        collateral: 'All assets'
      }

      const result = engine.validate(filing, 'TX')
      expect(result.warnings.some((w) => w.code === 'FUTURE_DATE')).toBe(true)
    })
  })

  describe('Full Filing Processing & Batch Operations', () => {
    it('processes and normalizes raw filing end-to-end', () => {
      const rawFiling: CollectedUCCFiling = {
        filingNumber: '202412345678',
        filingType: 'UCC-1',
        filingDate: '2024-03-01',
        state: 'FL',
        status: 'active',
        debtor: {
          name: 'Sunshine State Bakeries L.L.C. dba Sunshine Pastries',
          address: {
            street: '123 Palm Way',
            city: 'Miami',
            state: 'FL',
            zipCode: '33101',
            country: 'US'
          }
        },
        securedParty: {
          name: 'First Florida Financial Corporation',
          address: { street: '456 Brickell Ave', city: 'Miami', state: 'FL', zipCode: '33131' }
        },
        collateral: 'All accounts, inventory, and equipment now owned or hereafter acquired.'
      }

      const processed = engine.process(rawFiling, 'FL')

      expect(processed.validation.valid).toBe(true)
      expect(processed.normalized.debtor.name).toBe('SUNSHINE STATE BAKERIES LLC')
      expect(processed.normalized.debtor.address).toEqual(rawFiling.debtor.address)
      expect(processed.normalized.debtor.organizationType).toBe('organization')
      expect(processed.normalized.securedParty.organizationType).toBe('organization')
      expect(processed.entityDetails.debtor.dba).toBe('SUNSHINE PASTRIES')
      expect(processed.normalized.securedParty.name).toBe('FIRST FLORIDA FINANCIAL CORP')
      expect(processed.normalized.expirationDate).toBe('2029-03-01')
      expect(processed.collateralAnalysis.isAllAssets).toBe(true)
      expect(processed.collateralAnalysis.hasEquipment).toBe(true)
    })

    it('processes batch of filings and provides summary counts', () => {
      const batch: CollectedUCCFiling[] = [
        {
          filingNumber: '2024-123456',
          filingType: 'UCC-1',
          filingDate: '2024-01-15',
          state: 'NY',
          status: 'active',
          debtor: { name: 'ALPHA CORP' },
          securedParty: { name: 'BETA BANK' },
          collateral: 'All accounts'
        },
        {
          filingNumber: '', // Invalid
          filingType: 'UCC-1',
          filingDate: '2024-01-15',
          state: 'NY',
          status: 'active',
          debtor: { name: 'GAMMA LLC' },
          securedParty: { name: 'DELTA BANK' },
          collateral: 'All assets'
        }
      ]

      const batchResult = engine.processBatch(batch, 'NY')
      expect(batchResult.results).toHaveLength(2)
      expect(batchResult.passedCount).toBe(1)
      expect(batchResult.failedCount).toBe(1)
    })

    it('propagates public-finance status and preserves every extracted alias', () => {
      const result = engine.process({
        filingNumber: '2024-123456',
        filingType: 'UCC-1',
        filingDate: '2024-01-15',
        state: 'NY',
        status: 'active',
        debtor: { name: 'Acme LLC formerly known as Oldco' },
        securedParty: { name: 'Capital Corp d/b/a Funding Co' },
        collateral: 'Public finance transaction',
        collateralType: 'public-finance'
      })

      expect(result.normalized.expirationDate).toBe('2054-01-15')
      expect(result.normalized.rawData?.entityDetails).toEqual(
        expect.objectContaining({
          debtorFka: 'OLDCO',
          securedPartyDba: 'FUNDING CO'
        })
      )
    })

    it('does not fabricate a lapse date for terminated UCC-3 records', () => {
      const result = engine.process({
        filingNumber: 'NJ-12345678',
        filingType: 'UCC-3',
        filingDate: '2024-01-15',
        state: 'NJ',
        status: 'terminated',
        debtor: { name: 'DEBTOR LLC' },
        securedParty: { name: 'BANK CORP' },
        collateral: 'All assets'
      })

      expect(result.normalized.expirationDate).toBeUndefined()
    })
  })

  describe('Dynamic Custom Rule Registration', () => {
    it('allows registering a custom rule for a new state dynamically', () => {
      const customRule: StateRuleConfig = {
        state: 'WA',
        name: 'Washington',
        filingNumberPattern: /^WA-\d{8}$/i,
        filingNumberExample: 'WA-12345678',
        standardLapseYears: 5,
        hasTransmittingUtilityExemption: true,
        normalizeFilingNumber: (raw) => `WA-${raw.replace(/\D/g, '')}`
      }

      engine.registerRule(customRule)

      const rule = engine.getRule('WA')
      expect(rule.state).toBe('WA')
      expect(rule.normalizeFilingNumber!('12345678')).toBe('WA-12345678')
    })
  })

  describe('Singleton Instance', () => {
    it('exports stateRuleEngine singleton instance', () => {
      expect(stateRuleEngine).toBeInstanceOf(StateRuleEngine)
    })
  })

  describe('review regressions', () => {
    const filing: CollectedUCCFiling = {
      filingNumber: 'UCC-1234567890',
      filingType: 'UCC-1',
      filingDate: '2024-03-01',
      state: 'CA',
      status: 'active',
      debtor: { name: 'DEBTOR LLC' },
      securedParty: { name: 'BANK CORP' },
      collateral: ''
    }

    it('preserves prefixed California IDs and absent source collateral', () => {
      const result = engine.process(filing)
      expect(result.normalized.filingNumber).toBe(filing.filingNumber)
      expect(result.normalized.collateral).toBe('')
      expect(result.validation.warnings.some((w) => w.code === 'EMPTY_COLLATERAL')).toBe(true)
    })

    it('rejects whitespace-only identifiers', () => {
      const result = engine.validate({ ...filing, filingNumber: '   ' })
      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'filingNumber', code: 'REQUIRED_FIELD_MISSING' })
      )
    })

    it('does not alternate validation for a stateful custom regex', () => {
      const local = new StateRuleEngine()
      local.registerRule({
        ...local.getRule('CA'),
        state: 'WA',
        filingNumberPattern: /^WA-\d{8}$/g,
        normalizeFilingNumber: (raw) => raw
      })
      const input = { ...filing, state: 'WA', filingNumber: 'WA-12345678' }
      for (let i = 0; i < 3; i++) {
        expect(local.validate(input).warnings.some((w) => w.code === 'NON_STANDARD_FORMAT')).toBe(
          false
        )
      }
    })
  })
})
