# State UCC Collectors Catalog

This directory contains state-specific UCC data collectors for the platform. All collectors implement the canonical `StateCollector` interface and are registered in `StateCollectorFactory.ts`.

For the formal onboarding procedure, architecture standards, and verification protocols, see the [Add-One-State Playbook](../../../../../../docs/playbooks/ADD_ONE_STATE_PLAYBOOK.md).

---

## State Collector Implementations

| State  | Access Method | Class / Builder      | Required Credentials & Seeds                                 | Notes                                                                                  |
| :----: | :-----------: | :------------------- | :----------------------------------------------------------- | :------------------------------------------------------------------------------------- |
| **CA** |      API      | `CAApiCollector`     | `CA_SOS_API_KEY`                                             | Connects directly to California SOS XML API.                                           |
| **TX** |     Bulk      | `TXBulkCollector`    | `TX_SOSDIRECT_API_KEY`, `TX_SOSDIRECT_ACCOUNT_ID`            | Downloads and parses TX SOSDirect bulk data feeds.                                     |
| **FL** |    Vendor     | `FLVendorCollector`  | `FL_VENDOR_CONTRACT_ACTIVE=true`                             | Privatized state records via Image API, LLC agreement. Fails closed when unconfigured. |
| **NY** |    Scrape     | `NYScraperCollector` | `NY_UCC_DEBTOR_SEEDS`                                        | NY DOS public portal scraper. Seed-enumeration query model.                            |
| **NJ** |    Scrape     | `NJScraperCollector` | `NJ_UCC_API_KEY`, `NJ_UCC_ACCOUNT_ID`, `NJ_UCC_DEBTOR_SEEDS` | NJ Treasury portal scraper. Rejects HTML-as-200 responses.                             |

---

## The `StateCollector` Contract

Every collector in this directory must implement the `StateCollector` interface:

```typescript
export interface StateCollector {
  searchByBusinessName(name: string): Promise<SearchResult>
  searchByFilingNumber(number: string): Promise<UCCFiling | null>
  getFilingDetails(filingNumber: string): Promise<UCCFiling>
  collectNewFilings(options: CollectionOptions): Promise<UCCFiling[]>
  validateFiling(filing: UCCFiling): ValidationResult
  getStatus(): CollectorStatus
}
```

In addition, each collector provides:

- `isReady(): boolean`: Fail-closed gate reporting whether required credentials and seeds are present.
- Rate limiting using `RateLimiter` (`apps/web/src/lib/collectors/RateLimiter.ts`).
- Structured error handling translating network, scraping, and parsing errors into typed `CollectionError` instances.

---

## Adding a New State

1. **Copy the Template**:
   Copy `StateCollectorTemplate.ts.example` to `[State][Method]Collector.ts` (e.g., `ILScraperCollector.ts`).
2. **Implement Upstream Ingestion**:
   Implement `queryUpstream` and mapping to canonical `UCCFiling`.
3. **Register in Factory**:
   Add entry in `STATE_CONFIGS` and `COLLECTOR_BUILDERS` in `apps/web/src/lib/collectors/StateCollectorFactory.ts`.
4. **Contract Verification**:
   Ensure the new collector passes the contract suite in `StateCollectorContract.test.ts`.
5. **Run the 7-Consecutive-Run Verifier**:
   ```bash
   npx tsx scripts/verify-state-runs.ts --state [STATE] --probe
   ```
