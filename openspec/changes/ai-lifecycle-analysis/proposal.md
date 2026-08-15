# Proposal: AI Lifecycle Analysis (classify-lifecycle capability)

## Intent

Replace fragile deterministic classification (NestJS-only decorator registry, name-guessing, no framework detection) with LLM-classified framework/architecture, per-endpoint lifecycle, and DTO types over the stable structural IR. The AI infra (providers, 7-stage enrichment pipeline, KG merge) shipped via `ai-enrichment` + `epic-008`; this change delivers the `classify-lifecycle` capability end-to-end, the evaluation suite, and the spec-level contract marking deterministic classification as fallback.

## Scope

### In Scope

- `classify-lifecycle` capability: register in `CapabilityRegistry`, add v1 few-shot `examples.json`, align templates with `lifecycle-enrichment.dto` output schema
- Framework detection: deterministic manifest parse (package.json/pom.xml/requirements.txt/pyproject.toml) → candidates → LLM confirm/refine; decorator/import scan stays as fallback
- Eval suite (RFC-010 §11.3): golden datasets (mini-nestjs + express fixtures with expected outputs), determinism checks, injection-tripwire fixtures (comment/string stripping, `.env` deny-list)
- Spec deltas: mark deterministic classification as fallback in `static-analysis-pipeline`, `typescript-parser`, `intermediate-representation`

### Out of Scope

- New providers (Anthropic), streaming UI, tier gating, JSONSchema/ajv migration
- Non-TS framework configs (django/flask/spring) — blocked on missing parsers (`parser-abstraction`); format-config mechanism stays framework-agnostic
- Method-body call-chain extraction (owned by request-flow's approximate INVOKES)
- Frontend changes

## Capabilities

### New Capabilities

- `ai-lifecycle-classification`: `classify-lifecycle` capability — framework/architecture detection (manifest candidates + LLM confirm), per-endpoint lifecycle mapping, DTO extraction, per-framework format configs, confidence thresholds, golden evaluation

### Modified Capabilities

- `static-analysis-pipeline`: deterministic analysis documented as structural skeleton; AI enrichment is additive downstream (behavior unchanged when `ai.enabled=false`)
- `typescript-parser`: decorator-role classification designated deterministic fallback; AI-classified roles override per-unit when enrichment present
- `intermediate-representation`: document IrEnrichment linkage (manifest-keyed, additive); role classification AI-overridable, IR structure unchanged

## Approach

Reuse the shipped pipeline (`analysis.completed` → `ai-enrichment` worker → sketches → prompt → provider → 3 gates → IrEnrichment → KG merge). Deliver: (1) register capability + examples.json; (2) extend `detectFramework()` with manifest candidates fed into the prompt, LLM confirms via `{framework, architecture, confidence}`; (3) eval harness on Mock provider — CI never hits live APIs; (4) spec deltas. Sequence: capability → detection → eval → specs. Follows exploration **Option B + C** (additive stage, per-unit fallback).

## Affected Areas

| Area                                                                                              | Impact   | Description                                        |
| ------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------- |
| `src/backend/src/modules/ai/ai.capabilities/classify-lifecycle/v1/`                               | Modified | +`examples.json`; template alignment to output DTO |
| `src/backend/src/modules/ai/ai.module.ts`                                                         | Modified | register `classify-lifecycle`                      |
| `src/backend/src/modules/ai/application/enrichment.service.ts`                                    | Modified | manifest-based `detectFramework()`                 |
| `src/backend/src/modules/ai/ai.frameworks/`                                                       | Modified | configs for detected frameworks                    |
| `src/backend/test/fixtures/` + `ai.fixtures/`                                                     | Modified | golden expected outputs + injection tripwires      |
| `openspec/specs/{static-analysis-pipeline,typescript-parser,intermediate-representation}/spec.md` | Modified | fallback/legacy documentation                      |

## Risks

| Risk                             | Likelihood | Mitigation                                                                          |
| -------------------------------- | ---------- | ----------------------------------------------------------------------------------- |
| RFC-009 §14 override exposure    | Med        | Amendment §14.1 in force: signatures only, XML isolation, deny-list; tripwire tests |
| LLM non-determinism in CI        | Med        | Mock provider + golden fixtures; determinism checks                                 |
| Framework detection drift        | Low        | Manifest candidates + LLM confirm + confidence gate                                 |
| Scope creep to non-TS frameworks | Med        | Explicit deferral (parser dependency)                                               |

## Rollback Plan

`ai.enabled=false` already disables enrichment. Capability templates, configs, and fixtures are additive files; registry registration is startup-only. Revert = delete `classify-lifecycle` files, drop registration, revert spec deltas. No migration — IrEnrichment (jsonb) is additive.

## Dependencies

- `openai` SDK, Ollama (dev), Mock (CI) — already in tree
- RFC-009 §14.1 amendment (in force); RFC-010 capability shape; RFC-007 honesty (`UNKNOWN`, not guessed)
- request-flow node/edge types (merged — coordination resolved)

## Success Criteria

- [ ] `classify-lifecycle` registered; enrichment pipeline green on Mock in CI (0 live API calls)
- [ ] Manifest-based detection returns nestjs/express candidates; 3-gate validation passes before persistence
- [ ] Golden eval: mini-nestjs + express fixtures yield expected classifications; injection tripwires prove stripping + `.env` deny-list
- [ ] Spec deltas merged; `ai.enabled=false` leaves the deterministic pipeline behavior unchanged
