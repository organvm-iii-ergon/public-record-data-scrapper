# Testing Guide

This document describes the testing strategy and how to run tests for the UCC-MCA Intelligence Platform.

## Testing Framework

The project uses [Vitest](https://vitest.dev/) as the testing framework, chosen for its:
- Native TypeScript support
- Seamless integration with Vite
- Fast execution
- Jest-compatible API
- Built-in coverage reporting

## Test Structure

Tests are organized alongside the code they test:

```plaintext
src/
├── lib/
│   └── agentic/
│       ├── BaseAgent.ts
│       ├── BaseAgent.test.ts
│       ├── AgenticEngine.ts
│       ├── AgenticEngine.test.ts
│       └── agents/
│           ├── DataAnalyzerAgent.ts
│           └── OptimizerAgent.ts
└── test/
    └── setup.ts
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode (for development)
```bash
npm test -- --watch
```

### Run tests with UI
```bash
npm run test:ui
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Run specific test file
```bash
npm test -- --run BaseAgent.test.ts
```

## Test Coverage

Current test coverage for the agentic system:

### Core Components
- **BaseAgent** (11 tests): Foundation class for all agents
  - Constructor validation
  - Finding creation
  - Improvement suggestion creation
  - Analysis structure

- **AgenticEngine** (26 tests): Orchestration and autonomous execution
  - Configuration management
  - Autonomous cycles
  - Safety mechanisms
  - Manual approval workflow
  - System health metrics
  - Feedback loops
  - Execution history

- **AgenticCouncil** (25 tests): Multi-agent coordination
  - Council review process
  - Agent handoff mechanism
  - Improvement aggregation
  - Status management

### Specialized Agents
- **DataAnalyzerAgent** (13 tests): Data quality assessment
  - Freshness detection
  - Quality assessment
  - Completeness checking
  - Improvement suggestions

- **OptimizerAgent** (21 tests): Performance optimization
  - Performance analysis
  - Optimization opportunities
  - Caching strategies
  - Pagination suggestions

- **SecurityAgent** (22 tests): Security monitoring
  - Sensitive data detection
  - Access pattern analysis
  - Security hardening
  - Encryption recommendations

- **UXEnhancerAgent** (25 tests): User experience improvements
  - Interaction analysis
  - Satisfaction monitoring
  - Workflow efficiency
  - Usability suggestions

**Total: 143 tests**

## Writing Tests

### Test File Naming
- Test files should be named `[ComponentName].test.ts`
- Place test files next to the code they test

### Test Structure
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { ComponentToTest } from './ComponentToTest'

describe('ComponentToTest', () => {
  let component: ComponentToTest

  beforeEach(() => {
    component = new ComponentToTest()
  })

  describe('Feature Group', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test'
      
      // Act
      const result = component.doSomething(input)
      
      // Assert
      expect(result).toBe('expected')
    })
  })
})
```

### Best Practices

1. **Descriptive test names**: Use clear, descriptive names that explain what is being tested
2. **Arrange-Act-Assert**: Follow the AAA pattern for test clarity
3. **Test one thing**: Each test should verify a single behavior
4. **Use beforeEach**: Set up common test data in beforeEach hooks
5. **Test edge cases**: Include tests for boundary conditions and error cases
6. **Mock when needed**: Use mocks for external dependencies, but prefer real implementations for unit tests

## Testing Guidelines

### Unit Tests
- Test individual functions and methods in isolation
- Mock external dependencies
- Focus on a single unit of functionality
- Fast execution (< 100ms per test typically)

### Integration Tests
- Test interaction between multiple components
- Use real implementations where possible
- Test complete workflows
- May be slower than unit tests

### What to Test
- ✅ Public API methods
- ✅ Edge cases and boundary conditions
- ✅ Error handling
- ✅ Business logic
- ✅ Data transformations

### What Not to Test
- ❌ Third-party libraries (trust they work)
- ❌ Trivial getters/setters without logic
- ❌ Framework code
- ❌ Configuration files

## Continuous Integration

Tests are run automatically on:
- Pull request creation
- Push to main branch
- Before merging

All tests must pass before code can be merged.

## Coverage Goals

- **Target**: 80% code coverage for critical paths
- **Minimum**: 70% code coverage overall
- **Focus areas**: Business logic, data transformations, error handling

## Troubleshooting

### Tests are slow
- Tests run in parallel by default with Vitest.
- To explicitly specify the pool type: `npm test -- --pool=threads`
- Run only changed tests: `npm test -- --changed`

### Tests fail locally but pass in CI
- Check for timezone issues
- Verify node version matches CI
- Check for file system case sensitivity

### Coverage not generating
```bash
npm run test:coverage
```
Coverage reports are generated in `coverage/` directory.

## Future Improvements

- [ ] Add E2E tests using Playwright
- [ ] Add visual regression tests
- [ ] Implement mutation testing
- [ ] Add performance benchmarks
- [ ] Set up test fixtures library
- [ ] Add integration tests for API endpoints (when backend is implemented)
- [ ] Add tests for Playwright scrapers (when implemented)

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
