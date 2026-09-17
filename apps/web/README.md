# Web App

This directory hosts the web client (Vite + React).

Common commands (from repo root):

- `npm run dev` (web dev server)
- `npm run build` (web build)
- `npm run test` (web unit tests)

## Authenticated Cloudflare Pages deployment

The hosted tenant dashboard is deployed by `deploy-pages.yml` to Cloudflare Pages. The build sets
`VITE_DEPLOYMENT_SURFACE=tenant-dashboard` and exposes only the authoritative, tenant-scoped
contract backed by `/api/dashboard`: Prospects, Portfolio, Intelligence, Analytics, Requalification,
and Agentic. Unsupported CRM, communications, coverage, and compliance routes are not presented.
Pages Functions forward `/api/*` to the environment's exact-revision Worker service binding and
preserve the Cloudflare Access assertion. The Worker verifies the Pages Access audience and resolves
the authenticated subject through `access_memberships` before returning tenant records.

Staging deploys only from the current accepted `main` revision. Production additionally requires an
explicit `DEPLOY` confirmation and a successful same-revision staging Pages receipt. After a verified
authenticated production replacement is live, the workflow retires the superseded GitHub Pages site.

Focused verification from the repository root:

```bash
node --test scripts/__tests__/cloudflare-pages.test.mjs
node scripts/no-mock-runtime.mjs
VITE_API_BASE_URL=/api VITE_DEPLOYMENT_SURFACE=tenant-dashboard npm --workspace apps/web run build -- --base=/
```
