# Hono.js Best Practices

This document outlines Hono.js-specific best practices for this project.

## Application Setup

### Global Error Handler

Always configure a global error handler using `app.onError()`:

```typescript
import { Hono } from 'hono'
import type { Context } from 'hono'
import { AppError } from './errors/app-error.js'

const app = new Hono()

// Global error handler should be defined before routes
app.onError((err, c: Context) => {
  console.error('Error:', err)

  if (err instanceof AppError) {
    return c.json(
      {
        success: false,
        error: err.message,
        code: err.code,
      },
      err.statusCode as 400 | 404 | 500 | 502,
    )
  }

  // Unknown errors
  return c.json(
    {
      success: false,
      error: 'Internal server error',
      message: err.message,
    },
    500 as const,
  )
})

// Routes come after error handler
app.route('/health', health)
app.route('/exhibition', exhibition)
```

### Modular Routing

Use `app.route()` to organize routes by resource:

```typescript
// index.ts
import health from './routes/health.js'
import exhibition from './routes/exhibition.js'

const app = new Hono()

app.route('/health', health)
app.route('/exhibition', exhibition)
```

```typescript
// routes/exhibition.ts
import { Hono } from 'hono'

const app = new Hono()

app.post('/scrape', async (c) => {
  // Handler implementation
})

app.post('/scrape-feed', async (c) => {
  // Handler implementation
})

export default app
```

## Environment Variables

### Type-Safe Environment Access

Use Hono's `env()` helper with strongly-typed interfaces:

```typescript
// types/env.ts
export interface AppEnv extends Record<string, unknown> {
  APIFY_ACTOR_ID: string
  OPENAI_API_KEY: string
}

// routes/exhibition.ts
import { env } from 'hono/adapter'
import type { AppEnv } from '../types/env.js'

app.post('/scrape', async (c) => {
  const { APIFY_ACTOR_ID, OPENAI_API_KEY } = env<AppEnv>(c)

  if (!APIFY_ACTOR_ID || !OPENAI_API_KEY) {
    throw new ConfigurationError('Missing required environment variables')
  }

  // Use environment variables
})
```

**Note**: Interface must extend `Record<string, unknown>` to satisfy Hono's type constraints.

## Request Validation

### Using Zod Validator (Recommended)

Use `@hono/zod-validator` for request validation:

```typescript
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

const scrapeSchema = z.object({
  museumIds: z.array(z.string()).optional(),
  force: z.boolean().default(false),
})

app.post('/scrape', zValidator('json', scrapeSchema), async (c) => {
  const { museumIds, force } = c.req.valid('json')
  // Type-safe access to validated data
})
```

## Response Handling

### Consistent Response Format

Use consistent response formats across all endpoints:

```typescript
// Success response
return c.json(
  {
    success: true,
    message: 'Operation completed successfully',
    data: result,
    stats: {
      total: 10,
      created: 5,
      updated: 3,
      skipped: 2,
    },
  },
  201,
)

// Error response (handled by global error handler)
throw new ValidationError('Invalid input data')

// Or manual error response
return c.json(
  {
    success: false,
    error: 'Resource not found',
    code: 'NOT_FOUND',
  },
  404,
)
```

### Status Code Type Safety

Hono uses TypeScript literal types for status codes. Use type assertions when necessary:

```typescript
// ❌ TypeScript error: number not assignable to status code
return c.json({ error: 'Not found' }, statusCode)

// ✅ Use type assertion
return c.json({ error: 'Not found' }, statusCode as 404)

// ✅ Or use literal types
const statusCode = 404 as const
return c.json({ error: 'Not found' }, statusCode)
```

## Route Handlers

### Keep Handlers Thin

Route handlers should only orchestrate, not contain business logic:

```typescript
// ❌ Bad: Business logic in handler
app.post('/scrape', async (c) => {
  const museums = await db.collection('museum').get()
  const exhibitions = await db.collection('exhibition').get()

  // ... 100+ lines of processing logic

  return c.json({ success: true }, 201)
})

// ✅ Good: Handler orchestrates service calls
app.post('/scrape', async (c) => {
  const { APIFY_ACTOR_ID, OPENAI_API_KEY } = env<AppEnv>(c)

  if (!APIFY_ACTOR_ID || !OPENAI_API_KEY) {
    throw new ConfigurationError('Missing required environment variables')
  }

  const { museums, startUrls } = await fetchEnabledMuseumsWithUrls()
  const input = buildScrapeActorInput(startUrls, OPENAI_API_KEY)
  const rawResults = await runActorAndGetResults(APIFY_ACTOR_ID, input)
  const exhibitions = apifyResponseSchema.parse(rawResults)
  const museumMaps = buildMuseumMaps(museums)
  const results = await processScrapeResults(exhibitions, museumMaps, 'scrape')

  return c.json(
    {
      success: true,
      message: `Scrape successful. Found ${exhibitions.length} exhibitions.`,
      stats: results,
    },
    201,
  )
})
```

### Error Handling in Routes

Let service layer throw errors, global handler catches them:

```typescript
app.post('/scrape', async (c) => {
  // Don't use try-catch in route handlers (unless you need specific handling)
  // Service layer throws domain errors
  const results = await processScrapeResults(exhibitions, museumMaps, 'scrape')
  // Global error handler catches and converts to HTTP response

  return c.json({ success: true, stats: results }, 201)
})
```

If you need route-specific error handling:

```typescript
app.post('/scrape', async (c) => {
  try {
    const results = await processScrapeResults(exhibitions, museumMaps, 'scrape')
    return c.json({ success: true, stats: results }, 201)
  } catch (error) {
    if (error instanceof SpecificError) {
      // Handle specific error
      return c.json({ error: 'Specific handling' }, 400)
    }
    // Re-throw for global handler
    throw error
  }
})
```

## Context Object

The Hono context object (`c`) provides several useful methods:

```typescript
app.post('/example', async (c) => {
  // JSON response
  return c.json({ data: 'value' }, 200)

  // Text response
  return c.text('Plain text response', 200)

  // HTML response
  return c.html('<h1>Hello</h1>', 200)

  // Redirect
  return c.redirect('/other-path', 302)

  // Request data
  const body = await c.req.json()
  const param = c.req.param('id')
  const query = c.req.query('filter')

  // Headers
  c.header('X-Custom-Header', 'value')
})
```

## Middleware (Future)

When adding middleware, order matters:

```typescript
const app = new Hono()

// Global middleware (runs for all routes)
app.use('*', logger())
app.use('*', cors())

// Route-specific middleware
app.use('/admin/*', adminAuth())

// Error handler (comes before routes)
app.onError((err, c) => { /* ... */ })

// Routes (come last)
app.route('/health', health)
app.route('/exhibition', exhibition)
```

## Testing Routes

When testing Hono routes:

```typescript
import { Hono } from 'hono'

describe('Exhibition Routes', () => {
  it('should return 201 on successful scrape', async () => {
    const app = new Hono()
    // ... setup routes

    const res = await app.request('/exhibition/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.success).toBe(true)
  })
})
```

## Performance Considerations

### Avoid Blocking Operations

```typescript
// ❌ Bad: Sequential operations
const museums = await fetchMuseums()
const exhibitions = await fetchExhibitions()
const artists = await fetchArtists()

// ✅ Good: Parallel operations when possible
const [museums, exhibitions, artists] = await Promise.all([
  fetchMuseums(),
  fetchExhibitions(),
  fetchArtists(),
])
```

### Stream Large Responses

For large datasets, consider streaming:

```typescript
app.get('/export', async (c) => {
  const stream = new ReadableStream({
    async start(controller) {
      const exhibitions = await fetchAllExhibitions()
      for (const exhibition of exhibitions) {
        controller.enqueue(JSON.stringify(exhibition) + '\n')
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
    },
  })
})
```

## Common Patterns

### Health Check Endpoint

```typescript
import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.json({ status: 'ok' }, 200)
})

export default app
```

### CRUD Resource

```typescript
import { Hono } from 'hono'

const app = new Hono()

// List
app.get('/', async (c) => {
  const items = await listItems()
  return c.json({ items }, 200)
})

// Get
app.get('/:id', async (c) => {
  const id = c.req.param('id')
  const item = await getItem(id)
  return c.json({ item }, 200)
})

// Create
app.post('/', async (c) => {
  const data = await c.req.json()
  const item = await createItem(data)
  return c.json({ item }, 201)
})

// Update
app.put('/:id', async (c) => {
  const id = c.req.param('id')
  const data = await c.req.json()
  const item = await updateItem(id, data)
  return c.json({ item }, 200)
})

// Delete
app.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await deleteItem(id)
  return c.json({ success: true }, 204)
})

export default app
```

## Resources

- [Hono Documentation](https://hono.dev/)
- [Hono GitHub](https://github.com/honojs/hono)
- [@hono/zod-validator](https://github.com/honojs/middleware/tree/main/packages/zod-validator)
