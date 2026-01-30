---
paths: src/**/*.{ts,tsx}
---

# TypeScript Guidelines

## 1. Nomenclature

- Use `PascalCase` for classes.
- Use `camelCase` for variables, functions, and methods.
- Use `UPPERCASE` for environment variables.
- Start each function with a verb.
- Use verbs for boolean variables. Example: `isLoading`, `hasError`, `canDelete`, etc.
- Use complete words instead of abbreviations and correct spelling.
- Except for standard abbreviations like API, URL, etc.

## 2. Type Annotations

- All exported functions, variables, and components must have explicit type annotations.
- Avoid using `any` unless absolutely necessary and justified with a comment.
- Use `unknown` instead of `any` when the type is not known at compile time.
- Prefer `satisfies` over type annotations (`: Type`) for better type inference while maintaining type safety.

## 3. Interfaces and Types

- Prefer `interface` over `type` for object shapes and public APIs.
- Use `type` for unions, intersections, and utility types.
- Extend interfaces for shared structures instead of duplicating properties.

## 4. Strictness

- The project must enable strict mode in `tsconfig.json`:

```json
{
    "compilerOptions": {
        "strict": true
    }
}
```
- No disabling of strict options unless discussed and documented.

## 5. Utility Types

- Use built-in utility types (`Partial`, `Pick`, `Omit`, `Record`, etc.) for type transformations.
- Prefer `Readonly` and `ReadonlyArray` for immutable data structures.

6. Enum Usage

- Avoid using `enum` unless interoperability with other systems or libraries requires it.
- Prefer union string literal types for simple cases:
```typescript
type ButtonVariant = 'primary' | 'secondary' | 'danger';
```

## 7. Type Inference and `satisfies` Operator

### Type Inference

- Leverage TypeScript's type inference for local variables where the type is obvious.
- For function parameters and return types, always specify types explicitly.

### The `satisfies` Operator (TypeScript 4.9+)

The `satisfies` operator provides type checking without widening the type. It ensures a value conforms to a type while preserving the most specific type information.

#### When to Use `satisfies`

**✅ Use `satisfies` for:**

1. **Object literals that need type validation but should preserve literal types**

```typescript
// ❌ Bad: Type annotation widens literal types
const result: ProcessExhibitionResult = {
  documentId: 'abc123',
  action: 'created',  // Type is string, not 'created'
}

// ✅ Good: satisfies preserves literal types
const result = {
  documentId: 'abc123',
  action: 'created',  // Type is 'created' | 'updated' | 'skipped'
} satisfies ProcessExhibitionResult
```

2. **Initializing variables with complex objects**

```typescript
// ❌ Bad: Loses type information
const config: ApifyActorInput = {
  model: 'gpt-4o-mini',
  maxCrawlingDepth: 2,
  // ... other properties
}

// ✅ Good: Validates type and preserves specific values
const config = {
  model: 'gpt-4o-mini',
  maxCrawlingDepth: 2,
  // ... other properties
} satisfies ApifyActorInput
```

3. **Creating typed constants with literal types**

```typescript
// ❌ Bad: No type checking
const stats = {
  created: 0,
  updated: 0,
  skipped: 0,
  errors: 0,
}

// ✅ Good: Validates structure and catches typos
const stats = {
  created: 0,
  updated: 0,
  skipped: 0,
  errors: 0,
} satisfies ProcessingStats
```

4. **Inline return values that need validation**

```typescript
// ❌ Bad: Using 'as const' everywhere
return {
  documentId,
  action: 'created' as const,
  reason: 'New exhibition',
} as ProcessExhibitionResult

// ✅ Good: Clean and type-safe
return {
  documentId,
  action: 'created',
  reason: 'New exhibition',
} satisfies ProcessExhibitionResult
```

#### When NOT to Use `satisfies`

**❌ Don't use `satisfies` for:**

1. **Function parameters** - Use explicit type annotations

```typescript
// ❌ Bad: satisfies doesn't work here
function process(data satisfies ExhibitionData) { }

// ✅ Good: Use type annotation
function process(data: ExhibitionData) { }
```

2. **When you need the type to be widened**

```typescript
// If you need the type to be generic Record<string, number>
const counts: Record<string, number> = {
  created: 0,
  updated: 0,
}
```

3. **Function return types** - Specify the return type in the signature

```typescript
// ❌ Bad: satisfies in function body
function getStats() {
  return {
    created: 0,
    updated: 0,
  } satisfies ProcessingStats
}

// ✅ Good: Return type in signature
function getStats(): ProcessingStats {
  return {
    created: 0,
    updated: 0,
  }
}
```

#### Real-World Examples from the Codebase

```typescript
// services/exhibition.service.ts

// Example 1: Validating complex objects
const newExhibition = {
  title: exhibition.title,
  venue: canonicalVenueName,
  museumId,
  status: 'pending',
  origin,
  isExcluded: false,
  hasDateChanged: false,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
} satisfies NewExhibitionDocument

// Example 2: Update data with optional fields
const updateData = {
  ...(exhibition.startDate && {
    startDate: Timestamp.fromDate(new TZDate(exhibition.startDate, 'Asia/Tokyo')),
  }),
  hasDateChanged: true,
  updatedAt: Timestamp.now(),
} satisfies ExhibitionUpdateData

// Example 3: Statistics initialization
const results = {
  created: 0,
  updated: 0,
  skipped: 0,
  errors: 0,
} satisfies ProcessingStats

// Example 4: Return values
return {
  documentId,
  action: 'created',
} satisfies ProcessExhibitionResult
```

#### Benefits of `satisfies`

1. **Type Safety**: Catches typos and missing properties at compile time
2. **Better Inference**: Preserves literal types and specific values
3. **Refactoring**: Easier to update types without changing all usage sites
4. **Autocomplete**: Better IDE support with more specific types
5. **Cleaner Code**: No need for excessive `as const` assertions

## 8. Third-Party Types

- Always install and use type definitions for third-party libraries (`@types/*`).
- Do not use untyped libraries unless absolutely necessary and with team approval.

## 9. Error Handling

- Always handle possible `null` and `undefined` values explicitly.
- Use `Optional Chaining (?.)` and `Nullish Coalescing (??)` where appropriate.

## 10. Function Implementation

- If it returns a boolean, use `isX` or `hasX`, `canX`, etc.
- If it doesn't return anything, use `executeX` or `saveX`, etc.
- Use higher-order functions (map, `filter`, `reduce`, etc.) to avoid function nesting.
- Use arrow functions for simple functions (less than 3 instructions).
- Use named functions for non-simple functions.
- Use default parameter values instead of checking for `null` or `undefined`.
- Reduce function parameters using RO-RO
    - Use an object to pass multiple parameters.
    - Use an object to return results.
    - Declare necessary types for input arguments and output.

## 11. Class Implementation

- Follow SOLID principles.
- Prefer composition to inheritance.
- Declare interfaces to define contracts.
- Write small classes with a single purpose.
    - Less than 200 instructions.
    - Less than 10 public methods.
    - Less than 10 properties.
