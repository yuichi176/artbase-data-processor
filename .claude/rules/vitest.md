---
paths: src/**/*.test.ts
---

# Vitest Guidelines

## 1. Test Structure

### File Naming and Location

- Test files must be located next to the source file they test
- Use `.test.ts` suffix: `service.ts` → `service.test.ts`
- Mirror the source directory structure

```
src/
├── services/
│   ├── museum.service.ts
│   └── museum.service.test.ts  # Test file next to source
```

### Organizing Tests

- Use `describe` blocks to group related tests for a single module or function
- Use nested `describe` blocks for different functions within a module
- Use `it` or `test` for individual test cases with clear, descriptive names
- Follow the AAA pattern (Arrange, Act, Assert) for each test

```typescript
describe('museum.service', () => {
  describe('buildMuseumMaps', () => {
    it('should build correct maps for museums with aliases', () => {
      // Arrange: Set up test data
      const museums = [/* test data */]

      // Act: Execute the function
      const maps = buildMuseumMaps(museums)

      // Assert: Verify the results
      expect(maps.aliasToName.get('東博')).toBe('東京国立博物館')
    })
  })
})
```

## 2. Mocking External Dependencies

### Module-Level Mocking

Always mock external dependencies at the top of the test file, before any imports:

```typescript
// ❌ Bad: Mocking after imports
import { functionToTest } from './service.js'
vi.mock('../lib/firestore.js')

// ✅ Good: Mock before imports
vi.mock('../lib/firestore.js', () => ({
  default: {
    collection: vi.fn(),
    runTransaction: vi.fn(),
  },
}))

import { functionToTest } from './service.js'
```

### Mock Implementation in Tests

Set up mock behavior within test cases using `beforeEach` or directly in the test:

```typescript
describe('fetchEnabledMuseumsWithUrls', () => {
  beforeEach(() => {
    vi.clearAllMocks()  // Reset mocks between tests
  })

  it('should fetch enabled museums', async () => {
    const mockSnapshot = { docs: [/* mock data */] }
    const mockWhere = vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue(mockSnapshot),
    })

    const db = await import('../lib/firestore.js')
    vi.mocked(db.default.collection).mockReturnValue({
      where: mockWhere,
    } as never)

    const result = await fetchEnabledMuseumsWithUrls()
    expect(result.museums).toHaveLength(2)
  })
})
```

### Type Assertions for Mocks

When TypeScript complains about mock types, use appropriate type assertions:

```typescript
// For simple mocks
vi.mocked(db.default.collection).mockReturnValue(mockValue as never)

// For complex types that are difficult to satisfy
// eslint-disable-next-line @typescript-eslint/no-explicit-any
return await callback(mockTransaction as any)

// For partial objects in tests
const input = {
  startUrls: [{ url: 'https://example.com', method: 'GET' }],
} as ApifyActorInput  // Use 'as' instead of 'satisfies' for partial mocks
```

## 3. Testing Patterns

### Testing Pure Functions

Pure functions (no side effects, no external dependencies) are simplest to test:

```typescript
describe('buildMuseumMaps', () => {
  it('should handle museums without aliases', () => {
    const museums = [{ id: 'museum1', name: 'Museum', /* ... */ }]
    const maps = buildMuseumMaps(museums)

    expect(maps.aliasToName.get('Museum')).toBe('Museum')
    expect(maps.nameToId.get('Museum')).toBe('museum1')
  })

  it('should handle empty museum array', () => {
    const museums: Museum[] = []
    const maps = buildMuseumMaps(museums)

    expect(maps.aliasToName.size).toBe(0)
    expect(maps.nameToId.size).toBe(0)
  })
})
```

### Testing Functions with External Dependencies

Mock external dependencies (Firestore, APIs, etc.) to isolate the function:

```typescript
describe('runActorAndGetResults', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should successfully run actor and return results', async () => {
    const mockRun = { defaultDatasetId: 'dataset-123' }
    const mockResults = [{ title: 'Exhibition 1' }]

    const mockCall = vi.fn().mockResolvedValue(mockRun)
    const mockListItems = vi.fn().mockResolvedValue({ items: mockResults })

    const apifyClient = await import('../lib/apify.js')
    vi.mocked(apifyClient.default.actor).mockReturnValue({
      call: mockCall,
    } as never)
    vi.mocked(apifyClient.default.dataset).mockReturnValue({
      listItems: mockListItems,
    } as never)

    const result = await runActorAndGetResults('actor-id', input)

    expect(apifyClient.default.actor).toHaveBeenCalledWith('actor-id')
    expect(mockCall).toHaveBeenCalledWith(input, { timeout: 300 })
    expect(result).toEqual(mockResults)
  })
})
```

### Testing Error Handling

Always test error cases and exception handling:

```typescript
describe('getMuseumId', () => {
  it('should throw NotFoundError for unknown venue name', () => {
    const museumMaps = {
      aliasToName: new Map([['Museum A', 'Museum A']]),
      nameToId: new Map([['Museum A', 'museum1']]),
    }

    expect(() => getMuseumId('Unknown Museum', museumMaps)).toThrow(NotFoundError)
    expect(() => getMuseumId('Unknown Museum', museumMaps)).toThrow(
      'Museum ID not found for venue: Unknown Museum',
    )
  })
})
```

### Testing Async Functions with Transactions

For complex async operations like Firestore transactions:

```typescript
describe('processScrapeResults', () => {
  it('should create new exhibitions successfully', async () => {
    const mockTransaction = {
      get: vi.fn().mockImplementation((ref) => {
        if (Array.isArray(ref)) {
          return Promise.resolve(ref.map(() => ({ exists: false })))
        }
        return Promise.resolve({ exists: false })
      }),
      set: vi.fn(),
      update: vi.fn(),
    }

    const db = await import('../lib/firestore.js')
    vi.mocked(db.default.runTransaction).mockImplementation(async (callback) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await callback(mockTransaction as any)
    })

    const result = await processScrapeResults(exhibitions, museumMaps, 'scrape')

    expect(result.created).toBe(1)
    expect(mockTransaction.set).toHaveBeenCalled()
  })
})
```

## 4. Test Data Management

### Using Type-Safe Test Data

Always use proper types for test data with `satisfies` or type annotations:

```typescript
// ✅ Good: Type-safe test data
const museums = [
  {
    id: 'museum1',
    name: '東京国立博物館',
    address: '東京都台東区上野公園13-9',
    // ... all required fields
  },
] satisfies Museum[]

// For partial objects in mocks, use type assertion
const input = {
  startUrls: [{ url: 'https://example.com', method: 'GET' }],
} as ApifyActorInput
```

### Reusable Test Fixtures

For commonly used test data, consider creating helper functions:

```typescript
function createMockMuseum(overrides?: Partial<Museum>): Museum {
  return {
    id: 'museum1',
    name: '東京国立博物館',
    address: '東京都台東区上野公園13-9',
    access: 'JR上野駅から徒歩10分',
    openingInformation: '9:30-17:00',
    officialUrl: 'https://www.tnm.jp/',
    scrapeUrl: 'https://example.com',
    scrapeEnabled: true,
    venueType: '博物館',
    area: '上野',
    ...overrides,
  }
}
```

## 5. Coverage and Quality

### Coverage Requirements

- Aim for at least 80% code coverage for service layer
- 100% coverage for critical business logic
- Don't test trivial getters/setters or types

### What to Test

**✅ Always Test:**
- Business logic functions
- Data transformation and validation
- Error handling and edge cases
- Async operations and promises
- Functions with external dependencies (using mocks)

**❌ Don't Test:**
- Type definitions and interfaces
- Simple getters/setters
- External libraries (they have their own tests)
- Configuration files
- The test files themselves

### Running Tests

```bash
# Watch mode (for development)
pnpm test

# Run once (for CI/CD)
pnpm test:run

# With coverage report
pnpm test:coverage
```

## 6. Common Patterns

### Testing Return Values

```typescript
it('should return correct format', () => {
  const result = functionUnderTest()

  expect(result).toHaveLength(2)
  expect(result[0]).toEqual(expectedValue)
  expect(result).toContain(expectedItem)
})
```

### Testing Function Calls

```typescript
it('should call dependency with correct arguments', () => {
  const mockFn = vi.fn()
  functionUnderTest(mockFn)

  expect(mockFn).toHaveBeenCalledTimes(1)
  expect(mockFn).toHaveBeenCalledWith(expectedArgs)
})
```

### Testing Async/Promises

```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction()
  expect(result).toBe(expectedValue)
})

it('should reject with error', async () => {
  await expect(asyncFunction()).rejects.toThrow(ExpectedError)
})
```

### Testing Multiple Scenarios

```typescript
describe('normalizeVenue', () => {
  const testCases = [
    { input: '東博', expected: '東京国立博物館' },
    { input: '東京国立博物館', expected: '東京国立博物館' },
    { input: '不明な美術館', expected: null },
  ]

  testCases.forEach(({ input, expected }) => {
    it(`should normalize "${input}" to ${expected}`, () => {
      const result = normalizeVenue(input, museumMaps)
      expect(result).toBe(expected)
    })
  })
})
```

## 7. Best Practices

### Cleanup and Isolation

```typescript
describe('service', () => {
  beforeEach(() => {
    vi.clearAllMocks()  // Clear mock call history
  })

  afterEach(() => {
    vi.restoreAllMocks()  // Restore original implementations
  })
})
```

### Descriptive Test Names

```typescript
// ❌ Bad: Vague test names
it('works', () => { /* ... */ })
it('test 1', () => { /* ... */ })

// ✅ Good: Clear, descriptive names
it('should return null for unknown venue', () => { /* ... */ })
it('should create new exhibitions successfully', () => { /* ... */ })
it('should throw NotFoundError when museum ID not found', () => { /* ... */ })
```

### One Assertion Focus Per Test

```typescript
// ❌ Bad: Testing multiple unrelated things
it('should do everything', () => {
  expect(result.created).toBe(1)
  expect(result.updated).toBe(0)
  expect(mockFn).toHaveBeenCalled()
  expect(anotherThing).toBe(true)
})

// ✅ Good: Focused tests
it('should create one exhibition', () => {
  expect(result.created).toBe(1)
})

it('should not update any exhibitions', () => {
  expect(result.updated).toBe(0)
})
```

## 8. Troubleshooting

### Type Errors in Tests

If you encounter type errors with mocks:

1. Use `as never` for simple cases
2. Use `as any` with ESLint disable comment for complex types
3. Use type assertions for partial objects: `as Type` instead of `satisfies Type`

### Mock Not Working

If mocks aren't being applied:

1. Ensure `vi.mock()` is called before any imports
2. Clear mocks in `beforeEach()`
3. Check that you're mocking the correct module path
4. Use `vi.mocked()` to get proper TypeScript types

### Tests Failing Intermittently

1. Ensure tests are isolated (no shared state)
2. Mock all external dependencies
3. Use `beforeEach` to reset state
4. Avoid relying on timing or external factors
