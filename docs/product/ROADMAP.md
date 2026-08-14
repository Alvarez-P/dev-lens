# DevLens — Roadmap

> **Living document.** Updated as milestones are reached.
> **Last Updated:** 2026-07-30

---

# Executive Summary

DevLens is a Software Intelligence Platform that transforms source code into living knowledge. This roadmap defines the execution plan: what we build, in what order, and why.

The roadmap is organized around **two flows** that represent the product from different perspectives:

---

# The Two Flows

## User-Facing Product Flow

This is what the user experiences — the product from the outside:

```text
Repository
        │
        ▼
Repository Intelligence Pipeline
        │
        ▼
Static Analysis
        │
        ▼
Knowledge Extraction
        │
        ▼
Visualization
        │
        ├────────────► AI Insights
        ├────────────► Documentation
        ├────────────► Search
        └────────────► Metrics
```

The user connects a repository. The platform analyzes it. The user explores the resulting knowledge through five integrated experiences.

## Technical Architecture Flow

This is the real pipeline — what happens under the hood:

```text
Repository Snapshot
        │
        ▼
Language Detection
        │
        ▼
Parser
        │
        ▼
Abstract Syntax Tree (AST)
        │
        ▼
IR Builder
        │
        ▼
Intermediate Representation (IR)
        │
        ▼
Semantic Model Builder
        │
        ▼
Semantic Model
        │
        ▼
Knowledge Graph Builder
        │
        ▼
Knowledge Graph
        │
        ├────────────► Visualization Engine
        ├────────────► AI Orchestrator
        ├────────────► Documentation Engine
        ├────────────► Search Engine
        └────────────► Metrics Engine
```

Every node in this flow corresponds to an RFC and a bounded context. Every arrow is a domain event.

---

# Phase Structure

The roadmap is divided into four phases, each building on the previous one. Epics within a phase have explicit dependencies documented in their definitions.

---

# Phase 1 — MVP: Repository Understanding

**Goal:** A single developer can connect a repository, get it analyzed, explore the Knowledge Graph visually, ask AI questions, generate documentation, search for concepts, and see architecture metrics.

**Duration target:** ~6 months from Phase 1 start.

## Epic Execution Order

```
EPIC-001 Foundation
        │
        ▼
EPIC-002 Core Platform
        │
        ▼
EPIC-003 Identity
        │
        ├────────────► EPIC-004 Repository Intelligence
        │                       │
        │                       ▼
        │               EPIC-005 Static Analysis
        │                       │
        │                       ▼
        │               EPIC-006 Knowledge Graph
        │                       │
        │                       ▼
        │               ┌───────┴──────────┬──────────────┬──────────────┐
        │               ▼                  ▼              ▼              ▼
        │       EPIC-007           EPIC-008        EPIC-009        EPIC-010
        │     Visualization    AI Orchestration  Documentation    Search
        │               │                  │              │              │
        │               └──────────────────┴──────────────┴──────────────┘
        │                                       │
        │                                       ▼
        └───────────────────────────► EPIC-011 Architecture Metrics
```

The pipeline epics (004 → 005 → 006) are sequential — each feeds the next. The experience epics (007-010) can be developed partially in parallel once the Knowledge Graph API is stable. Metrics (011) is developed last within the MVP since it consumes the most mature graph.

## Phase 1 Epics & RFCs

| Epic                               | RFC(s)                    | Deliverable                                      |
| ---------------------------------- | ------------------------- | ------------------------------------------------ |
| EPIC-001 — Foundation              | —                         | Monorepo, Docker, CI/CD, tooling                 |
| EPIC-002 — Core Platform           | RFC-001, RFC-002, RFC-003 | Shared kernel, DDD foundation, base abstractions |
| EPIC-003 — Identity                | —                         | Auth, RBAC, organizations, workspaces            |
| EPIC-004 — Repository Intelligence | RFC-004, RFC-005          | Git provider abstraction, cloning, snapshots     |
| EPIC-005 — Static Analysis         | RFC-006                   | Language parsers, IR generation                  |
| EPIC-006 — Knowledge Graph         | RFC-007                   | Semantic Model, Knowledge Graph builder          |
| EPIC-007 — Visualization           | RFC-008                   | Interactive graph, architecture explorer         |
| EPIC-008 — AI Orchestration        | RFC-009, RFC-010          | RAG pipeline, streaming, AI capabilities         |
| EPIC-009 — Documentation Engine    | RFC-011                   | Auto-generated docs, multi-format export         |
| EPIC-010 — Search & Discovery      | RFC-012                   | Full-text + semantic search                      |
| EPIC-011 — Architecture Metrics    | RFC-013                   | Metrics engine, Architecture Score               |

## Phase 1 Exit Criteria

- [ ] A user can sign up, create an organization, and connect a Git repository.
- [ ] The platform clones, analyzes, and builds a Knowledge Graph.
- [ ] The Architecture Explorer renders the graph interactively.
- [ ] AI can answer questions about modules, services, and endpoints.
- [ ] Documentation is auto-generated in Markdown and OpenAPI formats.
- [ ] Search returns relevant software concepts in under 200ms.
- [ ] The Architecture Score is computed and visible.
- [ ] All core flows work for TypeScript repositories (Python and Java as fast-follows).

---

# Phase 2 — Team Productivity

**Goal:** Teams can collaborate around software knowledge. Shared workspaces, saved views, team documentation, and architectural discussions become possible.

**Duration target:** ~3 months from Phase 2 start.

## Epic Execution Order

```
EPIC-012 Billing & Licensing
        │
        ▼
Phase 2 Features (new epics)
        │
        ├── Shared Workspaces
        ├── Comments & Discussions
        ├── Saved Views & Bookmarks
        ├── Team Documentation
        ├── Repository Comparison
        └── Historical Architecture Timeline
```

## Phase 2 Epics & RFCs

| Epic                             | RFC(s)              | Deliverable                                              |
| -------------------------------- | ------------------- | -------------------------------------------------------- |
| EPIC-012 — Billing & Licensing   | —                   | Subscriptions, Stripe integration, feature gating        |
| Shared Workspaces                | RFC-002 (extension) | Multi-user workspaces, shared repositories               |
| Comments & Discussions           | —                   | Threaded discussions on graph nodes, modules, endpoints  |
| Saved Views & Bookmarks          | —                   | Persistent graph views, bookmark collections             |
| Team Documentation               | RFC-011 (extension) | Team-authored doc sections merged with generated docs    |
| Repository Comparison            | RFC-007 (extension) | Side-by-side graph comparison                            |
| Historical Architecture Timeline | RFC-007, RFC-013    | Visual timeline of architecture evolution across commits |

## Phase 2 Exit Criteria

- [ ] Teams can share workspaces and collaborate on the same repositories.
- [ ] Users can comment on architectural concepts and discuss changes.
- [ ] Saved views persist across sessions.
- [ ] Generated documentation can include team-authored sections.
- [ ] Architecture changes between commits are visualized.
- [ ] Billing is operational: Free, Pro, and Team plans.

---

# Phase 3 — Enterprise

**Goal:** Organizations can adopt DevLens at scale with SSO, governance, audit, and multi-repository analysis.

**Duration target:** ~4 months from Phase 3 start.

## Epic Execution Order

```
EPIC-013 Enterprise
        │
        ├── SSO (SAML, OIDC)
        ├── SCIM Provisioning
        ├── RBAC Enhancements
        ├── Multi-Repository Graphs
        ├── Audit Logs
        ├── Organization Policies
        ├── BYO AI (Bring Your Own AI)
        └── Private Deployments
```

## Phase 3 Epics & RFCs

| Epic                    | RFC(s)              | Deliverable                                           |
| ----------------------- | ------------------- | ----------------------------------------------------- |
| EPIC-013 — Enterprise   | —                   | SSO, RBAC, audit, governance, multi-repo, BYOAI       |
| Multi-Repository Graphs | RFC-007 (extension) | Cross-repo dependency edges, org-wide Knowledge Graph |
| Audit & Compliance      | —                   | Audit logs, compliance reports, exportable records    |
| Private Deployments     | —                   | Self-hosted option, air-gapped support                |

## Phase 3 Exit Criteria

- [ ] Enterprise SSO (SAML + OIDC) is operational.
- [ ] SCIM user provisioning is supported.
- [ ] Organization-wide RBAC policies are enforced.
- [ ] Multi-repository dependency graphs are generated.
- [ ] Full audit trail for all administrative actions.
- [ ] Organizations can use their own AI provider keys (BYOAI).
- [ ] Private deployment option is available.

---

# Phase 4 — Software Intelligence Platform

**Goal:** DevLens evolves from a single-organization tool into a platform for software intelligence at ecosystem scale.

**Duration target:** Ongoing — continuous evolution beyond Phase 3.

## Long-Term Vision

| Capability                         | Description                                                       |
| ---------------------------------- | ----------------------------------------------------------------- |
| **Cross-Organization Knowledge**   | Anonymized benchmarks, industry architecture patterns             |
| **AI Capabilities Marketplace**    | Shareable AI capabilities across organizations                    |
| **Architecture Governance**        | Policy-as-code for architecture rules, CI/CD integration          |
| **Automated Architecture Reviews** | AI-driven PR reviews focused on architectural impact              |
| **Predictive Impact Analysis**     | Forecast the impact of proposed changes before implementation     |
| **Security Architecture Analysis** | Detect security-relevant architectural patterns                   |
| **Ecosystem Visualization**        | Visualize relationships across organizations, services, and teams |

Phase 4 capabilities are defined as RFCs when they enter active development.

---

# RFC ↔ Epic Mapping (Complete)

| RFC     | Title                            | Primary Epic | Phase     |
| ------- | -------------------------------- | ------------ | --------- |
| RFC-000 | Product Vision                   | —            | Pre-phase |
| RFC-001 | Architecture Principles          | EPIC-002     | 1         |
| RFC-002 | System Architecture              | EPIC-002     | 1         |
| RFC-003 | Shared Kernel                    | EPIC-002     | 1         |
| RFC-004 | Event-Driven Architecture        | EPIC-004     | 1         |
| RFC-005 | Repository Intelligence Pipeline | EPIC-004     | 1         |
| RFC-006 | Static Analysis & IR             | EPIC-005     | 1         |
| RFC-007 | Knowledge Extraction Platform    | EPIC-006     | 1         |
| RFC-008 | Visualization Engine             | EPIC-007     | 1         |
| RFC-009 | AI Orchestration                 | EPIC-008     | 1         |
| RFC-010 | AI Architecture                  | EPIC-008     | 1         |
| RFC-011 | Documentation Engine             | EPIC-009     | 1         |
| RFC-012 | Search & Discovery               | EPIC-010     | 1         |
| RFC-013 | Architecture Metrics             | EPIC-011     | 1         |

---

# Milestones Summary

| Milestone                  | Phase | Key Outcome                                      |
| -------------------------- | ----- | ------------------------------------------------ |
| M1 — Platform Foundation   | 1     | Repo runs with one command, CI green             |
| M2 — First Analysis        | 1     | TypeScript repo analyzed, IR generated           |
| M3 — Knowledge Graph Alive | 1     | Graph built, API stable, queried by downstream   |
| M4 — Visual Understanding  | 1     | Architecture Explorer renders real graphs        |
| M5 — AI Explains           | 1     | First AI capability live (Explain Module)        |
| M6 — Docs Ship             | 1     | Auto-generated docs for TS projects              |
| M7 — MVP Complete          | 1     | All Phase 1 features operational                 |
| M8 — Team Ready            | 2     | Collaboration features live, billing operational |
| M9 — Enterprise Ready      | 3     | SSO, audit, multi-repo, private deploys          |
| M10 — Platform             | 4     | Ecosystem-scale intelligence                     |

---

# Guiding Principles

The roadmap is direction, not a deadline. Priorities shift based on user feedback, technical discoveries, and market conditions. However, the following principles are non-negotiable:

1. **The Knowledge Graph ships before AI.** AI without structured knowledge is just a chatbot.
2. **Visualization ships before documentation.** People understand systems visually before they read about them.
3. **Single-repo depth before multi-repo breadth.** Nail the single-repository experience before expanding.
4. **TypeScript first, then polyglot.** Master one language ecosystem before supporting many.
5. **Modular Monolith until proven otherwise.** Microservices only when the monolith demonstrably cannot scale.
