# No displayed mock data

Owner: repository maintainers / Codex. Base: `ee6b1e3`.
User correction: **no mock data AT ALL**. This overrides all earlier permissions for
Austin, demo mode, development previews, seeded business records, and synthetic
fallbacks. Only real records, honest empty states, or actionable errors may appear.
Test fixtures remain isolated verification inputs, never shipped runtime data.

This bounded packet restores DashboardApp as the only entrypoint, ignores legacy
mock flags, removes data-fetch failure/configuration fallbacks, avoids legacy
unscoped business-record caches, removes coverage and narrative simulation, and
moves real statistics calculation out of the fixture module. Spark initialization
requires its own explicit flag and is independent of API configuration. The Vite
build rejects rendered mock/demo modules. Integrations start empty and use API
requests instead of seeded webhook deliveries, random secrets, and timer-based
successes. API read/registration mapping validates displayed webhook fields.

Remaining restoration is owned by [verification foundation PR #514](https://github.com/organvm-iii-ergon/public-record-data-scrapper/pull/514)
and its complete ordered ledger. This packet does not establish authenticated
Cloudflare runtime acceptance. Existing API envelopes, session/tenant authority,
server integration security/provider verification, persisted settings, and live
browser behavior still need the original restoration work. In particular, the
existing server's CRM verification must be repaired before claiming provider
connectivity; the UI only reports accepted settings.

Keep this branch and isolated worktree for reviewed integration. Do not merge or
promote until the prerequisite verification/security and authenticated API path
are accepted. No deployments, credentials, or branch protections were changed.
