# RFC-012 — Search & Discovery

**Status:** Draft

**Authors:** DevLens Team

**Created:** 2026-07-30

**Last Updated:** 2026-07-30

---

# 1. Summary

This RFC defines the Search & Discovery Engine, the bounded context responsible for indexing the Knowledge Graph and enabling fast, deterministic, and semantic search across all software concepts.

Search in DevLens is not code search. It is knowledge search. Users search for architectural concepts — modules, services, endpoints, events, domain objects — not file contents.

The Search Engine provides the entry point for discovery: a developer arrives at DevLens, searches for a concept, and navigates from the search result into the graph visualization, documentation, or AI explanation.

---

# 2. Motivation

Developers spend a significant portion of their time searching:
- "Where is authentication implemented?"
- "Which services call the Payment API?"
- "Show me all endpoints related to orders."
- "Find modules that depend on the legacy billing system."

Traditional search tools (grep, GitHub search, IDE search) operate on text. They return files, not concepts. A developer searching for "PaymentService" wants to understand the payment *domain*, not find a file named `payment.service.ts`.

Structured search over the Knowledge Graph returns concepts with their relationships, enabling discovery rather than file hunting.

---

# 3. Goals

The Search Engine must:

- Index all Knowledge Graph nodes and their properties.
- Support full-text search across node labels, types, and metadata.
- Support semantic search using embeddings for natural language queries.
- Support faceted filtering (by type, language, domain, relationship count).
- Return results with context (relationships, parent module, bounded context).
- Integrate with the Visualization Engine for result navigation.
- Support autocomplete and type-ahead suggestions.
- Maintain low latency (< 200ms for text search, < 500ms for semantic search).
- Index incrementally as the Knowledge Graph updates.

---

# 4. Non-Goals

This RFC does **not** define:

- How the Knowledge Graph is built (see RFC-007).
- How the Visualization Engine renders results (see RFC-008).
- How AI processes search queries (see RFC-009).
- Source code search.
- Git history search.
- External tool integrations.

---

# 5. Architecture

## 5.1 Dual Index Strategy

DevLens uses two complementary search approaches:

```text
Knowledge Graph (RFC-007)
        │
        ├────────────► Full-Text Index (PostgreSQL)
        │                - GIN indexes on node labels
        │                - tsvector for natural language search
        │                - Fast exact and prefix matching
        │
        └────────────► Semantic Index (pgvector)
                         - Embedding vectors for nodes
                         - Cosine similarity search
                         - Natural language concept discovery
```

## 5.2 Search Flow

```text
User Query
        │
        ▼
Query Analyzer
  - Detect query type (exact match, prefix, natural language)
  - Extract filters (type, language, domain)
        │
        ▼
Search Router
  - Text query → Full-Text Index
  - Semantic query → Semantic Index
  - Hybrid → Both, merged and reranked
        │
        ▼
Result Enricher
  - Attach relationship counts
  - Attach parent context (module, domain)
  - Attach direct dependencies list
        │
        ▼
Search Response
  - Ranked results
  - Facet counts
  - Suggested next queries
```

---

# 6. Full-Text Search

## 6.1 Indexed Fields

Every Knowledge Graph node is indexed:

| Field | Index Type | Use Case |
|---|---|---|
| `label` | GIN trigram | Fuzzy name matching |
| `type` | B-tree | Type filtering |
| `properties.language` | B-tree | Language filtering |
| `properties.file_path` | GIN trigram | Path search |
| `properties.description` | GIN tsvector | Natural language search |
| `metadata.tags` | GIN array | Tag-based filtering |

## 6.2 Query Types

| Query | Example | Behavior |
|---|---|---|
| Exact match | `PaymentService` | Case-insensitive exact node label match |
| Prefix match | `Pay` | Matches nodes starting with "Pay" |
| Fuzzy match | `Paymnet` | Typo-tolerant via trigram similarity |
| Natural language | `payment processing module` | tsvector full-text search across all indexed fields |
| Filtered | `type:Service language:TypeScript payment` | Combined text search with type/language filters |

## 6.3 Ranking

Results are ranked by:
1. Exact label match (highest priority).
2. Prefix match.
3. Trigram similarity score.
4. tsvector relevance rank.
5. Node importance (number of relationships — more connected nodes rank higher).

---

# 7. Semantic Search

## 7.1 Embedding Strategy

Each Knowledge Graph node is vectorized for semantic similarity:

- **Embedding model**: text-embedding-3-small (or equivalent) for MVP. Configurable per organization.
- **What is embedded**: concatenation of node label, type, and a deterministic description generated from the node's properties and relationships.
- **Vector dimensions**: configurable, default 1536 (OpenAI) or 768 (local models).
- **Storage**: pgvector extension in PostgreSQL.

## 7.2 When Semantic Search Activates

Semantic search is used when:
- The query is a natural language question ("show me how authentication works").
- The query contains no exact or prefix matches.
- The user explicitly requests semantic search.
- Hybrid mode is enabled (semantic results boost full-text results).

## 7.3 Embedding Generation

Embeddings are generated:
- **Batch**: when the Knowledge Graph is first built, all nodes are embedded.
- **Incremental**: when nodes are added or modified, only affected nodes are re-embedded.
- **On-demand**: when a new embedding model is configured, existing nodes are re-embedded in the background.

Embedding generation calls the AI provider through the same abstraction as RFC-010 (embedding is a provider capability).

---

# 8. Hybrid Search

Hybrid mode combines full-text and semantic results:

1. Full-text and semantic queries run in parallel.
2. Results are merged with reciprocal rank fusion (RRF).
3. Final ranking considers both text relevance and semantic similarity.

Hybrid search provides the best of both worlds: exact matches when the user knows the name, semantic discovery when the user describes the concept.

---

# 9. Faceted Filtering

Search results support faceted refinement:

| Facet | Values |
|---|---|
| Type | Module, Service, Controller, Endpoint, Entity, Event, Interface, DTO |
| Language | TypeScript, Python, Java, Go, Rust, etc. |
| Domain | Bounded context names detected in the repository |
| Module | Parent module names |
| Relationship count | Low (0-5), Medium (6-20), High (20+) |

Facet counts update dynamically as filters are applied.

---

# 10. Autocomplete

Type-ahead suggestions as the user types:

- **Source**: node labels indexed by prefix.
- **Ranking**: by usage frequency (most-searched nodes rank higher) and relationship count.
- **Response time**: < 50ms (served from Redis cache).
- **Format**: label + type icon + parent module.

---

# 11. Search Result Structure

Each search result includes:

```json
{
  "node_id": "node:payment-service",
  "label": "PaymentService",
  "type": "Service",
  "language": "TypeScript",
  "module": "payments",
  "domain": "Payment",
  "relationship_counts": {
    "dependencies": 8,
    "dependents": 12,
    "endpoints": 5,
    "events_published": 2,
    "events_consumed": 3
  },
  "highlight": "Payment<em>Service</em> handles payment processing...",
  "actions": ["view_in_graph", "explain_with_ai", "view_documentation"]
}
```

Results provide immediate context (what it is, where it belongs, how connected it is) and actions (what the user can do next).

---

# 12. Integration Points

## 12.1 Visualization Engine (RFC-008)

- Search results highlight matching nodes in the graph.
- Selecting a result navigates the graph to that node.
- The search bar is embedded in the visualization UI.

## 12.2 AI Orchestration (RFC-009)

- AI explanations can be triggered directly from search results.
- AI can augment search with "Did you mean?" suggestions.

## 12.3 Documentation Engine (RFC-011)

- Generated documentation is indexed for search.
- Users can search within documentation as well as within the graph.

---

# 13. Index Lifecycle

## 13.1 Initial Build

When a repository is first analyzed:
1. Knowledge Graph is built (RFC-007).
2. Full-text index is created for all nodes.
3. Embeddings are generated for all nodes (batch process).
4. Semantic index is populated.
5. Autocomplete cache is warmed.

## 13.2 Incremental Updates

When the Knowledge Graph is updated:
1. Added/modified nodes are re-indexed in the full-text index.
2. Added/modified nodes are re-embedded.
3. Removed nodes are deleted from both indexes.
4. Autocomplete cache is invalidated for affected prefixes.

## 13.3 Reindexing

Full reindexing is supported for:
- Embedding model changes.
- Index configuration changes.
- Recovery from corruption.

Reindexing runs as a background job without blocking search (the previous index remains available until the new one is built).

---

# 14. Performance Targets

| Operation | Target |
|---|---|
| Text search (exact match) | < 50ms |
| Text search (fuzzy, 10K nodes) | < 200ms |
| Semantic search (10K nodes) | < 500ms |
| Autocomplete | < 50ms |
| Facet computation | < 100ms |
| Index build (10K nodes, full-text) | < 5 seconds |
| Embedding generation (10K nodes, batch) | < 5 minutes (parallelized) |

---

# 15. Access Control

Search results are scoped to the user's accessible repositories and organizations:
- Public repositories: searchable by all users.
- Private repositories: searchable only by authorized users.
- Organization-internal: searchable only by organization members.

Access control is applied at query time through row-level security or application-level filtering.

---

# 16. Future Considerations

- **Cross-repository search**: search across all repositories in an organization.
- **Natural language queries**: "find all services that depend on the legacy auth module".
- **Search analytics**: track popular searches to identify documentation gaps.
- **Saved searches**: persistent search queries with notifications for new results.
- **Search API**: expose search as a public API for integrations.
- **Code snippet search**: extend search to include source code excerpts (beyond Knowledge Graph concepts).
- **Multi-language embedding models**: support language-specific embedding models for non-English codebases.

---

# 17. References

- RFC-007 — Knowledge Extraction Platform
- RFC-008 — Visualization Engine
- RFC-009 — AI Orchestration
- EPIC-010 — Search & Discovery
- PRODUCT_CONTEXT.md — Section 8 (Search)
