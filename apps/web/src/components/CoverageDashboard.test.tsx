import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CoverageDashboard } from './CoverageDashboard'
import { fetchCoverageDashboard } from '@/lib/api/health'

vi.mock('@/lib/api/health', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/health')>('@/lib/api/health')

  return {
    ...actual,
    fetchCoverageDashboard: vi.fn()
  }
})

describe('CoverageDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not enable sample coverage through the legacy preview prop', async () => {
    vi.mocked(fetchCoverageDashboard).mockRejectedValueOnce(new Error('Coverage API offline'))
    render(<CoverageDashboard dataTier="paid" usePreviewData />)
    expect(await screen.findByText('Coverage API offline')).toBeInTheDocument()
    expect(fetchCoverageDashboard).toHaveBeenCalled()
    expect(screen.queryByText('California')).not.toBeInTheDocument()
    expect(screen.queryByText(/Operational readiness snapshot/i)).not.toBeInTheDocument()
  })

  it('does not silently fall back to synthetic data when live coverage fails', async () => {
    vi.mocked(fetchCoverageDashboard).mockRejectedValueOnce(new Error('Coverage API offline'))

    render(<CoverageDashboard dataTier="paid" />)

    expect(await screen.findByText('Coverage Dashboard')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Live coverage telemetry is unavailable. Synthetic fallback is disabled for this view.'
      )
    ).toBeInTheDocument()
    expect(screen.getByText('Coverage API offline')).toBeInTheDocument()
    expect(screen.queryByText('California')).not.toBeInTheDocument()
  })
})
