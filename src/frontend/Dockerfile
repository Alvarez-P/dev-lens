FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json ./
COPY src/frontend/package.json ./src/frontend/
COPY src/backend/package.json ./src/backend/
RUN pnpm install --frozen-lockfile --filter devlens-frontend...

FROM deps AS build
COPY src/frontend/ ./src/frontend/
RUN pnpm --filter devlens-frontend run build

FROM base AS production
COPY --from=build /app/src/frontend/.next/standalone ./
COPY --from=build /app/src/frontend/.next/static ./src/frontend/.next/static
COPY --from=build /app/src/frontend/public ./src/frontend/public

WORKDIR /app/src/frontend

EXPOSE 3000

CMD ["node", "server.js"]
