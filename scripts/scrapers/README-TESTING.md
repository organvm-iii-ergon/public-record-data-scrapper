# UCC Scraper Testing Guide

This guide explains how to test and validate the TX/FL/CA UCC scrapers.

## Quick Start

```bash
# Test all three scrapers (TX, FL, CA)
npm run test:scrapers

# Test individual states
npm run test:scrapers:tx
npm run test:scrapers:fl
npm run test:scrapers:ca

# Run in headed mode (see browser)
npm run test:scrapers:headed
npm run test:scrapers -- TX --headed
```

## Test Output

The test suite generates:

1. **Console Output**: Real-time test progress with colored indicators
2. **JSON Report**: Detailed results in `test-results/run-{timestamp}/report.json`
3. **Screenshots**: Captured on failures (when implemented)

### Sample Console Output

```
============================================================
Testing TX UCC Scraper
============================================================

[1/3] Testing: Tesla Inc
Description: Large public company
✅ Success - Found 0 filings in 5234ms
   No filings found (this may be expected)

[2/3] Testing: Dell Technologies
Description: Texas-based tech company
❌ Failed - Texas UCC portal requires SOS Portal account login (as of Sept 2025)
```

## Understanding Results

### Success Scenarios

**✅ Success with Results**
```
✅ Success - Found 5 filings in 3452ms
   First filing: 2023-001234 - ACME Corporation
```
This means the scraper successfully navigated the portal, submitted the search, and extracted filing data.

**✅ Success with Zero Results**
```
✅ Success - Found 0 filings in 2841ms
   No filings found (this may be expected)
```
This means the scraper worked correctly but the company has no UCC filings on record (or the search term yielded no matches).

### Failure Scenarios

**❌ Authentication Required (Texas)**
```
❌ Failed - Texas UCC portal requires SOS Portal account login (as of Sept 2025)
```
**Fix**: Implement authentication support (see next section)

**❌ CAPTCHA Detected**
```
❌ Failed - CAPTCHA detected - manual intervention required
```
**Fix**: Either solve CAPTCHA manually or implement CAPTCHA solving service

**❌ Form Not Found**
```
❌ Failed - Unable to locate debtor name search field on Florida UCC portal
```
**Fix**: Portal structure changed. Need to update selectors.

**❌ Network/Timeout Issues**
```
❌ Exception - Navigation timeout of 45000 ms exceeded
```
**Fix**: Increase timeout or check network connectivity

## Test Report Structure

The JSON report (`test-results/run-{timestamp}/report.json`) contains:

```json
{
  "timestamp": "2025-01-19T10:30:00.000Z",
  "summary": {
    "total": 9,
    "successful": 6,
    "failed": 3,
    "successRate": 0.667
  },
  "results": [
    {
      "state": "TX",
      "testCase": {
        "companyName": "Tesla Inc",
        "description": "Large public company",
        "expectedMinResults": 0
      },
      "result": {
        "success": true,
        "filings": [],
        "searchUrl": "https://www.sos.state.tx.us/ucc/...",
        "timestamp": "2025-01-19T10:30:05.234Z"
      },
      "success": true,
      "duration": 5234
    }
  ]
}
```

## Adding Custom Test Cases

Edit `scripts/scrapers/test-scrapers.ts` and add new test cases:

```typescript
const TEST_CASES: Record<string, TestCase[]> = {
  TX: [
    {
      companyName: 'Your Company Name',
      description: 'Description here',
      expectedMinResults: 0
    },
    // ... more test cases
  ]
}
```

## Debugging Failed Tests

### 1. Run in Headed Mode
```bash
npm run test:scrapers -- TX --headed
```
This opens the browser so you can watch the scraper navigate the portal in real-time.

### 2. Check the Search URL
Look at the `searchUrl` field in the test report to see what page the scraper ended up on.

### 3. Manual Verification
Visit the portal manually to:
- Confirm it's accessible
- Check if login is required
- Verify search form structure hasn't changed
- Test if CAPTCHA is triggered

### 4. Adjust Rate Limiting
If getting blocked/rate-limited:
- Increase wait time between tests (currently 15s)
- Reduce number of test cases
- Use different test company names

## Known Issues & Limitations

### Texas (TX)
- ❌ **Requires Login**: As of September 2025, requires SOS Portal account
- **Workaround**: Implement authentication support or use manual searches

### Florida (FL)
- ⚠️ **Exact Name Matching**: Very picky about exact company name formatting
- ⚠️ **Bot Detection**: May encounter rate limiting or blocking
- **Workaround**: Use varied test names, increase delays between tests

### California (CA)
- ⚠️ **May Require Account**: Some searches may require free account
- ✅ **Free Searches Available**: Basic searches work without login

## Next Steps

After running tests, prioritize fixes based on results:

1. **If authentication errors** → Implement auth support (Step B)
2. **If selector errors** → Update DOM selectors for changed portal structure
3. **If CAPTCHA errors** → Implement CAPTCHA solving or use proxies
4. **If successful** → Proceed to pagination implementation (Step C)

## Rate Limiting Guidelines

To avoid getting blocked:

- **Texas**: 3 requests/minute (conservative)
- **Florida**: 4 requests/minute (privatized system)
- **California**: 4 requests/minute (state portal)

Test suite automatically waits 15 seconds between tests within the same state.

## Continuous Testing

Recommended testing schedule:

- **Before releases**: Run full test suite
- **Weekly**: Run individual state tests to detect portal changes
- **After portal updates**: Run tests if state announces UCC portal changes
- **After code changes**: Run affected state tests

## Contributing Test Cases

When adding test cases:

1. Use real company names that likely have filings
2. Include variety: large/small, public/private companies
3. Add descriptive comments explaining why company was chosen
4. Set realistic `expectedMinResults` if known

## Troubleshooting

**"Module not found" errors**
```bash
npm install
```

**"Permission denied" on test-results folder**
```bash
chmod -R 755 test-results/
```

**Tests hanging indefinitely**
- Check if process is waiting for CAPTCHA
- Verify network connectivity
- Increase timeout in scraper config
