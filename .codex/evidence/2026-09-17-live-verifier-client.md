# Live staging client verification

Run 35173446883 deployed revision 9f3d257eba53fdad2f54814e9ccd803ae56878f8 and cron `0 0,2,6,12,18 * * *`, then failed the live health check. A direct probe returned the correct revision. The same Python verifier returned Cloudflare 403/error 1010 for its default client signature, before reaching the Worker.

The verifier now identifies itself as UCC-Staging-Verifier/1.0. Its unchanged acceptance rules pass against the live revision: health 200 with exact revision, unauthenticated and forged-token requests redirect to the expected ivixivi.cloudflareaccess.com Access login, and a nonexistent route returns 404. No authentication or security policy was relaxed. Successful user enrollment and authenticated data access remain unverified.

The database test JWT placeholder now explicitly says do-not-use, matching the existing scanner placeholder policy. No scan rule was weakened. After integrating current main, 52 Cloudflare Python tests and nine affected workflow/cron tests pass, including client identification without authorization or redirect following. Prior unchanged application shards retain their exact prior receipts; remote integration and deployment of this revision remain separate requirements.

Owner: UCC #239/#476, PR #514. Retain checkout through integration. PR #518 owns durable leases separately; the six dashboard surfaces, business handlers, feature integration and production promotion remain outstanding.
