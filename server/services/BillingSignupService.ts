import { database } from '../database/connection'

export type BillingSignupPlan = 'free' | 'starter' | 'professional' | 'enterprise'
export type BillingSignupStatus = 'captured' | 'waitlisted' | 'checkout_started' | 'subscribed'

export interface CaptureBillingSignupInput {
  email: string
  requestedPlan: BillingSignupPlan
  status: BillingSignupStatus
  companyName?: string
  source?: string
  metadata?: Record<string, unknown>
}

export interface BillingSignupRecord {
  id: string
  email: string
  requested_plan: BillingSignupPlan
  status: BillingSignupStatus
}

export async function captureBillingSignup(
  input: CaptureBillingSignupInput
): Promise<BillingSignupRecord> {
  const rows = await database.query<BillingSignupRecord>(
    `INSERT INTO billing_signups
       (email, requested_plan, status, company_name, source, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING id, email, requested_plan, status`,
    [
      input.email,
      input.requestedPlan,
      input.status,
      input.companyName ?? null,
      input.source ?? 'pricing-page',
      JSON.stringify(input.metadata ?? {})
    ]
  )

  return rows[0]
}

export async function attachCheckoutSessionToSignup(
  signupId: string,
  checkoutSessionId: string
): Promise<void> {
  await database.query(
    `UPDATE billing_signups
       SET stripe_checkout_session_id = $2,
           status = 'checkout_started',
           updated_at = NOW()
     WHERE id = $1`,
    [signupId, checkoutSessionId]
  )
}

export async function markBillingSignupSubscribed(
  checkoutSessionId: string,
  subscriptionId: string | null
): Promise<void> {
  await database.query(
    `UPDATE billing_signups
       SET status = 'subscribed',
           stripe_subscription_id = COALESCE($2, stripe_subscription_id),
           updated_at = NOW()
     WHERE stripe_checkout_session_id = $1`,
    [checkoutSessionId, subscriptionId]
  )
}
