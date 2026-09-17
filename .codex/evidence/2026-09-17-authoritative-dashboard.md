# Authoritative tenant dashboard contract

The six canonical dashboard surfaces (Prospects, Portfolio, Intelligence, Analytics, Requalification and Agentic) now share one authenticated tenant snapshot. Prospects, portfolio and competitor records come from D1 dashboard_records; user actions persist to D1. Analytics and Agentic consume that same snapshot, and Requalification now displays only actual tenant prospects marked dead and their recorded signal counts instead of a disconnected upload placeholder.

Admin ingestion requires a supported collection, stable record ID, complete collection payload, non-empty sourceRef and valid observedAt. The migration creates no records. Reads and writes derive org_id from verified Access membership or API-key identity, apply rate limits, disable shared caching and fail the whole snapshot on malformed stored data. Payload IDs cannot override the D1 record ID. User-action writes require a valid timestamp and object details.

Local verification passed: root and edge TypeScript; 30 focused snapshot/hook tests; full Miniflare Worker regression applying every migration. Runtime checks prove unauthenticated denial, missing-provenance rejection, persisted action readback, immutable record identity, empty unpopulated collections and cross-tenant isolation. Existing D1 membership and durable lease tests also pass after integration.

This establishes the data contract and UI wiring. It does not prove that authoritative business records exist in live staging, that a real Access member is enrolled, or that Pages is deployed. Live migration, provenance-backed tenant ingestion, browser acceptance and production promotion remain required. No record was invented to satisfy an acceptance check.

Owner: UCC #239/#475, PR #515. Dependency-only PR #519 remains held by the uninstalled Limen dependency-trust policy and is not required by this dashboard contract.
