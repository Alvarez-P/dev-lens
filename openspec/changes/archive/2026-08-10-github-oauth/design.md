# Design: GitHub OAuth 2.0 Login

## Technical Approach

Per [RFC-005](../../../docs/architecture/RFC-005-Authentication-Architecture.md): provider-abstraction strategy pattern with identity linking. Domain defines `ExternalIdentityProvider`; GitHub adapter wraps `passport-github2`. Identity resolution: external ID match → email match → auto-provision → JWT via existing `buildAuthResponse()`. Separate `external_identities` table — zero changes to `User` aggregate.

## Architecture Decisions

| #   | Decision                    | Chosen                           | Option B                | Rationale                                                                                           |
| --- | --------------------------- | -------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | Provider interface location | **`domain/`**                    | `infrastructure/`       | DIP: domain contracts, infra implements. Matches existing entity/repository separation.             |
| 2   | ExternalIdentity table      | **New table**                    | Extend `users`          | RFC-005: one user → many identities. User aggregate stays pure.                                     |
| 3   | OAuth controller            | **New `OAuthController`**        | Extend `AuthController` | Redirect flow (GET) ≠ JSON body (POST). Both under `@Controller({ path: 'auth', version: '1' })`.   |
| 4   | Token encryption            | **New `TokenEncryptionService`** | Reuse existing          | Spec R8: `AUTH_TOKEN_ENCRYPTION_KEY` (separate from `CREDENTIAL_ENCRYPTION_KEY`). Same AES-256-GCM. |
| 5   | Frontend hook               | **Extend `useAuth`**             | New `useOAuth`          | Spec R6: `AuthContext.loginWithProvider()`. Single auth surface.                                    |
| 6   | Module structure            | **Extend `IdentityModule`**      | New module              | OAuth IS identity concern. `ProviderRegistry` in same DI container.                                 |
| 7   | CSRF state param            | **Signed JWT**                   | Session-based           | Stateless, reuses `JwtService`. Spec R2 requires signed JWT.                                        |
| 8   | OAuth env vars              | **`oauth.github` section**       | Flat top-level          | Extensible for GitLab/Bitbucket. Follows existing `auth.*`/`repo.*` pattern.                        |

## Entity Diagram

```
┌───────────────────┐     1    *  ┌───────────────────────────────┐
│       User        │◄────────────│      ExternalIdentity         │
│───────────────────│             │───────────────────────────────│
│ id: UUID          │             │ id: UUID (PK)                 │
│ email             │             │ userId: FK → users            │
│ passwordHash       │             │ provider: string              │
│ firstName/lastName│             │ externalId: string            │
│ avatarUrl?        │             │ accessToken: encrypted text   │
│ isEmailVerified   │             │ refreshToken: encrypted text? │
│ refreshTokenHash? │             │ tokenExpiresAt: timestamptz?  │
│ lastLoginAt?      │             │ displayName, avatarUrl?       │
└───────────────────┘             │ UNIQUE(provider, externalId)  │
                                  └───────────────────────────────┘
```

## OAuth Flow

```
Browser → GET /auth/oauth/github → 302 to GitHub (state=JWT)
  └─ User authorizes → GitHub → 302 /auth/oauth/github/callback?code=&state=
       └─ validateState() → exchangeCode() → getUserProfile()
            └─ resolveIdentity():
                 ├─ match by (provider, externalId) → user
                 ├─ match by email → link identity
                 └─ no match → provision User
            └─ encrypt tokens → persist ExternalIdentity
            └─ buildAuthResponse(user) → 302 /?oauth=success → JWT in localStorage
```

## File Changes

### New Files (12)

| File                                                                               | Purpose                                                       |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `identity/domain/external-identity-provider.interface.ts`                          | `ExternalIdentityProvider` + `ExternalUserProfile`            |
| `identity/domain/external-identity.entity.ts`                                      | Domain entity                                                 |
| `identity/infrastructure/auth/github-oauth.provider.ts`                            | GitHub adapter wrapping `passport-github2`                    |
| `identity/infrastructure/auth/provider-registry.ts`                                | Maps provider name → adapter                                  |
| `identity/infrastructure/auth/oauth-state.service.ts`                              | Signs/verifies OAuth state JWTs (5min TTL)                    |
| `identity/infrastructure/controllers/oauth.controller.ts`                          | Redirect + callback endpoints                                 |
| `identity/infrastructure/persistence/typeorm/external-identity.typeorm-entity.ts`  | `@Entity('external_identities')`                              |
| `identity/infrastructure/persistence/repositories/external-identity.repository.ts` | TypeORM → domain mapping                                      |
| `identity/infrastructure/encryption/token-encryption.service.ts`                   | AES-256-GCM with `AUTH_TOKEN_ENCRYPTION_KEY`                  |
| `identity/application/dto/oauth.dto.ts`                                            | `LinkedIdentityDto`, `UnlinkIdentityDto`                      |
| `identity/application/oauth.service.ts`                                            | `authenticateWithProvider(provider, profile)` — resolve + JWT |
| `migrations/XXXXXX_create_external_identities.ts`                                  | TypeORM migration                                             |

### Modified Files (8)

| File                                              | Change                                                                                               |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `config/configuration.ts`                         | Add `OAuthConfig` interface + `oauth.github` factory                                                 |
| `config/config.service.ts`                        | Add `oauth` getter                                                                                   |
| `identity/identity.module.ts`                     | Register providers, controller, encryption, TypeORM entity                                           |
| `identity/domain/index.ts` + `identity-errors.ts` | Export new types + errors (`InvalidOAuthState`, `IdentityAlreadyLinked`, `CannotUnlinkSoleIdentity`) |
| `frontend/src/lib/auth/auth-context.tsx`          | Add `loginWithProvider(provider)` → `window.location` redirect                                       |
| `frontend/src/lib/auth/auth-types.ts`             | `ProviderLogin` type                                                                                 |
| `frontend/src/app/(auth)/login/page.tsx`          | OAuth divider + GitHub button (conditional on `NEXT_PUBLIC_GITHUB_CLIENT_ID`)                        |
| `frontend/src/app/(auth)/register/page.tsx`       | Same component                                                                                       |

## Testing Strategy

| Layer       | What                             | How                                                |
| ----------- | -------------------------------- | -------------------------------------------------- |
| Unit        | `TokenEncryptionService`         | AES-256-GCM round-trip, tamper detection           |
| Unit        | `OAuthStateService`              | Sign/verify, expired/tampered JWT                  |
| Unit        | `ProviderRegistry`               | Register, resolve, duplicate, unknown              |
| Integration | `OAuthController` callback       | Mock provider, assert 3 resolution paths → JWT     |
| Integration | `ExternalIdentityRepository`     | CRUD, findByProvider, duplicate constraint         |
| Integration | `AuthController` backward compat | `POST /login` and `/register` unchanged            |
| E2E         | Full OAuth flow                  | Click button → redirect → callback → authenticated |

## Migration / Rollout

Additive-only migration (new table, no existing data changes). Set `GITHUB_CLIENT_ID`/`SECRET`, `AUTH_TOKEN_ENCRYPTION_KEY`, deploy. Buttons render conditionally. Zero downtime.

**Rollback**: remove env vars → endpoints return 400. Drop `external_identities`.

## Open Questions

None — all decisions resolved per RFC-005 and proposal specs.
