# Pages service binding preparation

Implemented API-only Pages Functions routing for /api and /v1 through the API service binding. Requests preserve paths, query, body and authentication, do not follow upstream redirects, and disable shared response caching. Cross-origin browser writes fail before forwarding. Missing bindings and transport failure produce explicit 503/502 responses; no sample records are returned.

Preparation packages the actual SPA with base /, separate staging/production project names and Worker bindings, and API-only _routes.json. It rejects mismatched projects and base paths, and replaces stale disposable build files. Build VITE_API_BASE_URL=/api and VITE_ENABLE_SPARK=false. Spark's build plugin now requires explicit VITE_ENABLE_SPARK=true, independently of API configuration; this also fixes its unintended build-output override and proxy generation on Cloudflare builds.

Validation: root TypeScript and changed-file lint passed; seven Pages/no-mock behavior tests passed. SPA built successfully and Wrangler4.130.0 compiled the prepared Pages Functions Worker. No Pages deployment is claimed. Pages Access applications/audiences, authoritative Worker tenant membership and accepted production promotion still require implementation and live verification before exposure.

Build: npm --workspace apps/web run build -- --base=/ (VITE_API_BASE_URL=/api, VITE_ENABLE_SPARK=false). Prepare: node scripts/prepare-cloudflare-pages.mjs staging ucc-mca-dashboard-staging. The generated package is .quality/cloudflare-pages/staging with its own wrangler.json and functions directory.

Provider contracts: https://developers.cloudflare.com/pages/functions/bindings/ and https://developers.cloudflare.com/pages/functions/wrangler-configuration/ .

User constraint: do not invoke op again. Use the already verified cached credential and delivered repository secret. Vault reconciliation is preserved unexecuted in Limen draft PR2678; it is not a restoration dependency. Retain this checkout for continued no-mock, API and deployment integration.
