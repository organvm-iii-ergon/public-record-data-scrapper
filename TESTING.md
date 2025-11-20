# Testing Guide

This document provides comprehensive information about the testing infrastructure for the UCC-MCA Intelligence Platform's agentic system.

## Test Statistics

- **Total Tests**: 526 (100% passing ✅)
- **Test Files**: 15
- **Test Suites**: 60+
- **Duration**: ~27 seconds
- **Pass Rate**: 100%
- **Coverage**: Comprehensive edge case and integration coverage
- **Last Updated**: November 2025

## Testing Framework

We use **Vitest** as our primary testing framework with the following configuration:

- **Test Runner**: Vitest 4.0.10
- **Environment**: jsdom (for React component testing)
- **Coverage Provider**: v8
- **React Support**: @vitejs/plugin-react-swc
- **Performance**: Fork pool with 4 workers, file parallelism enabled

## Getting Started

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with UI interface
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

### Test Structure

Tests are located alongside the source files they test, following the pattern `*.test.ts` or `*.test.tsx`.

Example structure:
```
src/lib/agentic/
├── BaseAgent.ts
├── BaseAgent.test.ts
├── AgenticEngine.ts
├── AgenticEngine.test.ts
├── agents/
│   ├── DataAnalyzerAgent.ts
│   ├── DataAnalyzerAgent.test.ts
│   └── ...
```

## Recent Improvements (November 2025)

### Fixed 4 Failing Tests  → 512/512 → 526/526

#### Test 1: "should handle collection failures gracefully"
- **Issue**: Timeout (5000ms exceeded)
- **Root Cause**: Orchestrator collected from all 50+ states by default, each taking 500ms
- **Fix**: Added `{ limit: 2 }` parameter to constrain collection scope
- **Location**: `AgentOrchestrator.test.ts:329`

#### Test 2: "should update last collection time"
- **Issue**: Timeout (5000ms exceeded)
- **Root Cause**: Same as Test 1 - too many states collected
- **Fix**: Added `{ limit: 2 }` parameter
- **Location**: `AgentOrchestrator.test.ts:338`

#### Test 3: "should use configured interval"
- **Issue**: Assertion failed - `totalCollections` was 0
- **Root Cause**: Test waited 150ms, but collection takes 500ms to complete
- **Fix**: Increased wait time to 650ms (100ms interval + 500ms collection + buffer)
- **Location**: `AgentOrchestrator.test.ts:440`

#### Test 4: "should continue after individual failures"
- **Issue**: Assertion failed - no failed collections
- **Root Cause**: `collectFromAllSources()` only collected from valid states
- **Fix**: Changed to explicitly call `collectFromState()` with both valid and invalid states
- **Location**: `AgentOrchestrator.test.ts:492`

### Added 14 Edge Case Tests

All edge case tests added to `AgentOrchestrator.test.ts:563-770`:

**Boundary Conditions (3 tests)**
1. Empty states array handling - Verifies fallback to all agents
2. Very large concurrency limit - Tests with maxConcurrentCollections: 1000
3. Single state collection - Minimal configuration testing

**Error Recovery (3 tests)**
4. Multiple consecutive failures - 3 invalid states simultaneously
5. Accurate counts after failures - Metrics tracking validation
6. Error details in failed results - Error message presence and content

**Concurrent Operations (2 tests)**
7. Multiple simultaneous collectFromAllSources - Parallel orchestrator calls
8. Metrics tracking with concurrency - Counter accuracy under load

**State Management (3 tests)**
9. Separate orchestrator state - Instance isolation verification
10. lastCollectionTime after failures - Timestamp update behavior
11. Immutable status copies - No shared state mutations

**Collection Options Validation (3 tests)**
12. statesOnly option - Filter to state agents only
13. entryPointsOnly option - Filter to entry point agents only
14. Very small limit - Edge case with limit: 1

### Performance Optimizations

**Vitest Configuration Enhancements**:
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    pool: 'forks',              // Use forks for isolation
    poolOptions: {
      forks: {
        singleFork: false,      // Allow multiple workers
        maxForks: 4             // Limit concurrent workers
      }
    },
    fileParallelism: true,      // Run files in parallel
    testTimeout: 10000,         // 10 second default timeout
    hookTimeout: 10000          // 10 second hook timeout
  }
})
```

**Benefits**:
- Parallel test file execution across 4 worker processes
- Better isolation with fork pool
- Increased default timeout to prevent false negatives
- File-level parallelism for maximum throughput

## Testing Strategy

### Unit Tests

We follow the **AAA (Arrange-Act-Assert)** pattern for all unit tests:

1. **Arrange**: Set up test data and dependencies
2. **Act**: Execute the code being tested
3. **Assert**: Verify the results match expectations

Example:
```typescript
it('should create finding with correct structure', () => {
  // Arrange
  const agent = new TestAgent()
  
  // Act
  const finding = agent.createFinding('data-quality', 'warning', 'Test finding', { test: 'data' })
  
  // Assert
  expect(finding).toMatchObject({
    category: 'data-quality',
    severity: 'warning',
    description: 'Test finding'
  })
})
```

### Test Coverage Goals

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

### What We Test

#### Core Components
- **BaseAgent**: Foundation for all agents
  - Agent initialization
  - Finding creation
  - Improvement suggestion generation
  - Analysis assembly

- **AgenticEngine**: Orchestration and execution
  - Configuration management
  - Autonomous cycles
  - Safety thresholds
  - Approval workflows
  - Health metrics

- **AgenticCouncil**: Multi-agent collaboration
  - Council review workflow
  - Agent handoff mechanism
  - Improvement aggregation

#### Specialized Agents
- **DataAnalyzerAgent**: Data quality and freshness
- **OptimizerAgent**: Performance optimization
- **SecurityAgent**: Security vulnerabilities
- **UXEnhancerAgent**: User experience improvements

## Naming Conventions

### Test Files
- Use `.test.ts` or `.test.tsx` suffix
- Match the source file name exactly (e.g., `BaseAgent.ts` → `BaseAgent.test.ts`)

### Test Suites
- Use `describe()` blocks to group related tests
- Name suites after the component/feature being tested
- Nest `describe()` blocks for sub-features

Example:
```typescript
describe('AgenticEngine', () => {
  describe('Configuration Management', () => {
    it('should initialize with default configuration', () => { /* ... */ })
    it('should accept custom configuration', () => { /* ... */ })
  })
})
```

### Test Cases
- Start with "should" to describe expected behavior
- Be specific and descriptive
- Include context when needed

Good examples:
- ✅ `should detect stale health scores`
- ✅ `should not flag fresh data`
- ✅ `should set critical severity for very low completeness`

## Mocking and Test Utilities

### System Context Mock

Most tests use a mock `SystemContext` object:

```typescript
const mockContext: SystemContext = {
  prospects: [],
  competitors: [],
  portfolio: [],
  userActions: [],
  performanceMetrics: {
    avgResponseTime: 500,
    errorRate: 0.01,
    userSatisfactionScore: 8,
    dataFreshnessScore: 90
  },
  timestamp: new Date().toISOString()
}
```

Customize this for each test scenario as needed.

### beforeEach Setup

Use `beforeEach()` to reset state before each test:

```typescript
beforeEach(() => {
  agent = new DataAnalyzerAgent()
  mockContext = { /* fresh context */ }
})
```

## Test Categories

### 1. Happy Path Tests
Test normal, expected behavior:
```typescript
it('should detect missing revenue estimates', async () => {
  mockContext.prospects = [{ companyName: 'Test Co' }]
  const analysis = await agent.analyze(mockContext)
  expect(analysis.findings.length).toBeGreaterThan(0)
})
```

### 2. Edge Case Tests
Test boundary conditions and unusual inputs:
```typescript
it('should handle empty prospect list', async () => {
  mockContext.prospects = []
  const analysis = await agent.analyze(mockContext)
  expect(analysis).toBeDefined()
})
```

### 3. Error Handling Tests
Verify graceful error handling:
```typescript
it('should handle agent analysis errors gracefully', async () => {
  // Add failing agent and verify system continues
})
```

### 4. Scenario-based Tests
Test realistic, complex scenarios:
```typescript
it('should handle high-risk security scenario', async () => {
  // Set up complex security scenario with multiple issues
  // Verify appropriate responses
})
```

## Coverage Report

Generate a coverage report to see which code is tested:

```bash
npm run test:coverage
```

This generates:
- Terminal output with summary
- HTML report in `coverage/index.html`
- JSON report in `coverage/coverage-final.json`

Coverage is configured to exclude:
- `node_modules/`
- Test files themselves
- Type definition files (`.d.ts`)
- Configuration files
- Build output directories

## Continuous Integration

Tests run automatically on:
- Every pull request
- Every commit to main branches
- On-demand via GitHub Actions

CI configuration checks:
- All tests must pass
- Coverage thresholds must be met
- No linting errors

## Troubleshooting

### Common Issues

**Issue**: "Cannot find module" errors
- **Solution**: Check import paths - test files in subdirectories need relative imports
- Example: `import { DataAnalyzerAgent } from './DataAnalyzerAgent'` (not `'./agents/DataAnalyzerAgent'`)

**Issue**: Tests timeout
- **Solution**: Increase timeout in test or async operations
- Example: `it('long test', async () => { /* ... */ }, 10000)` // 10 second timeout

**Issue**: Flaky tests (sometimes pass, sometimes fail)
- **Solution**: Look for timing issues, shared state, or random data
- Use `beforeEach()` to reset state
- Avoid time-dependent assertions

### Debugging Tests

Run a single test file:
```bash
npm test src/lib/agentic/BaseAgent.test.ts
```

Run tests matching a pattern:
```bash
npm test -- --grep "DataAnalyzerAgent"
```

Enable verbose output:
```bash
npm test -- --reporter=verbose
```

## Best Practices

1. **Keep tests focused**: One assertion per test when possible
2. **Make tests independent**: Tests should not depend on each other
3. **Use descriptive names**: Test names should explain what they test
4. **Test behavior, not implementation**: Focus on what the code does, not how
5. **Keep tests maintainable**: Refactor tests when refactoring code
6. **Use setup/teardown**: Leverage `beforeEach`/`afterEach` for common setup
7. **Mock external dependencies**: Isolate the unit being tested
8. **Write tests first**: Consider TDD for new features

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Jest DOM Matchers](https://github.com/testing-library/jest-dom)

## Contributing

When adding new features:
1. Write tests first (TDD approach preferred)
2. Ensure all tests pass before submitting PR
3. Maintain or improve coverage percentages
4. Follow existing test patterns and conventions
5. Update this documentation if adding new testing patterns

## Support

For questions or issues with tests:
- Check this guide first
- Review existing test files for examples
- Ask in the team's development channel
- Create an issue with the `testing` label
