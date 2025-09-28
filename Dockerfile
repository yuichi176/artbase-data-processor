# Use the official Node.js 20 image as base
FROM node:20-alpine

# Set the working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package.json and pnpm-lock.yaml (if available)
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Expose the port that the app runs on
EXPOSE 8080

# Set environment variable for port
ENV PORT=8080

# Start the application
CMD ["pnpm", "start"]