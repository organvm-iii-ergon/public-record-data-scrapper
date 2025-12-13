# Database Setup Guide

This guide will help you set up PostgreSQL database for the UCC-MCA Intelligence Platform.

## Prerequisites

- PostgreSQL 14 or higher installed
- Node.js and npm installed
- PostgreSQL server running

## Quick Start

### 1. Install PostgreSQL

**macOS (using Homebrew):**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Download and install from [PostgreSQL official website](https://www.postgresql.org/download/windows/)

### 2. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE ucc_mca;

# Create user (optional, for better security)
CREATE USER ucc_user WITH PASSWORD 'your_secure_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE ucc_mca TO ucc_user;

# Exit psql
\q
```

### 3. Configure Environment Variables

Copy the example environment file and update with your database credentials:

```bash
cp .env.example .env
```

Edit `.env` and update the database configuration:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ucc_mca
DB_USER=postgres  # or ucc_user if you created a separate user
DB_PASSWORD=your_secure_password_here
```

### 4. Run Migrations

Run the database migrations to create all tables, indexes, and functions:

```bash
npm run db:migrate
```

You should see output like:
```
Database Migration Runner
============================================================
Database: ucc_mca
Host: localhost
Port: 5432
============================================================

Testing database connection...
✓ Database connection successful
...
✓ All migrations completed successfully!
```

### 5. Test Connection

Verify your database connection:

```bash
npm run db:test
```

## Database Schema

The database schema includes the following main tables:

### Core Tables

- **ucc_filings** - UCC filing records from various states
- **prospects** - Identified business prospects with default signals
- **growth_signals** - Growth indicators for prospects
- **health_scores** - Business health metrics
- **competitors** - Competitor lender analysis
- **portfolio_companies** - Portfolio monitoring

### Junction Tables

- **prospect_ucc_filings** - Links prospects to UCC filings
- **portfolio_health_scores** - Links portfolio companies to health scores

### Logging Tables

- **ingestion_logs** - Data ingestion tracking
- **enrichment_logs** - Enrichment process tracking
- **schema_migrations** - Migration version tracking

### Views

- **latest_health_scores** - Most recent health score per prospect
- **prospects_with_health** - Prospects joined with latest health data
- **high_priority_prospects** - Prospects with priority score >= 70
- **stale_prospects** - Prospects needing data refresh

## Database Commands

### Available npm Scripts

```bash
# Run migrations
npm run db:migrate

# Test database connection
npm run db:test
```

### Direct PostgreSQL Commands

```bash
# Connect to database
psql -U postgres -d ucc_mca

# List all tables
\dt

# Describe a table
\d ucc_filings

# View applied migrations
SELECT * FROM schema_migrations;

# Count records in a table
SELECT COUNT(*) FROM prospects;
```

## Troubleshooting

### Connection Refused

If you see "connection refused" errors:

1. Check if PostgreSQL is running:
   ```bash
   # macOS
   brew services list

   # Linux
   sudo systemctl status postgresql
   ```

2. Start PostgreSQL if needed:
   ```bash
   # macOS
   brew services start postgresql@14

   # Linux
   sudo systemctl start postgresql
   ```

### Authentication Failed

If you see "authentication failed" errors:

1. Check your `.env` file has correct credentials
2. Try connecting directly with psql to verify credentials:
   ```bash
   psql -U postgres -d ucc_mca
   ```

3. If needed, reset the password:
   ```bash
   # macOS (with Homebrew)
   psql postgres -c "ALTER USER postgres PASSWORD 'newpassword';"
   ```

### Extension Errors

If you see errors about missing extensions (uuid-ossp, pg_trgm, btree_gin):

These extensions are included in most PostgreSQL installations but may need to be enabled:

```sql
-- Connect as superuser
psql -U postgres -d ucc_mca

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
```

### Permission Denied

If you see "permission denied" errors:

```sql
-- Connect as postgres user
psql -U postgres -d ucc_mca

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE ucc_mca TO your_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_user;
```

## Production Deployment

For production deployments:

1. **Use SSL connections:**
   Add to your DATABASE_URL or connection config:
   ```
   ?sslmode=require
   ```

2. **Use connection pooling:**
   Consider using PgBouncer for connection pooling in high-traffic scenarios

3. **Set appropriate pool sizes:**
   Adjust `DB_POOL_MAX` based on your workload

4. **Enable logging for monitoring:**
   Set `DB_LOG_QUERIES=true` initially to monitor query performance

5. **Regular backups:**
   ```bash
   pg_dump -U postgres ucc_mca > backup.sql
   ```

6. **Restore from backup:**
   ```bash
   psql -U postgres -d ucc_mca < backup.sql
   ```

## Database Maintenance

### Creating New Migrations

To create a new migration:

1. Create a new file in `database/migrations/` with format: `002_migration_name.sql`
2. Start with:
   ```sql
   -- Migration: 002_migration_name
   -- Description: What this migration does
   -- Date: YYYY-MM-DD

   BEGIN;

   -- Your SQL here

   -- Record migration
   INSERT INTO schema_migrations (version, name)
   VALUES ('002', 'migration_name');

   COMMIT;
   ```

3. Run migrations:
   ```bash
   npm run db:migrate
   ```

### Indexes

The schema includes optimized indexes for:
- Fuzzy text search (using pg_trgm)
- Date range queries
- Priority/score sorting
- Foreign key relationships

Monitor slow queries and add indexes as needed.

## Next Steps

After setting up the database:

1. Run the data scrapers to populate initial data
2. Set up scheduled ingestion jobs
3. Configure enrichment services
4. Set up monitoring and alerting

For more information, see:
- [DATA_PIPELINE.md](./DATA_PIPELINE.md) - Data ingestion and processing
- [README.md](./README.md) - General project documentation
