# Testing Suite Documentation

This document describes the comprehensive testing suite for the Sandstone document editing application.

## 🧪 Test Structure

### Core Test Files

- **`__tests__/lib/textDiff.test.ts`** - Text diffing algorithm tests
- **`__tests__/lib/search.test.ts`** - Search functionality tests
- **`__tests__/lib/collaboration.test.ts`** - Real-time collaboration tests
- **`__tests__/performance/benchmarks.test.ts`** - Performance benchmarks
- **`__tests__/integration/document-workflow.test.ts`** - End-to-end workflow tests

## 🚀 Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run only performance tests
npm run test:performance

# Run performance tests with detailed report
npm run test:performance:report
```

### Specific Test Suites

```bash
# Run only text diff tests
npm test -- --testNamePattern="Text Diff Logic"

# Run only search tests
npm test -- --testNamePattern="Search Functionality"

# Run only collaboration tests
npm test -- --testNamePattern="Collaboration Manager"

# Run only performance benchmarks
npm test -- --testNamePattern="Performance Benchmarks"
```

## 📊 Test Categories

### 1. Unit Tests

#### Text Diff Logic (`textDiff.test.ts`)

- **Basic Operations**: Simple text replacements, insertions, deletions
- **Edge Cases**: Unicode characters, emojis, very long words, repeated patterns
- **Performance**: Large file handling (10MB+), many small changes
- **Benchmarks**: Character-level and word-level change detection

**Key Functions Tested:**

- `findTextChanges()` - Character-level diffing
- `generateChangeRequests()` - Word-level diffing with fallback
- `findMultipleTextChanges()` - Complex multi-change detection

#### Search Functionality (`search.test.ts`)

- **Basic Search**: Text search with ranking
- **Complex Queries**: Multi-term searches, filters
- **Performance**: Large result sets, concurrent searches
- **Analytics**: Search tracking and metadata handling

#### Collaboration (`collaboration.test.ts`)

- **Connection Management**: Socket.IO connection handling
- **Document Management**: Join/leave document workflows
- **Cursor Tracking**: Real-time cursor position updates
- **User Management**: Multi-user collaboration scenarios
- **Performance**: Concurrent users, frequent updates

### 2. Performance Tests

#### Benchmarks (`benchmarks.test.ts`)

- **Large File Processing**: 10MB+ text files
- **Memory Usage**: Memory leak detection and garbage collection
- **Concurrent Operations**: Parallel processing capabilities
- **Load Testing**: Sustained high-load scenarios

**Performance Targets:**

- Large file diff: < 30 seconds
- Small changes: < 10 seconds
- Basic search: < 100ms
- Cursor updates: < 1 second
- Word-level changes: < 5ms average
- Change request generation: < 2ms average

### 3. Integration Tests

#### Document Workflow (`document-workflow.test.ts`)

- **Complete Lifecycle**: Create → Edit → Search → Analytics
- **Collaborative Editing**: Multi-user document editing
- **Data Integrity**: Consistency across operations
- **Error Handling**: Database failures, invalid inputs

## 🎯 Test Coverage

### Core Functionality

- ✅ Text diffing algorithms
- ✅ Search and filtering
- ✅ Real-time collaboration
- ✅ Database operations
- ✅ API endpoints
- ✅ Error handling

### Performance

- ✅ Large file handling
- ✅ Memory management
- ✅ Concurrent operations
- ✅ Load testing
- ✅ Benchmark comparisons

### Edge Cases

- ✅ Unicode and emoji support
- ✅ Very long content
- ✅ Empty/invalid inputs
- ✅ Network failures
- ✅ Database connection issues

## 📈 Performance Benchmarks

### Text Diff Performance

- **Large Files (10MB)**: < 30 seconds
- **Many Small Changes**: < 10 seconds
- **Word-Level Changes**: < 5ms average
- **Change Request Generation**: < 2ms average

### Search Performance

- **Basic Search**: < 100ms
- **Complex Queries**: < 50ms
- **Large Result Sets**: < 100ms
- **Concurrent Searches**: < 1 second

### Collaboration Performance

- **Cursor Updates**: < 1ms average
- **Document Sync**: < 5ms average
- **User Management**: < 100ms for 100 users
- **Memory Usage**: < 10MB increase for 1000 users

## 🔧 Test Configuration

### Jest Configuration (`jest.config.js`)

```javascript
{
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'lib/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    'app/**/*.{js,jsx,ts,tsx}',
  ]
}
```

### Test Setup (`jest.setup.js`)

- Environment variable mocking
- Global fetch mocking
- Socket.IO mocking
- Next.js router mocking
- Clerk authentication mocking

## 📋 Test Reports

### Coverage Report

```bash
npm run test:coverage
```

Generates detailed coverage reports showing:

- Line coverage
- Branch coverage
- Function coverage
- Statement coverage

### Performance Report

```bash
npm run test:performance:report
```

Generates performance reports with:

- Execution time benchmarks
- Memory usage analysis
- Performance recommendations
- Markdown and JSON outputs

## 🐛 Debugging Tests

### Verbose Output

```bash
npm test -- --verbose
```

### Debug Specific Test

```bash
npm test -- --testNamePattern="specific test name" --verbose
```

### Run Single Test File

```bash
npm test -- __tests__/lib/textDiff.test.ts
```

## 📝 Adding New Tests

### Unit Test Template

```typescript
describe("Feature Name", () => {
  beforeEach(() => {
    // Setup
  });

  it("should handle basic functionality", () => {
    // Test implementation
    expect(result).toBe(expected);
  });

  it("should handle edge cases", () => {
    // Edge case testing
  });

  it("should perform efficiently", () => {
    const startTime = performance.now();
    // Test operation
    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(1000);
  });
});
```

### Performance Test Template

```typescript
describe("Performance Tests", () => {
  it("benchmark: should handle large datasets efficiently", () => {
    const startTime = performance.now();
    // Performance test
    const endTime = performance.now();
    console.log(`Operation took: ${endTime - startTime}ms`);
    expect(endTime - startTime).toBeLessThan(5000);
  });
});
```

## 🚨 Common Issues

### Test Failures

1. **Mock Issues**: Ensure all external dependencies are properly mocked
2. **Async Operations**: Use `async/await` for asynchronous tests
3. **Timing Issues**: Use `performance.now()` for accurate timing measurements
4. **Memory Leaks**: Monitor memory usage in performance tests

### Performance Issues

1. **Slow Tests**: Optimize test data generation
2. **Memory Leaks**: Clear references and force garbage collection
3. **Flaky Tests**: Add proper cleanup in `afterEach` hooks

## 📚 Best Practices

1. **Test Isolation**: Each test should be independent
2. **Descriptive Names**: Use clear, descriptive test names
3. **Performance Monitoring**: Include performance assertions
4. **Edge Case Coverage**: Test boundary conditions
5. **Error Scenarios**: Test error handling and recovery
6. **Documentation**: Document complex test scenarios

## 🔄 Continuous Integration

Tests are automatically run on:

- Pull requests
- Main branch commits
- Release deployments

Performance benchmarks are tracked over time to detect regressions.
