# Quick Start Guide - Field Data Collection

This guide is designed for field experts who need to quickly collect UCC filing and company data from the command line without dealing with a GUI.

## Prerequisites

- Node.js 18+ installed
- Internet connection
- Basic command line knowledge

## Installation (One-Time Setup)

1. **Clone or download the repository:**
   ```bash
   git clone https://github.com/ivi374forivi/public-record-data-scrapper.git
   cd public-record-data-scrapper
   ```

2. **Install dependencies:**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Verify installation:**
   ```bash
   npm run scrape -- --version
   ```
   You should see: `1.0.0`

## Basic Usage

### 1. Quick Company Lookup

To scrape UCC filings for a single company:

```bash
npm run scrape -- scrape-ucc -c "Company Name" -s CA
```

Replace:
- `"Company Name"` with the actual company name
- `CA` with the state code (CA, TX, or FL)

Example:
```bash
npm run scrape -- scrape-ucc -c "Acme Corporation" -s CA
```

### 2. Save Results to File

To save results as JSON:
```bash
npm run scrape -- scrape-ucc -c "Acme Corporation" -s CA -o results.json
```

To save results as CSV:
```bash
npm run scrape -- scrape-ucc -c "Acme Corporation" -s CA -o results.csv --csv
```

### 3. Enrich Company Data

To get additional data from public sources (SEC, OSHA, etc.):
```bash
npm run scrape -- enrich -c "Acme Corporation" -s CA -o enriched.json
```

### 4. Batch Processing

If you have multiple companies to check:

1. **Create a CSV file** named `companies.csv`:
   ```csv
   company,state
   Acme Corporation,CA
   Example LLC,TX
   Test Company,FL
   ```

2. **Run batch processing:**
   ```bash
   npm run scrape -- batch -i companies.csv -o ./batch-results
   ```

   This will:
   - Process each company one by one
   - Save individual results in the `batch-results` folder
   - Create a summary file with all results

## Supported States

Currently supported:
- **CA** - California
- **TX** - Texas
- **FL** - Florida

To check available states:
```bash
npm run scrape -- list-states
```

## Common Scenarios

### Scenario 1: Quick Field Check
You're in the field and need to quickly check one company:

```bash
npm run scrape -- scrape-ucc -c "Restaurant Name" -s CA
```

Results appear in your terminal immediately.

### Scenario 2: Daily Batch Run
You have a list of 20 companies to check every day:

```bash
# Create or update companies.csv with your list
npm run scrape -- batch -i companies.csv -o ./daily-$(date +%Y%m%d)
```

This creates a dated folder with all results.

### Scenario 3: Comprehensive Research
You need full details on a company:

```bash
# Step 1: Get UCC filings
npm run scrape -- scrape-ucc -c "Company Name" -s CA -o ucc.json

# Step 2: Get enrichment data
npm run scrape -- enrich -c "Company Name" -s CA -o enriched.json
```

## Understanding Output

### UCC Filing Output
```json
{
  "state": "CA",
  "companyName": "Acme Corporation",
  "filingCount": 2,
  "filings": [
    {
      "filingNumber": "UCC-123456",
      "debtorName": "Acme Corporation",
      "securedParty": "Bank of America",
      "filingDate": "2024-01-15",
      "status": "active",
      "collateral": "All assets"
    }
  ],
  "searchUrl": "https://..."
}
```

**Key Fields:**
- `filingCount`: How many UCC filings were found
- `filings`: Array of filing details
- `searchUrl`: Direct link to verify manually

### Enrichment Output
```json
{
  "companyName": "Acme Corporation",
  "state": "CA",
  "sources": ["sec-edgar", "osha", "uspto"],
  "enrichedData": {
    "sec": { "cik": "0001234567" },
    "osha": { "violations": 2 },
    "uspto": { "trademarkCount": 3 }
  }
}
```

**Key Fields:**
- `sources`: Which databases were checked
- `enrichedData`: Data from each source

## Tips for Field Use

1. **Rate Limiting**: The tool automatically waits 12-15 seconds between requests to avoid being blocked

2. **CAPTCHA Handling**: If a CAPTCHA is detected, the tool will:
   - Show an error message
   - Provide a manual URL to complete the search in a browser

3. **Save Everything**: Always use `-o filename` to save results for later analysis

4. **Network Issues**: If you have spotty internet, use smaller batches and save each result

5. **Verify Important Results**: Use the `searchUrl` field to manually verify critical findings

## Troubleshooting

### "Command not found"
Make sure you're in the correct directory:
```bash
cd public-record-data-scrapper
npm run scrape -- --help
```

### "Cannot find module"
Reinstall dependencies:
```bash
npm install --legacy-peer-deps
```

### "CAPTCHA detected"
The site is blocking automated access. Options:
1. Wait 30 minutes and try again
2. Use the provided manual URL to complete the search
3. Try a different state's database

### "No results found"
This could mean:
- The company has no UCC filings in that state
- The company name needs to be adjusted (try without LLC/Inc)
- Use the normalize command first:
  ```bash
  npm run scrape -- normalize -n "company name llc"
  ```

## Advanced Usage

### Using the Wrapper Script
Instead of typing `npm run scrape --`, you can use:
```bash
./scraper.sh scrape-ucc -c "Company Name" -s CA
```

### Normalization for Better Results
Before searching, normalize the company name:
```bash
npm run scrape -- normalize -n "ACME CORPORATION, LLC"
# Output: Acme Corporation
```

Then use the normalized name in your search.

### Checking Scraper Status
```bash
npm run scrape -- list-states
```

## Export for Analysis

### For Excel/Google Sheets
Export as CSV:
```bash
npm run scrape -- scrape-ucc -c "Company" -s CA -o data.csv --csv
```

### For CRM/Database Import
Export as JSON:
```bash
npm run scrape -- scrape-ucc -c "Company" -s CA -o data.json
```

## Getting Help

View all commands:
```bash
npm run scrape -- --help
```

View help for specific command:
```bash
npm run scrape -- scrape-ucc --help
npm run scrape -- enrich --help
npm run scrape -- batch --help
```

## Next Steps

- See [CLI_USAGE.md](./CLI_USAGE.md) for complete documentation
- See [ENRICHMENT_PIPELINE.md](./ENRICHMENT_PIPELINE.md) for data source details
- See [README.md](./README.md) for web application features

## Support

For issues or questions, check the documentation files or review the code in the `scripts/` directory.
