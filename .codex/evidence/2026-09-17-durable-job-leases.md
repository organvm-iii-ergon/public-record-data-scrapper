# Durable D1 job leases

Jobs left processing after a Worker crash previously had no recovery path. Atomic D1 claims now assign an expiring owner token; expired claims can be recovered, and completion updates require a current unexpired owner. Retry delays and a five-attempt limit bound failures, including crashes on the last attempt. Migration 0004 recovers legacy processing rows. Webhook jobs must own their referenced delivery.

Verified locally after integrating main's single-trigger repair: D1 concurrency, expiry recovery, owner fencing, retry delay, legacy migration and terminal crash recovery; edge TypeScript; full Miniflare API/auth/tenant/rate-limit/cron/job regression with no outbound requests. The lease test reads the deployment compatibility settings and runs in CI. The full runtime regression applies migration 0004.

These are at-least-once job-state guarantees. External side effects can repeat after a crash; business ingestion, enrichment and health handlers still require implementation. This packet does not claim pipeline completion or live migration acceptance.

Owner: UCC #239/#476. Retain this checkout through integration and staging verification. PR #517 is merged at 9f3d257eba53fdad2f54814e9ccd803ae56878f8; its staging deployment is a separate acceptance boundary.

Live follow-up: Actions run 35173446883 completed provisioning, migrations, schema checks and Worker deployment successfully, then failed live acceptance with `live_revision_or_health_mismatch`. Cron admission is repaired; runtime identity/authentication acceptance remains unproven. Next inspect the actual health status/content type/revision and routing before changing the verifier. Lease implementation is published as PR #518 and has not yet been integrated or deployed.
