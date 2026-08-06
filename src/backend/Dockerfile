# ── Base ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# ── Development ───────────────────────────────────────────────────────
FROM base AS development
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json ./
COPY src/frontend/package.json ./src/frontend/
COPY src/backend/package.json ./src/backend/
RUN pnpm install --frozen-lockfile --filter devlens-backend...

WORKDIR /app/src/backend
EXPOSE 3001
CMD ["pnpm", "dev"]

# ── Production dependencies ───────────────────────────────────────────
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json ./
COPY src/frontend/package.json ./src/frontend/
COPY src/backend/package.json ./src/backend/
RUN pnpm install --frozen-lockfile --filter devlens-backend...

# ── Production build ──────────────────────────────────────────────────
FROM deps AS build
COPY src/backend/ ./src/backend/
RUN pnpm --filter devlens-backend run build

# ── Production image ──────────────────────────────────────────────────
FROM base AS production
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json ./
COPY src/frontend/package.json ./src/frontend/
COPY src/backend/package.json ./src/backend/
RUN pnpm install --prod --frozen-lockfile --filter devlens-backend...
COPY --from=build /app/src/backend/dist ./src/backend/dist

WORKDIR /app/src/backend
EXPOSE 3001
CMD ["node", "dist/src/main"]
