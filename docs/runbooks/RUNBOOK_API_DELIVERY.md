# Runbook: Versioned REST API & Edge Delivery Architecture (v1)

This runbook documents the operational and architectural foundations for the UCC-MCA Intelligence Platform's edge-native versioned REST API (`/v1/*`), multi-tenant API key authentication, sliding-window rate limiting, and tier entitlements deployed via Cloudflare Workers, D1, and KV.

---

## 1. Architectural Overview & DX Design

### 1.1 Developer Experience (DX) Principles

- **Predictable Resource Structure**: Resources are structured under standard REST versioning (`/v1/prospects`, `/v1/jobs`, `/v1/enrichment`, `/v1/keys`).
- **Standardized Envelopes**:
  - Success responses return `{ "data": ... }` with optional `{ "meta": { "total", "limit", "offset" } }` pagination metadata.
  - Fail-closed error responses adhere to `{ "error": { "message": string, "code": string, "statusCode": number } }`.
- **OpenAPI 3.1 Alignment**: Served directly by the Worker at `/v1/openapi.json` and `/openapi.json` for live client generation, Swagger UI, and SDK compilation.
- **Strict Query Clamping**: Pagination limits are defensive (`limit` clamped 1–200, default 50) and `offset` non-negative.

### 1.2 Multi-Tenant Query Scoping (Telos Invariant #3)

SQLite/D1 does not provide PostgreSQL Row-Level Security (RLS). Tenant isolation is enforced at the query layer:

- Every query carries `WHERE org_id = ?`.
- `org_id` is derived strictly from verified credentials (`c.get('identity').orgId`), never from client input.
- Any attempt to read or mutate another organization's records returns `404 Not Found` (never `403` on resource existence) to eliminate cross-tenant data leakage.

---

## 2. Authentication Strategy: API Keys vs. OAuth

### 2.1 Strategic Decision Matrix

For a multi-tenant B2B data product delivering programmatic UCC intelligence, **API Key authentication (`prk_...`) with SHA-256 hashing** was chosen over OAuth/OIDC for external programmatic ingestion:

| Factor                          | API Keys (`prk_...`)                                                                                       | OAuth 2.0 / OIDC                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Friction & Integration DX**   | **Very Low**: Customer passes `X-API-Key` or `Authorization: Bearer prk_...` in curl/Python/ETL pipelines. | **High**: Requires authorization servers, redirect URLs, refresh token loops, token storage. |
| **Batch/Cron/Job Pipeline Fit** | **Native**: Long-lived, non-interactive credentials ideal for automated ingest scripts.                    | **Awkward**: Refresh tokens expire and break unattended daemon jobs.                         |
| **Tenant Scoping & Auditing**   | **Direct**: Bound to a single `org_id` and role (`user` or `admin`) in D1 `api_keys`.                      | **Complex**: Requires token exchange, custom claim mapping, or external IdP synchronization. |
| **Security at Rest**            | **High**: Raw secret returned once; only SHA-256 hash (`key_hash`) stored in D1.                           | **High**: Signed JWTs verified via JWKS.                                                     |

Cloudflare Access JWT (`Cf-Access-Jwt-Assertion`) is retained for internal operators and Zero Trust web dashboard access, while API Keys serve programmatic B2B customer traffic.

### 2.2 API Key Lifecycle

- **Format**: `prk_${base64url(randomBytes(32))}`.
- **Prefix**: `prk_` (enables secret scanning by GitHub/GitLab and zero-cost header classification).
- **Display Prefix**: First 12 characters (e.g. `prk_AbC12345`) stored in `key_prefix` for audit logs and UI display.
- **Hashing**: SHA-256 hex digest (`key_hash`) generated via native Web Crypto (`crypto.subtle.digest`).
- **Revocation**: Setting `revoked_at = datetime('now')` immediately invalidates the key across edge datacenters.

---

## 3. Edge Rate Limiting & Tier Entitlements

### 3.1 Pre-D1 Edge Defense

D1 has query limits and introduces network latency. The Cloudflare Workers rate limiter evaluates request volume and tier entitlements **at the edge before any database query is executed**.

### 3.2 Tier Quotas & Limits

Quotas are evaluated over a 60-second sliding/fixed window:

| Subscription Tier | Rate Limit (req/min) | Allowed Capabilities                                              |
| ----------------- | -------------------- | ----------------------------------------------------------------- |
| **Free**          | 60                   | Prospect reads/creates, single job dispatch, single enrichment.   |
| **Starter**       | 300                  | High-frequency prospect reads, job status monitoring.             |
| **Growth / Pro**  | 1,200                | Batch prospect enrichment (up to 100 items), priority jobs queue. |
| **Enterprise**    | 5,000                | Custom SLA, high-volume programmatic streaming, dedicated limits. |

### 3.3 Response Headers

Every response from `/v1/*` includes standard rate-limiting headers:

- `X-RateLimit-Limit`: Maximum allowed requests per minute for the organization's tier.
- `X-RateLimit-Remaining`: Remaining request quota in the current 60-second window.
- `X-RateLimit-Reset`: Unix epoch timestamp when the window resets.

### 3.4 Rate Limit Exceeded (HTTP 429)

When a tenant exceeds their quota, the edge Worker returns:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 35
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1773705660

{
  "error": {
    "message": "Rate limit exceeded for tier 'free'. Limit is 60 requests per minute.",
    "code": "RATE_LIMIT_EXCEEDED",
    "statusCode": 429
  }
}
```

### 3.5 Tier Entitlement Enforcement (HTTP 403)

Certain heavy operations (such as `/v1/enrichment/batch`) enforce minimum tier requirements. If a `free` tier tenant attempts to batch enrich:

```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": {
    "message": "This operation requires the 'growth' tier or higher. Your current tier is 'free'.",
    "code": "TIER_UPGRADE_REQUIRED",
    "statusCode": 403
  }
}
```

---

## 4. Operational Procedures

### 4.1 Minting an API Key

An organization admin can mint an API key via `/v1/keys`:

```bash
curl -X POST https://api.ucc-mca.example.com/v1/keys \
  -H "X-API-Key: prk_masterAdminKey..." \
  -H "Content-Type: application/json" \
  -d '{"name": "Production ETL Scraper", "role": "user"}'
```

Response:

```json
{
  "data": {
    "id": "c1f7292a-5cf5-4e78-831e-450410cb0047",
    "name": "Production ETL Scraper",
    "key": "prk_s0meS3cretK3yHere...",
    "key_prefix": "prk_s0meS3cr",
    "role": "user",
    "created_at": "2026-09-15 14:00:00"
  }
}
```

_Note: The `key` field is displayed only once. Store it securely in your secret manager._

### 4.2 Revoking an API Key

To immediately revoke a compromised key:

```bash
curl -X DELETE https://api.ucc-mca.example.com/v1/keys/c1f7292a-5cf5-4e78-831e-450410cb0047 \
  -H "X-API-Key: prk_masterAdminKey..."
```

### 4.3 Applying D1 Migrations

Migrations are applied via Wrangler or GitHub Actions:

```bash
# Staging
wrangler d1 migrations apply ucc-mca --env staging

# Production
wrangler d1 migrations apply ucc-mca --env production
```

---

## 5. Verification & Testing

Local runtime smoke tests verify authentication, rate limiting, and database interactions:

```bash
cd cloudflare
npm run typecheck
cd ..
node scripts/test-cloudflare-runtime.mjs
```

The test verifies:

- D1 schema creation (5 tables).
- Public health probes (`/health`, `/v1/health`).
- OpenAPI schema accessibility (`/v1/openapi.json`).
- Rejection of forged, malformed, expired, and revoked API keys.
- Complete tenant data isolation.
- Rate-limiting headers and 429 response on quota breach.
- Entitlement gating (403 on restricted endpoints).
- Cron-driven job drainage.
