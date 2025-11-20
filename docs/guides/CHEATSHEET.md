# CLI Scraper - Quick Reference Cheat Sheet

## Installation
```bash
npm install --legacy-peer-deps
```

## Basic Commands

### Get Help
```bash
npm run scrape -- --help
npm run scrape -- scrape-ucc --help
```

### List Available States
```bash
npm run scrape -- list-states
```

### Scrape UCC Filings
```bash
# JSON output (default)
npm run scrape -- scrape-ucc -c "Company Name" -s CA

# CSV output
npm run scrape -- scrape-ucc -c "Company Name" -s CA -o results.csv --csv

# Specify output file
npm run scrape -- scrape-ucc -c "Company Name" -s CA -o /path/to/output.json
```

### Enrich Company Data
```bash
# Free tier (default)
npm run scrape -- enrich -c "Company Name" -s CA

# CSV output
npm run scrape -- enrich -c "Company Name" -s CA -o enriched.csv --csv

# Specify tier
npm run scrape -- enrich -c "Company Name" -s CA --tier free
```

### Normalize Company Name
```bash
npm run scrape -- normalize -n "ACME CORPORATION, LLC"
# Output: Acme Corporation
```

### Batch Processing
```bash
# From CSV file
npm run scrape -- batch -i companies.csv -o ./results

# CSV format:
# company,state
# Acme Corp,CA
# Example LLC,TX
```

## State Codes
- **CA** - California
- **TX** - Texas
- **FL** - Florida

## Common Use Cases

### Daily Batch Run
```bash
npm run scrape -- batch -i daily-list.csv -o ./results-$(date +%Y%m%d)
```

### Quick Field Check
```bash
npm run scrape -- scrape-ucc -c "Restaurant Name" -s CA
```

### Full Research
```bash
# Get UCC filings
npm run scrape -- scrape-ucc -c "Company" -s CA -o ucc.json

# Get enrichment data
npm run scrape -- enrich -c "Company" -s CA -o enriched.json
```

## Using Wrapper Script
```bash
# Instead of "npm run scrape --"
./scraper.sh scrape-ucc -c "Company Name" -s CA
./scraper.sh list-states
```

## Creating Distribution Package
```bash
./package-for-distribution.sh
# Creates ucc-scraper-TIMESTAMP.tar.gz
```

## Output Files

### Default Locations
- `output.json` - UCC scrape results
- `enriched-data.json` - Enrichment results
- `batch-results/` - Batch processing output

### File Formats
- **JSON**: Machine-readable, structured data
- **CSV**: Spreadsheet-compatible, easy to import

## Rate Limiting
- Automatic 12-15 second delay between requests
- Respects site policies
- Prevents blocking

## Troubleshooting

### CAPTCHA Detected
```bash
# Tool provides manual URL
# Complete search manually in browser
```

### No Results Found
```bash
# Try normalizing the company name first
npm run scrape -- normalize -n "company name"
# Use normalized name in search
```

### Module Not Found
```bash
npm install --legacy-peer-deps
```

## Tips
- Always save results with `-o` flag
- Use CSV for Excel/Sheets
- Use JSON for databases/APIs
- Verify important results manually
- Start with small batches

## Documentation
- **QUICK_START.md** - Beginner guide
- **CLI_USAGE.md** - Complete reference
- **IMPLEMENTATION_NOTES.md** - Technical details
- **README.md** - Full platform docs
