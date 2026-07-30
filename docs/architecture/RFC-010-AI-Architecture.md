# RFC-010 — AI Architecture

**Status:** Draft

**Authors:** DevLens Team

**Created:** 2026-07-30

**Last Updated:** 2026-07-30

---

# 1. Summary

This RFC defines the structural architecture of the AI layer: the capability framework, the provider abstraction, prompt templates, context strategies, and the capability registry.

AI Architecture defines *what* AI can do and *how* it is organized. AI Orchestration (RFC-009) defines *how* it runs.

Together, they ensure that AI in DevLens is structured, provider-independent, observable, and maintainable — not a collection of ad-hoc prompts scattered across the codebase.

---

# 2. Motivation

Most AI-integrated products suffer from three architectural failures:

1. **Prompts are hardcoded** — scattered across controllers, services, and UI components, making them impossible to audit, version, or test.
2. **Provider coupling** — switching from OpenAI to Anthropic requires rewriting every AI call site.
3. **Context inconsistency** — different features assemble context differently, producing inconsistent AI behavior.

DevLens avoids these failures by organizing AI around *capabilities* — discrete, well-defined operations that own their prompt template, context strategy, output format, and validation rules.

---

# 3. Goals

The AI Architecture must:

- Define AI operations as versioned, testable capabilities.
- Abstract AI providers behind a common interface.
- Ensure every capability owns its context strategy.
- Keep prompt templates separate from execution logic.
- Support multiple AI providers through configuration.
- Enable capability discovery and registration.
- Allow capabilities to be gated by user tier (Free vs. Professional vs. Enterprise).
- Maintain backward compatibility when prompts evolve.

---

# 4. Non-Goals

This RFC does **not** define:

- How AI requests are executed at runtime (see RFC-009).
- How context is retrieved from the Knowledge Graph (see RFC-009).
- How streaming works (see RFC-009).
- How AI usage is tracked (see RFC-009).
- The specific LLM models to use.
- AI security policies.

---

# 5. AI Capability Framework

## 5.1 Capability Definition

An AI Capability is a discrete operation that the AI can perform. Every capability is defined by:

```typescript
interface AICapability {
  id: string;                    // Unique identifier (e.g., "explain-module")
  name: string;                  // Human-readable name
  description: string;           // What it does
  version: number;               // Capability version (for evolution)
  tier: 'free' | 'professional' | 'enterprise';  // Access tier
  contextStrategy: ContextStrategy;  // What context to fetch
  promptTemplate: PromptTemplate;    // How to structure the prompt
  outputFormat: OutputFormat;        // Expected response structure
  validationRules: ValidationRule[]; // Post-generation validation
}
```

## 5.2 Context Strategy

Defines what Knowledge Graph context is assembled before prompt generation:

```typescript
interface ContextStrategy {
  targetNodeType: NodeType;       // What the capability explains
  relationshipDepth: number;      // How many hops to traverse
  includeDependents: boolean;     // Nodes that depend on the target
  includeDependencies: boolean;   // Nodes the target depends on
  includeApiSurface: boolean;     // Endpoints exposed
  includeEventSurface: boolean;   // Events published/consumed
  includeDomainContext: boolean;  // Bounded context and aggregate
  maxContextTokens: number;       // Token budget for context
}
```

## 5.3 Prompt Template

Separates prompt structure from execution logic:

```typescript
interface PromptTemplate {
  systemInstruction: string;      // System-level behavior instruction
  contextPlaceholder: string;     // Where context is inserted
  userQueryWrapper: string;       // How the user query is wrapped
  capabilityInstructions: string; // Specific instructions for this capability
  examples?: PromptExample[];     // Few-shot examples (optional)
}
```

Templates are stored as versioned artifacts — not hardcoded strings. This enables:
- A/B testing of prompt variations.
- Rollback to previous prompt versions.
- Audit of prompt changes over time.
- Translation to multiple languages.

## 5.4 Output Format

Defines the expected structure of AI responses:

```typescript
interface OutputFormat {
  type: 'text' | 'markdown' | 'json' | 'mermaid';
  schema?: JSONSchema;            // For structured JSON responses
  validation: 'strict' | 'lenient' | 'none';
}
```

## 5.5 Validation Rules

Post-generation validation ensures AI responses meet quality standards:

- **Completeness**: required sections are present.
- **Schema compliance**: JSON responses match the expected schema.
- **Length**: responses do not exceed maximum length.
- **Safety**: responses pass content filtering.
- **Groundedness**: responses reference entities present in the provided context.

---

# 6. AI Provider Abstraction

## 6.1 Provider Interface

Every AI provider implements a common interface:

```typescript
interface AIProvider {
  id: string;                     // Provider identifier
  name: string;                   // Human-readable name
  supportedModels: string[];      // Available models

  complete(request: AIRequest): Promise<AIResponse>;
  streamComplete(request: AIRequest): AsyncIterable<AIChunk>;

  healthCheck(): Promise<boolean>;
  estimateCost(request: AIRequest): number;
}
```

## 6.2 Provider Implementations

| Provider | Models | Type |
|---|---|---|
| OpenAI | GPT-4o, GPT-4o-mini | Cloud |
| Anthropic | Claude 3.5 Sonnet, Claude 3 Haiku | Cloud |
| Ollama | Llama 3, Mistral, CodeLlama | Local |
| OpenRouter | Multiple (routing) | Cloud |

## 6.3 Provider Configuration

Providers are configured through the application configuration, not code:

```yaml
ai:
  default_provider: anthropic
  providers:
    openai:
      enabled: true
      api_key_secret: OPENAI_API_KEY
      default_model: gpt-4o-mini
    anthropic:
      enabled: true
      api_key_secret: ANTHROPIC_API_KEY
      default_model: claude-3-5-sonnet-20241022
    ollama:
      enabled: false
      base_url: http://localhost:11434
      default_model: llama3
```

## 6.4 Provider Selection

The orchestrator (RFC-009) selects a provider based on:
1. **Capability requirements**: some capabilities may require specific model capabilities (e.g., JSON mode).
2. **User tier**: Free tier may use cheaper/faster models.
3. **Provider availability**: fallback if primary provider is unavailable.
4. **Cost optimization**: route to the cheapest available provider for simple queries.
5. **User preference**: organization-level provider preferences (Enterprise).

---

# 7. Capability Catalog

## 7.1 MVP Capabilities

| ID | Name | Tier | Description |
|---|---|---|---|
| `explain-module` | Explain Module | Free | Summarize what a module does, its dependencies, and its role |
| `explain-service` | Explain Service | Free | Explain a service's responsibility, inputs, and outputs |
| `explain-endpoint` | Explain Endpoint | Free | Describe an API endpoint, its parameters, and its behavior |
| `explain-architecture` | Explain Architecture | Free | High-level architecture overview of the repository |
| `explain-dependency` | Explain Dependency | Free | Explain why two modules depend on each other |
| `explain-event` | Explain Event | Free | Describe a domain event, its producers, and consumers |
| `suggest-documentation` | Suggest Documentation | Professional | Generate documentation for an undocumented module |
| `analyze-impact` | Impact Analysis | Professional | Estimate the impact of changing a specific module |
| `review-architecture` | Architecture Review | Professional | Identify architectural risks and suggest improvements |
| `onboard-developer` | Onboarding Guide | Professional | Generate a personalized onboarding path for a repository |
| `summarize-changes` | Summarize Changes | Enterprise | Summarize architectural changes between two commits |

## 7.2 Capability Registry

All capabilities are registered in a centralized registry. The orchestrator discovers available capabilities at startup:

```typescript
interface CapabilityRegistry {
  register(capability: AICapability): void;
  get(id: string): AICapability;
  list(tier?: string): AICapability[];
  isAvailable(id: string, tier: string): boolean;
}
```

New capabilities can be added without modifying the orchestrator — they are registered and immediately available.

---

# 8. Prompt Management

## 8.1 Template Storage

Prompt templates are stored as versioned files:

```
ai/
  capabilities/
    explain-module/
      v1/
        system.md
        instructions.md
        examples.json
      v2/
        system.md
        instructions.md
        examples.json
    explain-service/
      v1/
        ...
```

This structure enables:
- Code review of prompt changes.
- Git-based version history.
- Rollback to any previous version.
- A/B testing by running multiple versions concurrently.

## 8.2 Template Variables

Templates support variable substitution:

```
You are analyzing the module `{{target.name}}` in the `{{project.name}}` project.
This module is written in {{project.language}} using {{project.framework}}.

{{#each target.dependencies}}
- Depends on: `{{this.name}}` ({{this.relationship_type}})
{{/each}}
```

Variables are populated from the Knowledge Graph context — never from raw code.

## 8.3 Prompt Evolution

When a prompt template is updated:
1. The new version is added alongside the old version.
2. Capabilities reference a specific version.
3. Migrating to a new version requires explicit capability version bump.
4. Old versions are retained for at least 30 days before deprecation.

---

# 9. Capability Gating

AI capabilities are gated by user tier:

- **Free**: `explain-*` capabilities (basic understanding).
- **Professional**: adds `suggest-*`, `analyze-*`, `onboard-*` capabilities.
- **Enterprise**: all capabilities, including `review-*` and `summarize-*`.

Gating is enforced by the orchestrator before context assembly. Attempting to use a gated capability returns a clear upgrade prompt, not a generic error.

---

# 10. Multi-Language Support

Capabilities should produce responses in the user's preferred language.

- Prompt templates include a `language` parameter.
- System instructions direct the model to respond in the specified language.
- The Knowledge Graph context retains its original language (code identifiers are not translated).
- Explanations are generated in the user's language; code references remain unchanged.

---

# 11. Testing AI Capabilities

Every capability must be testable:

## 11.1 Unit Tests

- Prompt template compilation with sample context.
- Token budget enforcement.
- Output format validation.
- Context strategy correctness (produces expected graph queries).

## 11.2 Integration Tests

- End-to-end capability execution with a mock AI provider.
- Verify that capability output passes validation rules.
- Verify that provider fallback works correctly.

## 11.3 Evaluation Tests

- Regression tests with golden datasets.
- Compare responses across prompt versions.
- Measure groundedness (does the response reference provided context?).

---

# 12. Future Considerations

- **Custom AI Capabilities**: allow organizations to define their own capabilities with custom context strategies and prompts.
- **Fine-tuned models**: deploy fine-tuned models for specific capabilities.
- **Capability marketplace**: share capabilities across organizations.
- **Multi-agent orchestration**: chain capabilities (e.g., "analyze this module, then suggest documentation, then review the architecture").
- **AI memory**: persistent conversation context across sessions (beyond single requests).
- **Confidence scoring**: estimate AI response reliability based on context completeness.

---

# 13. References

- RFC-001 — Architecture Principles (Provider Independence, Deterministic Before Intelligent)
- RFC-007 — Knowledge Extraction Platform
- RFC-009 — AI Orchestration
- EPIC-008 — AI Orchestration
- PRODUCT_CONTEXT.md — Section 13 (AI Philosophy)
