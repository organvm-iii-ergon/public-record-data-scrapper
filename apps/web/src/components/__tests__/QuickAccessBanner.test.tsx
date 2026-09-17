import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QuickAccessBanner } from '../QuickAccessBanner'

vi.mock('@phosphor-icons/react', () => ({
  Play: () => <span data-testid="play-icon">Play</span>,
  Rocket: () => <span data-testid="rocket-icon">Rocket</span>
}))

describe('QuickAccessBanner', () => {
  describe('rendering', () => {
    it('renders quick access label', () => {
      render(<QuickAccessBanner />)

      expect(screen.getByText(/Quick Access:/)).toBeInTheDocument()
    })

    it('renders video download link', () => {
      render(<QuickAccessBanner />)

      expect(screen.getByText('Watch 5-Min Investor Pitch')).toBeInTheDocument()
    })

    it('renders access page link', () => {
      render(<QuickAccessBanner />)

      expect(screen.getByText('Access Page')).toBeInTheDocument()
    })

    it('renders play icon', () => {
      render(<QuickAccessBanner />)

      expect(screen.getByTestId('play-icon')).toBeInTheDocument()
    })

    it('renders rocket icon', () => {
      render(<QuickAccessBanner />)

      expect(screen.getByTestId('rocket-icon')).toBeInTheDocument()
    })
  })

  describe('video link', () => {
    it('has correct href for video', () => {
      render(<QuickAccessBanner />)

      const videoLink = screen.getByText('Watch 5-Min Investor Pitch').closest('a')
      expect(videoLink).toHaveAttribute('href', '/public/videos/EXECUTIVE_VIDEO_SCRIPT.mp4')
    })

    it('has download attribute', () => {
      render(<QuickAccessBanner />)

      const videoLink = screen.getByText('Watch 5-Min Investor Pitch').closest('a')
      expect(videoLink).toHaveAttribute('download')
    })
  })

  describe('access page link', () => {
    it('has correct href for access page', () => {
      render(<QuickAccessBanner />)

      const accessLink = screen.getByText('Access Page').closest('a')
      expect(accessLink).toHaveAttribute('href', '/access.html')
    })

    it('opens in new tab', () => {
      render(<QuickAccessBanner />)

      const accessLink = screen.getByText('Access Page').closest('a')
      expect(accessLink).toHaveAttribute('target', '_blank')
    })

    it('has noopener noreferrer for security', () => {
      render(<QuickAccessBanner />)

      const accessLink = screen.getByText('Access Page').closest('a')
      expect(accessLink).toHaveAttribute('rel', 'noopener noreferrer')
    })
  })

  describe('styling', () => {
    it('renders with mica-effect class', () => {
      const { container } = render(<QuickAccessBanner />)

      expect(container.firstChild).toHaveClass('mica-effect')
    })
  })
})
