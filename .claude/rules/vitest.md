---
paths: src/**/*.test.ts
---

# Vitest Guidelines

## 1. Test Structure

- Use `describe` blocks to group related tests for a single component or module.
- Name test cases with `test` followed by a clear, descriptive statement of the expected behavior.
- Follow the AAA pattern for each test:
    - **Arrange**: Set up test conditions and inputs.
    - **Act**: Execute the behavior being tested.
    - **Assert**: Verify the expected outcomes.

## 2. Best Practices

### 2.1. Focus on Critical Functionality

- Prioritize tests for business logic, utility functions, and core application flows.
- Ensure that critical paths are always covered by tests.

### 2.2. Dependency Mocking

- Always mock external dependencies before importing the module under test using `vi.mock()`.
- Use spies (`vi.spyOn`) for monitoring function calls when full mocking is unnecessary.

### 2.3. Comprehensive Data Scenarios

- Test with a variety of input scenarios, including:
    - Valid inputs (expected use cases)
    - Invalid inputs (error or edge cases)
    - Boundary values (minimum/maximum, empty/null/undefined)

### 2.4. Edge Case Coverage

- Include tests for:
    - `undefined`, `null`, and unexpected data types.
    - Empty arrays, objects, or strings.
    - Error handling and exception cases.
