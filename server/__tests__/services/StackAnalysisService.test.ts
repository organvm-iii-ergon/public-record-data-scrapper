import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StackAnalysisService } from '../../services/StackAnalysisService'

// Mock the database module
vi.mock('../../database/connection', () => ({
  database: {
    query: vi.fn()
  }
}))

// Mock the identity module
vi.mock('@public-records/core/identity', () => ({
  normalizeCompanyName: vi.fn().mockImplementation((name: string) => ({
    normalized: name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim(),
    original: name
  }))
}))

import { database } from '../../database/connection'

const mockQuery = vi.mocked(database.query)

describe('StackAnalysisService', () => {
  let service: StackAnalysisService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new StackAnalysisService()
  })

  describe('analyzeStack', () => {
    it('should analyze stack for prospect with no filings', async () => {
      const mockProspect = {
        id: 'prospect-1',
        company_name: 'Clean Slate Corp',
        estimated_revenue: 500000
      }

      mockQuery.mockResolvedValueOnce([mockProspect]).mockResolvedValueOnce([]) // no filings

      const result = await service.analyzeStack('prospect-1')

      expect(result.currentStackDepth).toBe(0)
      expect(result.estimatedPosition).toBe(1)
      expect(result.isOverStacked).toBe(false)
      expect(result.recommendation.canFund).toBe(true)
      expect(result.recommendation.suggestedPosition).toBe(1)
    })

    it('should detect active positions', async () => {
      const mockProspect = {
        id: 'prospect-1',
        company_name: 'Test Corp',
        estimated_revenue: 300000
      }
      const mockFilings = [
        {
          id: 'f1',
          external_id: 'UCC-001',
          filing_date: '2024-01-01',
          status: 'active',
          secured_party_name: 'OnDeck Capital',
          collateral_description: 'All assets',
          filing_type: 'UCC-1'
        },
        {
          id: 'f2',
          external_id: 'UCC-002',
          filing_date: '2024-02-01',
          status: 'active',
          secured_party_name: 'Kabbage',
          collateral_description: 'Accounts receivable',
          filing_type: 'UCC-1'
        }
      ]

      mockQuery.mockResolvedValueOnce([mockProspect]).mockResolvedValueOnce(mockFilings)

      const result = await service.analyzeStack('prospect-1')

      expect(result.currentStackDepth).toBe(2)
      expect(result.estimatedPosition).toBe(3)
      expect(result.activePositions).toHaveLength(2)
      expect(result.hasKnownMcaFunder).toBe(true)
    })

    it('should identify over-stacked businesses', async () => {
      const mockProspect = {
        id: 'prospect-1',
        company_name: 'Stacked Corp',
        estimated_revenue: 200000
      }
      const mockFilings = [
        {
          id: 'f1',
          external_id: 'UCC-001',
          filing_date: '2024-01-01',
          status: 'active',
          secured_party_name: 'OnDeck Capital',
          collateral_description: 'All assets',
          filing_type: 'UCC-1'
        },
        {
          id: 'f2',
          external_id: 'UCC-002',
          filing_date: '2024-02-01',
          status: 'active',
          secured_party_name: 'Kabbage',
          collateral_description: 'All assets',
          filing_type: 'UCC-1'
        },
        {
          id: 'f3',
          external_id: 'UCC-003',
          filing_date: '2024-03-01',
          status: 'active',
          secured_party_name: 'BlueVine',
          collateral_description: 'All assets',
          filing_type: 'UCC-1'
        },
        {
          id: 'f4',
          external_id: 'UCC-004',
          filing_date: '2024-04-01',
          status: 'active',
          secured_party_name: 'Credibly',
          collateral_description: 'All assets',
          filing_type: 'UCC-1'
        },
        {
          id: 'f5',
          external_id: 'UCC-005',
          filing_date: '2024-05-01',
          status: 'active',
          secured_party_name: 'Fundbox',
          collateral_description: 'All assets',
          filing_type: 'UCC-1'
        }
      ]

      mockQuery.mockResolvedValueOnce([mockProspect]).mockResolvedValueOnce(mockFilings)

      const result = await service.analyzeStack('prospect-1')

      expect(result.isOverStacked).toBe(true)
      expect(result.recommendation.canFund).toBe(false)
    })

    it('should detect known MCA funders', async () => {
      const mockProspect = {
        id: 'prospect-1',
        company_name: 'Test Corp',
        estimated_revenue: 300000
      }
      const mockFilings = [
        {
          id: 'f1',
          external_id: 'UCC-001',
          filing_date: '2024-01-01',
          status: 'active',
          secured_party_name: 'ONDECK CAPITAL INC',
          collateral_description: 'All assets',
          filing_type: 'UCC-1'
        }
      ]

      mockQuery.mockResolvedValueOnce([mockProspect]).mockResolvedValueOnce(mockFilings)

      const result = await service.analyzeStack('prospect-1')

      expect(result.hasKnownMcaFunder).toBe(true)
      expect(result.mcaPositionCount).toBe(1)
    })

    it('should identify blanket liens', async () => {
      const mockProspect = {
        id: 'prospect-1',
        company_name: 'Test Corp',
        estimated_revenue: 300000
      }
      const mockFilings = [
        {
          id: 'f1',
          external_id: 'UCC-001',
          filing_date: '2024-01-01',
          status: 'active',
          secured_party_name: 'Bank of America',
          collateral_description:
            'All present and future assets, accounts, inventory, and general intangibles',
          filing_type: 'UCC-1'
        }
      ]

      mockQuery.mockResolvedValueOnce([mockProspect]).mockResolvedValueOnce(mockFilings)

      const result = await service.analyzeStack('prospect-1')

      expect(result.hasBlanketsLien).toBe(true)
      expect(result.collateralTypes.some((c) => c.type === 'blanket')).toBe(true)
    })

    it('should throw error for non-existent prospect', async () => {
      mockQuery.mockResolvedValueOnce([])

      await expect(service.analyzeStack('non-existent')).rejects.toThrow('Prospect not found')
    })

    it('should generate recommendations for 2nd position', async () => {
      const mockProspect = {
        id: 'prospect-1',
        company_name: 'Test Corp',
        estimated_revenue: 300000
      }
      const mockFilings = [
        {
          id: 'f1',
          external_id: 'UCC-001',
          filing_date: '2024-01-01',
          status: 'active',
          secured_party_name: 'Wells Fargo Bank',
          collateral_description: 'Equipment',
          filing_type: 'UCC-1'
        }
      ]

      mockQuery.mockResolvedValueOnce([mockProspect]).mockResolvedValueOnce(mockFilings)

      const result = await service.analyzeStack('prospect-1')

      expect(result.recommendation.canFund).toBe(true)
      expect(result.recommendation.suggestedPosition).toBe(2)
      expect(result.recommendation.requiredDueDiligence.length).toBeGreaterThan(0)
    })

    it('should identify risk factors', async () => {
      const mockProspect = {
        id: 'prospect-1',
        company_name: 'Test Corp',
        estimated_revenue: 200000
      }
      const mockFilings = [
        {
          id: 'f1',
          external_id: 'UCC-001',
          filing_date: '2024-01-01',
          status: 'active',
          secured_party_name: 'OnDeck Capital',
          collateral_description: 'All assets',
          filing_type: 'UCC-1'
        },
        {
          id: 'f2',
          external_id: 'UCC-002',
          filing_date: '2024-02-01',
          status: 'active',
          secured_party_name: 'World Business Lenders',
          collateral_description: 'All assets',
          filing_type: 'UCC-1'
        }
      ]

      mockQuery.mockResolvedValueOnce([mockProspect]).mockResolvedValueOnce(mockFilings)

      const result = await service.analyzeStack('prospect-1')

      expect(result.riskFactors.length).toBeGreaterThan(0)
    })

    it('should identify opportunities', async () => {
      const mockProspect = {
        id: 'prospect-1',
        company_name: 'Clean Corp',
        estimated_revenue: 500000
      }

      mockQuery.mockResolvedValueOnce([mockProspect]).mockResolvedValueOnce([])

      const result = await service.analyzeStack('prospect-1')

      expect(result.opportunities.length).toBeGreaterThan(0)
      expect(result.opportunities.some((o) => o.includes('Clean'))).toBe(true)
    })
  })

  describe('competitor detection', () => {
    it('should detect bank positions', async () => {
      const mockProspect = {
        id: 'prospect-1',
        company_name: 'Test Corp',
        estimated_revenue: 300000
      }
      const mockFilings = [
        {
          id: 'f1',
          external_id: 'UCC-001',
          filing_date: '2024-01-01',
          status: 'active',
          secured_party_name: 'Wells Fargo Bank NA',
          collateral_description: 'Equipment',
          filing_type: 'UCC-1'
        }
      ]

      mockQuery.mockResolvedValueOnce([mockProspect]).mockResolvedValueOnce(mockFilings)

      const result = await service.analyzeStack('prospect-1')

      expect(result.detectedCompetitors.some((c) => c.funderType === 'bank')).toBe(true)
    })

    it('should differentiate MCA from equipment lenders', async () => {
      const mockProspect = {
        id: 'prospect-1',
        company_name: 'Test Corp',
        estimated_revenue: 300000
      }
      const mockFilings = [
        {
          id: 'f1',
          external_id: 'UCC-001',
          filing_date: '2024-01-01',
          status: 'active',
          secured_party_name: 'OnDeck Capital',
          collateral_description: 'All assets',
          filing_type: 'UCC-1'
        },
        {
          id: 'f2',
          external_id: 'UCC-002',
          filing_date: '2024-02-01',
          status: 'active',
          secured_party_name: 'De Lage Landen',
          collateral_description: 'Equipment serial 12345',
          filing_type: 'UCC-1'
        }
      ]

      mockQuery.mockResolvedValueOnce([mockProspect]).mockResolvedValueOnce(mockFilings)

      const result = await service.analyzeStack('prospect-1')

      const mcaCompetitor = result.detectedCompetitors.find((c) => c.funderName.includes('OnDeck'))
      const equipmentCompetitor = result.detectedCompetitors.find((c) =>
        c.funderName.includes('De Lage')
      )

      expect(mcaCompetitor?.funderType).toBe('mca')
      expect(equipmentCompetitor?.funderType).toBe('equipment')
    })
  })

  describe('collateral analysis', () => {
    it('should classify blanket collateral', async () => {
      const mockProspect = {
        id: 'prospect-1',
        company_name: 'Test Corp',
        estimated_revenue: 300000
      }
      const mockFilings = [
        {
          id: 'f1',
          external_id: 'UCC-001',
          filing_date: '2024-01-01',
          status: 'active',
          secured_party_name: 'Test Lender',
          collateral_description:
            'All assets including accounts receivable, inventory, equipment, and general intangibles',
          filing_type: 'UCC-1'
        }
      ]

      mockQuery.mockResolvedValueOnce([mockProspect]).mockResolvedValueOnce(mockFilings)

      const result = await service.analyzeStack('prospect-1')

      expect(result.collateralTypes.some((c) => c.type === 'blanket')).toBe(true)
    })

    it('should classify equipment collateral', async () => {
      const mockProspect = {
        id: 'prospect-1',
        company_name: 'Test Corp',
        estimated_revenue: 300000
      }
      const mockFilings = [
        {
          id: 'f1',
          external_id: 'UCC-001',
          filing_date: '2024-01-01',
          status: 'active',
          secured_party_name: 'Test Lender',
          collateral_description: 'Equipment: 2024 Ford F-150 VIN: 12345',
          filing_type: 'UCC-1'
        }
      ]

      mockQuery.mockResolvedValueOnce([mockProspect]).mockResolvedValueOnce(mockFilings)

      const result = await service.analyzeStack('prospect-1')

      expect(result.collateralTypes.some((c) => c.type === 'equipment')).toBe(true)
    })

    it('should identify MCA-typical collateral patterns', async () => {
      const mockProspect = {
        id: 'prospect-1',
        company_name: 'Test Corp',
        estimated_revenue: 300000
      }
      const mockFilings = [
        {
          id: 'f1',
          external_id: 'UCC-001',
          filing_date: '2024-01-01',
          status: 'active',
          secured_party_name: 'Test Lender',
          collateral_description: 'Future receivables and credit card receipts',
          filing_type: 'UCC-1'
        }
      ]

      mockQuery.mockResolvedValueOnce([mockProspect]).mockResolvedValueOnce(mockFilings)

      const result = await service.analyzeStack('prospect-1')

      expect(result.collateralTypes.some((c) => c.isCommonMcaCollateral)).toBe(true)
    })
  })

  describe('analyzeStackBatch', () => {
    it('should analyze multiple prospects', async () => {
      const mockProspect1 = {
        id: 'prospect-1',
        company_name: 'Test Corp 1',
        estimated_revenue: 300000
      }
      const mockProspect2 = {
        id: 'prospect-2',
        company_name: 'Test Corp 2',
        estimated_revenue: 400000
      }

      mockQuery
        .mockResolvedValueOnce([mockProspect1])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockProspect2])
        .mockResolvedValueOnce([])

      const results = await service.analyzeStackBatch(['prospect-1', 'prospect-2'])

      expect(results.size).toBe(2)
    })

    it('should continue on individual failures', async () => {
      mockQuery
        .mockResolvedValueOnce([]) // First fails
        .mockResolvedValueOnce([
          { id: 'prospect-2', company_name: 'Test Corp', estimated_revenue: 300000 }
        ])
        .mockResolvedValueOnce([])

      const results = await service.analyzeStackBatch(['prospect-1', 'prospect-2'])

      expect(results.size).toBe(1)
    })
  })

  describe('getKnownFunders', () => {
    it('should return list of known funders', () => {
      const funders = service.getKnownFunders()

      expect(funders.length).toBeGreaterThan(0)
      expect(funders.some((f) => f.name === 'OnDeck Capital')).toBe(true)
    })
  })

  describe('addKnownFunder', () => {
    it('should add new funder to list', () => {
      const initialCount = service.getKnownFunders().length

      service.addKnownFunder({
        name: 'New Test Funder',
        aliases: ['new test', 'ntf'],
        type: 'mca',
        tier: 'c',
        averagePosition: 2
      })

      const newCount = service.getKnownFunders().length
      expect(newCount).toBe(initialCount + 1)
    })
  })

  describe('payment estimation', () => {
    it('should estimate monthly payments from active positions', async () => {
      const mockProspect = {
        id: 'prospect-1',
        company_name: 'Test Corp',
        estimated_revenue: 300000
      }
      const mockFilings = [
        {
          id: 'f1',
          external_id: 'UCC-001',
          filing_date: '2024-01-01',
          status: 'active',
          secured_party_name: 'OnDeck Capital',
          original_amount: 50000,
          collateral_description: 'All assets',
          filing_type: 'UCC-1'
        }
      ]

      mockQuery.mockResolvedValueOnce([mockProspect]).mockResolvedValueOnce(mockFilings)

      const result = await service.analyzeStack('prospect-1')

      expect(result.estimatedMonthlyPayments).toBeGreaterThan(0)
    })

    it('should calculate payment burden ratio', async () => {
      const mockProspect = {
        id: 'prospect-1',
        company_name: 'Test Corp',
        estimated_revenue: 120000 // $10k/month
      }
      const mockFilings = [
        {
          id: 'f1',
          external_id: 'UCC-001',
          filing_date: '2024-01-01',
          status: 'active',
          secured_party_name: 'OnDeck Capital',
          original_amount: 30000,
          collateral_description: 'All assets',
          filing_type: 'UCC-1'
        }
      ]

      mockQuery.mockResolvedValueOnce([mockProspect]).mockResolvedValueOnce(mockFilings)

      const result = await service.analyzeStack('prospect-1')

      expect(result.paymentBurdenRatio).toBeDefined()
    })
  })
})
