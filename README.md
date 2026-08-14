# DevLens

**Software Intelligence Platform — Transform source code into living knowledge.**

DevLens is a modular platform that ingests source code repositories, performs static analysis, builds a knowledge graph of your architecture, and provides visualization, documentation, AI-powered insights, and search capabilities.

---

## Quick Start

```bash
# 1. Clone the repository
git clone <repo-url>
cd devlens

# 2. Set up environment files
cp .env.example .env
cp src/backend/.env.example src/backend/.env
cp src/frontend/.env.example src/frontend/.env

# 3. Start all services
docker compose up
```

The platform will be available at:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **API Documentation (Swagger)**: http://localhost:3001/api/docs
- **MinIO Console**: http://localhost:9001

---

## Architecture Overview

DevLens follows a **Modular Monolith** architecture with **Domain-Driven Design (DDD)**, **Hexagonal Architecture**, and **Event-Driven** principles. The platform is organized into independent bounded contexts that communicate through explicit contracts, with a shared kernel providing common architectural abstractions.

```
Frontend → Public API → Bounded Contexts → Shared Infrastructure
```

Each bounded context owns its business logic, persistence, and public interfaces. External dependencies (PostgreSQL, Redis, MinIO) are abstracted behind repository interfaces and infrastructure adapters.

---

## Tech Stack

| Layer            | Technology                                     |
| ---------------- | ---------------------------------------------- |
| Frontend         | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Backend          | NestJS 10, TypeScript                          |
| Database         | PostgreSQL 16                                  |
| Cache            | Redis 7                                        |
| Object Storage   | MinIO (S3-compatible)                          |
| Background Jobs  | BullMQ                                         |
| Message Broker   | Kafka (optional, disabled by default)          |
| Containerization | Docker / Docker Compose                        |
| CI/CD            | GitHub Actions                                 |

---

## Project Structure

```
devlens/
├── src/
│   ├── backend/       # NestJS API — modular monolith
│   │   ├── src/
│   │   │   ├── config/    # Application configuration
│   │   │   ├── shared/    # Shared Kernel (DDD building blocks)
│   │   │   └── core/      # Future bounded contexts
│   └── frontend/      # Next.js web application
│       └── src/
│           ├── app/       # App Router pages
│           ├── components/# UI components
│           └── lib/       # Utilities and API client
├── docs/              # Architecture RFCs and product documentation
├── docker/            # Docker infrastructure scripts
└── .github/           # CI/CD workflows
```

---

## Development

### Prerequisites

- Node.js >= 20
- Docker & Docker Compose
- npm

### Local Development Without Docker

```bash
# Install dependencies
npm install

# Start infrastructure services (PostgreSQL, Redis, MinIO)
docker compose up postgres redis minio -d

# Start backend and frontend in development mode
npm run dev
```

### Quality

```bash
# Lint all projects
npm run lint

# Format code
npm run format

# Run tests
npm test
```

---

## Documentation

Detailed RFCs and architecture documentation are available in the [`docs/`](./docs/) directory:

- **[Product Context](./docs/product/PRODUCT_CONTEXT.md)** — Product vision and market context
- **[Architecture RFCs](./docs/architecture/)** — Technical design documents
- **[Evolution Roadmap](./docs/product/ROADMAP.md)** — Platform evolution plan

---

## License

MIT
