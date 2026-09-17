## Database Setup Guide

### Prerequisites

- PostgreSQL 14+ installed
- Database user with CREATE DATABASE permissions

### Quick Start

```bash
# 1. Create database
createdb ucc_intelligence

# 2. Run schema
psql -d ucc_intelligence -f database/schema.sql

# 3. (Optional) Load sample data
psql -d ucc_intelligence -f database/seed.sql
```

### Environment Variables

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/ucc_intelligence
DATABASE_POOL_SIZE=20
DATABASE_TIMEOUT=30000
```

### Migrations

```bash
# Run all migrations
for file in database/migrations/*.sql; do
    psql -d ucc_intelligence -f "$file"
done
```

### Backup & Restore

```bash
# Backup
pg_dump ucc_intelligence > backup.sql

# Restore
psql -d ucc_intelligence < backup.sql
```

### Performance Tuning

See `database/tuning.md` for PostgreSQL configuration recommendations.
