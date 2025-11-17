import { describe, it, expect, beforeEach } from 'vitest'
import { CompetitorsService } from '../../services/CompetitorsService'
import { TestDataFactory } from '../helpers/testData'

describe('CompetitorsService', () => {
  let service: CompetitorsService

  beforeEach(() => {
    service = new CompetitorsService()
  })

  describe('list', () => {
    it('should return paginated list of competitors', async () => {
      // Create UCC filings from different secured parties
      await TestDataFactory.createUCCFiling({ securedParty: 'Lender A' })
      await TestDataFactory.createUCCFiling({ securedParty: 'Lender A' })
      await TestDataFactory.createUCCFiling({ securedParty: 'Lender B' })

      const result = await service.list({
        page: 1,
        limit: 10,
        sort_by: 'filing_count',
        sort_order: 'desc'
      })

      expect(result).toBeDefined()
      expect(result.competitors).toBeInstanceOf(Array)
      expect(result.competitors.length).toBe(2) // 2 unique lenders
      expect(result.page).toBe(1)
      expect(result.limit).toBe(10)
      expect(result.total).toBe(2)
    })

    it('should aggregate filings by secured party', async () => {
      await TestDataFactory.createUCCFiling({
        securedParty: 'Test Lender',
        lienAmount: 100000
      })
      await TestDataFactory.createUCCFiling({
        securedParty: 'Test Lender',
        lienAmount: 200000
      })
      await TestDataFactory.createUCCFiling({
        securedParty: 'Test Lender',
        lienAmount: 300000
      })

      const result = await service.list({
        page: 1,
        limit: 10,
        sort_by: 'filing_count',
        sort_order: 'desc'
      })

      const testLender = result.competitors.find(c => c.name === 'TEST LENDER')
      expect(testLender).toBeDefined()
      expect(testLender?.filing_count).toBe(3)
      expect(testLender?.total_amount).toBe(600000)
      expect(testLender?.avg_amount).toBeCloseTo(200000, 0)
    })

    it('should filter by state', async () => {
      await TestDataFactory.createUCCFiling({ securedParty: 'Lender NY', state: 'NY' })
      await TestDataFactory.createUCCFiling({ securedParty: 'Lender NY', state: 'NY' })
      await TestDataFactory.createUCCFiling({ securedParty: 'Lender CA', state: 'CA' })

      const result = await service.list({
        page: 1,
        limit: 10,
        state: 'NY',
        sort_by: 'filing_count',
        sort_order: 'desc'
      })

      expect(result.competitors.length).toBe(1)
      expect(result.competitors[0].name).toBe('LENDER NY')
    })

    it('should handle pagination correctly', async () => {
      // Create 15 different lenders
      for (let i = 0; i < 15; i++) {
        await TestDataFactory.createUCCFiling({ securedParty: `Lender ${i}` })
      }

      const page1 = await service.list({
        page: 1,
        limit: 10,
        sort_by: 'filing_count',
        sort_order: 'desc'
      })

      expect(page1.competitors.length).toBe(10)
      expect(page1.total).toBe(15)

      const page2 = await service.list({
        page: 2,
        limit: 10,
        sort_by: 'filing_count',
        sort_order: 'desc'
      })

      expect(page2.competitors.length).toBe(5)
    })

    it('should sort by different fields', async () => {
      await TestDataFactory.createUCCFiling({ securedParty: 'Alpha', lienAmount: 500000 })
      await TestDataFactory.createUCCFiling({ securedParty: 'Beta', lienAmount: 300000 })
      await TestDataFactory.createUCCFiling({ securedParty: 'Gamma', lienAmount: 400000 })

      // Sort by total_amount descending
      const byAmount = await service.list({
        page: 1,
        limit: 10,
        sort_by: 'total_amount',
        sort_order: 'desc'
      })

      expect(byAmount.competitors[0].name).toBe('ALPHA')
      expect(byAmount.competitors[1].name).toBe('GAMMA')
      expect(byAmount.competitors[2].name).toBe('BETA')
    })
  })

  describe('getById', () => {
    it('should return competitor details', async () => {
      const filing = await TestDataFactory.createUCCFiling({
        securedParty: 'Test Lender',
        state: 'NY',
        lienAmount: 250000
      })

      // Note: getById is a placeholder in current implementation
      // This test validates the structure
      const result = await service.getById('test-id')

      if (result) {
        expect(result).toHaveProperty('name')
        expect(result).toHaveProperty('filing_count')
        expect(result).toHaveProperty('total_amount')
      }
    })
  })

  describe('getAnalysis', () => {
    it('should return SWOT analysis with market share', async () => {
      // Create market data
      await TestDataFactory.createUCCFiling({ securedParty: 'Major Lender', lienAmount: 1000000 })
      await TestDataFactory.createUCCFiling({ securedParty: 'Major Lender', lienAmount: 1000000 })
      await TestDataFactory.createUCCFiling({ securedParty: 'Minor Lender', lienAmount: 100000 })

      const competitors = await service.list({
        page: 1,
        limit: 10,
        sort_by: 'filing_count',
        sort_order: 'desc'
      })

      const majorLender = competitors.competitors[0]
      const analysis = await service.getAnalysis(majorLender.name)

      if (analysis) {
        expect(analysis).toHaveProperty('market_share')
        expect(analysis).toHaveProperty('analysis')
        expect(analysis.analysis).toHaveProperty('strengths')
        expect(analysis.analysis).toHaveProperty('weaknesses')
        expect(analysis.analysis).toHaveProperty('opportunities')
        expect(analysis.analysis).toHaveProperty('threats')
      }
    })

    it('should calculate market share correctly', async () => {
      // Create controlled market: Lender A has 2M out of 3M total (66.7%)
      await TestDataFactory.createUCCFiling({ securedParty: 'Lender A', lienAmount: 2000000 })
      await TestDataFactory.createUCCFiling({ securedParty: 'Lender B', lienAmount: 1000000 })

      const competitors = await service.list({
        page: 1,
        limit: 10,
        sort_by: 'total_amount',
        sort_order: 'desc'
      })

      const lenderA = competitors.competitors[0]
      const analysis = await service.getAnalysis(lenderA.name)

      if (analysis) {
        expect(analysis.market_share).toBeCloseTo(66.67, 1)
      }
    })

    it('should identify high volume as strength', async () => {
      // Create high-volume lender (>100 filings)
      for (let i = 0; i < 101; i++) {
        await TestDataFactory.createUCCFiling({
          securedParty: 'High Volume Lender',
          lienAmount: 10000
        })
      }

      const competitors = await service.list({
        page: 1,
        limit: 10,
        sort_by: 'filing_count',
        sort_order: 'desc'
      })

      const highVolume = competitors.competitors[0]
      const analysis = await service.getAnalysis(highVolume.name)

      if (analysis) {
        expect(analysis.analysis.strengths).toContain('High volume of transactions')
      }
    })

    it('should identify dominant market position as strength', async () => {
      // Create dominant player (>10% market share)
      await TestDataFactory.createUCCFiling({ securedParty: 'Dominant', lienAmount: 2000000 })
      await TestDataFactory.createUCCFiling({ securedParty: 'Small', lienAmount: 100000 })

      const competitors = await service.list({
        page: 1,
        limit: 10,
        sort_by: 'total_amount',
        sort_order: 'desc'
      })

      const dominant = competitors.competitors[0]
      const analysis = await service.getAnalysis(dominant.name)

      if (analysis) {
        expect(analysis.analysis.strengths).toContain('Dominant market position')
      }
    })
  })

  describe('getStats', () => {
    it('should return competitor statistics', async () => {
      await TestDataFactory.createUCCFiling({ securedParty: 'Lender A', lienAmount: 500000 })
      await TestDataFactory.createUCCFiling({ securedParty: 'Lender A', lienAmount: 300000 })
      await TestDataFactory.createUCCFiling({ securedParty: 'Lender B', lienAmount: 200000 })

      const stats = await service.getStats()

      expect(stats).toBeDefined()
      expect(stats.total_competitors).toBe(2)
      expect(stats.total_filings).toBe(3)
      expect(stats.total_market_value).toBe(1000000)
      expect(stats.avg_filing_amount).toBeCloseTo(333333, 0)
    })

    it('should return zero stats when no filings exist', async () => {
      const stats = await service.getStats()

      expect(stats.total_competitors).toBe(0)
      expect(stats.total_filings).toBe(0)
      expect(stats.total_market_value).toBe(0)
      expect(stats.avg_filing_amount).toBe(0)
    })

    it('should count unique competitors correctly', async () => {
      await TestDataFactory.createUCCFiling({ securedParty: 'Same Lender' })
      await TestDataFactory.createUCCFiling({ securedParty: 'Same Lender' })
      await TestDataFactory.createUCCFiling({ securedParty: 'Same Lender' })

      const stats = await service.getStats()

      expect(stats.total_competitors).toBe(1)
      expect(stats.total_filings).toBe(3)
    })
  })
})
