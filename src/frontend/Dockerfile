# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY tsconfig.json next.config.js tailwind.config.ts postcss.config.js ./
COPY src ./src
COPY public ./public

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy standalone build output
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# Expose application port
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Start the application
CMD ["node", "server.js"]
