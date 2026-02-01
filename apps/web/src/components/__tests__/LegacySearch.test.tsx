import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { LegacySearch } from '../LegacySearch'

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
    variant,
    className
  }: {
    children: ReactNode
    onClick?: () => void
    disabled?: boolean
    type?: 'submit' | 'button'
    variant?: string
    className?: string
  }) => (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      className={className}
    >
      {children}
    </button>
  )
}))

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    className,
    ...props
  }: {
    value?: string
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
    placeholder?: string
    className?: string
  }) => (
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      data-testid="search-input"
      {...props}
    />
  )
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({
    children,
    value,
    onValueChange
  }: {
    children: ReactNode
    value?: string
    onValueChange?: (value: string) => void
  }) => (
    <div data-testid="select">
      <select
        data-testid="source-select"
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        <option value="bing">Web (Bing snippets)</option>
        <option value="ucc">Public UCC filings (mock demo)</option>
        <option value="both">Both</option>
      </select>
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: () => null
}))

vi.mock('@/components/ui/table', () => ({
  Table: ({ children, className }: { children: ReactNode; className?: string }) => (
    <table data-testid="results-table" className={className}>
      {children}
    </table>
  ),
  TableBody: ({ children }: { children: ReactNode }) => <tbody>{children}</tbody>,
  TableCell: ({ children, className }: { children: ReactNode; className?: string }) => (
    <td className={className}>{children}</td>
  ),
  TableHead: ({ children, className }: { children: ReactNode; className?: string }) => (
    <th className={className}>{children}</th>
  ),
  TableHeader: ({ children }: { children: ReactNode }) => <thead>{children}</thead>,
  TableRow: ({ children, className }: { children: ReactNode; className?: string }) => (
    <tr className={className}>{children}</tr>
  )
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: (string | undefined | false)[]) => classes.filter(Boolean).join(' ')
}))

describe('LegacySearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('rendering', () => {
    it('renders the search title', () => {
      render(<LegacySearch />)
      expect(screen.getByText('Legacy Web & Filing Search')).toBeInTheDocument()
    })

    it('renders the description', () => {
      render(<LegacySearch />)
      expect(screen.getByText(/Run the original keyword search experience/)).toBeInTheDocument()
    })

    it('renders the search input', () => {
      render(<LegacySearch />)
      expect(screen.getByTestId('search-input')).toBeInTheDocument()
    })

    it('renders the source selector', () => {
      render(<LegacySearch />)
      expect(screen.getByTestId('source-select')).toBeInTheDocument()
    })

    it('renders the search button', () => {
      render(<LegacySearch />)
      expect(screen.getByRole('button', { name: /start search/i })).toBeInTheDocument()
    })

    it('renders the clear button', () => {
      render(<LegacySearch />)
      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
    })

    it('shows initial idle status', () => {
      render(<LegacySearch />)
      expect(screen.getByRole('status')).toHaveTextContent('Idle')
    })
  })

  describe('form validation', () => {
    it('shows error when searching with empty query', async () => {
      render(<LegacySearch />)

      const searchButton = screen.getByRole('button', { name: /start search/i })
      await userEvent.click(searchButton)

      expect(screen.getByRole('status')).toHaveTextContent('Type a search phrase first')
    })

    it('shows error when query is only whitespace', async () => {
      render(<LegacySearch />)

      const input = screen.getByTestId('search-input')
      await userEvent.type(input, '   ')

      const searchButton = screen.getByRole('button', { name: /start search/i })
      await userEvent.click(searchButton)

      expect(screen.getByRole('status')).toHaveTextContent('Type a search phrase first')
    })
  })

  describe('search functionality', () => {
    it('makes API call with correct parameters', async () => {
      const mockResults = { results: [{ source: 'bing', title: 'Test', found: '2024-01-15' }] }
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResults)
      })

      render(<LegacySearch />)

      const input = screen.getByTestId('search-input')
      await userEvent.type(input, 'test query')

      const searchButton = screen.getByRole('button', { name: /start search/i })
      await userEvent.click(searchButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/search?q=test+query&source=bing')
        )
      })
    })

    it('shows loading state during search', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      render(<LegacySearch />)

      const input = screen.getByTestId('search-input')
      await userEvent.type(input, 'test query')

      const searchButton = screen.getByRole('button', { name: /start search/i })
      await userEvent.click(searchButton)

      expect(screen.getByRole('status')).toHaveTextContent('Searching…')
      expect(screen.getByRole('button', { name: /searching/i })).toBeDisabled()
    })

    it('displays results in table', async () => {
      const mockResults = {
        results: [
          {
            source: 'bing',
            title: 'Result 1',
            snippet: 'Snippet 1',
            url: 'http://example.com',
            found: '2024-01-15T10:00:00Z'
          },
          { source: 'ucc', title: 'Result 2', snippet: 'Snippet 2', found: '2024-01-16T10:00:00Z' }
        ]
      }
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResults)
      })

      render(<LegacySearch />)

      const input = screen.getByTestId('search-input')
      await userEvent.type(input, 'test query')

      const searchButton = screen.getByRole('button', { name: /start search/i })
      await userEvent.click(searchButton)

      await waitFor(() => {
        expect(screen.getByTestId('results-table')).toBeInTheDocument()
      })

      expect(screen.getByText('Result 1')).toBeInTheDocument()
      expect(screen.getByText('Result 2')).toBeInTheDocument()
    })

    it('shows result count in status', async () => {
      const mockResults = {
        results: [
          { source: 'bing', title: 'Result 1', found: '2024-01-15' },
          { source: 'bing', title: 'Result 2', found: '2024-01-15' }
        ]
      }
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResults)
      })

      render(<LegacySearch />)

      const input = screen.getByTestId('search-input')
      await userEvent.type(input, 'test')

      await userEvent.click(screen.getByRole('button', { name: /start search/i }))

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('Found 2 items (duplicates filtered)')
      })
    })

    it('handles singular item count', async () => {
      const mockResults = {
        results: [{ source: 'bing', title: 'Result 1', found: '2024-01-15' }]
      }
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResults)
      })

      render(<LegacySearch />)

      const input = screen.getByTestId('search-input')
      await userEvent.type(input, 'test')

      await userEvent.click(screen.getByRole('button', { name: /start search/i }))

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('Found 1 item (duplicates filtered)')
      })
    })
  })

  describe('error handling', () => {
    it('shows error message on server error', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500
      })

      render(<LegacySearch />)

      const input = screen.getByTestId('search-input')
      await userEvent.type(input, 'test')

      await userEvent.click(screen.getByRole('button', { name: /start search/i }))

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('Error: Server error')
      })
    })

    it('shows error message on network failure', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'))

      render(<LegacySearch />)

      const input = screen.getByTestId('search-input')
      await userEvent.type(input, 'test')

      await userEvent.click(screen.getByRole('button', { name: /start search/i }))

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('Error: Network error')
      })
    })
  })

  describe('clear functionality', () => {
    it('clears query and results', async () => {
      const mockResults = {
        results: [{ source: 'bing', title: 'Result', found: '2024-01-15' }]
      }
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResults)
      })

      render(<LegacySearch />)

      const input = screen.getByTestId('search-input')
      await userEvent.type(input, 'test')
      await userEvent.click(screen.getByRole('button', { name: /start search/i }))

      await waitFor(() => {
        expect(screen.getByText('Result')).toBeInTheDocument()
      })

      await userEvent.click(screen.getByRole('button', { name: /clear/i }))

      expect(input).toHaveValue('')
      expect(screen.queryByTestId('results-table')).not.toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent('Idle')
    })
  })

  describe('source selection', () => {
    it('changes source selection', async () => {
      render(<LegacySearch />)

      const sourceSelect = screen.getByTestId('source-select')
      await userEvent.selectOptions(sourceSelect, 'ucc')

      expect(sourceSelect).toHaveValue('ucc')
    })

    it('uses selected source in API call', async () => {
      const mockResults = { results: [] }
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResults)
      })

      render(<LegacySearch />)

      const sourceSelect = screen.getByTestId('source-select')
      await userEvent.selectOptions(sourceSelect, 'both')

      const input = screen.getByTestId('search-input')
      await userEvent.type(input, 'test')

      await userEvent.click(screen.getByRole('button', { name: /start search/i }))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('source=both'))
      })
    })
  })

  describe('result links', () => {
    it('renders link for results with URL', async () => {
      const mockResults = {
        results: [
          { source: 'bing', title: 'Result', url: 'http://example.com', found: '2024-01-15' }
        ]
      }
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResults)
      })

      render(<LegacySearch />)

      const input = screen.getByTestId('search-input')
      await userEvent.type(input, 'test')
      await userEvent.click(screen.getByRole('button', { name: /start search/i }))

      await waitFor(() => {
        const link = screen.getByRole('link', { name: 'Open' })
        expect(link).toHaveAttribute('href', 'http://example.com')
        expect(link).toHaveAttribute('target', '_blank')
        expect(link).toHaveAttribute('rel', 'noopener noreferrer')
      })
    })

    it('shows dash for results without URL', async () => {
      const mockResults = {
        results: [{ source: 'bing', title: 'Result', found: '2024-01-15' }]
      }
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResults)
      })

      render(<LegacySearch />)

      const input = screen.getByTestId('search-input')
      await userEvent.type(input, 'test')
      await userEvent.click(screen.getByRole('button', { name: /start search/i }))

      await waitFor(() => {
        expect(screen.getByText('—')).toBeInTheDocument()
      })
    })
  })
})
