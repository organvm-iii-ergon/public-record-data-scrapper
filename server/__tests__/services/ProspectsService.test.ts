import { describe, it, expect, beforeEach } from 'vitest'
import { ProspectsService } from '../../services/ProspectsService'
import { TestDataFactory } from '../helpers/testData'

// TODO: These tests require database connection - TestDataFactory needs DB
describe.skip('ProspectsService', () => {
  let service: ProspectsService

  beforeEach(() => {
    service = new ProspectsService()
  })

  describe('list', () => {
    it('should return paginated list of prospects', async () => {
      // Create test prospects
      await TestDataFactory.createProspects(5, { state: 'NY' })

      const result = await service.list({
        page: 1,
        limit: 10,
        sort_by: 'created_at',
        sort_order: 'desc'
      })

      expect(result).toBeDefined()
      expect(result.prospects).toBeInstanceOf(Array)
      expect(result.prospects.length).toBe(5)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(10)
      expect(result.total).toBe(5)
    })

    it('should filter prospects by state', async () => {
      await TestDataFactory.createProspects(3, { state: 'NY' })
      await TestDataFactory.createProspects(2, { state: 'CA' })

      const result = await service.list({
        page: 1,
        limit: 10,
        state: 'NY',
        sort_by: 'created_at',
        sort_order: 'desc'
      })

      expect(result.prospects.length).toBe(3)
      expect(result.total).toBe(3)
      result.prospects.forEach((p) => {
        expect(p.state).toBe('NY')
      })
    })

    it('should filter prospects by industry', async () => {
      await TestDataFactory.createProspects(2, { industry: 'Technology' })
      await TestDataFactory.createProspects(3, { industry: 'Manufacturing' })

      const result = await service.list({
        page: 1,
        limit: 10,
        industry: 'Technology',
        sort_by: 'created_at',
        sort_order: 'desc'
      })

      expect(result.prospects.length).toBe(2)
      result.prospects.forEach((p) => {
        expect(p.industry).toBe('Technology')
      })
    })

    it('should filter prospects by risk score range', async () => {
      await TestDataFactory.createProspect({ riskScore: 50 })
      await TestDataFactory.createProspect({ riskScore: 75 })
      await TestDataFactory.createProspect({ riskScore: 90 })

      const result = await service.list({
        page: 1,
        limit: 10,
        min_score: 60,
        max_score: 85,
        sort_by: 'created_at',
        sort_order: 'desc'
      })

      expect(result.prospects.length).toBe(1)
      expect(result.prospects[0].risk_score).toBe(75)
    })

    it('should filter prospects by status', async () => {
      await TestDataFactory.createProspects(2, { status: 'active' })
      await TestDataFactory.createProspects(1, { status: 'converted' })
      await TestDataFactory.createProspects(1, { status: 'archived' })

      const result = await service.list({
        page: 1,
        limit: 10,
        status: 'active',
        sort_by: 'created_at',
        sort_order: 'desc'
      })

      expect(result.prospects.length).toBe(2)
      result.prospects.forEach((p) => {
        expect(p.status).toBe('active')
      })
    })

    it('should handle pagination correctly', async () => {
      await TestDataFactory.createProspects(25)

      // First page
      const page1 = await service.list({
        page: 1,
        limit: 10,
        sort_by: 'created_at',
        sort_order: 'desc'
      })

      expect(page1.prospects.length).toBe(10)
      expect(page1.total).toBe(25)

      // Second page
      const page2 = await service.list({
        page: 2,
        limit: 10,
        sort_by: 'created_at',
        sort_order: 'desc'
      })

      expect(page2.prospects.length).toBe(10)
      expect(page2.total).toBe(25)

      // Third page
      const page3 = await service.list({
        page: 3,
        limit: 10,
        sort_by: 'created_at',
        sort_order: 'desc'
      })

      expect(page3.prospects.length).toBe(5)
      expect(page3.total).toBe(25)
    })

    it('should sort by different fields', async () => {
      await TestDataFactory.createProspect({ companyName: 'Alpha Corp', riskScore: 50 })
      await TestDataFactory.createProspect({ companyName: 'Beta Inc', riskScore: 80 })
      await TestDataFactory.createProspect({ companyName: 'Gamma LLC', riskScore: 65 })

      // Sort by risk_score descending
      const byScore = await service.list({
        page: 1,
        limit: 10,
        sort_by: 'risk_score',
        sort_order: 'desc'
      })

      expect(byScore.prospects[0].risk_score).toBe(80)
      expect(byScore.prospects[1].risk_score).toBe(65)
      expect(byScore.prospects[2].risk_score).toBe(50)

      // Sort by company_name ascending
      const byName = await service.list({
        page: 1,
        limit: 10,
        sort_by: 'company_name',
        sort_order: 'asc'
      })

      expect(byName.prospects[0].company_name).toBe('Alpha Corp')
      expect(byName.prospects[1].company_name).toBe('Beta Inc')
      expect(byName.prospects[2].company_name).toBe('Gamma LLC')
    })
  })

  describe('getById', () => {
    it('should return prospect by id', async () => {
      const created = await TestDataFactory.createProspect({
        companyName: 'Test Company',
        state: 'NY'
      })

      const result = await service.getById(created.id)

      expect(result).toBeDefined()
      expect(result?.id).toBe(created.id)
      expect(result?.company_name).toBe('Test Company')
      expect(result?.state).toBe('NY')
    })

    it('should return null for non-existent id', async () => {
      const result = await service.getById('00000000-0000-0000-0000-000000000000')

      expect(result).toBeNull()
    })

    it('should include growth signals count', async () => {
      const prospect = await TestDataFactory.createProspect()
      await TestDataFactory.createGrowthSignal(prospect.id, 'hiring', false)
      await TestDataFactory.createGrowthSignal(prospect.id, 'permits', false)

      const result = await service.getById(prospect.id)

      expect(result).toBeDefined()
      expect(result?.growth_signals_count).toBe(2)
    })
  })

  describe('create', () => {
    it('should create a new prospect', async () => {
      const prospectData = {
        company_name: 'New Test Company',
        state: 'CA',
        industry: 'Technology',
        lien_amount: 750000,
        risk_score: 85,
        status: 'active' as const
      }

      const result = await service.create(prospectData)

      expect(result).toBeDefined()
      expect(result.id).toBeDefined()
      expect(result.company_name).toBe(prospectData.company_name)
      expect(result.state).toBe(prospectData.state)
      expect(result.industry).toBe(prospectData.industry)
      expect(result.lien_amount).toBe(prospectData.lien_amount)
      expect(result.risk_score).toBe(prospectData.risk_score)
      expect(result.status).toBe(prospectData.status)
    })

    it('should set default status to active', async () => {
      const result = await service.create({
        company_name: 'Default Status Test',
        state: 'TX'
      })

      expect(result.status).toBe('active')
    })
  })

  describe('update', () => {
    it('should update prospect fields', async () => {
      const prospect = await TestDataFactory.createProspect({
        companyName: 'Original Name',
        riskScore: 70
      })

      const result = await service.update(prospect.id, {
        company_name: 'Updated Name',
        risk_score: 85
      })

      expect(result).toBeDefined()
      expect(result?.company_name).toBe('Updated Name')
      expect(result?.risk_score).toBe(85)
    })

    it('should return null for non-existent id', async () => {
      const result = await service.update('00000000-0000-0000-0000-000000000000', {
        company_name: 'Test'
      })

      expect(result).toBeNull()
    })

    it('should update only provided fields', async () => {
      const prospect = await TestDataFactory.createProspect({
        companyName: 'Test Company',
        state: 'NY',
        riskScore: 75
      })

      const result = await service.update(prospect.id, {
        risk_score: 90
      })

      expect(result).toBeDefined()
      expect(result?.company_name).toBe('Test Company')
      expect(result?.state).toBe('NY')
      expect(result?.risk_score).toBe(90)
    })
  })

  describe('delete', () => {
    it('should delete a prospect', async () => {
      const prospect = await TestDataFactory.createProspect()

      const result = await service.delete(prospect.id)

      expect(result).toBe(true)

      // Verify it's deleted
      const found = await service.getById(prospect.id)
      expect(found).toBeNull()
    })

    it('should return false for non-existent id', async () => {
      const result = await service.delete('00000000-0000-0000-0000-000000000000')

      expect(result).toBe(false)
    })
  })

  describe('getStats', () => {
    it('should return prospect statistics', async () => {
      await TestDataFactory.createProspects(5, { status: 'active' })
      await TestDataFactory.createProspects(3, { status: 'converted' })
      await TestDataFactory.createProspects(2, { status: 'archived' })

      const stats = await service.getStats()

      expect(stats).toBeDefined()
      expect(stats.total_prospects).toBe(10)
      expect(stats.active_prospects).toBe(5)
      expect(stats.converted_prospects).toBe(3)
      expect(stats.archived_prospects).toBe(2)
    })

    it('should calculate average risk score', async () => {
      await TestDataFactory.createProspect({ riskScore: 60 })
      await TestDataFactory.createProspect({ riskScore: 80 })
      await TestDataFactory.createProspect({ riskScore: 90 })

      const stats = await service.getStats()

      expect(stats.avg_risk_score).toBeCloseTo(76.67, 1)
    })

    it('should return zero stats when no prospects exist', async () => {
      const stats = await service.getStats()

      expect(stats.total_prospects).toBe(0)
      expect(stats.active_prospects).toBe(0)
      expect(stats.avg_risk_score).toBe(0)
    })
  })
})
