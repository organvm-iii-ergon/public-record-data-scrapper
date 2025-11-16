# Implementation Guide: MCP Servers and Analytics Infrastructure

## Quick Start Guide

This guide provides step-by-step instructions for implementing the recommended MCP servers, web scraping frameworks, and database solutions for the UCC-MCA Intelligence Platform.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Phase 1: Development Environment Setup](#phase-1-development-environment-setup)
3. [Phase 2: Web Scraping Implementation](#phase-2-web-scraping-implementation)
4. [Phase 3: Database Setup](#phase-3-database-setup)
5. [Phase 4: MCP Server Deployment](#phase-4-mcp-server-deployment)
6. [Phase 5: Integration and Testing](#phase-5-integration-and-testing)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

- **Node.js**: v18+ (for TypeScript components and MCP servers)
- **Python**: 3.11+ (for Scrapy and data processing)
- **PostgreSQL**: 15+ (primary database)
- **Docker**: Latest stable (for containerized services)
- **Git**: For version control

### Required Knowledge

- Basic understanding of web scraping concepts
- SQL and database design
- REST APIs and JSON
- Command line operations
- Docker basics

---

## Phase 1: Development Environment Setup

### 1.1 Install Core Dependencies

#### Node.js and npm

```bash
# Install Node.js 18+ (using nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
node --version  # Should be v18.x.x
```

#### Python and pip

```bash
# Install Python 3.11+
sudo apt update
sudo apt install python3.11 python3.11-venv python3-pip

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

#### PostgreSQL

```bash
# Install PostgreSQL 15
sudo apt install postgresql-15 postgresql-contrib-15

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql
```

```sql
-- In PostgreSQL shell
CREATE DATABASE ucc_intelligence;
CREATE USER ucc_admin WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE ucc_intelligence TO ucc_admin;
\q
```

### 1.2 Install TimescaleDB

```bash
# Add TimescaleDB repository
sudo sh -c "echo 'deb https://packagecloud.io/timescale/timescaledb/ubuntu/ $(lsb_release -c -s) main' > /etc/apt/sources.list.d/timescaledb.list"
wget --quiet -O - https://packagecloud.io/timescale/timescaledb/gpgkey | sudo apt-key add -
sudo apt update

# Install TimescaleDB
sudo apt install timescaledb-2-postgresql-15

# Configure TimescaleDB
sudo timescaledb-tune --quiet --yes

# Restart PostgreSQL
sudo systemctl restart postgresql
```

Enable TimescaleDB in your database:

```sql
-- Connect to database
psql -U ucc_admin -d ucc_intelligence

-- Enable extension
CREATE EXTENSION IF NOT EXISTS timescaledb;
```

### 1.3 Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker-compose --version
```

---

## Phase 2: Web Scraping Implementation

### 2.1 Setup Scrapy Project

```bash
# Install Scrapy
pip install scrapy scrapy-playwright playwright

# Install Playwright browsers
playwright install

# Create Scrapy project
scrapy startproject ucc_scraper
cd ucc_scraper

# Create spider for a state (example: California)
scrapy genspider california_ucc bizfileonline.sos.ca.gov
```

### 2.2 Configure Scrapy Settings

Edit `ucc_scraper/settings.py`:

```python
# settings.py

BOT_NAME = 'ucc_scraper'

SPIDER_MODULES = ['ucc_scraper.spiders']
NEWSPIDER_MODULE = 'ucc_scraper.spiders'

# Obey robots.txt rules
ROBOTSTXT_OBEY = True

# Configure delay between requests
DOWNLOAD_DELAY = 2
CONCURRENT_REQUESTS_PER_DOMAIN = 2

# Enable AutoThrottle
AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_START_DELAY = 2
AUTOTHROTTLE_MAX_DELAY = 10

# Enable Playwright for JavaScript-heavy sites
DOWNLOAD_HANDLERS = {
    "http": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
    "https": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
}

# Database pipeline
ITEM_PIPELINES = {
    'ucc_scraper.pipelines.PostgresPipeline': 300,
}

# PostgreSQL connection
POSTGRES_HOST = 'localhost'
POSTGRES_PORT = 5432
POSTGRES_DB = 'ucc_intelligence'
POSTGRES_USER = 'ucc_admin'
POSTGRES_PASSWORD = 'your_secure_password'

# User agent
USER_AGENT = 'UCCIntelligenceBot/1.0 (+https://example.com/bot)'

# Enable logging
LOG_LEVEL = 'INFO'
```

### 2.3 Create Database Pipeline

Create `ucc_scraper/pipelines.py`:

```python
import psycopg2
from psycopg2.extras import Json
import logging

class PostgresPipeline:
    def __init__(self, db_settings):
        self.db_settings = db_settings
        self.conn = None
        self.cursor = None
    
    @classmethod
    def from_crawler(cls, crawler):
        return cls({
            'host': crawler.settings.get('POSTGRES_HOST'),
            'port': crawler.settings.get('POSTGRES_PORT'),
            'database': crawler.settings.get('POSTGRES_DB'),
            'user': crawler.settings.get('POSTGRES_USER'),
            'password': crawler.settings.get('POSTGRES_PASSWORD'),
        })
    
    def open_spider(self, spider):
        self.conn = psycopg2.connect(**self.db_settings)
        self.cursor = self.conn.cursor()
        logging.info("Database connection established")
    
    def close_spider(self, spider):
        self.conn.commit()
        self.cursor.close()
        self.conn.close()
        logging.info("Database connection closed")
    
    def process_item(self, item, spider):
        try:
            self.cursor.execute("""
                INSERT INTO ucc_filings (
                    filing_number,
                    debtor_name,
                    secured_party_name,
                    filing_date,
                    state,
                    status,
                    raw_data,
                    scraped_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
                ON CONFLICT (filing_number, state) 
                DO UPDATE SET
                    debtor_name = EXCLUDED.debtor_name,
                    secured_party_name = EXCLUDED.secured_party_name,
                    status = EXCLUDED.status,
                    raw_data = EXCLUDED.raw_data,
                    updated_at = NOW()
            """, (
                item.get('filing_number'),
                item.get('debtor_name'),
                item.get('secured_party_name'),
                item.get('filing_date'),
                item.get('state'),
                item.get('status'),
                Json(dict(item))
            ))
            self.conn.commit()
            return item
        except Exception as e:
            logging.error(f"Error saving item: {e}")
            self.conn.rollback()
            raise
```

### 2.4 Example Spider Implementation

Create `ucc_scraper/spiders/california_ucc.py`:

```python
import scrapy
from scrapy_playwright.page import PageMethod

class CaliforniaUCCSpider(scrapy.Spider):
    name = 'california_ucc'
    allowed_domains = ['bizfileonline.sos.ca.gov']
    
    def start_requests(self):
        # Example: Search form
        urls = [
            'https://bizfileonline.sos.ca.gov/search/business'
        ]
        
        for url in urls:
            yield scrapy.Request(
                url,
                meta={
                    'playwright': True,
                    'playwright_page_methods': [
                        PageMethod('wait_for_selector', 'input[name="searchCriteria"]'),
                    ],
                },
                callback=self.parse_search_form
            )
    
    def parse_search_form(self, response):
        # Extract CSRF token or other required fields
        # Fill in search criteria
        # Submit form
        # Example simplified:
        
        yield {
            'filing_number': response.css('.filing-number::text').get(),
            'debtor_name': response.css('.debtor-name::text').get(),
            'secured_party_name': response.css('.secured-party::text').get(),
            'filing_date': response.css('.filing-date::text').get(),
            'state': 'CA',
            'status': response.css('.status::text').get(),
        }
    
    def parse_filing_detail(self, response):
        # Parse detailed filing information
        yield {
            'filing_number': response.meta['filing_number'],
            'debtor_name': response.css('.debtor-name::text').get(),
            'secured_party_name': response.css('.secured-party::text').get(),
            'filing_date': response.css('.filing-date::text').get(),
            'state': 'CA',
            'status': response.css('.status::text').get(),
            'collateral_description': response.css('.collateral::text').get(),
        }
```

### 2.5 Alternative: Crawlee Implementation (TypeScript)

```bash
# Create new project
mkdir ucc-scraper-ts
cd ucc-scraper-ts
npm init -y

# Install Crawlee
npm install crawlee playwright

# Create scraper
touch src/main.ts
```

Edit `src/main.ts`:

```typescript
import { PlaywrightCrawler, Dataset } from 'crawlee';
import { Pool } from 'pg';

// Database connection
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'ucc_intelligence',
  user: 'ucc_admin',
  password: 'your_secure_password',
});

const crawler = new PlaywrightCrawler({
  async requestHandler({ request, page, enqueueLinks, log }) {
    log.info(`Processing ${request.url}`);
    
    // Wait for content to load
    await page.waitForSelector('.filing-results');
    
    // Extract data
    const filings = await page.$$eval('.filing-row', (rows) =>
      rows.map((row) => ({
        filingNumber: row.querySelector('.filing-number')?.textContent?.trim(),
        debtorName: row.querySelector('.debtor-name')?.textContent?.trim(),
        securedParty: row.querySelector('.secured-party')?.textContent?.trim(),
        filingDate: row.querySelector('.filing-date')?.textContent?.trim(),
        state: 'CA',
      }))
    );
    
    // Save to database
    for (const filing of filings) {
      await pool.query(
        `INSERT INTO ucc_filings (
          filing_number, debtor_name, secured_party_name, 
          filing_date, state, scraped_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (filing_number, state) DO NOTHING`,
        [
          filing.filingNumber,
          filing.debtorName,
          filing.securedParty,
          filing.filingDate,
          filing.state,
        ]
      );
    }
    
    // Enqueue more pages
    await enqueueLinks({
      selector: '.pagination a',
      label: 'listing',
    });
  },
  
  maxRequestsPerCrawl: 100,
  maxConcurrency: 2,
});

await crawler.run(['https://bizfileonline.sos.ca.gov/search/business']);
await pool.end();
```

---

## Phase 3: Database Setup

### 3.1 Create Database Schema

Create `schema.sql`:

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "timescaledb";

-- UCC Filings table
CREATE TABLE ucc_filings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filing_number VARCHAR(100) NOT NULL,
    state VARCHAR(2) NOT NULL,
    debtor_name VARCHAR(500),
    secured_party_name VARCHAR(500),
    filing_date DATE,
    expiration_date DATE,
    status VARCHAR(50),
    collateral_description TEXT,
    raw_data JSONB,
    scraped_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(filing_number, state)
);

-- Create indexes
CREATE INDEX idx_filings_debtor ON ucc_filings USING gin (debtor_name gin_trgm_ops);
CREATE INDEX idx_filings_secured_party ON ucc_filings USING gin (secured_party_name gin_trgm_ops);
CREATE INDEX idx_filings_state ON ucc_filings(state);
CREATE INDEX idx_filings_date ON ucc_filings(filing_date DESC);
CREATE INDEX idx_filings_status ON ucc_filings(status);

-- Secured parties table
CREATE TABLE secured_parties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(500) NOT NULL,
    normalized_name VARCHAR(500),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(2),
    zip VARCHAR(20),
    entity_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(name, state)
);

-- Debtors table
CREATE TABLE debtors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(500) NOT NULL,
    normalized_name VARCHAR(500),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(2),
    zip VARCHAR(20),
    entity_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(name, state)
);

-- Health scores (time-series)
CREATE TABLE health_scores (
    id UUID DEFAULT uuid_generate_v4(),
    debtor_id UUID REFERENCES debtors(id),
    score NUMERIC(5,2),
    grade VARCHAR(2),
    calculated_at TIMESTAMP NOT NULL,
    factors JSONB,
    PRIMARY KEY (debtor_id, calculated_at)
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('health_scores', 'calculated_at', if_not_exists => TRUE);

-- Growth signals (time-series)
CREATE TABLE growth_signals (
    id UUID DEFAULT uuid_generate_v4(),
    debtor_id UUID REFERENCES debtors(id),
    signal_type VARCHAR(50) NOT NULL,
    signal_date TIMESTAMP NOT NULL,
    description TEXT,
    source VARCHAR(200),
    metadata JSONB,
    PRIMARY KEY (id, signal_date)
);

-- Convert to hypertable
SELECT create_hypertable('growth_signals', 'signal_date', if_not_exists => TRUE);

-- Prospects view
CREATE VIEW prospects AS
SELECT 
    d.id as debtor_id,
    d.name as debtor_name,
    d.state,
    d.city,
    COUNT(DISTINCT uf.id) as filing_count,
    MAX(uf.filing_date) as latest_filing_date,
    MAX(hs.score) as health_score,
    MAX(hs.grade) as health_grade,
    COUNT(DISTINCT gs.id) as signal_count,
    ARRAY_AGG(DISTINCT gs.signal_type) as signal_types
FROM debtors d
LEFT JOIN ucc_filings uf ON d.name = uf.debtor_name AND d.state = uf.state
LEFT JOIN health_scores hs ON d.id = hs.debtor_id 
    AND hs.calculated_at = (
        SELECT MAX(calculated_at) 
        FROM health_scores 
        WHERE debtor_id = d.id
    )
LEFT JOIN growth_signals gs ON d.id = gs.debtor_id
    AND gs.signal_date >= NOW() - INTERVAL '90 days'
GROUP BY d.id, d.name, d.state, d.city;

-- Scraping jobs tracking
CREATE TABLE scraping_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    state VARCHAR(2) NOT NULL,
    spider_name VARCHAR(100) NOT NULL,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    status VARCHAR(50),
    records_scraped INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    error_details JSONB
);
```

Apply the schema:

```bash
psql -U ucc_admin -d ucc_intelligence -f schema.sql
```

### 3.2 Setup ClickHouse for Analytics

```bash
# Run ClickHouse via Docker
docker run -d \
  --name clickhouse-server \
  -p 8123:8123 \
  -p 9000:9000 \
  --ulimit nofile=262144:262144 \
  clickhouse/clickhouse-server:latest

# Create database
docker exec -it clickhouse-server clickhouse-client
```

```sql
-- In ClickHouse client
CREATE DATABASE ucc_analytics;

USE ucc_analytics;

-- Filings analytics table (denormalized)
CREATE TABLE filings_analytics (
    filing_id String,
    filing_number String,
    state String,
    debtor_name String,
    secured_party_name String,
    filing_date Date,
    year UInt16,
    month UInt8,
    status String,
    collateral_value Nullable(Float64),
    industry String,
    scraped_at DateTime
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(filing_date)
ORDER BY (state, filing_date, secured_party_name);

-- Market intelligence view
CREATE TABLE market_intelligence (
    secured_party_name String,
    state String,
    filing_count UInt32,
    total_value Nullable(Float64),
    avg_value Nullable(Float64),
    date_month Date,
    PRIMARY KEY (secured_party_name, state, date_month)
) ENGINE = SummingMergeTree()
ORDER BY (secured_party_name, state, date_month);
```

### 3.3 Setup Data Sync (PostgreSQL → ClickHouse)

Create `sync_to_clickhouse.py`:

```python
import psycopg2
from clickhouse_driver import Client
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)

# PostgreSQL connection
pg_conn = psycopg2.connect(
    host='localhost',
    port=5432,
    database='ucc_intelligence',
    user='ucc_admin',
    password='your_secure_password'
)

# ClickHouse connection
ch_client = Client(
    host='localhost',
    port=9000,
    database='ucc_analytics'
)

def sync_filings():
    """Sync filings from PostgreSQL to ClickHouse"""
    logging.info("Starting filings sync...")
    
    with pg_conn.cursor() as cursor:
        cursor.execute("""
            SELECT 
                id::text,
                filing_number,
                state,
                debtor_name,
                secured_party_name,
                filing_date,
                EXTRACT(YEAR FROM filing_date)::int,
                EXTRACT(MONTH FROM filing_date)::int,
                status,
                scraped_at
            FROM ucc_filings
            WHERE scraped_at >= NOW() - INTERVAL '1 hour'
        """)
        
        rows = cursor.fetchall()
        
        if rows:
            ch_client.execute(
                """
                INSERT INTO filings_analytics 
                (filing_id, filing_number, state, debtor_name, 
                 secured_party_name, filing_date, year, month, 
                 status, scraped_at)
                VALUES
                """,
                rows
            )
            logging.info(f"Synced {len(rows)} filings to ClickHouse")
        else:
            logging.info("No new filings to sync")

if __name__ == '__main__':
    sync_filings()
```

---

## Phase 4: MCP Server Deployment

### 4.1 Install PostgreSQL MCP Server

```bash
# Install globally
npm install -g @modelcontextprotocol/server-postgres

# Or add to project
npm install @modelcontextprotocol/server-postgres
```

### 4.2 Configure MCP Server

Create `.mcpconfig.json`:

```json
{
  "mcpServers": {
    "postgres-ucc": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://ucc_admin:your_secure_password@localhost:5432/ucc_intelligence"
      ],
      "env": {
        "PGSSLMODE": "prefer"
      }
    }
  }
}
```

### 4.3 Deploy Puppeteer MCP Server

Create `mcp-servers/puppeteer-scraper/`:

```bash
mkdir -p mcp-servers/puppeteer-scraper
cd mcp-servers/puppeteer-scraper
npm init -y
npm install @modelcontextprotocol/sdk puppeteer
```

Create `index.js`:

```javascript
#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import puppeteer from 'puppeteer';

const server = new Server(
  {
    name: 'puppeteer-scraper',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define scraping tools
server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'scrape_url',
        description: 'Scrape content from a URL using Puppeteer',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL to scrape',
            },
            selector: {
              type: 'string',
              description: 'CSS selector to extract',
            },
            wait_for: {
              type: 'string',
              description: 'Selector to wait for before extracting',
            },
          },
          required: ['url'],
        },
      },
    ],
  };
});

server.setRequestHandler('tools/call', async (request) => {
  if (request.params.name === 'scrape_url') {
    const { url, selector, wait_for } = request.params.arguments;
    
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    try {
      await page.goto(url, { waitUntil: 'networkidle2' });
      
      if (wait_for) {
        await page.waitForSelector(wait_for, { timeout: 10000 });
      }
      
      let content;
      if (selector) {
        content = await page.$$eval(selector, (elements) =>
          elements.map((el) => el.textContent.trim())
        );
      } else {
        content = await page.content();
      }
      
      await browser.close();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(content, null, 2),
          },
        ],
      };
    } catch (error) {
      await browser.close();
      throw error;
    }
  }
  
  throw new Error(`Unknown tool: ${request.params.name}`);
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

Make it executable:

```bash
chmod +x index.js
```

### 4.4 Test MCP Servers

```bash
# Test PostgreSQL MCP server
npx @modelcontextprotocol/server-postgres \
  "postgresql://ucc_admin:your_secure_password@localhost:5432/ucc_intelligence"

# Test Puppeteer MCP server
node mcp-servers/puppeteer-scraper/index.js
```

---

## Phase 5: Integration and Testing

### 5.1 Run Complete Workflow

1. **Start scraping**:

```bash
# Scrapy
cd ucc_scraper
scrapy crawl california_ucc -o output.json

# Crawlee
cd ucc-scraper-ts
npm start
```

2. **Verify data in PostgreSQL**:

```sql
-- Check scraped data
SELECT COUNT(*) FROM ucc_filings;
SELECT * FROM ucc_filings LIMIT 10;

-- Check prospects view
SELECT * FROM prospects LIMIT 10;
```

3. **Sync to ClickHouse**:

```bash
python sync_to_clickhouse.py
```

4. **Query analytics**:

```sql
-- In ClickHouse
SELECT 
    secured_party_name,
    COUNT(*) as filing_count,
    COUNT(DISTINCT state) as state_count
FROM filings_analytics
GROUP BY secured_party_name
ORDER BY filing_count DESC
LIMIT 20;
```

### 5.2 Integration Testing

Create `tests/test_integration.py`:

```python
import pytest
import psycopg2
from clickhouse_driver import Client

@pytest.fixture
def pg_connection():
    conn = psycopg2.connect(
        host='localhost',
        database='ucc_intelligence',
        user='ucc_admin',
        password='your_secure_password'
    )
    yield conn
    conn.close()

@pytest.fixture
def ch_client():
    return Client(host='localhost', port=9000, database='ucc_analytics')

def test_data_sync(pg_connection, ch_client):
    """Test that data syncs from PostgreSQL to ClickHouse"""
    with pg_connection.cursor() as cursor:
        cursor.execute("SELECT COUNT(*) FROM ucc_filings")
        pg_count = cursor.fetchone()[0]
    
    ch_count = ch_client.execute("SELECT COUNT(*) FROM filings_analytics")[0][0]
    
    assert ch_count > 0
    assert ch_count <= pg_count  # ClickHouse may lag slightly

def test_prospect_view(pg_connection):
    """Test prospects view returns data"""
    with pg_connection.cursor() as cursor:
        cursor.execute("SELECT COUNT(*) FROM prospects")
        count = cursor.fetchone()[0]
    
    assert count > 0

def test_time_series_queries(pg_connection):
    """Test TimescaleDB time-series queries"""
    with pg_connection.cursor() as cursor:
        cursor.execute("""
            SELECT COUNT(*) 
            FROM health_scores 
            WHERE calculated_at >= NOW() - INTERVAL '30 days'
        """)
        count = cursor.fetchone()[0]
    
    assert count >= 0
```

Run tests:

```bash
pytest tests/test_integration.py -v
```

---

## Troubleshooting

### Common Issues

#### 1. Scrapy Connection Errors

**Problem**: `ConnectionError: Connection refused`

**Solution**:
```bash
# Check robots.txt compliance
scrapy shell https://example.com

# Increase delays
# In settings.py:
DOWNLOAD_DELAY = 3
```

#### 2. PostgreSQL Connection Issues

**Problem**: `psycopg2.OperationalError: could not connect`

**Solution**:
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check connection settings
psql -U ucc_admin -d ucc_intelligence

# Edit pg_hba.conf if needed
sudo nano /etc/postgresql/15/main/pg_hba.conf
# Add: host all all 127.0.0.1/32 md5
sudo systemctl restart postgresql
```

#### 3. TimescaleDB Not Loading

**Problem**: `ERROR: could not load library "timescaledb"`

**Solution**:
```bash
# Reinstall TimescaleDB
sudo apt install --reinstall timescaledb-2-postgresql-15

# Update postgresql.conf
sudo nano /etc/postgresql/15/main/postgresql.conf
# Add: shared_preload_libraries = 'timescaledb'

sudo systemctl restart postgresql
```

#### 4. ClickHouse Connection Errors

**Problem**: `Connection refused to localhost:9000`

**Solution**:
```bash
# Check ClickHouse is running
docker ps | grep clickhouse

# Restart container
docker restart clickhouse-server

# Check logs
docker logs clickhouse-server
```

#### 5. MCP Server Not Starting

**Problem**: MCP server fails to start

**Solution**:
```bash
# Check Node.js version
node --version  # Should be 18+

# Reinstall dependencies
npm install --force

# Check logs
node index.js 2>&1 | tee mcp-server.log
```

### Performance Optimization

#### Database Indexing

```sql
-- Add GIN indexes for fuzzy search
CREATE INDEX idx_debtor_trgm ON debtors USING gin (name gin_trgm_ops);
CREATE INDEX idx_secured_party_trgm ON secured_parties USING gin (name gin_trgm_ops);

-- Analyze tables
ANALYZE ucc_filings;
ANALYZE debtors;
ANALYZE secured_parties;
```

#### Scrapy Performance

```python
# In settings.py

# Increase concurrent requests
CONCURRENT_REQUESTS = 16
CONCURRENT_REQUESTS_PER_DOMAIN = 4

# Enable HTTP caching
HTTPCACHE_ENABLED = True
HTTPCACHE_EXPIRATION_SECS = 86400

# Use faster DNS resolver
DNSCACHE_ENABLED = True
```

#### ClickHouse Optimization

```sql
-- Optimize tables
OPTIMIZE TABLE filings_analytics FINAL;

-- Create aggregating materialized views
CREATE MATERIALIZED VIEW monthly_stats
ENGINE = AggregatingMergeTree()
ORDER BY (state, month)
AS
SELECT 
    state,
    toYYYYMM(filing_date) as month,
    count() as filing_count,
    uniq(debtor_name) as unique_debtors
FROM filings_analytics
GROUP BY state, month;
```

---

## Next Steps

1. **Expand scraping coverage**: Add spiders for more states
2. **Implement monitoring**: Set up Prometheus + Grafana
3. **Add data enrichment**: Integrate business data APIs
4. **Build ML pipeline**: Health scoring and signal detection
5. **Deploy to production**: Kubernetes cluster or cloud services
6. **Implement CI/CD**: GitHub Actions for automated testing

---

## Resources

- **Scrapy Documentation**: https://docs.scrapy.org
- **Crawlee Documentation**: https://crawlee.dev/docs
- **PostgreSQL Documentation**: https://www.postgresql.org/docs
- **TimescaleDB Documentation**: https://docs.timescale.com
- **ClickHouse Documentation**: https://clickhouse.com/docs
- **MCP Documentation**: https://modelcontextprotocol.io/docs

---

## Support

For issues or questions:
- Check the troubleshooting section
- Review logs in detail
- Test components independently
- Consult official documentation
- Community forums and Stack Overflow
