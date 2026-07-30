# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy production dependencies and built artifacts
COPY package.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

# Expose application port
EXPOSE 3001

# Start the application
CMD ["node", "dist/main"]
