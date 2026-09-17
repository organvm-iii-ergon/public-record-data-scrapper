# UCC single-trigger schedule repair

Accepted staging run35172014174 applied migrations and passed schema verification, uploaded Worker5218a561c0cb39902572f9978ffbb0e117c7213b, and installed its HTTP trigger. It then failed installing three cron triggers with Cloudflare10072 (five-trigger free-account limit). Successful changes were not rolled back. A read-only account inventory found four pre-existing triggers, with none yet installed on UCC staging.

Use one UTC trigger at 00:00,02:00,06:00,12:00,18:00. Dispatch ingestion at02:00, enrichment every six hours and health every twelve hours from event.scheduledTime. Coincident tasks run independently; queue drainage still follows. Legacy cron event values remain supported. No jobs or schedule frequencies were removed, and no other Worker's configuration or spending plan was changed.

The pure schedule tests verify all24hours over31days, including exact daily task counts1/4/2 and coincident work. Invalid times and legacy routing are covered. Edge frozen install/typecheck, seven schedule/policy tests and local Miniflare API/job regression passed. The updated runtime suite also invokes the unified trigger. These are routing/runtime checks; existing ingestion/enrichment/health handlers are still stubs and job lease/security repairs remain required. Do not report business pipeline completion from this packet.

Production will require a shared scheduling arrangement or available trigger capacity before promotion; two separate UCC cron installations do not fit the currently observed remaining slot. Preserve all existing owners and the spending boundary. This packet repairs staging trigger admission, not full production scheduling acceptance.

A local HTTP probe received Cloudflare403/error1010 before application verification. That is an unverified runtime boundary, not application acceptance. Use accepted workflow/live browser evidence for further verification.

Do not invoke op. Existing CLAVIS cache and delivered repository secret remain the only credential path needed here. Continue bounded restoration packets; retain this checkout until integration and deployment evidence are observed.
