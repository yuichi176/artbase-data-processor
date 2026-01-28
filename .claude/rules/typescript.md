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

## 7. Type Inference

- Leverage TypeScript's type inference for local variables where the type is obvious.
- For function parameters and return types, always specify types explicitly.

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
