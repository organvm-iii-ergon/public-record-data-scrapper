import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DisclosureService } from '../../services/DisclosureService'
import { NotFoundError, ValidationError, DatabaseError } from '../../errors'

// Mock the database module
vi.mock('../../database/connection', () => ({
  database: {
    query: vi.fn()
  }
}))

// Mock the disclosure calculator
vi.mock('../../services/DisclosureCalculator', () => ({
  disclosureCalculator: {
    calculateFromDeal: vi.fn().mockReturnValue({
      fundingAmount: 50000,
      totalDollarCost: 15000,
      financeCharge: 15000,
      totalFees: 0,
      totalPayback: 65000,
      termDays: 180,
      paymentFrequency: 'daily',
      paymentAmount: 361.11,
      numberOfPayments: 180,
      aprEquivalent: 0.65,
      effectiveRate: 0.3,
      prepaymentPolicy: 'No prepayment discount.',
      paymentSchedule: []
    }),
    formatForDisplay: vi.fn().mockReturnValue({
      fundingAmount: '$50,000.00',
      totalDollarCost: '$15,000.00'
    })
  }
}))

// Mock the deals service
vi.mock('../../services/DealsService', () => ({
  dealsService: {
    getByIdOrThrow: vi.fn().mockResolvedValue({
      id: 'deal-1',
      amountRequested: 50000,
      factorRate: 1.3,
      termMonths: 6
    })
  }
}))

import { database } from '../../database/connection'

const mockQuery = vi.mocked(database.query)

describe('DisclosureService', () => {
  let service: DisclosureService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new DisclosureService()
  })

  describe('getRequirements', () => {
    it('should return disclosure requirements for a state', async () => {
      const mockRequirement = {
        id: 'req-1',
        state: 'CA',
        regulation_name: 'SB 1235',
        effective_date: '2023-01-01',
        required_fields: ['apr', 'total_cost'],
        calculation_rules: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockQuery.mockResolvedValueOnce([mockRequirement])

      const result = await service.getRequirements('CA')

      expect(result).not.toBeNull()
      expect(result?.state).toBe('CA')
      expect(result?.regulationName).toBe('SB 1235')
    })

    it('should return null for state without requirements', async () => {
      mockQuery.mockResolvedValueOnce([])

      const result = await service.getRequirements('AZ')

      expect(result).toBeNull()
    })

    it('should throw DatabaseError on failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Query failed'))

      await expect(service.getRequirements('CA')).rejects.toThrow(DatabaseError)
    })
  })

  describe('getAllRequirements', () => {
    it('should return all active requirements', async () => {
      const mockRequirements = [
        {
          id: 'req-1',
          state: 'CA',
          regulation_name: 'SB 1235',
          effective_date: '2023-01-01',
          required_fields: [],
          calculation_rules: {},
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'req-2',
          state: 'NY',
          regulation_name: 'CFDL',
          effective_date: '2023-01-01',
          required_fields: [],
          calculation_rules: {},
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ]

      mockQuery.mockResolvedValueOnce(mockRequirements)

      const result = await service.getAllRequirements()

      expect(result).toHaveLength(2)
    })
  })

  describe('requiresDisclosure', () => {
    it('should return true for state with requirements', async () => {
      const mockRequirement = {
        id: 'req-1',
        state: 'CA',
        regulation_name: 'SB 1235',
        effective_date: '2023-01-01',
        required_fields: [],
        calculation_rules: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockQuery.mockResolvedValueOnce([mockRequirement])

      const result = await service.requiresDisclosure('CA')

      expect(result).toBe(true)
    })

    it('should return false for state without requirements', async () => {
      mockQuery.mockResolvedValueOnce([])

      const result = await service.requiresDisclosure('AZ')

      expect(result).toBe(false)
    })
  })

  describe('generate', () => {
    it('should generate disclosure for a deal', async () => {
      const mockRequirement = {
        id: 'req-1',
        state: 'CA',
        regulation_name: 'SB 1235',
        effective_date: '2023-01-01',
        required_fields: ['apr'],
        calculation_rules: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
      const mockDisclosure = {
        id: 'disc-1',
        org_id: 'org-1',
        deal_id: 'deal-1',
        state: 'CA',
        regulation_name: 'SB 1235',
        version: '1.0',
        funding_amount: 50000,
        total_dollar_cost: 15000,
        status: 'generated',
        signature_required: true,
        disclosure_data: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockQuery
        .mockResolvedValueOnce([mockRequirement]) // getRequirements
        .mockResolvedValueOnce([]) // supersedeExisting
        .mockResolvedValueOnce([{ max_version: null }]) // getNextVersion
        .mockResolvedValueOnce([mockDisclosure]) // insert

      const result = await service.generate({
        dealId: 'deal-1',
        orgId: 'org-1',
        state: 'CA'
      })

      expect(result.id).toBe('disc-1')
      expect(result.state).toBe('CA')
      expect(result.status).toBe('generated')
    })

    it('should throw ValidationError for state without requirements', async () => {
      mockQuery.mockResolvedValueOnce([]) // getRequirements returns empty

      await expect(
        service.generate({
          dealId: 'deal-1',
          orgId: 'org-1',
          state: 'AZ'
        })
      ).rejects.toThrow(ValidationError)
    })
  })

  describe('getById', () => {
    it('should return disclosure by id', async () => {
      const mockDisclosure = {
        id: 'disc-1',
        org_id: 'org-1',
        deal_id: 'deal-1',
        state: 'CA',
        regulation_name: 'SB 1235',
        version: '1.0',
        funding_amount: 50000,
        total_dollar_cost: 15000,
        status: 'generated',
        signature_required: true,
        disclosure_data: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockQuery.mockResolvedValueOnce([mockDisclosure])

      const result = await service.getById('disc-1', 'org-1')

      expect(result).not.toBeNull()
      expect(result?.id).toBe('disc-1')
    })

    it('should return null for non-existent disclosure', async () => {
      mockQuery.mockResolvedValueOnce([])

      const result = await service.getById('non-existent', 'org-1')

      expect(result).toBeNull()
    })
  })

  describe('getByIdOrThrow', () => {
    it('should return disclosure when found', async () => {
      const mockDisclosure = {
        id: 'disc-1',
        org_id: 'org-1',
        deal_id: 'deal-1',
        state: 'CA',
        regulation_name: 'SB 1235',
        version: '1.0',
        funding_amount: 50000,
        total_dollar_cost: 15000,
        status: 'generated',
        signature_required: true,
        disclosure_data: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockQuery.mockResolvedValueOnce([mockDisclosure])

      const result = await service.getByIdOrThrow('disc-1', 'org-1')

      expect(result.id).toBe('disc-1')
    })

    it('should throw NotFoundError when disclosure does not exist', async () => {
      mockQuery.mockResolvedValueOnce([])

      await expect(service.getByIdOrThrow('non-existent', 'org-1')).rejects.toThrow(NotFoundError)
    })
  })

  describe('getByDealId', () => {
    it('should return all disclosures for a deal', async () => {
      const mockDisclosures = [
        {
          id: 'disc-1',
          org_id: 'org-1',
          deal_id: 'deal-1',
          state: 'CA',
          regulation_name: 'SB 1235',
          version: '1.0',
          funding_amount: 50000,
          total_dollar_cost: 15000,
          status: 'superseded',
          signature_required: true,
          disclosure_data: {},
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'disc-2',
          org_id: 'org-1',
          deal_id: 'deal-1',
          state: 'CA',
          regulation_name: 'SB 1235',
          version: '1.1',
          funding_amount: 50000,
          total_dollar_cost: 15000,
          status: 'generated',
          signature_required: true,
          disclosure_data: {},
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z'
        }
      ]

      mockQuery.mockResolvedValueOnce(mockDisclosures)

      const result = await service.getByDealId('deal-1')

      expect(result).toHaveLength(2)
    })
  })

  describe('getCurrentDisclosure', () => {
    it('should return current active disclosure', async () => {
      const mockDisclosure = {
        id: 'disc-2',
        org_id: 'org-1',
        deal_id: 'deal-1',
        state: 'CA',
        regulation_name: 'SB 1235',
        version: '1.1',
        funding_amount: 50000,
        total_dollar_cost: 15000,
        status: 'sent',
        signature_required: true,
        disclosure_data: {},
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z'
      }

      mockQuery.mockResolvedValueOnce([mockDisclosure])

      const result = await service.getCurrentDisclosure('deal-1')

      expect(result?.status).toBe('sent')
    })

    it('should return null when no current disclosure', async () => {
      mockQuery.mockResolvedValueOnce([])

      const result = await service.getCurrentDisclosure('deal-1')

      expect(result).toBeNull()
    })
  })

  describe('markAsSent', () => {
    it('should update disclosure status to sent', async () => {
      const mockDisclosure = {
        id: 'disc-1',
        org_id: 'org-1',
        deal_id: 'deal-1',
        state: 'CA',
        regulation_name: 'SB 1235',
        version: '1.0',
        funding_amount: 50000,
        total_dollar_cost: 15000,
        status: 'sent',
        sent_at: '2024-01-02T00:00:00Z',
        signature_required: true,
        disclosure_data: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z'
      }

      mockQuery.mockResolvedValueOnce([mockDisclosure])

      const result = await service.markAsSent('disc-1', 'org-1')

      expect(result.status).toBe('sent')
      expect(result.sentAt).toBeDefined()
    })

    it('should throw NotFoundError for non-existent disclosure', async () => {
      mockQuery.mockResolvedValueOnce([])

      await expect(service.markAsSent('non-existent', 'org-1')).rejects.toThrow(NotFoundError)
    })
  })

  describe('markAsViewed', () => {
    it('should update disclosure status to viewed', async () => {
      const mockDisclosure = {
        id: 'disc-1',
        org_id: 'org-1',
        deal_id: 'deal-1',
        state: 'CA',
        regulation_name: 'SB 1235',
        version: '1.0',
        funding_amount: 50000,
        total_dollar_cost: 15000,
        status: 'viewed',
        viewed_at: '2024-01-03T00:00:00Z',
        signature_required: true,
        disclosure_data: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-03T00:00:00Z'
      }

      mockQuery.mockResolvedValueOnce([mockDisclosure])

      const result = await service.markAsViewed('disc-1')

      expect(result.status).toBe('viewed')
      expect(result.viewedAt).toBeDefined()
    })
  })

  describe('recordSignature', () => {
    it('should record signature on disclosure', async () => {
      const mockExisting = {
        id: 'disc-1',
        org_id: 'org-1',
        deal_id: 'deal-1',
        state: 'CA',
        regulation_name: 'SB 1235',
        version: '1.0',
        funding_amount: 50000,
        total_dollar_cost: 15000,
        status: 'viewed',
        signature_required: true,
        disclosure_data: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
      const mockSigned = {
        ...mockExisting,
        status: 'signed',
        signed_at: '2024-01-04T00:00:00Z',
        signed_by: 'John Doe',
        signed_ip: '192.168.1.1'
      }

      mockQuery
        .mockResolvedValueOnce([mockExisting]) // getById
        .mockResolvedValueOnce([mockSigned]) // update

      const result = await service.recordSignature({
        disclosureId: 'disc-1',
        signedBy: 'John Doe',
        signedIp: '192.168.1.1'
      })

      expect(result.status).toBe('signed')
      expect(result.signedBy).toBe('John Doe')
    })

    it('should throw NotFoundError for non-existent disclosure', async () => {
      mockQuery.mockResolvedValueOnce([])

      await expect(
        service.recordSignature({
          disclosureId: 'non-existent',
          signedBy: 'John Doe'
        })
      ).rejects.toThrow(NotFoundError)
    })

    it('should throw ValidationError for already signed disclosure', async () => {
      const mockSigned = {
        id: 'disc-1',
        org_id: 'org-1',
        deal_id: 'deal-1',
        state: 'CA',
        regulation_name: 'SB 1235',
        version: '1.0',
        funding_amount: 50000,
        total_dollar_cost: 15000,
        status: 'signed',
        signature_required: true,
        disclosure_data: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockQuery.mockResolvedValueOnce([mockSigned])

      await expect(
        service.recordSignature({
          disclosureId: 'disc-1',
          signedBy: 'John Doe'
        })
      ).rejects.toThrow(ValidationError)
    })
  })

  describe('setDocumentUrl', () => {
    it('should set document URL and hash', async () => {
      const mockDisclosure = {
        id: 'disc-1',
        org_id: 'org-1',
        deal_id: 'deal-1',
        state: 'CA',
        regulation_name: 'SB 1235',
        version: '1.0',
        funding_amount: 50000,
        total_dollar_cost: 15000,
        status: 'generated',
        document_url: 'https://storage.example.com/disc-1.pdf',
        signature_required: true,
        disclosure_data: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockQuery.mockResolvedValueOnce([mockDisclosure])

      const result = await service.setDocumentUrl(
        'disc-1',
        'org-1',
        'https://storage.example.com/disc-1.pdf'
      )

      expect(result.documentUrl).toBe('https://storage.example.com/disc-1.pdf')
    })
  })

  describe('list', () => {
    it('should return paginated disclosures', async () => {
      const mockDisclosures = [
        {
          id: 'disc-1',
          org_id: 'org-1',
          deal_id: 'deal-1',
          state: 'CA',
          regulation_name: 'SB 1235',
          version: '1.0',
          funding_amount: 50000,
          total_dollar_cost: 15000,
          status: 'signed',
          signature_required: true,
          disclosure_data: {},
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ]

      mockQuery.mockResolvedValueOnce(mockDisclosures).mockResolvedValueOnce([{ count: '1' }])

      const result = await service.list('org-1')

      expect(result.disclosures).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('should filter by status', async () => {
      mockQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: '0' }])

      await service.list('org-1', { status: 'signed' })

      expect(mockQuery.mock.calls[0][0]).toContain('status = $')
    })

    it('should filter by state', async () => {
      mockQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: '0' }])

      await service.list('org-1', { state: 'NY' })

      expect(mockQuery.mock.calls[0][0]).toContain('state = $')
    })
  })

  describe('hasSigned', () => {
    it('should return true when deal has signed disclosure', async () => {
      mockQuery.mockResolvedValueOnce([{ count: '1' }])

      const result = await service.hasSigned('deal-1')

      expect(result).toBe(true)
    })

    it('should return false when deal has no signed disclosure', async () => {
      mockQuery.mockResolvedValueOnce([{ count: '0' }])

      const result = await service.hasSigned('deal-1')

      expect(result).toBe(false)
    })
  })

  describe('getPendingForFollowUp', () => {
    it('should return pending disclosures for follow-up', async () => {
      const mockDisclosures = [
        {
          id: 'disc-1',
          org_id: 'org-1',
          deal_id: 'deal-1',
          state: 'CA',
          regulation_name: 'SB 1235',
          version: '1.0',
          funding_amount: 50000,
          total_dollar_cost: 15000,
          status: 'sent',
          sent_at: '2024-01-01T00:00:00Z',
          signature_required: true,
          disclosure_data: {},
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ]

      mockQuery.mockResolvedValueOnce(mockDisclosures)

      const result = await service.getPendingForFollowUp('org-1', 3)

      expect(result).toHaveLength(1)
      expect(result[0].status).toBe('sent')
    })
  })
})
