import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PricingPage } from '../PricingPage'

describe('PricingPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('captures signup interest and redirects when checkout is configured', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({ configured: true, provider: 'stripe' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'checkout_started',
          checkoutAvailable: true,
          url: 'https://checkout.stripe.test/session'
        })
      })
    vi.stubGlobal('fetch', fetchMock)

    const hrefSetter = vi.fn()
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        set href(value: string) {
          hrefSetter(value)
        }
      }
    })

    render(<PricingPage />)

    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: 'buyer@example.com' }
    })
    fireEvent.change(screen.getByLabelText(/company/i), {
      target: { value: 'Buyer Co' }
    })
    const checkoutButtons = await screen.findAllByRole('button', { name: /start free trial/i })
    fireEvent.click(checkoutButtons[0])

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith('/api/billing/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'buyer@example.com',
          companyName: 'Buyer Co',
          tier: 'starter'
        })
      })
    })
    expect(hrefSetter).toHaveBeenCalledWith('https://checkout.stripe.test/session')

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation
    })
  })

  it('captures waitlist interest when checkout is not configured', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({ configured: false, provider: 'stripe' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'waitlisted',
          checkoutAvailable: false
        })
      })
    vi.stubGlobal('fetch', fetchMock)

    render(<PricingPage />)

    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: 'waitlist@example.com' }
    })
    const waitlistButtons = await screen.findAllByRole('button', { name: /join waitlist/i })
    fireEvent.click(waitlistButtons[0])

    await screen.findByText(/you are on the waitlist/i)
    expect(fetchMock).toHaveBeenLastCalledWith('/api/billing/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'waitlist@example.com',
        companyName: undefined,
        tier: 'starter'
      })
    })
  })
})
