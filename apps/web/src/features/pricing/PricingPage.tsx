/**
 * Pricing page — displays subscription tiers and handles checkout.
 *
 * Checks /api/billing/status first to determine if Stripe is configured.
 * If not configured, shows a "coming soon" state.
 */

import { useState, useEffect } from 'react'

interface BillingStatus {
  configured: boolean
  provider: string
}

type SignupResult = {
  status?: string
  checkoutAvailable?: boolean
  url?: string
}

const TIERS = [
  {
    name: 'Starter',
    price: '$29',
    period: '/month',
    description: 'For individual researchers and small teams',
    features: [
      'Up to 1,000 record lookups/month',
      'Basic property data',
      'CSV export',
      'Email support'
    ],
    cta: 'Start Free Trial',
    highlighted: false
  },
  {
    name: 'Professional',
    price: '$99',
    period: '/month',
    description: 'For agencies and growing teams',
    features: [
      'Up to 10,000 record lookups/month',
      'Full property + owner data',
      'API access',
      'Batch processing',
      'Priority support'
    ],
    cta: 'Start Free Trial',
    highlighted: true
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large organizations with custom needs',
    features: [
      'Unlimited record lookups',
      'Dedicated infrastructure',
      'Custom integrations',
      'SLA guarantee',
      'Dedicated account manager'
    ],
    cta: 'Contact Sales',
    highlighted: false
  }
]

export function PricingPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/billing/status')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ configured: false, provider: 'none' }))
  }, [])

  async function handleCheckout(tierName: string) {
    if (!email.trim()) {
      setMessage('Enter your work email to continue.')
      return
    }

    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/billing/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          companyName: companyName.trim() || undefined,
          tier: tierName.toLowerCase()
        })
      })
      const data = (await res.json()) as SignupResult & { error?: string }
      if (!res.ok) {
        setMessage(data.error ?? 'Could not capture signup interest.')
        return
      }
      if (data.url) {
        window.location.href = data.url
        return
      }
      setMessage(
        data.status === 'captured'
          ? 'Thanks. Your free-plan interest was captured.'
          : 'Thanks. You are on the waitlist and we will follow up when checkout is ready.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>Pricing</h1>
      <p style={{ textAlign: 'center', opacity: 0.7, marginBottom: '2rem' }}>
        Public record intelligence at scale
      </p>
      <form
        onSubmit={(event) => event.preventDefault()}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1.5rem'
        }}
      >
        <label>
          <span style={{ display: 'block', marginBottom: 4 }}>Work email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid #555' }}
          />
        </label>
        <label>
          <span style={{ display: 'block', marginBottom: 4 }}>Company</span>
          <input
            type="text"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="Company name"
            style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid #555' }}
          />
        </label>
      </form>
      {message && (
        <p role="status" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          {message}
        </p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem'
        }}
      >
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            style={{
              border: tier.highlighted ? '2px solid #3b82f6' : '1px solid #333',
              borderRadius: 12,
              padding: '1.5rem',
              background: tier.highlighted ? '#1e293b' : 'transparent'
            }}
          >
            <h3>{tier.name}</h3>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>
              {tier.price}
              <span style={{ fontSize: '1rem', opacity: 0.6 }}>{tier.period}</span>
            </div>
            <p style={{ opacity: 0.7, fontSize: '0.9rem' }}>{tier.description}</p>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {tier.features.map((f) => (
                <li key={f} style={{ padding: '0.25rem 0' }}>
                  ✓ {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleCheckout(tier.name)}
              disabled={loading || status === null}
              style={{
                width: '100%',
                padding: '0.75rem',
                marginTop: '1rem',
                borderRadius: 8,
                border: 'none',
                background: tier.highlighted ? '#3b82f6' : '#444',
                color: '#fff',
                cursor: status === null ? 'not-allowed' : 'pointer',
                opacity: status === null ? 0.5 : 1
              }}
            >
              {status?.configured ? tier.cta : 'Join Waitlist'}
            </button>
          </div>
        ))}
      </div>

      {!status?.configured && (
        <p
          style={{
            textAlign: 'center',
            marginTop: '2rem',
            opacity: 0.5,
            fontSize: '0.85rem'
          }}
        >
          Payment processing is being configured. Check back soon.
        </p>
      )}
    </div>
  )
}

export default PricingPage
