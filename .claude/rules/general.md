# Project Overview

This is a TypeScript-based data processor built with Hono.js, a lightweight web framework. The project uses ES modules and is configured for Node.js runtime.

## Development Commands

- `pnpm run dev` - Start development server with hot reload using tsx
- `pnpm run build` - Compile TypeScript to JavaScript
- `pnpm start` - Run the compiled production build
- `pnpm install` - Install dependencies

## Code Quality Commands

- `pnpm run lint` - Run ESLint on TypeScript files
- `pnpm run lint:fix` - Run ESLint with auto-fix
- `pnpm run format` - Format code with Prettier
- `pnpm run typecheck` - Run TypeScript type checking without emitting files

## Architecture

- **Framework**: Hono.js web framework running on Node.js
- **Language**: TypeScript with strict mode enabled
- **Module System**: ES modules (`"type": "module"` in package.json)
- **Build Tool**: TypeScript compiler (tsc)
- **Dev Tool**: tsx for development with watch mode
- **Port**: Application runs on port 8080 (configurable via PORT environment variable)
- **Architecture Pattern**: Layered architecture with service layer separation

## Key Configuration

- TypeScript target: ESNext with NodeNext module resolution
- JSX support configured for Hono's JSX runtime
- Strict TypeScript configuration with verbatim module syntax
- Output directory: `./dist`
- ESLint configured with flat config (`eslint.config.js`) using TypeScript ESLint
- Prettier configured for code formatting
- Lefthook configured for git hooks (pre-commit: lint, format, typecheck; pre-push: build)

## Project Structure

```
src/
├── index.ts              # Main application entry point with global error handler
├── config/               # Configuration files
│   └── apify.config.ts   # Apify actor configuration builders
├── errors/               # Custom error classes
│   └── app-error.ts      # AppError, ValidationError, NotFoundError, etc.
├── routes/               # HTTP route handlers (thin orchestration layer)
│   ├── health.ts         # Health check endpoint
│   └── exhibition.ts     # Exhibition scraping endpoints
├── services/             # Business logic layer
│   ├── apify.service.ts       # Apify actor execution
│   ├── exhibition.service.ts  # Exhibition processing logic
│   └── museum.service.ts      # Museum data operations
├── schemas/              # Zod validation schemas (runtime validation)
│   ├── exhibition.schema.ts   # Exhibition data schemas
│   ├── museum.schema.ts       # Museum document schemas
│   └── apify.schema.ts        # Apify response schemas
├── types/                # TypeScript type definitions (compile-time types)
│   ├── env.ts            # Environment variable types
│   ├── exhibition.ts     # Exhibition domain types
│   └── museum.ts         # Museum domain types
├── lib/                  # External service clients
│   ├── apify.ts          # Apify client initialization
│   └── firestore.ts      # Firestore client initialization
└── utils/                # Utility functions
    ├── date.ts           # Date comparison utilities
    └── hash.ts           # Document ID generation
```

## Architectural Principles

### Separation of Concerns

The codebase follows a layered architecture:

1. **Routes Layer** (`routes/`): Thin handlers that orchestrate requests
   - Validate environment variables
   - Call service layer methods
   - Return HTTP responses
   - Should be 30-50 lines per endpoint

2. **Service Layer** (`services/`): Business logic implementation
   - Pure business logic, no HTTP concerns
   - Reusable across different endpoints
   - Throws custom errors for error handling

3. **Data Access Layer** (`lib/`): External service clients
   - Firestore database access
   - Apify API integration
   - Initialized once at module load

4. **Configuration Layer** (`config/`): Centralized configuration
   - Extract magic numbers and strings
   - Builder functions for complex configurations
   - Environment-agnostic settings

### Error Handling

- Use custom error classes from `errors/app-error.ts`
- Global error handler in `index.ts` catches all errors
- Service layer throws domain-specific errors
- Route layer catches and returns appropriate HTTP responses

### Type Safety

- Define domain types in `types/` directory
- Use Zod for runtime validation of external data
- Extend base interfaces when needed (e.g., `AppEnv extends Record<string, unknown>`)
- Avoid type assertions (`as`) when possible

## Key Dependencies

- `hono` - Web framework
- `@hono/node-server` - Node.js adapter for Hono
- `@hono/zod-validator` - Zod validation middleware
- `zod` - Schema validation
- `@google-cloud/firestore` - Firestore database client
- `apify-client` - Apify web scraping platform client
- `@date-fns/tz` - Timezone-aware date handling

## Environment Variables

Required environment variables (defined in `types/env.ts`):

- `APIFY_API_TOKEN` - Apify API authentication token
- `APIFY_ACTOR_ID` - Apify actor ID for web scraping
- `OPENAI_API_KEY` - OpenAI API key for AI-powered scraping
- `PORT` - Server port (optional, defaults to 8080)