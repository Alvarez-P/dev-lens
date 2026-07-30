# RFC-000 — Product Vision

**Status:** Draft v1
**Authors:** Founding Team
**Last Updated:** 2026-07-24
**Product:** DevLens AI

---

# Executive Summary

Modern software systems evolve faster than humans can understand them.

Documentation becomes outdated. Architecture diagrams become obsolete. Knowledge gets trapped in the minds of senior engineers. Onboarding takes weeks. Pull Requests grow larger. Dependencies multiply. Services become coupled. Events spread across dozens of repositories.

The code is the only reliable source of truth, but code alone is not optimized for understanding.

Developers can read code.

Teams need to understand systems.

DevLens exists to bridge that gap.

DevLens continuously analyzes software systems, builds a living model of the architecture, generates documentation automatically, visualizes relationships between components, and enables developers to explore an entire system through an interactive knowledge graph.

Artificial Intelligence is not the product.

The Knowledge Graph is the product.

AI exists to explain and navigate that knowledge.

DevLens aims to become the living architecture layer that sits between source code and human understanding.

---

# Vision

## Long-Term Vision

Every software system should be able to explain itself.

Software evolves continuously.

Architecture should evolve continuously too.

Documentation should never become outdated.

Knowledge should never be trapped inside individuals.

Every engineer should be able to understand any system in minutes instead of weeks.

DevLens exists to make software knowledge searchable, visual, understandable, and continuously updated.

Our vision is:

> Every codebase deserves a living architecture.

---

# Mission

Our mission is:

> To transform source code into living knowledge.

We believe software systems should provide:

* continuously updated architecture
* automatically generated documentation
* instant onboarding
* visual understanding
* impact analysis
* historical architecture evolution
* shared technical knowledge

without requiring manual effort from developers.

---

# The Problem

## Software Complexity Is Growing Faster Than Human Understanding

The larger a system becomes, the harder it becomes to answer seemingly simple questions:

* Where does authentication happen?
* What services depend on Inventory?
* Which endpoints trigger this event?
* What breaks if I change this module?
* Which services consume this Kafka event?
* Why does this service exist?
* Is this code still used?
* What changed architecturally during the last six months?

Developers spend an enormous amount of time understanding systems instead of building them.

Understanding software is becoming more expensive than writing software.

---

## Documentation Always Becomes Outdated

Documentation requires manual maintenance.

Manual maintenance eventually fails.

The larger the organization:

* the faster documentation becomes obsolete
* the more diagrams become inaccurate
* the harder onboarding becomes
* the more tribal knowledge appears

The problem is not documentation quality.

The problem is that documentation is disconnected from the code.

---

## Architecture Exists Only Inside People's Heads

In many companies:

* senior engineers understand the architecture
* new engineers understand individual files
* nobody understands the entire system

When key engineers leave:

knowledge leaves with them.

This creates:

* onboarding costs
* maintenance costs
* slower development
* increased technical debt
* increased architectural drift

---

## Existing Tools Solve Fragments

Today developers use:

* GitHub
* Swagger
* AsyncAPI
* SonarQube
* Structurizr
* Mermaid
* Backstage
* Compodoc
* ADRs
* Notion
* Confluence
* Cursor
* Claude Code
* Copilot

Each tool solves one problem.

No tool unifies:

* architecture
* documentation
* dependencies
* events
* APIs
* domain models
* historical evolution
* onboarding
* impact analysis
* AI explanations

Software knowledge remains fragmented.

---

# Why Existing Solutions Fail

## Documentation Tools

Documentation tools rely on humans.

Humans forget.

Humans postpone documentation.

Humans leave companies.

Documentation eventually becomes incorrect.

---

## Diagram Tools

Most diagrams are snapshots.

Software is constantly changing.

Static diagrams eventually become lies.

---

## AI Coding Assistants

Cursor, Claude Code, and Copilot help developers write code.

They do not maintain software knowledge.

They do not maintain architecture.

They do not build long-term understanding.

They operate primarily through temporary context windows.

Understanding is not persistent.

---

## Static Analysis Tools

Static analysis tools identify problems.

They do not explain systems.

They do not build knowledge.

They do not visualize architecture.

They do not preserve understanding.

---

## Internal Wikis

Internal wikis become stale.

They require maintenance.

They depend on discipline.

They become outdated the moment code changes.

---

# Product Positioning

DevLens is not:

* an AI coding assistant
* a documentation platform
* a static analysis tool
* a diagramming tool
* a code review tool
* a wiki
* a repository browser

DevLens is:

> A Software Intelligence Platform.

DevLens continuously transforms source code into living organizational knowledge.

Its purpose is to answer:

* How does the system work?
* Why does it work this way?
* What changed?
* What depends on this?
* What will break?
* What should be documented?
* What should be improved?
* How do I understand this system quickly?

---

# Mental Model

The wrong model is:

```text
Code
 ↓
LLM
 ↓
Answer
```

The DevLens model is:

```text
Code
 ↓
Static Analysis
 ↓
Knowledge Graph
 ↓
Architecture Intelligence
 ↓
Living Documentation
 ↓
RAG
 ↓
AI
 ↓
Understanding
```

AI is not the source of truth.

The system itself is the source of truth.

---

# Core Belief

We believe:

> Understanding software is more valuable than generating software.

Writing code is becoming cheaper.

Understanding systems is becoming more expensive.

DevLens focuses on understanding.

---

# Non-Goals

DevLens will NOT attempt to become:

## A Code Editor

VS Code already exists.

Cursor already exists.

We do not compete there.

---

## A Full IDE

We will integrate with IDEs.

We will not replace IDEs.

---

## A CI/CD Platform

We may integrate with CI/CD systems.

We will not replace them.

---

## A Monitoring Platform

We may visualize observability data.

We will not replace Prometheus or Grafana.

---

## A Source Control Platform

GitHub, GitLab and Bitbucket remain the source control systems.

DevLens consumes repositories.

It does not replace repository hosting.

---

## A General Purpose Chatbot

Chat is not the product.

Chat is merely an interface to knowledge.

Knowledge remains the product.

---

# Product Thesis

Software systems deserve:

* living architecture
* living documentation
* persistent knowledge
* instant onboarding
* visual understanding
* continuously updated system intelligence

DevLens exists to make that possible.

---

# Foundational Statement

> GitHub stores your code.
>
> DevLens stores your software knowledge.

---

# Vision Statement

> Every codebase deserves a living architecture.
