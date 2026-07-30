# Proposal: GitHub OAuth 2.0 Login

## Intent

Email/password registration is friction for developers who already trust GitHub. DevLens integrates with GitHub for repo access — OAuth login reuses that trust. RFC-005 defines the architecture; this change implements it for GitHub.

## Scope

### In Scope

- GitHub provider adapter (`ExternalIdentityProvider` interface)
- `GET /api/v1/auth/oauth/:provider` redirect + callback endpoints
- `external_identities` table, entity, repository
- Identity resolution: external ID → email → auto-provision
- "Sign in with GitHub" button on login/register pages
- Provider registry in `IdentityModule`
- Link/unlink UI in user settings

### Out of Scope

- GitLab/Bitbucket/Google providers (architecture-ready, not built)
- Enterprise SSO (SAML/OIDC) — EPIC-013
- Passwordless-only accounts (email/password coexists)
- Token refresh from provider APIs

## Capabilities

### New Capabilities

- `oauth-authentication`: OAuth provider abstraction, GitHub adapter, OAuth endpoints, identity resolution, provider login UI

### Modified Capabilities

None — no existing specs.

## Approach

Per RFC-005: `ProviderRegistry` maps provider names to `ExternalIdentityProvider` implementations. GitHub adapter wraps `passport-github2` in the domain interface. Frontend redirects to `/api/v1/auth/oauth/github`. Callback resolves via `external_identities` table (external ID match → email match → provision), then issues JWT via existing `buildAuthResponse`.

## Affected Areas

| Area                                   | Impact   | Description                                  |
| -------------------------------------- | -------- | -------------------------------------------- |
| `identity/domain/`                     | New      | `external-identity.entity.ts`                |
| `identity/infrastructure/auth/`        | New      | `github.provider.ts`, `provider-registry.ts` |
| `identity/infrastructure/persistence/` | New      | Ext identity entity + repo                   |
| `identity/infrastructure/controllers/` | New      | `oauth.controller.ts`                        |
| `identity/identity.module.ts`          | Modified | Register providers, repos                    |
| `src/frontend/.../login/page.tsx`      | Modified | GitHub button                                |
| `src/frontend/.../auth-context.tsx`    | Modified | `loginWithProvider()`                        |
| `src/frontend/src/app/settings/`       | New      | Identity management UI                       |

## Risks

| Risk                             | Likelihood | Mitigation                              |
| -------------------------------- | ---------- | --------------------------------------- |
| OAuth misconfig                  | Low        | Env validation on startup               |
| Account linking (email mismatch) | Low        | Match by email; manual link in settings |
| Provider downtime                | Low        | Email/password fallback                 |

## Rollback Plan

1. Remove OAuth env vars
2. Revert `IdentityModule` + frontend changes
3. Drop `external_identities` table
4. `pnpm -r build` to verify

## Dependencies

- GitHub OAuth App client ID/secret (env vars)
- `passport-github2` package
- Node.js `crypto` for OAuth state param

## Success Criteria

- [ ] "Sign in with GitHub" → GitHub auth → redirect → authenticated in DevLens
- [ ] New user auto-provisioned with verified email + JWT
- [ ] Existing user by email links identity on first OAuth login
- [ ] Returning user logs in via identity match (no re-link)
- [ ] External identities manageable in user settings
- [ ] Email/password auth unchanged
