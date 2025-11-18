# Database Module

Type-safe PostgreSQL database client with connection pooling, migrations, and query helpers.

## Quick Start

```typescript
import { initDatabase, createQueries } from '@/lib/database'

// Initialize database connection
const db = await initDatabase({
  connectionString: process.env.DATABASE_URL
})

// Create query helpers
const queries = createQueries(db)

// Query data
const prospects = await queries.getProspects({
  status: 'new',
  minScore: 70,
  limit: 10
})
```

## Features

### Connection Pooling
- Automatic connection pool management
- Configurable pool size and timeouts
- Connection health checks
- Retry logic with exponential backoff

### Query Logging
- Automatic query logging in development
- Duration tracking
- Error tracking
- Query statistics

### Transactions
- Built-in transaction support
- Automatic rollback on errors
- Type-safe transaction callbacks

### Migrations
- Version-controlled schema changes
- Automatic migration tracking
- Rollback support
- Migration status reporting

## Configuration

### Environment Variables

```bash
# Connection
DATABASE_URL=postgresql://user:pass@localhost:5432/ucc_intelligence
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ucc_intelligence
DB_USER=postgres
DB_PASSWORD=secret
DB_SSL=true

# Pool Configuration
DATABASE_POOL_SIZE=20
DATABASE_TIMEOUT=30000
```

### Programmatic Configuration

```typescript
const db = await initDatabase({
  host: 'localhost',
  port: 5432,
  database: 'ucc_intelligence',
  user: 'postgres',
  password: 'secret',
  ssl: true,
  poolSize: 20,
  queryTimeoutMillis: 30000,
  enableQueryLogging: true
})
```

## Usage Examples

### Basic Queries

```typescript
import { getDatabase, createQueries } from '@/lib/database'

const db = getDatabase()
const queries = createQueries(db)

// Get all prospects
const allProspects = await queries.getProspects()

// Get filtered prospects
const newProspects = await queries.getProspects({
  status: 'new',
  industry: 'restaurant',
  state: 'NY',
  minScore: 80,
  limit: 50,
  offset: 0
})

// Get single prospect
const prospect = await queries.getProspectById(id)

// Search prospects (fuzzy)
const results = await queries.searchProspects('acme corp')
```

### Creating Records

```typescript
// Create prospect
const prospect = await queries.createProspect({
  companyName: 'Acme Restaurant Corp',
  industry: 'restaurant',
  state: 'NY',
  priorityScore: 85,
  defaultDate: new Date('2024-01-15'),
  timeSinceDefault: 180,
  estimatedRevenue: 5000000
})

// Create UCC filing
const filing = await queries.createUCCFiling({
  externalId: 'NY-2024-12345',
  filingDate: new Date('2024-01-15'),
  debtorName: 'Acme Restaurant Corp',
  securedParty: 'First Capital MCA',
  state: 'NY',
  lienAmount: 250000,
  status: 'active',
  filingType: 'UCC-1',
  source: 'ny-portal'
})

// Link filing to prospect
await queries.linkUCCFilingToProspect(prospect.id, filing.id)

// Add growth signal
const signal = await queries.createGrowthSignal({
  prospectId: prospect.id,
  type: 'hiring',
  source: 'indeed',
  description: 'Posted 3 new job openings',
  detectedDate: new Date(),
  confidence: 0.9,
  metadata: { positions: ['Chef', 'Manager', 'Server'] }
})
```

### Updating Records

```typescript
// Update prospect status
const updated = await queries.updateProspect(prospectId, {
  status: 'claimed',
  claimedBy: 'john@example.com',
  claimedDate: new Date()
})

// Update priority score
await queries.updateProspect(prospectId, {
  priorityScore: 92
})
```

### Transactions

```typescript
import { getDatabase } from '@/lib/database'

const db = getDatabase()

// Execute multiple operations in a transaction
await db.transaction(async (client) => {
  // All queries use the same transaction
  await client.query('INSERT INTO prospects (...) VALUES (...)')
  await client.query('INSERT INTO growth_signals (...) VALUES (...)')
  await client.query('UPDATE prospects SET ...')

  // Commit happens automatically if no errors
  // Rollback happens automatically on error
})
```

### Raw Queries

```typescript
import { getDatabase } from '@/lib/database'

const db = getDatabase()

// Execute raw query
const result = await db.query(
  'SELECT * FROM prospects WHERE state = $1 AND score > $2',
  ['NY', 80]
)

// Get single row
const row = await db.queryOne(
  'SELECT * FROM prospects WHERE id = $1',
  [prospectId]
)

// Get many rows
const rows = await db.queryMany(
  'SELECT * FROM prospects ORDER BY priority_score DESC LIMIT $1',
  [10]
)
```

### Migrations

```typescript
import { initDatabase, runMigrations, getMigrationStatus } from '@/lib/database'

const db = await initDatabase()

// Run all pending migrations
const result = await runMigrations(db, './database/migrations')

if (result.success) {
  console.log(`Applied ${result.migrations.length} migrations`)
} else {
  console.error('Migration errors:', result.errors)
}

// Check migration status
const status = await getMigrationStatus(db)
console.log('Applied migrations:', status)
```

### Statistics

```typescript
const queries = createQueries(db)

// Get prospect statistics
const stats = await queries.getProspectStats()
console.log('Total prospects:', stats.total)
console.log('By status:', stats.byStatus)
console.log('By industry:', stats.byIndustry)
console.log('Average score:', stats.avgScore)
```

### Connection Management

```typescript
import { initDatabase, closeDatabase, getDatabase } from '@/lib/database'

// Initialize
const db = await initDatabase()

// Check connection
const healthy = await db.healthCheck()
console.log('Database healthy:', healthy)

// Get connection stats
const stats = db.getStats()
console.log('Pool stats:', stats)

// Close connection (on app shutdown)
await closeDatabase()
```

## Best Practices

### 1. Use Connection Pooling
The client automatically manages a connection pool. Don't create multiple database instances.

```typescript
// ✅ Good - Reuse singleton
import { getDatabase } from '@/lib/database'
const db = getDatabase()

// ❌ Bad - Creates new pool
const db = new DatabaseClient(config)
```

### 2. Use Query Helpers
Prefer typed query helpers over raw SQL for common operations.

```typescript
// ✅ Good - Type-safe
const prospects = await queries.getProspects({ status: 'new' })

// ❌ Less ideal - Raw SQL
const result = await db.query('SELECT * FROM prospects WHERE status = $1', ['new'])
```

### 3. Use Transactions for Multiple Operations
Wrap related operations in transactions to ensure data consistency.

```typescript
// ✅ Good - Atomic operation
await db.transaction(async (client) => {
  await client.query('INSERT INTO prospects ...')
  await client.query('INSERT INTO growth_signals ...')
})

// ❌ Bad - Separate queries (not atomic)
await db.query('INSERT INTO prospects ...')
await db.query('INSERT INTO growth_signals ...')
```

### 4. Handle Errors Properly
Always wrap database operations in try-catch blocks.

```typescript
try {
  const prospect = await queries.getProspectById(id)
  if (!prospect) {
    throw new Error('Prospect not found')
  }
  return prospect
} catch (error) {
  console.error('Database error:', error)
  throw error
}
```

### 5. Close Connections on Shutdown
Always close database connections when the application shuts down.

```typescript
process.on('SIGTERM', async () => {
  await closeDatabase()
  process.exit(0)
})
```

## Testing

```typescript
import { initDatabase, closeDatabase } from '@/lib/database'

describe('Database Tests', () => {
  let db: DatabaseClient

  beforeAll(async () => {
    db = await initDatabase({
      database: 'ucc_intelligence_test'
    })
  })

  afterAll(async () => {
    await closeDatabase()
  })

  it('should connect to database', async () => {
    const healthy = await db.healthCheck()
    expect(healthy).toBe(true)
  })

  it('should query prospects', async () => {
    const queries = createQueries(db)
    const prospects = await queries.getProspects()
    expect(Array.isArray(prospects)).toBe(true)
  })
})
```

## Troubleshooting

### Connection Refused
- Check DATABASE_URL is correct
- Ensure PostgreSQL is running
- Verify network connectivity
- Check firewall rules

### Query Timeout
- Increase queryTimeoutMillis
- Add indexes to frequently queried columns
- Optimize slow queries

### Pool Exhaustion
- Increase poolSize
- Ensure connections are released (use transactions properly)
- Check for connection leaks

### Migration Errors
- Check migration SQL syntax
- Ensure migrations are numbered sequentially
- Review migration order dependencies
- Check database permissions

## API Reference

See inline TypeScript documentation for complete API reference.
