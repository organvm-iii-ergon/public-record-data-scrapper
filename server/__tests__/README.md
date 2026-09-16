# Backend Testing Guide

Comprehensive testing infrastructure for the UCC-MCA Intelligence API server.

## Test Structure

```
server/__tests__/
├── setup.ts                    # Test environment setup
├── helpers/                    # Test utilities
│   ├── testData.ts            # Data factories for creating test data
│   └── apiHelper.ts           # API testing utilities
├── services/                   # Unit tests for service layer
│   ├── ProspectsService.test.ts
│   ├── EnrichmentService.test.ts
│   ├── CompetitorsService.test.ts
│   └── PortfolioService.test.ts
└── routes/                     # Integration tests for API endpoints
    ├── prospects.test.ts
    ├── enrichment.test.ts
    ├── competitors.test.ts
    ├── portfolio.test.ts
    └── jobs.test.ts
```

## Running Tests

### Run all backend tests

```bash
npm run test:server
```

### Run tests in watch mode

```bash
npm run test:server:watch
```

### Generate coverage report

```bash
npm run test:server:coverage
```

Coverage reports are generated in `./coverage/` directory:

- `coverage/index.html` - Interactive HTML report
- `coverage/lcov.info` - LCOV format for CI/CD
- `coverage/coverage-final.json` - JSON format

## Test Environment

### Database Setup

Tests use a separate test database to avoid contaminating development data.

**Environment Variables:**

```env
TEST_DATABASE_URL=postgresql://localhost:5432/ucc_intelligence_test
DATABASE_URL=postgresql://localhost:5432/ucc_intelligence_test
```

**Setup:**

```bash
# Create test database
createdb ucc_intelligence_test

# Run migrations
DATABASE_URL=postgresql://localhost:5432/ucc_intelligence_test npm run migrate
```

### Redis (for queue tests)

Queue-related tests require Redis:

```bash
# Start Redis (Docker)
docker run -d -p 6379:6379 redis:7

# Or use local Redis
redis-server
```

### Cleanup

The test setup automatically:

- Cleans up all test data after each test
- Ensures tests don't interfere with each other
- Disconnects from database after all tests complete

## Writing Tests

### Service Unit Tests

Use `TestDataFactory` to create test data:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { ProspectsService } from '../../services/ProspectsService'
import { TestDataFactory } from '../helpers/testData'

describe('ProspectsService', () => {
  let service: ProspectsService

  beforeEach(() => {
    service = new ProspectsService()
  })

  it('should list prospects', async () => {
    // Create test data
    await TestDataFactory.createProspects(5, { state: 'NY' })

    // Test the service
    const result = await service.list({
      page: 1,
      limit: 10,
      sort_by: 'created_at',
      sort_order: 'desc'
    })

    // Assert results
    expect(result.prospects.length).toBe(5)
  })
})
```

### API Integration Tests

Use `ApiTestHelper` for endpoint testing:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { ApiTestHelper } from '../helpers/apiHelper'
import { TestDataFactory } from '../helpers/testData'

describe('Prospects API', () => {
  let api: ApiTestHelper

  beforeEach(() => {
    api = new ApiTestHelper()
  })

  it('should return prospects list', async () => {
    await TestDataFactory.createProspects(3)

    const response = await api.get('/api/prospects')

    expect(response.status).toBe(200)
    expect(response.body.prospects.length).toBe(3)
  })

  it('should create a prospect', async () => {
    const data = {
      company_name: 'Test Corp',
      state: 'NY'
    }

    const response = await api.post('/api/prospects', data)

    expect(response.status).toBe(201)
    expect(response.body.company_name).toBe('Test Corp')
  })
})
```

## Test Data Factories

### Creating Prospects

```typescript
// Create single prospect
const prospect = await TestDataFactory.createProspect({
  companyName: 'Test Company',
  state: 'NY',
  industry: 'Technology',
  riskScore: 85
})

// Create multiple prospects
const prospects = await TestDataFactory.createProspects(10, {
  state: 'CA'
})
```

### Creating Portfolio Companies

```typescript
const company = await TestDataFactory.createPortfolioCompany({
  companyName: 'Portfolio Co',
  fundedAmount: 1000000,
  healthScore: 85,
  healthGrade: 'B'
})
```

### Creating UCC Filings

```typescript
const filing = await TestDataFactory.createUCCFiling({
  debtorName: 'Debtor Corp',
  securedParty: 'Lender LLC',
  state: 'NY',
  lienAmount: 500000
})
```

### Creating Growth Signals

```typescript
await TestDataFactory.createGrowthSignal(
  prospectId,
  'hiring', // or 'permits', 'contracts', 'expansion', 'equipment'
  false // isPortfolioCompany
)
```

### Creating Health Scores

```typescript
await TestDataFactory.createHealthScore(
  prospectId,
  85, // score
  false // isPortfolioCompany
)
```

## API Test Helpers

### Making Requests

```typescript
// GET request
const response = await api.get('/api/prospects')

// POST request
const response = await api.post('/api/prospects', { company_name: 'Test' })

// PATCH request
const response = await api.patch('/api/prospects/uuid', { status: 'archived' })

// DELETE request
const response = await api.delete('/api/prospects/uuid')
```

### Assertions

```typescript
// Assert success (2xx status)
api.assertSuccess(response)

// Assert specific error status
api.assertError(response, 404)

// Assert object has fields
api.assertHasFields(response.body, ['id', 'company_name', 'state'])

// Assert pagination structure
api.assertPagination(response)
```

## Coverage Requirements

The test suite enforces minimum coverage thresholds:

- **Lines**: 80%
- **Functions**: 80%
- **Branches**: 75%
- **Statements**: 80%

Coverage is automatically checked in CI/CD pipeline.

## CI/CD Integration

### GitHub Actions

Tests run automatically on:

- Every push to any branch
- Pull requests to `main`, `master`, or `develop`

The workflow:

1. Sets up PostgreSQL and Redis
2. Installs dependencies
3. Runs database migrations
4. Executes test suite
5. Generates coverage report
6. Uploads coverage to Codecov (if configured)
7. Comments on PRs with coverage stats

### Local CI Testing

Test the CI workflow locally:

```bash
# Set environment variables
export DATABASE_URL=postgresql://localhost:5432/ucc_intelligence_test
export REDIS_HOST=localhost
export REDIS_PORT=6379
export NODE_ENV=test

# Run migrations
npm run migrate

# Run tests
npm run test:server:coverage
```

## Best Practices

### 1. Test Isolation

Each test should be independent:

- Don't rely on test execution order
- Clean up test data (automatic with setup.ts)
- Don't share mutable state between tests

### 2. Descriptive Test Names

Use clear, descriptive test names:

```typescript
✅ Good:
it('should filter prospects by state query parameter')
it('should return 404 for non-existent prospect')
it('should validate email format')

❌ Bad:
it('test 1')
it('works')
it('should do stuff')
```

### 3. Arrange-Act-Assert Pattern

Structure tests clearly:

```typescript
it('should update prospect fields', async () => {
  // Arrange - Set up test data
  const prospect = await TestDataFactory.createProspect()

  // Act - Perform the action
  const result = await service.update(prospect.id, {
    risk_score: 90
  })

  // Assert - Verify the result
  expect(result?.risk_score).toBe(90)
})
```

### 4. Test Edge Cases

Cover happy path AND edge cases:

```typescript
describe('update', () => {
  it('should update prospect fields') // Happy path
  it('should return null for non-existent id') // Edge case
  it('should validate update data') // Edge case
  it('should handle partial updates') // Edge case
})
```

### 5. Use Test Data Factories

Always use factories for consistency:

```typescript
✅ Good:
const prospect = await TestDataFactory.createProspect({
  companyName: 'Test Corp'
})

❌ Bad:
await database.query(
  'INSERT INTO prospects (id, company_name, ...) VALUES (...)'
)
```

## Debugging Tests

### Run specific test file

```bash
npx vitest server/__tests__/services/ProspectsService.test.ts
```

### Run specific test

```bash
npx vitest -t "should filter prospects by state"
```

### Debug with --inspect

```bash
node --inspect-brk ./node_modules/.bin/vitest --run
```

Then attach your debugger (VS Code, Chrome DevTools).

### Verbose output

```bash
npm run test:server -- --reporter=verbose
```

## Troubleshooting

### Tests failing with database errors

```bash
# Ensure test database exists
createdb ucc_intelligence_test

# Run migrations
DATABASE_URL=postgresql://localhost:5432/ucc_intelligence_test npm run migrate

# Check connection
psql postgresql://localhost:5432/ucc_intelligence_test
```

### Tests hanging

- Check Redis is running: `redis-cli ping`
- Increase timeout in vitest.config.server.ts
- Look for unclosed database connections

### Coverage not generated

```bash
# Ensure coverage provider is installed
npm install --save-dev @vitest/coverage-v8

# Run with coverage flag
npm run test:server:coverage
```

### CI/CD failures

1. Check GitHub Actions logs
2. Verify environment variables are set
3. Ensure PostgreSQL and Redis services are healthy
4. Check for flaky tests (run tests multiple times locally)

## Contributing

When adding new features:

1. Write tests FIRST (TDD approach)
2. Ensure tests pass: `npm run test:server`
3. Check coverage: `npm run test:server:coverage`
4. Verify CI passes before merging

## Future Enhancements

- [ ] E2E tests with Playwright
- [ ] Load testing with k6
- [ ] Performance benchmarks
- [ ] Contract testing for external APIs
- [ ] Mutation testing
- [ ] Visual regression testing (for future dashboard)
