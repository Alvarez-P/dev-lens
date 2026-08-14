# DevLens AI

> **Your architecture should evolve as fast as your code.**

<p align="center">
  <strong>Transform your source code into a living architecture.</strong><br/>
  A Software Intelligence Platform that continuously understands, documents and visualizes your software systems.
</p>

---

## What is DevLens?

DevLens AI is a **Software Intelligence Platform** that continuously analyzes your source code, builds a **Knowledge Graph** of your system, generates living documentation, visualizes software architecture, and helps engineers understand complex codebases in minutes instead of weeks.

Unlike traditional documentation tools, DevLens treats your source code as the single source of truth.

Documentation, architecture diagrams, dependency graphs and API references are generated automatically and evolve together with your code.

The result is a **Digital Twin** of your software.

---

## Why DevLens Exists

Modern software systems have become too complex.

Every month they gain:

- more services
- more APIs
- more dependencies
- more events
- more developers
- more technical debt

Yet the tools used to understand these systems have barely changed.

Documentation becomes outdated.

Architecture diagrams stop reflecting reality.

Knowledge becomes trapped inside senior engineers.

New developers spend days—or even weeks—trying to understand how a system works before they can confidently contribute.

DevLens exists to solve this problem.

---

## The Problem

Software is growing faster than human understanding.

Developers constantly ask questions like:

- Where does authentication happen?
- Which services consume this Kafka event?
- What happens when an order is created?
- What modules depend on Inventory?
- What breaks if I modify this service?
- Which APIs are undocumented?
- Where is this database table used?
- What changed architecturally in the last release?

Finding those answers usually requires:

- searching dozens of files
- reading documentation
- asking teammates
- exploring Git history
- drawing diagrams manually

DevLens should answer those questions instantly.

---

## Our Philosophy

Artificial Intelligence is **not** the product.

The **Knowledge Graph** is the product.

AI is simply another way to navigate that knowledge.

Instead of sending raw code directly to an LLM, DevLens first understands the project through static analysis.

The platform continuously builds a model of the software, including:

- Modules
- Services
- Controllers
- Entities
- Repositories
- APIs
- Events
- Dependencies
- Databases
- External Services
- Domain Boundaries
- Architecture Relationships

AI uses this structured model to provide precise answers with significantly lower hallucination risk.

---

## Core Features

### 🗺️ Living Architecture

Automatically generate and maintain architecture diagrams that evolve alongside the codebase.

No more outdated diagrams.

---

### 🕸️ Knowledge Graph

Visualize the complete software system as an interactive graph.

Explore relationships between:

- Modules
- Services
- Events
- APIs
- Databases
- Repositories
- External Integrations

---

### 📚 Living Documentation

Generate documentation automatically.

Including:

- README
- Architecture Guides
- OpenAPI
- AsyncAPI
- Mermaid
- PlantUML
- C4 Diagrams
- ADRs
- Onboarding Guides

Documentation is generated directly from source code.

---

### 🔍 Architecture Explorer

Navigate your system visually.

Understand:

- dependencies
- coupling
- boundaries
- event flows
- module relationships

without reading hundreds of files.

---

### 🌊 Event Flow Visualization

Understand asynchronous systems.

Visualize:

- Kafka Events
- Producers
- Consumers
- Event Chains
- Dead Letter Queues
- Processing Flow

---

### ⚙️ API Explorer

Explore every endpoint in context.

Instead of only seeing an endpoint, understand:

- which use case it executes
- which services it depends on
- which events it publishes
- which database tables it modifies

---

### 📈 Architecture Score

Continuously evaluate software quality.

Track metrics such as:

- coupling
- cohesion
- documentation coverage
- architectural violations
- dependency cycles
- complexity trends

---

### 📊 Impact Analysis

Before modifying a service, understand exactly what will be affected.

Example:

> Changing `PaymentService` affects:
>
> - 12 API endpoints
> - 4 Kafka events
> - 7 services
> - 31 automated tests

---

### ⏳ Architecture Timeline

See how the architecture evolves over time.

Move through Git history and visualize:

- new modules
- removed services
- changing dependencies
- architectural drift
- event evolution

---

### 🤖 AI Software Architect

Ask questions about your software.

Examples:

- Explain the authentication flow.
- Why does Inventory depend on Orders?
- Which APIs publish OrderCreated?
- Summarize this Pull Request.
- Suggest architectural improvements.

AI always answers using the Knowledge Graph and repository context.

---

## Product Principles

DevLens follows a few non-negotiable principles.

### Performance is a feature.

Fast software feels simpler.

Every interaction should feel instantaneous.

---

### The Knowledge Graph is the source of truth.

Not documentation.

Not prompts.

Not conversations.

The software model itself.

---

### Documentation must be generated.

Never manually maintained.

---

### Visual understanding is better than conversational understanding.

People understand systems faster when they can explore them visually.

Chat complements visualization.

It never replaces it.

---

### Simplicity beats cleverness.

Readable software is better software.

Architecture should enable developers, not impress them.

---

## Technology

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- React Flow
- ELKJS
- Framer Motion

### Backend

- NestJS
- PostgreSQL
- Redis
- BullMQ
- Kafka
- pgvector

### AI

- OpenAI
- Anthropic
- Ollama
- OpenRouter

---

## Roadmap

### Phase 1

- Repository Analysis
- Knowledge Graph
- Architecture Explorer
- Documentation Generation

### Phase 2

- AI Assistant
- Pull Request Intelligence
- API Explorer
- Impact Analysis

### Phase 3

- Multi-project Architecture
- Team Collaboration
- Enterprise Integrations
- Historical Architecture Timeline

---

## Long-Term Vision

We believe software should explain itself.

Every commit should update architecture.

Every Pull Request should improve documentation.

Every developer should understand a complex system in minutes.

Every organization should preserve technical knowledge independently of the people who wrote the code.

Our goal is to make software architecture a living asset instead of a forgotten document.

---

# Mission

> Transform source code into living knowledge.

---

# Vision

> Every codebase deserves a living architecture.

---

# Tagline

> GitHub stores your code.
>
> **DevLens stores your software knowledge.**

Una vez aprobado este README, el siguiente documento debería ser el **MANIFESTO.md**, que establecerá los principios de ingeniería, diseño y producto que guiarán todas las decisiones del proyecto. Ese manifiesto será la referencia para evaluar cualquier nueva funcionalidad o cambio arquitectónico.
