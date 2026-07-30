# Tasks: GitHub OAuth 2.0 Login

**TDD mode**: strict — each task follows RED (write failing test) → GREEN (implement) → REFACTOR. Test files are counted in line estimates.

## Review Workload Forecast

| Field                   | Value              |
| ----------------------- | ------------------ |
| Estimated changed lines | ~1,100–1,500       |
| 400-line budget risk    | **High**           |
| Chained PRs recommended | **Yes**            |
| Suggested split         | PR 1 → PR 2 → PR 3 |
| Delivery strategy       | ask-always         |
| Chain strategy          | pending            |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal                                                                | Likely PR | Notes                                    |
| ---- | ------------------------------------------------------------------- | --------- | ---------------------------------------- |
| 1    | Domain contracts + core infra (encryption, state, config, registry) | PR 1      | ~350 lines. Unit-testable independently. |
| 2    | GitHub adapter, persistence, resolution service, controller, wiring | PR 2      | ~500 lines. Integration tests.           |
| 3    | Frontend OAuth UI, settings management, E2E                         | PR 3      | ~300 lines. Depends on PR 2 endpoints.   |

## Phase 1: Domain + Config Foundation

- [x] 1.1 Define `ExternalIdentityProvider` interface + `ExternalUserProfile` type in `identity/domain/external-identity-provider.interface.ts`
- [x] 1.2 Create `ExternalIdentity` domain entity (`identity/domain/external-identity.entity.ts`)
- [x] 1.3 Add errors: `InvalidOAuthState`, `IdentityAlreadyLinked`, `CannotUnlinkSoleIdentity` in `identity/domain/identity-errors.ts`
- [x] 1.4 Add `OAuthConfig` interface + `oauth.github` factory to `config/configuration.ts` + `config.service.ts`
- [x] 1.5 Export all new types + errors from `identity/domain/index.ts`

## Phase 2: Infrastructure Core

- [x] 2.1 Build `TokenEncryptionService` — AES-256-GCM encrypt/decrypt with `AUTH_TOKEN_ENCRYPTION_KEY`
- [x] 2.2 Build `OAuthStateService` — sign/verify 5min TTL JWTs for CSRF state param (reuses `JwtService`)
- [x] 2.3 Build `ProviderRegistry` — register/resolve `ExternalIdentityProvider` by provider name
- [x] 2.4 Implement `GithubOAuthProvider` wrapping `passport-github2` — `getAuthorizationUrl`, `exchangeCode`, `getUserProfile`

## Phase 3: Persistence + Resolution

- [ ] 3.1 Create `ExternalIdentityTypeormEntity` (`@Entity('external_identities')`) with unique `(provider, externalId)` constraint + migration
- [ ] 3.2 Implement `ExternalIdentityRepository` — CRUD, `findByProvider`, token encryption on write
- [ ] 3.3 Build `OAuthService.authenticateWithProvider()` — 3-path resolution (identity match → email match → provision) + `buildAuthResponse` + DTOs

## Phase 4: API Endpoints + Integration

- [ ] 4.1 Create `OAuthController` — `GET /auth/oauth/:provider` (302 redirect) and `GET /auth/oauth/:provider/callback` (code exchange → JWT)
- [ ] 4.2 Register controller, providers, TypeORM entity, encryption in `IdentityModule`
- [ ] 4.3 Integration tests: callback (3 resolution paths), tampered state, duplicate identity, backward compat unchanged

## Phase 5: Frontend OAuth UI

- [ ] 5.1 Add `loginWithProvider(provider)` to `AuthContext` — `window.location` redirect to `/api/v1/auth/oauth/{provider}`
- [ ] 5.2 Add "Sign in with GitHub" button on login + register pages, conditional on env var (`NEXT_PUBLIC_GITHUB_CLIENT_ID`)
- [ ] 5.3 Build Settings > Security — linked identity list, display name, Unlink button (reject sole auth method)

## Phase 6: Verification

- [ ] 6.1 E2E: full OAuth flow — button → redirect → callback → authenticated session with JWT
- [ ] 6.2 E2E: auto-provision new user, returning user match, existing email/password user link
- [ ] 6.3 E2E: unlink prevention when identity is sole auth method (no password set)
