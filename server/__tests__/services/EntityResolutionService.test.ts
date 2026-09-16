import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  EntityResolutionService,
  type FilingEntityInput
} from '../../services/EntityResolutionService'

// Mock database connection
vi.mock('../../database/connection', () => ({
  database: {
    query: vi.fn()
  }
}))

import { database } from '../../database/connection'
const mockQuery = vi.mocked(database.query)

describe('EntityResolutionService', () => {
  let service: EntityResolutionService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new EntityResolutionService()
  })

  describe('deduplicateFilings', () => {
    it('returns zero metrics for empty filing array', () => {
      const summary = service.deduplicateFilings([])
      expect(summary.totalFilingsProcessed).toBe(0)
      expect(summary.corporateClusters).toHaveLength(0)
      expect(summary.individualClusters).toHaveLength(0)
      expect(summary.crossStateEntities).toBe(0)
      expect(summary.deduplicationRatio).toBe(0)
    })

    it('deduplicates and links corporate filings across different state jurisdictions', () => {
      const filings: FilingEntityInput[] = [
        {
          id: 'filing-ca-1',
          filingDate: '2024-01-10',
          debtorName: 'Summit Hospitality Group, LLC',
          debtorAddress: '500 Grand Ave',
          debtorCity: 'Los Angeles',
          debtorZip: '90071',
          state: 'CA',
          securedParty: 'Apex Funding Corporation',
          principals: ['David Miller']
        },
        {
          id: 'filing-tx-1',
          filingDate: '2024-02-15',
          debtorName: 'Summit Hospitality Group',
          debtorAddress: '1200 Main St',
          debtorCity: 'Dallas',
          debtorZip: '75202',
          state: 'TX',
          securedParty: 'Apex Funding Corp',
          principals: ['Dave Miller']
        },
        {
          id: 'filing-fl-1',
          filingDate: '2024-04-01',
          debtorName: 'Summit Hospitality Group Inc.',
          state: 'FL',
          securedParty: 'Apex Funding Corporation',
          principals: ['David Miller']
        },
        {
          id: 'filing-ny-1',
          filingDate: '2024-03-05',
          debtorName: 'Beacon Software Solutions LLC',
          state: 'NY',
          securedParty: 'Kalamata Capital Group'
        }
      ]

      const summary = service.deduplicateFilings(filings)

      expect(summary.totalFilingsProcessed).toBe(4)
      expect(summary.corporateClusters).toHaveLength(2) // Summit cluster + Beacon cluster

      const summitCluster = summary.corporateClusters.find((c) =>
        c.canonicalName.toLowerCase().includes('summit')
      )
      expect(summitCluster).toBeDefined()
      expect(summitCluster!.recordCount).toBe(3)
      expect(summitCluster!.states).toEqual(expect.arrayContaining(['CA', 'TX', 'FL']))
      expect(summitCluster!.crossStateLinksCount).toBe(2)
      expect(summitCluster!.filingIds).toEqual(
        expect.arrayContaining(['filing-ca-1', 'filing-tx-1', 'filing-fl-1'])
      )
      expect(summitCluster!.enrichment_confidence).toBeGreaterThanOrEqual(0.85)
      expect(summitCluster!.enrichment_confidence).toBeLessThanOrEqual(1.0)
      expect(summitCluster!.explanation).toContain('Linked across 3 states')

      expect(summary.crossStateEntities).toBe(1)
      expect(summary.deduplicationRatio).toBe(0.5) // (4 - 2) / 4 = 0.50
    })

    it('clusters individual debtors across multiple filings with nickname expansion', () => {
      const filings: FilingEntityInput[] = [
        {
          id: 'ind-1',
          filingDate: '2024-01-01',
          debtorName: 'Robert Davis',
          state: 'CA',
          securedParty: 'National Funding',
          isIndividual: true
        },
        {
          id: 'ind-2',
          filingDate: '2024-02-01',
          debtorName: 'Bob Davis',
          state: 'TX',
          securedParty: 'National Funding LLC',
          isIndividual: true
        }
      ]

      const summary = service.deduplicateFilings(filings)
      expect(summary.individualClusters).toHaveLength(1)
      const cluster = summary.individualClusters[0]
      expect(cluster.recordCount).toBe(2)
      expect(cluster.states).toEqual(expect.arrayContaining(['CA', 'TX']))
      expect(cluster.enrichment_confidence).toBeGreaterThanOrEqual(0.8)
    })

    it('handles transitive equivalence (A -> B and B -> C forms unified cluster)', () => {
      const filings: FilingEntityInput[] = [
        {
          id: 'f-1',
          filingDate: '2024-01-01',
          debtorName: 'Vanguard Logistics LLC',
          state: 'CA',
          securedParty: 'Lender One'
        },
        {
          id: 'f-2',
          filingDate: '2024-02-01',
          debtorName: 'Vanguard Logistics',
          state: 'NV',
          securedParty: 'Lender One'
        },
        {
          id: 'f-3',
          filingDate: '2024-03-01',
          debtorName: 'Vanguard Logistics Inc',
          state: 'AZ',
          securedParty: 'Lender Two'
        }
      ]

      const summary = service.deduplicateFilings(filings)
      expect(summary.corporateClusters).toHaveLength(1)
      expect(summary.corporateClusters[0].recordCount).toBe(3)
      expect(summary.corporateClusters[0].states).toHaveLength(3)
    })
  })

  describe('linkFilingToProspect', () => {
    it('links a new cross-state filing to a prospect and recalculates enrichment_confidence', async () => {
      // Mock prospect lookup
      mockQuery.mockResolvedValueOnce([
        {
          id: 'prospect-uuid-1',
          company_name: 'Metro Distribution Services LLC',
          state: 'CA',
          enrichment_confidence: 0.85
        }
      ])

      // Mock existing junction check (not linked yet)
      mockQuery.mockResolvedValueOnce([])

      // Mock junction insert
      mockQuery.mockResolvedValueOnce({ rowCount: 1 })

      // Mock linked filings lookup for updated confidence calculation (now 2 states: CA & TX)
      mockQuery.mockResolvedValueOnce([{ state: 'CA' }, { state: 'TX' }])

      // Mock prospect update
      mockQuery.mockResolvedValueOnce({ rowCount: 1 })

      const filing: FilingEntityInput = {
        id: 'filing-tx-99',
        filingDate: '2024-05-10',
        debtorName: 'Metro Distribution Services Inc',
        state: 'TX',
        securedParty: 'OnDeck Capital'
      }

      const result = await service.linkFilingToProspect(filing, {
        prospectId: 'prospect-uuid-1'
      })

      expect(result.linked).toBe(true)
      expect(result.isNewLink).toBe(true)
      expect(result.enrichment_confidence).toBeGreaterThanOrEqual(0.85)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO prospect_ucc_filings'),
        ['prospect-uuid-1', 'filing-tx-99']
      )
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE prospects'),
        expect.arrayContaining(['prospect-uuid-1'])
      )
    })

    it('rejects linking when match confidence is below threshold', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          id: 'prospect-uuid-2',
          company_name: 'Quantum Cybernetics Inc',
          state: 'CA',
          enrichment_confidence: 0.9
        }
      ])

      const filing: FilingEntityInput = {
        id: 'filing-fl-77',
        filingDate: '2024-05-10',
        debtorName: 'Completely Unrelated Bakery LLC',
        state: 'FL',
        securedParty: 'Local Bank'
      }

      const result = await service.linkFilingToProspect(filing, {
        prospectId: 'prospect-uuid-2'
      })

      expect(result.linked).toBe(false)
      expect(result.isNewLink).toBe(false)
      expect(result.explanation).toContain('below threshold')
    })
  })

  describe('resolveAndEnrichProspect', () => {
    it('discovers cross-state filings across all states and updates prospect enrichment_confidence', async () => {
      // Mock prospect load
      mockQuery.mockResolvedValueOnce([
        {
          id: 'prospect-uuid-1',
          company_name: 'Atlas Heavy Machinery LLC',
          company_name_normalized: 'atlas heavy machinery',
          state: 'CA',
          enrichment_confidence: 0.7
        }
      ])

      // Mock candidate filings query from ucc_filings
      mockQuery.mockResolvedValueOnce([
        {
          id: 'ucc-ca-1',
          debtor_name: 'Atlas Heavy Machinery LLC',
          debtor_name_normalized: 'atlas heavy machinery',
          secured_party: 'First Financial',
          state: 'CA',
          filing_date: '2024-01-01',
          raw_data: null
        },
        {
          id: 'ucc-tx-1',
          debtor_name: 'Atlas Heavy Machinery Corp',
          debtor_name_normalized: 'atlas heavy machinery',
          secured_party: 'First Financial LLC',
          state: 'TX',
          filing_date: '2024-02-01',
          raw_data: null
        }
      ])

      // Mock junction insert for ucc-ca-1
      mockQuery.mockResolvedValueOnce({ rowCount: 1 })
      // Mock junction insert for ucc-tx-1
      mockQuery.mockResolvedValueOnce({ rowCount: 1 })
      // Mock prospect update
      mockQuery.mockResolvedValueOnce({ rowCount: 1 })

      const result = await service.resolveAndEnrichProspect('prospect-uuid-1')

      expect(result.prospectId).toBe('prospect-uuid-1')
      expect(result.states).toEqual(expect.arrayContaining(['CA', 'TX']))
      expect(result.filingCount).toBe(2)
      expect(result.enrichment_confidence).toBeGreaterThanOrEqual(0.85)
      expect(result.explanation).toContain('Multi-state enterprise resolved across 2 states')
    })

    it('throws when prospect is not found', async () => {
      mockQuery.mockResolvedValueOnce([])
      await expect(service.resolveAndEnrichProspect('non-existent-uuid')).rejects.toThrow(
        'Prospect non-existent-uuid not found'
      )
    })
  })
})
