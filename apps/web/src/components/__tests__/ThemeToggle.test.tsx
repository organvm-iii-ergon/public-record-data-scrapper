import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { ThemeToggle } from '../ThemeToggle'

const mockSetTheme = vi.fn()
const mockTheme = vi.fn(() => 'light')

vi.mock('next-themes', () => ({
  useTheme: () => ({
    setTheme: mockSetTheme,
    theme: mockTheme()
  })
}))

vi.mock('@public-records/ui/button', () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: {
    children: ReactNode
    onClick?: () => void
    [key: string]: unknown
  }) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  )
}))

vi.mock('@public-records/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => (
    <div data-testid="dropdown">{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <div data-testid="dropdown-trigger">{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button data-testid="dropdown-item" onClick={onClick}>
      {children}
    </button>
  )
}))

vi.mock('@phosphor-icons/react', () => ({
  Sun: () => <span data-testid="sun-icon">Sun</span>,
  Moon: () => <span data-testid="moon-icon">Moon</span>,
  Palette: () => <span data-testid="palette-icon">Palette</span>,
  Leaf: () => <span data-testid="leaf-icon">Leaf</span>,
  Terminal: () => <span data-testid="terminal-icon">Terminal</span>
}))

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders dropdown menu', () => {
      render(<ThemeToggle />)

      expect(screen.getByTestId('dropdown')).toBeInTheDocument()
    })

    it('renders trigger button', () => {
      render(<ThemeToggle />)

      expect(screen.getByTestId('dropdown-trigger')).toBeInTheDocument()
    })

    it('renders theme icons in menu', () => {
      render(<ThemeToggle />)

      // Check that theme icons are rendered in the menu
      expect(screen.getAllByTestId('moon-icon').length).toBeGreaterThan(0)
      expect(screen.getAllByTestId('sun-icon').length).toBeGreaterThan(0)
      expect(screen.getAllByTestId('leaf-icon').length).toBeGreaterThan(0)
      expect(screen.getAllByTestId('palette-icon').length).toBeGreaterThan(0)
      expect(screen.getAllByTestId('terminal-icon').length).toBeGreaterThan(0)
    })

    it('renders screen reader text', () => {
      render(<ThemeToggle />)

      expect(screen.getByText('Toggle theme')).toBeInTheDocument()
    })

    it('renders five theme options', () => {
      render(<ThemeToggle />)

      expect(screen.getByText('Dark Professional')).toBeInTheDocument()
      expect(screen.getByText('Light Clean')).toBeInTheDocument()
      expect(screen.getByText('Dark Green')).toBeInTheDocument()
      expect(screen.getByText('Purple Classic')).toBeInTheDocument()
      expect(screen.getByText('Hacker')).toBeInTheDocument()
    })
  })

  describe('theme selection', () => {
    it('calls setTheme with "dark-professional" when Dark Professional is clicked', () => {
      render(<ThemeToggle />)

      const items = screen.getAllByTestId('dropdown-item')
      const item = items.find((item) => item.textContent?.includes('Dark Professional'))
      fireEvent.click(item!)

      expect(mockSetTheme).toHaveBeenCalledWith('dark-professional')
    })

    it('calls setTheme with "light-clean" when Light Clean is clicked', () => {
      render(<ThemeToggle />)

      const items = screen.getAllByTestId('dropdown-item')
      const item = items.find((item) => item.textContent?.includes('Light Clean'))
      fireEvent.click(item!)

      expect(mockSetTheme).toHaveBeenCalledWith('light-clean')
    })

    it('calls setTheme with "dark-green" when Dark Green is clicked', () => {
      render(<ThemeToggle />)

      const items = screen.getAllByTestId('dropdown-item')
      const item = items.find((item) => item.textContent?.includes('Dark Green'))
      fireEvent.click(item!)

      expect(mockSetTheme).toHaveBeenCalledWith('dark-green')
    })

    it('calls setTheme with "current-fixed" when Purple Classic is clicked', () => {
      render(<ThemeToggle />)

      const items = screen.getAllByTestId('dropdown-item')
      const item = items.find((item) => item.textContent?.includes('Purple Classic'))
      fireEvent.click(item!)

      expect(mockSetTheme).toHaveBeenCalledWith('current-fixed')
    })

    it('calls setTheme with "hacker" when Hacker is clicked', () => {
      render(<ThemeToggle />)

      const items = screen.getAllByTestId('dropdown-item')
      const item = items.find((item) => item.textContent?.includes('Hacker'))
      fireEvent.click(item!)

      expect(mockSetTheme).toHaveBeenCalledWith('hacker')
    })
  })
})
