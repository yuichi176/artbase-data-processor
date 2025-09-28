# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

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
- `pnpm run format:check` - Check code formatting with Prettier
- `pnpm run typecheck` - Run TypeScript type checking without emitting files

## Architecture

- **Framework**: Hono.js web framework running on Node.js
- **Language**: TypeScript with strict mode enabled
- **Module System**: ES modules (`"type": "module"` in package.json)
- **Build Tool**: TypeScript compiler (tsc)
- **Dev Tool**: tsx for development with watch mode
- **Port**: Application runs on port 8080 (configurable via PORT environment variable)

## Key Configuration

- TypeScript target: ESNext with NodeNext module resolution
- JSX support configured for Hono's JSX runtime
- Strict TypeScript configuration with verbatim module syntax
- Output directory: `./dist`
- ESLint configured with flat config (`eslint.config.js`) using TypeScript ESLint
- Prettier configured for code formatting
- Lefthook configured for git hooks (pre-commit: lint, format, typecheck; pre-push: build)

## Project Structure

- `src/index.ts` - Main application entry point with Hono server setup
- Single-file application currently with basic "Hello Hono!" endpoint