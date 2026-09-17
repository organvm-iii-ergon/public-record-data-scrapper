import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IntegrationsDialog } from '../IntegrationsDialog'

const request = vi.hoisted(() => vi.fn())
vi.mock('@/lib/api/client', () => ({ apiRequest: request }))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    promise: vi.fn((p) => p)
  }
}))

describe('IntegrationsDialog', () => {
  beforeEach(() => {
    request.mockReset()
    request.mockImplementation(async (path, options) => {
      if (options?.method === 'POST')
        return { endpoint: { id: 'created', url: options.body.url, events: [], status: 'active' } }
      return path === '/webhooks' ? { endpoints: [] } : { deliveries: [] }
    })
  })
  it('renders CRM tab by default with native HubSpot push details', () => {
    render(<IntegrationsDialog open={true} onOpenChange={vi.fn()} />)

    expect(screen.getByText('Customer System Integrations')).toBeInTheDocument()
    expect(screen.getByText(/Native HubSpot Push/i)).toBeInTheDocument()
    expect(screen.getByText('HubSpot')).toBeInTheDocument()
    expect(screen.getByText('Salesforce')).toBeInTheDocument()
    expect(screen.getAllByText(/Private App Access Token/i)[0]).toBeInTheDocument()
    expect(screen.getByText(/Test Connection/i)).toBeInTheDocument()
  })

  it('switches to Webhooks tab and displays endpoints and DLQ information', async () => {
    const user = userEvent.setup()
    render(<IntegrationsDialog open={true} onOpenChange={vi.fn()} />)

    const webhooksTab = screen.getByText(/Webhooks & Dead-Letter Queue/i)
    await user.click(webhooksTab)

    expect(screen.getByText(/Register New Webhook Endpoint/i)).toBeInTheDocument()
    expect(screen.getByText(/HMAC-SHA256 \(X-UCC-Signature\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Recent Deliveries & Dead-Letter Queue \(DLQ\)/i)).toBeInTheDocument()
    expect(screen.queryByText(/Replay DLQ/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Apex Logistics')).not.toBeInTheDocument()
  })

  it('allows registering a new webhook endpoint and displays feedback', async () => {
    const user = userEvent.setup()
    render(<IntegrationsDialog open={true} onOpenChange={vi.fn()} />)

    await user.click(screen.getByText(/Webhooks & Dead-Letter Queue/i))

    const urlInput = screen.getByPlaceholderText('https://your-domain.com/webhooks/ucc')
    await user.type(urlInput, 'https://example.com/api/webhooks')

    const registerBtn = screen.getByText('Register Endpoint')
    await user.click(registerBtn)

    expect(await screen.findByText('https://example.com/api/webhooks')).toBeInTheDocument()
    expect(request).toHaveBeenCalledWith('/webhooks', expect.objectContaining({ method: 'POST' }))
  })
  it('shows an API failure without seeded endpoints or delivered events', async () => {
    request.mockRejectedValue(new Error('Authentication required'))
    const user = userEvent.setup()
    render(<IntegrationsDialog open onOpenChange={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Authentication required')
    await user.click(screen.getByText(/Webhooks & Dead-Letter Queue/i))
    expect(screen.queryByText('Apex Logistics')).not.toBeInTheDocument()
    expect(screen.queryByText(/Replay DLQ/i)).not.toBeInTheDocument()
  })
  it('maps delivery history from the API without inventing a successful delivery', async () => {
    request.mockImplementation(async (path) =>
      path === '/webhooks'
        ? { endpoints: [] }
        : {
            deliveries: [
              {
                id: 'provider-receipt',
                event: 'prospect.updated',
                status: 'dead_letter',
                attempts: 2,
                max_attempts: 5,
                response_status: 503
              }
            ]
          }
    )
    const user = userEvent.setup()
    render(<IntegrationsDialog open onOpenChange={vi.fn()} />)
    await user.click(screen.getByText(/Webhooks & Dead-Letter Queue/i))
    expect(await screen.findByText('2/5')).toBeInTheDocument()
    expect(screen.getByText('HTTP 503')).toBeInTheDocument()
    expect(screen.queryByText('Delivered')).not.toBeInTheDocument()
  })
})
