
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchDashboardStats } from '../databaseService'
import { getDatabase, createQueries } from '@/lib/database'

// Mock dependencies
vi.mock('@/lib/database', () => ({
  initDatabase: vi.fn(),
  getDatabase: vi.fn(),
  createQueries: vi.fn()
}))

describe('fetchDashboardStats', () => {
  let mockQueries: any
  let mockDb: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup mock query results
    mockQueries = {
      getProspectStats: vi.fn().mockResolvedValue({
        total: 100,
        by_status: { new: 50, contacted: 50 },
        avg_priority_score: 75,
        avg_health_score: 85
      })
    }

    // Setup database mocks
    mockDb = {}
    ;(getDatabase as any).mockReturnValue(mockDb)
    ;(createQueries as any).mockReturnValue(mockQueries)
  })

  it('calculates average health grade correctly', async () => {
    const stats = await fetchDashboardStats()

    expect(stats).toBeDefined()
    expect(stats.avgPriorityScore).toBe(75) // Should be correct now
    expect(stats.avgHealthGrade).toBe('B') // 85 -> B
  })

  it('calculates A grade correctly', async () => {
    mockQueries.getProspectStats.mockResolvedValue({
      total: 100,
      avg_priority_score: 95,
      avg_health_score: 95
    })

    const stats = await fetchDashboardStats()
    expect(stats.avgHealthGrade).toBe('A')
  })

  it('calculates C grade correctly', async () => {
     mockQueries.getProspectStats.mockResolvedValue({
      total: 100,
      avg_priority_score: 75,
      avg_health_score: 75
    })

    const stats = await fetchDashboardStats()
    expect(stats.avgHealthGrade).toBe('C')
  })
})
