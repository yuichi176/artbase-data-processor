# Coding Style Guidelines

## Directory Organization

Organize code by technical concern, not by feature:

```
src/
├── routes/      # HTTP handlers (one file per resource)
├── services/    # Business logic (one file per domain)
├── types/       # TypeScript type definitions
├── config/      # Configuration builders
├── errors/      # Custom error classes
├── lib/         # External service clients
└── utils/       # Pure utility functions
```

### When to Create a New File

- **Routes**: One file per REST resource (e.g., `exhibition.ts`, `museum.ts`)
- **Services**: One file per domain entity (e.g., `exhibition.service.ts`, `museum.service.ts`)
- **Types**: Group related types in a single file (e.g., `exhibition.ts` contains all exhibition-related types)
- **Config**: One file per external service or complex configuration (e.g., `apify.config.ts`)

## File Naming Conventions

- **Routes**: `{resource}.ts` (e.g., `exhibition.ts`, `health.ts`)
- **Services**: `{domain}.service.ts` (e.g., `exhibition.service.ts`)
- **Types**: `{domain}.ts` (e.g., `exhibition.ts`, `env.ts`)
- **Config**: `{service}.config.ts` (e.g., `apify.config.ts`)
- **Errors**: `app-error.ts` for all custom error classes
- **Utils**: Descriptive names (e.g., `date.ts`, `hash.ts`)

## Code Organization Principles

### 1. Separation of Concerns

Each layer should have a single responsibility:

```typescript
// ❌ Bad: Business logic in route handler
app.post('/scrape', async (c) => {
  const museums = await db.collection('museum').get()
  const existingExhibitions = await db.collection('exhibition').get()
  // ... 100+ lines of processing logic
})

// ✅ Good: Route handler orchestrates, services contain logic
app.post('/scrape', async (c) => {
  const { museums, startUrls } = await fetchEnabledMuseumsWithUrls()
  const input = buildScrapeActorInput(startUrls, OPENAI_API_KEY)
  const rawResults = await runActorAndGetResults(APIFY_ACTOR_ID, input)
  const exhibitions = apifyResponseSchema.parse(rawResults)
  const museumMaps = buildMuseumMaps(museums)
  const results = await processScrapeResults(exhibitions, museumMaps, 'scrape')
  return c.json({ success: true, stats: results }, 201)
})
```

### 2. Extract Configuration

Centralize configuration to avoid duplication:

```typescript
// ❌ Bad: Configuration duplicated across endpoints
app.post('/scrape', async (c) => {
  const input = {
    maxCrawlingDepth: 2,
    model: 'gpt-4o-mini',
    // ... 50 lines of config
  }
})

app.post('/scrape-feed', async (c) => {
  const input = {
    maxCrawlingDepth: 1,
    model: 'gpt-4o-mini',
    // ... 50 lines of config (mostly duplicate)
  }
})

// ✅ Good: Configuration in dedicated file
// config/apify.config.ts
export function buildScrapeActorInput(startUrls, apiKey) {
  return { ...BASE_CONFIG, maxCrawlingDepth: 2, startUrls, openaiApiKey: apiKey }
}

export function buildScrapeFeedActorInput(apiKey) {
  return { ...BASE_CONFIG, maxCrawlingDepth: 1, startUrls: FEED_URLS, openaiApiKey: apiKey }
}
```

### 3. Service Layer Pattern

Business logic should live in services, not routes:

```typescript
// services/exhibition.service.ts
export async function processScrapeResults(
  exhibitions: Array<Exhibition>,
  museumMaps: MuseumMaps,
  origin: 'scrape' | 'scrape-feed',
): Promise<ProcessingStats> {
  const existingExhibitionsMap = await fetchExistingExhibitions()

  const results = { created: 0, updated: 0, skipped: 0, errors: 0 }

  for (const exhibition of exhibitions) {
    try {
      const result = await processExhibition({
        exhibition,
        museumMaps,
        existingExhibitionsMap,
        origin,
      })

      results[result.action]++
    } catch (error) {
      results.errors++
    }
  }

  return results
}
```

### 4. Custom Error Classes

Use custom errors for better error handling:

```typescript
// errors/app-error.ts
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, 'NOT_FOUND')
  }
}

// Service layer throws domain errors
if (!canonicalVenueName) {
  throw new NotFoundError(`Venue not found: ${exhibition.venue}`)
}

// Global error handler catches and converts to HTTP response
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: err.message, code: err.code }, err.statusCode)
  }
  return c.json({ error: 'Internal server error' }, 500)
})
```

### 5. Type Definitions

Define domain types separately from implementation:

```typescript
// types/exhibition.ts
export interface ExistingExhibition {
  startDate: Timestamp | string
  endDate: Timestamp | string
}

export interface MuseumMaps {
  aliasToName: Map<string, string>
  nameToId: Map<string, string>
}

export interface ProcessExhibitionResult {
  documentId: string
  action: 'created' | 'updated' | 'skipped'
  reason?: string
}
```

## Function Guidelines

### Function Size

- Route handlers: 30-50 lines (orchestration only)
- Service functions: 50-100 lines (single responsibility)
- Utility functions: 10-30 lines (pure, focused)

### Function Naming

- Use descriptive verb-noun patterns
- Service methods: `fetchX`, `processX`, `buildX`, `saveX`
- Utilities: `getX`, `validateX`, `transformX`
- Boolean predicates: `isX`, `hasX`, `canX`

### Function Parameters

For functions with more than 2-3 parameters, use object parameters:

```typescript
// ❌ Bad: Too many positional parameters
async function processExhibition(
  exhibition: Exhibition,
  aliasMap: Map<string, string>,
  idMap: Map<string, string>,
  existingMap: Map<string, ExistingExhibition>,
  origin: string,
) { }

// ✅ Good: Object parameter with typed interface
interface ProcessExhibitionParams {
  exhibition: Exhibition
  museumMaps: MuseumMaps
  existingExhibitionsMap: Map<string, ExistingExhibition>
  origin: 'scrape' | 'scrape-feed'
}

async function processExhibition(params: ProcessExhibitionParams) { }
```

## Import Organization

Organize imports in the following order:

1. External dependencies
2. Internal absolute imports (by layer: types → lib → config → services → utils)
3. Relative imports

```typescript
// External
import { Hono } from 'hono'
import { env } from 'hono/adapter'

// Types
import type { AppEnv } from '../types/env.js'
import type { MuseumMaps } from '../types/exhibition.js'

// Lib
import db from '../lib/firestore.js'

// Config
import { buildScrapeActorInput } from '../config/apify.config.js'

// Services
import { runActorAndGetResults } from '../services/apify.service.js'

// Utils
import { getExhibitionDocumentId } from '../utils/hash.js'

// Schemas
import { apifyResponseSchema } from '../schema.js'

// Errors
import { ConfigurationError } from '../errors/app-error.js'
```

## Code Duplication

### When to Extract

Extract code when you see:

1. **Exact duplication**: Same code in 2+ places → Extract to utility function
2. **Similar logic with variations**: → Extract to service method with parameters
3. **Configuration duplication**: → Extract to config file with builder functions
4. **Type duplication**: → Extract to shared type definition

### When NOT to Extract

Don't over-abstract:

- One-off operations (even if similar)
- Logic that varies significantly between use cases
- Simple 1-3 line operations

## Comments

### When to Comment

- Complex business logic that's not self-evident
- Workarounds or non-obvious solutions
- API quirks or external service limitations

### When NOT to Comment

- Self-explanatory code
- What the code does (code should be self-documenting)
- Commented-out code (delete it, use git history)

```typescript
// ❌ Bad: Unnecessary comment
// Fetch museums from Firestore
const museums = await fetchAllMuseums()

// ✅ Good: Explains why, not what
// Use NFKC normalization to handle full-width characters from scraped data
const normalized = text.normalize('NFKC').toLowerCase()
```

## Testing (Future)

When writing tests:

- Test public APIs (service methods), not internal implementation
- Use descriptive test names: `should create exhibition when venue is found`
- Mock external dependencies (Firestore, Apify)
- Focus on edge cases and error conditions
