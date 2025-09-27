# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript-based data processor built with Hono.js, a lightweight web framework. The project uses ES modules and is configured for Node.js runtime.

## Development Commands

- `pnpm run dev` - Start development server with hot reload using tsx
- `pnpm run build` - Compile TypeScript to JavaScript
- `pnpm start` - Run the compiled production build
- `pnpm install` - Install dependencies

## Architecture

- **Framework**: Hono.js web framework running on Node.js
- **Language**: TypeScript with strict mode enabled
- **Module System**: ES modules (`"type": "module"` in package.json)
- **Build Tool**: TypeScript compiler (tsc)
- **Dev Tool**: tsx for development with watch mode
- **Port**: Application runs on port 3000

## Key Configuration

- TypeScript target: ESNext with NodeNext module resolution
- JSX support configured for Hono's JSX runtime
- Strict TypeScript configuration with verbatim module syntax
- Output directory: `./dist`

## Project Structure

- `src/index.ts` - Main application entry point with Hono server setup
- Single-file application currently with basic "Hello Hono!" endpoint