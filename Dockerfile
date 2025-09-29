FROM node:20-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

# Copy package files separately to leverage Docker cache
COPY package.json pnpm-lock.yaml* ./

# Production dependencies only stage
FROM base AS prod-deps
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# Build stage with all dependencies
FROM base AS build
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm run build

# Final production image
FROM base AS production

WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 8080
ENV PORT=8080

CMD ["pnpm", "start"]
