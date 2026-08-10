# Archive Report — GitHub OAuth 2.0 Login

**Change:** `github-oauth`
**Archived:** 2026-08-10
**Delivery:** 3-PR chain (PR 1: domain + infra core, PR 2: adapter/persistence/resolution/controller, PR 3: frontend UI + E2E)
**Artifact store:** openspec
**Source of truth:** synced to `openspec/specs/` (1 delta spec → new capability spec created)

---

## Completion Summary

| Metric         | Value                                                         |
| -------------- | ------------------------------------------------------------- |
| Status         | **COMPLETED**                                                 |
| Tasks          | 18 across 6 phases (all `[x]`)                                |
| Backend tests  | ✅ 768 passing (Jest, 92 suites)                              |
| Frontend tests | ✅ 382 passing (Vitest, 26 files)                             |
| Total tests    | ✅ 1150/1150 passing, 0 failures                              |
| OAuth-specific | ✅ 76 tests (13 backend suites + 1 frontend E2E), all passing |
| Build          | ✅ green (backend `nest build`, frontend `next build`)        |
| Verify verdict | **PASS** — 16/16 spec scenarios compliant, 0 CRITICAL issues  |

## Delta Sync Summary

| Domain               | Spec file (global)                            | Action  | Details                                                       |
| -------------------- | --------------------------------------------- | ------- | ------------------------------------------------------------- |
| oauth-authentication | `openspec/specs/oauth-authentication/spec.md` | Created | New capability spec, 9 requirements (R1–R9) copied from delta |

### Merge method

No main spec existed for `oauth-authentication` — the delta spec IS a full spec, so it
was copied directly to `openspec/specs/oauth-authentication/spec.md` (no add/modify/remove
merge required, no unrelated requirements to preserve).

- **ADDED**: 9 requirements (R1 Provider Interface, R2 Authorization Endpoints, R3 Identity
  Resolution, R4 External Identity Table, R5 Provider Login UI, R6 Frontend OAuth Flow,
  R7 Identity Management, R8 Token Encryption, R9 Backward Compatibility), each with RFC 2119
  keyword + Given/When/Then scenarios.
- **MODIFIED**: none (no pre-existing spec).
- **REMOVED**: none.
- No destructive merges — no orchestrator confirmation was required (`rules.archive`).

## What Was Built

GitHub-first OAuth 2.0 login alongside existing email/password auth:

1. **Domain contracts (PR 1)**: `ExternalIdentityProvider` interface + `ExternalUserProfile`
   (domain layer, DIP), `ExternalIdentity` domain entity, errors `InvalidOAuthState` /
   `IdentityAlreadyLinked` / `CannotUnlinkSoleIdentity`, `OAuthConfig` under `oauth.github`.
2. **Infra core (PR 1)**: `TokenEncryptionService` (AES-256-GCM, `AUTH_TOKEN_ENCRYPTION_KEY`),
   `OAuthStateService` (signed JWT CSRF state, 5min TTL), `ProviderRegistry` (duplicate guard).
3. **Adapter + persistence + resolution (PR 2)**: `GithubOAuthProvider` (passport-github2 with
   email fallback via `/user/emails`), `external_identities` table with unique
   `(provider, externalId)` + migration, `ExternalIdentityRepository` (encrypt on write /
   decrypt on read), `OAuthService.authenticateWithProvider` 3-path resolution
   (identity match → email match/link → auto-provision with `isEmailVerified=true`).
4. **API endpoints (PR 2)**: `GET /api/v1/auth/oauth/:provider` (redirect, both `@Public()`)
   and `GET /api/v1/auth/oauth/:provider/callback` (state validation → code exchange →
   JWT via `buildAuthResponse` → `/?oauth=success`).
5. **Frontend (PR 3)**: `loginWithProvider(provider)` on `AuthContext`, "Sign in with GitHub"
   button on login/register (conditional on `NEXT_PUBLIC_GITHUB_CLIENT_ID`), Settings >
   Security linked-identity list with Unlink button (sole-auth-method guard).

## Key Decisions (from design.md)

1. **D1: Provider interface in `domain/`** — DIP: `ExternalIdentityProvider` in domain,
   GitHub adapter in infrastructure; future providers (GitLab/Bitbucket) register via
   `ProviderRegistry` without controller changes.
2. **D2: New `external_identities` table** — separate table; `User` aggregate untouched.
3. **D3: New `OAuthController`** (not extending `AuthController`) under `@Controller({ path: 'auth', version: '1' })`.
4. **D4: New `TokenEncryptionService` with separate key** — `AUTH_TOKEN_ENCRYPTION_KEY`,
   same AES-256-GCM algorithm.
5. **D5: Extend `useAuth`** (not a new hook) — `loginWithProvider`, `getLinkedIdentities`,
   `unlinkIdentity` on `AuthContextType`.
6. **D6: Extend `IdentityModule`** (not a new module) — all OAuth providers/repos/controllers.
7. **D7: CSRF state as signed JWT** — `OAuthStateService` uses `JwtService`, 5min TTL.
8. **D8: `oauth.github` config section** — extensible for future providers.

## Verification Result

- **Verdict**: PASS — all 8 design decisions followed, all 16/16 spec scenarios compliant.
- **Tests**: 1150/1150 (768 backend + 382 frontend), 0 failures. All 76 OAuth-specific
  tests pass (13 backend suites + 1 Playwright E2E).
- **Build**: green for both backend (`nest build`) and frontend (`next build`).
- **WARNINGS** (non-blocking, infra-level only): backend test worker force-exit from active
  timers during module teardown (not a code defect); frontend build `ENOENT` trace warning.
- **SUGGESTIONS**: `--detectOpenHandles` in Jest config; add `test:cov` to CI; test logger
  suppressor for the intentional `InvalidOAuthState` error-path simulation.

## Follow-ups Identified

| #   | Follow-up                                                             | Source                   |
| --- | --------------------------------------------------------------------- | ------------------------ |
| 1   | Additional OAuth providers (GitLab, Bitbucket) via `ProviderRegistry` | design D1/D8             |
| 2   | Test coverage measurement (`test:cov`) in CI                          | verify-report suggestion |
| 3   | Jest `--detectOpenHandles` for cleaner teardown diagnostics           | verify-report suggestion |

## Artifacts in This Archive

- `proposal.md` — intent, scope, approach, risks, rollback plan, success criteria
- `design.md` — architecture decisions (D1–D8), data contracts, file changes, migration/rollout
- `tasks.md` — 18 tasks across 6 phases (all `[x]`), TDD evidence, work-unit PR plan
- `specs/` — 1 delta spec (oauth-authentication)
- `verify-report.md` — full verification with spec compliance matrix
- `apply-progress.md` — RED → GREEN → TRIANGULATE → REFACTOR evidence per task
- `archive.md` — this report

## Source of Truth (global specs updated)

- `openspec/specs/oauth-authentication/spec.md` — **created** (9 requirements, 16 scenarios)

## Next Steps

- Downstream changes (e.g., additional providers, identity management hardening) can
  consume the synced `openspec/specs/oauth-authentication` capability.
- Address follow-ups #1–#3 in small follow-up changes.

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived. Source of truth is
synced to `openspec/specs/`. Ready for the next change.
