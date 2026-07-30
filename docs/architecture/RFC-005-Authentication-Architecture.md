# RFC-005 — Federated Authentication Architecture

**Status:** Draft
**Epic:** [EPIC-003 — Identity](../product/epics/01-platform/EPIC-003-Identity.md)

---

## Context

DevLens already integrates with GitHub, GitLab, and Bitbucket for repository access. Users manage provider credentials to clone and analyze repos. However, account creation still requires email/password registration — a friction point for developers who already trust their Git provider.

This RFC defines the architecture for OAuth 2.0-based federated login, starting with GitHub and designed to accommodate additional providers without core domain changes.

## Decision

**Use a provider-abstraction strategy pattern with identity linking.** Users authenticate via an external OAuth provider, and the system resolves or creates a local user account. One user may link multiple external identities.

## Architecture

### Provider Abstraction

```
interface ExternalIdentityProvider {
  readonly provider: GitProvider; // 'github' | 'gitlab' | 'bitbucket' | 'google'
  getAuthorizationUrl(state: string): string;
  exchangeCodeForToken(code: string): Promise<TokenResponse>;
  getUserProfile(accessToken: string): Promise<ExternalUserProfile>;
}

interface ExternalUserProfile {
  externalId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}
```

Providers are registered via a `ProviderRegistry`:

```
class ProviderRegistry {
  private providers = new Map<GitProvider, ExternalIdentityProvider>();

  register(provider: ExternalIdentityProvider): void;
  resolve(provider: GitProvider): ExternalIdentityProvider;
}
```

New providers require only implementing the interface and registering — zero changes to the auth flow or user domain.

### OAuth Flow

```
1. GET  /api/v1/auth/oauth/:provider        → redirect to provider
2. GET  /api/v1/auth/oauth/:provider/callback → exchange code, resolve user, issue JWT
```

Callback logic:

```
async handleCallback(provider: GitProvider, code: string) {
  const adapter = registry.resolve(provider);
  const token = await adapter.exchangeCodeForToken(code);
  const profile = await adapter.getUserProfile(token.accessToken);

  const existingIdentity = await findExternalIdentity(provider, profile.externalId);

  if (existingIdentity) {
    return issueJwt(existingIdentity.user);
  }

  const userByEmail = await findUserByEmail(profile.email);

  if (userByEmail) {
    await linkExternalIdentity(userByEmail, provider, profile);
    return issueJwt(userByEmail);
  }

  const newUser = await createUser({
    email: profile.email,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    emailVerified: true,
  });

  await linkExternalIdentity(newUser, provider, profile);
  return issueJwt(newUser);
}
```

### Database — External Identity Linking

New `external_identities` table, separate from the user aggregate:

| Column           | Type             | Description                       |
| ---------------- | ---------------- | --------------------------------- |
| id               | uuid PK          |                                   |
| user_id          | uuid FK → users  | Owning user                       |
| provider         | varchar(20)      | github, gitlab, bitbucket, google |
| external_id      | varchar(255)     | Provider-side user ID             |
| access_token     | text (encrypted) | For provider API calls            |
| refresh_token    | text (encrypted) |                                   |
| token_expires_at | timestamptz      |                                   |
| profile_data     | jsonb            | Cached display name, avatar, etc. |
| created_at       | timestamptz      |                                   |
| updated_at       | timestamptz      |                                   |

Unique constraint on `(provider, external_id)`. Index on `user_id`.

### User Model — No Changes Required

The `User` entity remains unchanged. External identity data lives in a separate table. A user can have zero or more external identities alongside or instead of a password hash.

A user without `password_hash` can only log in via OAuth. A user with both can use either method.

## Consequences

### Positive

- Developers sign up with their Git provider — no new password to manage
- Provider credentials can be reused for repository access (single OAuth token)
- Adding a new provider requires only a new adapter class — no core changes
- Works alongside existing email/password auth

### Risks

- **Token refresh**: OAuth tokens expire. The system must refresh them proactively or handle 401s gracefully when accessing provider APIs. Mitigation: store refresh tokens encrypted, refresh on use.
- **Account linking ambiguity**: If a user registers with email A via GitHub and later tries Google with email A, the system links automatically. If emails differ, prompt the user to link manually. Mitigation: explicit link/unlink UI in account settings.
- **Provider downtime**: If GitHub is down, users with only GitHub-linked accounts can't log in. Mitigation: encourage linking a password or multiple providers.

## Provider Roadmap

| Phase   | Provider  | Rationale                                                |
| ------- | --------- | -------------------------------------------------------- |
| Phase 1 | GitHub    | Primary developer audience, already integrated for repos |
| Phase 2 | GitLab    | Second most requested, existing provider support         |
| Phase 3 | Bitbucket | Existing provider support                                |
| Phase 4 | Google    | Broader adoption, non-Git users                          |

## References

- [EPIC-003 — Identity](../product/epics/01-platform/EPIC-003-Identity.md)
- [EPIC-013 — Enterprise](../product/epics/04-business/EPIC-013-Enterprise.md) — SSO is separate, enterprise-only
- [RFC-002 — System Architecture](./RFC-002-System-Architecture.md)
