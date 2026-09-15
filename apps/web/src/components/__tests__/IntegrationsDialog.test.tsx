import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { IntegrationsDialog } from '../IntegrationsDialog'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    promise: vi.fn((p) => p)
  }
}))

describe('IntegrationsDialog', () => {
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
    expect(screen.getByText(/Dead-Letter \(DLQ\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Replay DLQ/i)).toBeInTheDocument()
  })

  it('allows registering a new webhook endpoint and displays feedback', async () => {
    const user = userEvent.setup()
    render(<IntegrationsDialog open={true} onOpenChange={vi.fn()} />)

    await user.click(screen.getByText(/Webhooks & Dead-Letter Queue/i))

    const urlInput = screen.getByPlaceholderText('https://your-domain.com/webhooks/ucc')
    await user.type(urlInput, 'https://example.com/api/webhooks')

    const registerBtn = screen.getByText('Register Endpoint')
    await user.click(registerBtn)

    expect(screen.getByText('https://example.com/api/webhooks')).toBeInTheDocument()
  })
})
