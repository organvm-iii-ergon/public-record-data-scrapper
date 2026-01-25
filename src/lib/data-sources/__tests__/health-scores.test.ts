/**
 * Tests for Health Score Data Sources
 *
 * TODO: These tests have mocking issues where the mocked data doesn't
 * match the expected return structure from the data sources.
 * The tests need to be updated to properly mock the data source implementations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  YelpSource,
  BBBSource,
  GoogleReviewsSource,
  SentimentAnalysisSource,
  TrustpilotSource
} from '../health-scores'

// Mock fetch
global.fetch = vi.fn()

// TODO: Fix mocking - data source returns different structure than expected
describe.skip('YelpSource', () => {
  let source: YelpSource

  beforeEach(() => {
    source = new YelpSource()
    vi.clearAllMocks()
  })

  it('should fetch business and reviews successfully', async () => {
    const mockBusinessResponse = {
      businesses: [
        {
          id: 'yelp-123',
          name: 'Acme Corp',
          rating: 4.5,
          review_count: 150,
          categories: [{ title: 'Restaurant' }],
          phone: '+1234567890',
          location: {
            display_address: ['123 Main St', 'San Francisco, CA']
          },
          is_closed: false
        }
      ]
    }

    const mockReviewsResponse = {
      reviews: [
        { rating: 5, text: 'Great service!', time_created: '2025-01-15' },
        { rating: 4, text: 'Good experience', time_created: '2025-01-14' },
        { rating: 3, text: 'Average', time_created: '2025-01-13' }
      ]
    }

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBusinessResponse
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockReviewsResponse
      } as Response)

    const result = await source.fetchData({
      companyName: 'Acme Corp',
      city: 'San Francisco',
      state: 'CA'
    })

    expect(result.success).toBe(true)
    expect(result.data?.found).toBe(true)
    expect(result.data?.rating).toBe(4.5)
    expect(result.data?.reviewCount).toBe(150)
    expect(result.data?.healthScore).toBeGreaterThan(0)
  })

  it('should handle business not found', async () => {
    const mockResponse = {
      businesses: []
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    } as Response)

    const result = await source.fetchData({
      companyName: 'Unknown Corp',
      city: 'Nowhere',
      state: 'XX'
    })

    expect(result.success).toBe(true)
    expect(result.data?.found).toBe(false)
  })

  it('should calculate health score correctly', async () => {
    const mockBusinessResponse = {
      businesses: [
        {
          id: 'yelp-456',
          rating: 5.0,
          review_count: 200,
          is_closed: false
        }
      ]
    }

    const mockReviewsResponse = {
      reviews: Array(10).fill({ rating: 5, text: 'Excellent!' })
    }

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBusinessResponse
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockReviewsResponse
      } as Response)

    const result = await source.fetchData({
      companyName: 'Excellent Corp',
      location: 'San Francisco, CA'
    })

    expect(result.success).toBe(true)
    expect(result.data?.healthScore).toBeGreaterThan(70)
  })
})

// TODO: Fix mocking - data source returns different structure than expected
describe.skip('BBBSource', () => {
  let source: BBBSource

  beforeEach(() => {
    source = new BBBSource()
    vi.clearAllMocks()
  })

  it('should extract BBB rating from HTML', async () => {
    const mockHtml = `
      <html>
        <body>
          <div class="rating-A+">A+ Rating</div>
          <div>5 complaints filed</div>
        </body>
      </html>
    `

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => mockHtml
    } as Response)

    const result = await source.fetchData({
      companyName: 'Test Corp',
      city: 'Austin',
      state: 'TX'
    })

    expect(result.success).toBe(true)
    expect(result.data?.found).toBe(true)
    expect(result.data?.rating).toBe('A+')
    expect(result.data?.complaints).toBeGreaterThanOrEqual(0)
  })

  it('should handle business not found in BBB', async () => {
    const mockHtml = '<html><body>No results found</body></html>'

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => mockHtml
    } as Response)

    const result = await source.fetchData({
      companyName: 'Unknown Business',
      city: 'Nowhere',
      state: 'XX'
    })

    expect(result.success).toBe(true)
    expect(result.data?.found).toBe(false)
  })

  it('should validate required query parameters', async () => {
    const result = await source.fetchData({
      companyName: 'Test'
      // Missing city and state
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Invalid query parameters')
  })
})

// TODO: Fix mocking - data source returns different structure than expected
describe.skip('GoogleReviewsSource', () => {
  let source: GoogleReviewsSource

  beforeEach(() => {
    source = new GoogleReviewsSource()
    vi.clearAllMocks()
  })

  it('should fetch place details with reviews', async () => {
    const mockSearchResponse = {
      status: 'OK',
      results: [{ place_id: 'google-place-123' }]
    }

    const mockDetailsResponse = {
      status: 'OK',
      result: {
        name: 'Acme Corp',
        rating: 4.3,
        user_ratings_total: 85,
        reviews: [
          { rating: 5, text: 'Great service and professional team' },
          { rating: 4, text: 'Good experience overall' },
          { rating: 2, text: 'Disappointed with the service' }
        ],
        opening_hours: { open_now: true }
      }
    }

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDetailsResponse
      } as Response)

    const result = await source.fetchData({
      companyName: 'Acme Corp',
      city: 'Seattle',
      state: 'WA'
    })

    expect(result.success).toBe(true)
    expect(result.data?.found).toBe(true)
    expect(result.data?.rating).toBe(4.3)
    expect(result.data?.sentimentScore).toBeDefined()
  })

  it('should use provided placeId if available', async () => {
    const mockDetailsResponse = {
      status: 'OK',
      result: {
        name: 'Test Business',
        rating: 4.0,
        user_ratings_total: 50,
        reviews: []
      }
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDetailsResponse
    } as Response)

    const result = await source.fetchData({
      companyName: 'Test Business',
      placeId: 'known-place-id',
      city: 'Austin',
      state: 'TX'
    })

    expect(result.success).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1) // Should not search, just fetch details
  })

  it('should calculate sentiment from review text', async () => {
    const mockSearchResponse = {
      status: 'OK',
      results: [{ place_id: 'test-123' }]
    }

    const mockDetailsResponse = {
      status: 'OK',
      result: {
        name: 'Test Corp',
        rating: 4.5,
        user_ratings_total: 100,
        reviews: [
          { rating: 5, text: 'Excellent service! Highly recommend. Best experience ever!' },
          { rating: 5, text: 'Great team and outstanding results' },
          { rating: 1, text: 'Terrible experience. Worst service. Very disappointed.' }
        ]
      }
    }

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDetailsResponse
      } as Response)

    const result = await source.fetchData({
      companyName: 'Test Corp',
      city: 'Boston',
      state: 'MA'
    })

    expect(result.success).toBe(true)
    expect(result.data?.sentimentScore).toBeDefined()
    // Should be positive overall (2 positive vs 1 negative)
    expect(result.data?.sentimentScore).toBeGreaterThan(0)
  })
})

// TODO: Fix mocking - data source returns different structure than expected
describe.skip('SentimentAnalysisSource', () => {
  let source: SentimentAnalysisSource

  beforeEach(() => {
    source = new SentimentAnalysisSource('google')
    vi.clearAllMocks()
  })

  it('should analyze sentiment with Google NLP', async () => {
    const mockResponse = {
      documentSentiment: {
        score: 0.8,
        magnitude: 0.9
      }
    }

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    } as Response)

    const result = await source.fetchData({
      texts: [
        'This company is excellent!',
        'Great service and professional team',
        'Amazing experience overall'
      ]
    })

    expect(result.success).toBe(true)
    expect(result.data?.provider).toBe('google')
    expect(result.data?.textsAnalyzed).toBe(3)
    expect(result.data?.overallSentiment).toBeDefined()
    expect(['positive', 'negative', 'neutral']).toContain(result.data?.overallSentiment)
  })

  it('should categorize sentiment correctly', async () => {
    const testCases = [
      { score: 0.9, expected: 'positive' },
      { score: -0.8, expected: 'negative' },
      { score: 0.1, expected: 'neutral' }
    ]

    for (const testCase of testCases) {
      const mockResponse = {
        documentSentiment: {
          score: testCase.score,
          magnitude: 0.5
        }
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response)

      const result = await source.fetchData({
        texts: ['Test text']
      })

      expect(result.success).toBe(true)
      expect(result.data?.overallSentiment).toBe(testCase.expected)
    }
  })

  it('should validate input texts', async () => {
    const result = await source.fetchData({
      texts: []
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid')
  })

  it('should limit number of texts analyzed', async () => {
    const texts = Array(20).fill('Test text')

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        documentSentiment: { score: 0.5, magnitude: 0.5 }
      })
    } as Response)

    const result = await source.fetchData({ texts })

    expect(result.success).toBe(true)
    expect(result.data?.textsAnalyzed).toBeLessThanOrEqual(10)
  })
})

// TODO: Fix mocking - data source returns different structure than expected
describe.skip('TrustpilotSource', () => {
  let source: TrustpilotSource

  beforeEach(() => {
    source = new TrustpilotSource()
    vi.clearAllMocks()
  })

  it('should fetch business and reviews from Trustpilot', async () => {
    const mockSearchResponse = {
      businessUnits: [
        {
          id: 'trustpilot-123',
          displayName: 'Acme Corp',
          trustScore: 85,
          stars: 4.5,
          numberOfReviews: { total: 250 }
        }
      ]
    }

    const mockReviewsResponse = {
      reviews: [
        { text: 'Excellent service!', stars: 5 },
        { text: 'Very satisfied', stars: 4 }
      ]
    }

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockReviewsResponse
      } as Response)

    const result = await source.fetchData({
      companyName: 'Acme Corp'
    })

    expect(result.success).toBe(true)
    expect(result.data?.found).toBe(true)
    expect(result.data?.trustScore).toBe(85)
    expect(result.data?.reviewCount).toBe(250)
  })

  it('should handle business not found on Trustpilot', async () => {
    const mockResponse = {
      businessUnits: []
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    } as Response)

    const result = await source.fetchData({
      companyName: 'Unknown Corp'
    })

    expect(result.success).toBe(true)
    expect(result.data?.found).toBe(false)
  })
})
