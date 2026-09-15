/**
 * Worker runtime bindings + identity types.
 *
 * `Env` is the contract between wrangler.toml and the code: every binding and
 * var declared there must appear here, or it cannot be read type-safely.
 *
 * - Bindings (DB/KV/ARTIFACTS): declared as `[[d1_databases]]` / `[[kv_namespaces]]`
 *   / `[[r2_buckets]]` in wrangler.toml.
 * - Plain vars (ACCESS_TEAM_DOMAIN/ACCESS_AUD/ENVIRONMENT): the `[vars]` blocks.
 * - Secrets (JWT_SECRET, STRIPE_WEBHOOK_SECRET, ...): NOT in wrangler.toml; set
 *   via `wrangler secret put`. They arrive on `env` at runtime just like vars.
 */
export interface Env {
  // --- Bindings ---
  DB: D1Database
  KV: KVNamespace
  ARTIFACTS: R2Bucket

  // --- Non-secret vars (wrangler.toml [vars]) ---
  ENVIRONMENT: string
  /** Exact source revision injected by the staging deployment workflow. */
  DEPLOYMENT_SHA?: string
  /** Zero Trust team domain, e.g. "your-team.cloudflareaccess.com". */
  ACCESS_TEAM_DOMAIN: string
  /** Cloudflare Access application Audience (AUD) tag — the JWT `aud`. */
  ACCESS_AUD: string

  // --- Secrets (wrangler secret put) ---
  /**
   * Legacy/self-issued JWT signing secret. Optional in the edge model because
   * Cloudflare Access is the primary identity plane (see telos), but kept on the
   * Env so ported endpoints that still mint/verify app tokens compile.
   */
  JWT_SECRET?: string
  /** Stripe webhook signing secret (set when the billing route is ported). */
  STRIPE_WEBHOOK_SECRET?: string
}

export type SubscriptionTier = 'free' | 'starter' | 'growth' | 'pro' | 'enterprise'

/**
 * The authenticated caller, derived from Cloudflare Access JWT or an API Key.
 * `orgId` is the tenant boundary — every org-scoped query keys off it.
 */
export interface Identity {
  orgId: string
  email?: string
  role?: string
  tier: SubscriptionTier
  authMethod: 'cf_access' | 'api_key'
  keyId?: string
}

/**
 * Organization row in D1.
 */
export interface OrganizationRow {
  id: string
  name: string
  subscription_tier: string
  created_at: string
}

/**
 * Prospect row in D1.
 */
export interface ProspectRow {
  id: string
  org_id: string
  company_name: string | null
  priority_score: number | null
  status: string | null
  enrichment_confidence: number | null
  raw_data: string | null
  created_at: string
}

/**
 * Job row in D1.
 */
export interface JobRow {
  id: string
  type: string
  payload: string | null
  status: 'pending' | 'processing' | 'done' | 'failed'
  org_id: string | null
  attempts: number
  created_at: string
}

/**
 * API Key row in D1.
 */
export interface ApiKeyRow {
  id: string
  org_id: string
  name: string
  key_prefix: string
  key_hash: string
  role: 'user' | 'admin'
  expires_at: string | null
  revoked_at: string | null
  last_used_at: string | null
  created_at: string
}

/**
 * Sanitized public API key record (never exposes hash or full key).
 */
export interface ApiKeyPublic {
  id: string
  name: string
  key_prefix: string
  role: 'user' | 'admin'
  expires_at: string | null
  revoked_at: string | null
  last_used_at: string | null
  created_at: string
}

/**
 * Hono variable map. Lets handlers do `c.get('identity')` with full typing
 * after auth has run.
 */
export interface Variables {
  identity: Identity
}

/** Convenience alias for Hono generics: `new Hono<AppBindings>()`. */
export interface AppBindings {
  Bindings: Env
  Variables: Variables
}
