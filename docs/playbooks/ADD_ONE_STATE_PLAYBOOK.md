# Add-One-State Playbook

## Executive Summary & Mission

This playbook defines the **standard factory pipeline and architectural contract** for expanding UCC data coverage across all 50 US states + DC (**Epic S6 / Epic S7**).

Adding a state is an assembly-line operation executed by autonomous agents and platform engineers. To ensure scalability, security, and stability:

1. **Zero Orchestration Churn (Open-Closed Principle)**: The core orchestration layer (`UCCSearchService`, `ScrapeJobService`, `scheduler`, and pipeline agents) MUST NOT change when adding state $N+1$. New states plug into a unified contract interface (`StateCollector`).
2. **Fail-Closed by Default**: Unconfigured or failing state collectors must fail closed, withholding access rather than emitting empty or fabricated data. Mock implementations (`SCRAPER_IMPLEMENTATION=mock`) are strictly restricted to local unit tests.
3. **Verifiable Receipts & Auditability**: Every collection run produces a deterministic `LiveReceipt` containing structured telemetry, record counts, and cryptographic payload digests.
4. **Consecutive Green Run Gate**: Under **Epic S7**, an expansion wave cannot be certified for production, nor can Wave $N+1$ commence, until the state achieves **7 consecutive green runs** verified by the automated verification runner.

---

## Architecture & Interface Standardization

### The Core Decoupling Principle

The platform separates **Core Orchestration** from **State Ingestion**:

```
+-------------------------------------------------------------------------+
|                        Core Orchestration Layer                         |
|   (UCCSearchService, ScrapeJobService, Scheduler, Discovery Pipeline)   |
+-------------------------------------------------------------------------+
                                    |
                                    | consumes StateCollector interface
                                    v
+-------------------------------------------------------------------------+
|                  StateCollectorFactory Registry                         |
|        - STATE_CONFIGS (Metadata, Tier Preferences, Economics)          |
|        - COLLECTOR_BUILDERS (Lazy-loaded, credential-gated builders)    |
+-------------------------------------------------------------------------+
      |                   |                   |                   |
      v                   v                   v                   v
+------------+     +------------+     +------------+     +------------+
| CA Collector|    | TX Collector|    | FL Collector|    | NY Collector|  ... [State N]
|   (API)    |     |   (Bulk)   |     |  (Vendor)  |     |  (Scraper) |
+------------+     +------------+     +------------+     +------------+
```

### The Standard `StateCollector` Contract

Every state adapter must implement the `StateCollector` interface defined in `apps/web/src/lib/collectors/types.ts`:

```typescript
export interface StateCollector {
  /** Search filings by business / debtor name */
  searchByBusinessName(name: string): Promise<SearchResult>

  /** Search for a specific filing by filing number */
  searchByFilingNumber(number: string): Promise<UCCFiling | null>

  /** Get detailed filing metadata and history */
  getFilingDetails(filingNumber: string): Promise<UCCFiling>

  /** Ingest recent filings within a time window */
  collectNewFilings(options: CollectionOptions): Promise<UCCFiling[]>

  /** Validate a parsed filing against schema requirements */
  validateFiling(filing: UCCFiling): ValidationResult

  /** Report operational status and health metrics */
  getStatus(): CollectorStatus
}
```

### Standard Normalized Output Schema (`UCCFiling`)

All collectors must normalize raw portal/API payloads into the canonical `UCCFiling` schema:

| Field            | Type                                                | Required | Description                                            |
| :--------------- | :-------------------------------------------------- | :------: | :----------------------------------------------------- |
| `filingNumber`   | `string`                                            |   Yes    | Unique jurisdiction filing identifier                  |
| `filingType`     | `'UCC-1' \| 'UCC-3' \| 'UCC-5' \| string`           |   Yes    | Filing instrument type                                 |
| `filingDate`     | `string`                                            |   Yes    | ISO 8601 date string (`YYYY-MM-DD`)                    |
| `expirationDate` | `string`                                            |    No    | ISO 8601 lapse date (typically +5 years for UCC-1)     |
| `status`         | `'active' \| 'lapsed' \| 'terminated' \| 'amended'` |   Yes    | Standardized filing lifecycle status                   |
| `state`          | `string`                                            |   Yes    | 2-letter uppercase postal code (e.g. `CA`, `IL`, `OH`) |
| `debtor`         | `Party` (`name`, `address?`, `organizationType?`)   |   Yes    | Debtor organization or individual                      |
| `securedParty`   | `Party` (`name`, `address?`, `organizationType?`)   |   Yes    | Secured funder / lender                                |
| `collateral`     | `string`                                            |   Yes    | Text description of collateral or summary              |
| `pages`          | `number`                                            |    No    | Total document page count                              |
| `amendments`     | `Amendment[]`                                       |    No    | Associated UCC-3 amendment records                     |
| `rawData`        | `Record<string, unknown>`                           |    No    | Preserved upstream source payload for audit            |

---

## The 7-Step State Rollout Factory Pipeline

Each state onboarding ticket follows this 7-step sequence:

```
+----------+     +----------+     +----------+     +----------+
| 1.       |     | 2.       |     | 3.       |     | 4.       |
| Research |---> | Adapter  |---> | Bot Gate |---> | Live     |
| & Source |     | Template |     | & Auth   |     | Receipt  |
+----------+     +----------+     +----------+     +----------+
                                                        |
                                                        v
+----------+     +----------+     +----------+     +----------+
| 7.       |     | 6.       |     | 5.       |     |          |
| Compl.   |<--- | Pricing  |<--- | Docs     |<----+          |
| Matrix   |     | Update   |     | Update   |
+----------+     +----------+     +----------+
```

---

### Step 1: Research & Discovery

Before writing code, conduct formal reconnaissance on the state's public records infrastructure:

1. **Access Method Taxonomy**: Determine the appropriate primary access tier in order of preference:
   - **API (Tier 1)**: Direct State Secretary of State (SOS) REST/XML/SOAP API (e.g., California SOS XML API). Fast, structured, low cost per query ($0.01 - $0.05).
   - **Bulk Download / Subscription (Tier 2)**: SOSDirect monthly or weekly bulk file feeds (e.g., Texas SOSDirect). Best for periodic large-volume batch ingestion.
   - **Commercial Vendor (Tier 3)**: Required when state records are legally privatized (e.g., Florida Image API, LLC agreement).
   - **Direct Public Portal Scraper (Tier 4)**: Automated extraction from SOS public web portals (e.g., New York DOS, New Jersey Treasury). Use when no API or bulk options exist.
2. **Search Capabilities & Limitations**:
   - Does the portal permit debtor name wildcard/exact search?
   - Does it support date-window queries (`since` / `until`)? If not, debtor seed enumeration is required (like NY/NJ).
   - Does it require session tokens, CSRF tokens, or ASP.NET `__VIEWSTATE` cookies?
3. **Data Dictionary Mapping**:
   - Identify raw field names for filing number, filing date, debtor name/address, secured party name/address, collateral descriptions, and lapse status.
4. **Economics & Rate Limits**:
   - Document portal request limits (e.g. 10 requests/minute), daily query caps, or subscription pricing.

---

### Step 2: Adapter Implementation

Create the state collector in `apps/web/src/lib/collectors/state-collectors/`:

1. **File Naming**:
   - API collector: `[State]ApiCollector.ts` (e.g., `ILApiCollector.ts`)
   - Bulk collector: `[State]BulkCollector.ts` (e.g., `ILBulkCollector.ts`)
   - Scraper collector: `[State]ScraperCollector.ts` (e.g., `ILScraperCollector.ts`)
   - Vendor collector: `[State]VendorCollector.ts` (e.g., `ILVendorCollector.ts`)
2. **Implementation Requirements**:
   - Implement `StateCollector` interface completely.
   - Implement credential gating via `isReady(): boolean`. If credentials, seeds, or subscription configs are missing, `isReady()` must return `false`.
   - Incorporate rate limiting via `RateLimiter`.
   - Normalize output into `UCCFiling` records.
   - Validate filings using `this.validateFiling(filing)`.
3. **Zero-Touch Factory Registration**:
   In `apps/web/src/lib/collectors/StateCollectorFactory.ts`:
   - Add state configuration to `STATE_CONFIGS`:
     ```typescript
     IL: {
       code: 'IL',
       name: 'Illinois',
       accessMethods: ['scrape'],
       activeMethod: 'scrape',
       hasApi: false,
       hasBulk: false,
       requiresVendor: false,
       costPer1000Queries: { api: null, bulk: null, vendor: null, scrape: 0 },
       notes: 'Illinois SOS UCC portal scraper.'
     }
     ```
   - Register the builder in `COLLECTOR_BUILDERS`:
     ```typescript
     IL: { method: 'scrape', build: () => whenReady(createILScraperCollector()) }
     ```
   _(Note: No services, routes, or orchestration files need editing!)_

---

### Step 3: Bot Gate & Anti-Detection

For scrapers and portals with automated access defenses:

1. **Gate Evaluation**:
   - Identify defense layer: Cloudflare Turnstile, Akamai Bot Manager, reCAPTCHA v2/v3, hCaptcha, AWS WAF, or IP rate-limiting.
2. **Countermeasures**:
   - Use `puppeteer-extra-plugin-stealth` or Playwright stealth context.
   - Employ humanized input delays (50–150ms per keystroke) and random inter-request jitter (1000–3000ms).
   - Honor `robots.txt` and respect state portal bandwidth.
   - Use rotating proxies when required by commercial scraping terms.
3. **Fail-Closed Credential Gate**:
   - If a portal requires client credentials (e.g., `IL_UCC_API_KEY`, `IL_UCC_ACCOUNT_ID`), the collector must fail closed when unconfigured.
4. **Structured Error Handling**:
   - Never throw raw network or parsing exceptions. Catch and map errors to `CollectionError`:
     - `'CAPTCHA'`: Blocked by anti-bot gate.
     - `'RATE_LIMIT'`: HTTP 429 or threshold block.
     - `'STRUCTURE_CHANGE'`: Selector mismatch or DOM schema update.
     - `'AUTH'`: Credential failure or session expiry.
     - `'TIMEOUT'`: Upstream unresponsive.
     - `'NETWORK'`: Socket hangup or DNS resolution failure.
     - `'PARSE'`: Malformed payload / unexpected HTML in JSON response.
5. **Diagnostic Capture**:
   - On error, log structured diagnostic artifacts (DOM snapshot and page screenshot) to `.quality/diagnostics/[state]/`.

---

### Step 4: Live Receipt & Verification

Verification requires concrete, un-mocked proof of successful ingestion:

1. **Generate Live Receipt**:
   Execute a real extraction run against the target portal or staging environment. The runner emits an execution receipt:
   ```json
   {
     "receiptId": "rcpt_il_20260915_093000_a1b2",
     "state": "IL",
     "accessMethod": "scrape",
     "timestamp": "2026-09-15T13:30:00.000Z",
     "targetQuery": "Acme Industrial Corp",
     "status": "SUCCESS",
     "recordsIngested": 3,
     "recordsValidated": 3,
     "validationErrors": [],
     "durationMs": 1420,
     "payloadSha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
     "isMockData": false
   }
   ```
2. **Receipt Integrity Verification**:
   - `isMockData` MUST be `false`.
   - `recordsValidated` MUST equal `recordsIngested`.
   - `validationErrors` MUST be empty.
   - `payloadSha256` ensures audit reproducibility.

---

### Step 5: Documentation Updates

Keep documentation in sync with new state additions:

1. **`docs/SCRAPING_GUIDE.md`**:
   - Add state-specific section with portal URL, access requirements, and troubleshooting tips.
2. **`apps/web/src/lib/collectors/state-collectors/README.md`**:
   - Document state collector module, access methods, and configuration keys.
3. **`README.md`**:
   - Update state coverage matrix / supported jurisdiction count.
4. **`.env.example`**:
   - Document required environment variables (e.g., `IL_UCC_API_KEY`, `IL_UCC_DEBTOR_SEEDS`).

---

### Step 6: Pricing & Unit Economics

Update commercial and financial configurations:

1. **Coverage Documentation**:
   - Update `docs/PRICING.md` coverage section to include the newly onboarded state.
2. **Cost Modeling**:
   - Record estimated per-query cost in `StateConfig.costPer1000Queries`.
3. **Gross Margin Guardrail**:
   - Verify that data acquisition cost per lead leaves at least 65% gross margin across all tiers:
     - **Starter ($4.00/lead)**: Max acquisition cost $\le \$1.40$
     - **Growth ($3.00/lead)**: Max acquisition cost $\le \$1.05$
     - **Scale ($2.25/lead)**: Max acquisition cost $\le \$0.78$
   - If vendor data costs exceed thresholds, establish a state-specific surcharge or enterprise-only tiering.

---

### Step 7: Compliance Row & Legal Governance

Formalize regulatory compliance for the new jurisdiction:

1. **State Compliance Matrix**:
   - Record jurisdiction in the platform's compliance register with:
     - State code and name.
     - Legal basis (State Open Records Act / UCC Public Record Statute).
     - Commercial solicitation restrictions (e.g., restrictions on direct commercial solicitation from public filings).
     - Disclosure requirements (e.g., California Commercial Financing Disclosure Law, New York Commercial Financing Disclosure Law, or similar state statutes).
2. **Suppression & Privacy**:
   - Ensure contact enrichment for leads from this state passes TCPA, DNC, and state-specific telemarketing suppression registries.
3. **Audit Schedule**:
   - Schedule quarterly review of Secretary of State Terms of Service and portal access policies.

---

## Defining a 'Green Run'

A collection or probe run is classified as **GREEN** if and only if it satisfies ALL seven criteria:

| #     | Criterion                         | Verification Rule                                                                    | Failure Consequence         |
| :---- | :-------------------------------- | :----------------------------------------------------------------------------------- | :-------------------------- |
| **1** | **Process Exit & Error Free**     | Exit code 0, no unhandled exceptions or rejected promises.                           | Status = RED                |
| **2** | **Zero Mock Contamination**       | `SCRAPER_IMPLEMENTATION !== 'mock'` and collector is not using canned fallback data. | Status = RED (Disqualified) |
| **3** | **100% Schema Conformance**       | Every ingested record passes `validateFiling` with 0 missing required fields.        | Status = RED                |
| **4** | **Data Completeness**             | Valid filings extracted for known active seeds, or clean zero-match verification.    | Status = RED                |
| **5** | **SLA Latency Adherence**         | Query latency $< 30,000\text{ ms}$; batch run within designated timeout window.      | Status = RED                |
| **6** | **Zero Block / Rate-Limit**       | No HTTP 429, 403, or unhandled anti-bot CAPTCHA challenges encountered.              | Status = RED                |
| **7** | **Deterministic Receipt Emitted** | Structured `LiveReceipt` JSON recorded with SHA-256 payload digest.                  | Status = RED                |

---

## The 7-Consecutive-Run Verification Protocol

Under **Epic S7 (50-State Expansion)**:

> _"Rule: Wave N+1 cannot start until Wave N has 7 consecutive green runs."_

### Streak State Machine

```
              +---------------------------+
              |     Initial State (0)     |
              +---------------------------+
                            |
                     [Run 1 = GREEN]
                            v
              +---------------------------+
              |         Streak = 1        |
              +---------------------------+
                     |             |
              [Run = RED]   [Run 2 = GREEN]
                     |             v
                     |       +---------------------------+
                     |       |         Streak = 2        |
                     |       +---------------------------+
                     |                     |
                     v                     v
              +---------------+           ...
              |  Streak = 0   |            |
              | (RESET TO 0)  |     [Run 7 = GREEN]
              +---------------+            v
                     ^       +---------------------------+
                     |       |  CERTIFIED PRODUCTION     |
                     +-------|   (Streak = 7, WAVE PASS) |
                    [RED Run]+---------------------------+
```

1. **Streak Counter**: Increments by 1 on each confirmed Green Run.
2. **Strict Reset**: ANY Red Run (network drop, CAPTCHA block, schema error, unhandled timeout) IMMEDIATELY resets the streak back to `0`.
3. **Certification Threshold**: A state is certified as **Production Ready** once `consecutiveGreenRuns >= 7`.

### Automated Verification Runner (`scripts/verify-state-runs.ts`)

The repository includes an automated verification runner to evaluate and certify state runs:

```bash
# Verify run history from recorded receipts
npx tsx scripts/verify-state-runs.ts --state IL --evaluate

# Execute active probe runs against a state collector
npx tsx scripts/verify-state-runs.ts --state IL --probe --count 7

# Inspect current certification status across all implemented states
npx tsx scripts/verify-state-runs.ts --status
```

The runner records certification output to `.quality/state-verification/[STATE]-verification.json`.

---

## State Rollout Checklist Template (Copy-Pasteable for Issues)

When opening an issue for a new state (e.g., `[S7.1] Onboard Illinois (IL) UCC Data`), embed this checklist:

```markdown
### State Onboarding Checklist: [STATE_NAME] ([STATE_CODE])

- [ ] **Step 1: Research & Discovery**
  - [ ] SOS portal / data source identified: `[URL]`
  - [ ] Access method selected: `[API | Bulk | Vendor | Scrape]`
  - [ ] Query semantics & parameters documented
  - [ ] Data dictionary mapped to canonical `UCCFiling` schema
  - [ ] Economics estimated: `$X.XX` per 1k queries

- [ ] **Step 2: Adapter Implementation**
  - [ ] Collector created in `apps/web/src/lib/collectors/state-collectors/[State]Collector.ts`
  - [ ] Implements full `StateCollector` interface
  - [ ] Credential gate implemented (`isReady(): boolean`)
  - [ ] Registered in `STATE_CONFIGS` (`StateCollectorFactory.ts`)
  - [ ] Registered in `COLLECTOR_BUILDERS` (`StateCollectorFactory.ts`)
  - [ ] Unit & contract tests added and passing

- [ ] **Step 3: Bot Gate & Anti-Detection**
  - [ ] Anti-bot defenses evaluated (CAPTCHA, rate limits, session auth)
  - [ ] Stealth plugins / rate limiters configured
  - [ ] Typed `CollectionError` mappings verified
  - [ ] Failure diagnostic artifact capture configured

- [ ] **Step 4: Live Receipt & Verification**
  - [ ] Test execution run against live portal / staging endpoint
  - [ ] `LiveReceipt` generated with SHA-256 payload digest
  - [ ] Zero mock data verified (`isMockData: false`)

- [ ] **Step 5: Documentation Updates**
  - [ ] Updated `docs/SCRAPING_GUIDE.md`
  - [ ] Updated `apps/web/src/lib/collectors/state-collectors/README.md`
  - [ ] Updated `README.md` coverage list
  - [ ] Documented environment variables in `.env.example`

- [ ] **Step 6: Pricing & Unit Economics**
  - [ ] Updated `docs/PRICING.md` coverage
  - [ ] Configured `costPer1000Queries` in `StateConfig`
  - [ ] Verified $\ge 65\%$ gross margin threshold

- [ ] **Step 7: Compliance Row & Legal Governance**
  - [ ] Added entry to State Compliance Matrix
  - [ ] Verified public records legal authority & commercial solicitation rules
  - [ ] Verified TCPA / DNC suppression compliance
  - [ ] Scheduled quarterly ToS audit

- [ ] **7 Consecutive Green Runs Certification**
  - [ ] Ran automated verification runner: `npx tsx scripts/verify-state-runs.ts --state [STATE_CODE] --probe`
  - [ ] Achieved 7/7 consecutive green runs
  - [ ] Certification receipt generated at `.quality/state-verification/[STATE_CODE]-verification.json`
```
