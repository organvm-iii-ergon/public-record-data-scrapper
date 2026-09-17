# Authoritative dashboard membership

Access JWT signature, issuer and audience verification remains mandatory. A verified subject now resolves tenant, role and subscription through D1 access_memberships joined to organizations. Token tenant claims can select an existing membership but cannot create one; token role claims cannot elevate it. Missing, revoked, wrong-issuer, wrong-subject and ambiguous memberships fail closed. Migration 0005 creates no real or synthetic user accounts. 0004 remains reserved for the separate durable lease repair, PR #518.

API-key verification now consults D1 on every request, requires a real organization and rejects malformed expiry. Existing KV identities are ignored so revoked keys and changed tenant authority cannot remain valid through cached identity. No auth policy or required signature validation was removed.

Local Miniflare/D1 checks passed for membership, role escalation rejection, cross-tenant isolation, issuer/subject binding, revocation, ambiguity and stale API-key cache rejection. Edge TypeScript and existing full Worker runtime regression passed. Membership checks run in CI; runtime migration setup now applies all migration files rather than a fixed three-file list.

Owner: UCC #239/#475, PR #515. These tests do not prove successful real-user enrollment, Pages Access audience configuration, deployed membership migrations, browser acceptance or authoritative business data. Those remain prerequisites before exposure/promotion. Keep this checkout through integration; no real identity was invented or enrolled.
