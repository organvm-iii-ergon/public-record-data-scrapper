# Staging resource write and readback repair

The credential delivery repair merged as Limen PR2677 (da3bb2688b5e8488b156548219d445c589f17ec2). Authorized staging workflow run35171069185 confirmed service read access and created D1, then failed with inconsistent_list_total. A later read returned a coherent six-row/six-total D1 inventory. This supports a transient post-create list inconsistency; no inventory completeness checks were relaxed.

The provisioner now makes one corrective read after newly-created-resource list inconsistency or missing readback. It never repeats creation and never retries denied requests, duplicate identities, changed identities or foreign targets. Existing-resource preflight remains strict.

Live reconciliation created dedicated KV, R2 and Access resources. Cloudflare normalized the exact configured Access domain into both self_hosted_domains and a single public destinations URI. Accept that exact equivalent shape while continuing to reject additional, private or foreign destinations. A subsequent reconcile returned ready and reused all four resources.

Validation: 26 provisioner tests plus 22 diagnostic/configuration/live-verifier/classifier tests passed. The provider source contract is https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/list/ . Tests use offline provider counterexamples only; no business records were fabricated.

Live identities:

- d1: ucc-mca-staging / f59aa021-1d47-4bd8-918d-a2a2f20314fa
- kv: ucc-mca-edge-staging-KV / d0551be240a24b27bd008bfd21412edb
- r2: cronus-assets-staging / cronus-assets-staging
- access: ucc-mca-edge-staging-api / 77a91cf6-9432-4463-a09f-d3e6008761ef

The generated configuration passes source isolation checks against configured production bindings. Actual production provisioning and full remote separation remain part of production acceptance. Access policy remains default deny (empty policies); enrollment and deployment are unverified. No Worker or Pages deployment is claimed. The existing production site is unchanged.

User authority: continue the full restoration autonomously in bounded packets, with published checkpoints and no displayed mock data. Retain this isolated checkout while the deployment repair is integrated. Foundation PR514 remains separately held by the dependency review route; this narrow provisioning repair has no package changes.
