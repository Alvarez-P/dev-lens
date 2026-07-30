import {
  ExternalIdentityProvider,
  ExternalUserProfile,
  ExternalIdentity,
  ExternalIdentityId,
  InvalidOAuthState,
  IdentityAlreadyLinked,
  CannotUnlinkSoleIdentity,
} from '@/modules/identity/domain/index';

describe('Domain index exports', () => {
  it('should export ExternalIdentityProvider interface', () => {
    // Verify the interface is usable at runtime via a conforming object
    const provider: ExternalIdentityProvider = {
      provider: 'test',
      getProviderName: () => 'test',
      getAuthorizationUrl: () => 'https://example.com/auth',
      exchangeCode: async () => ({
        externalId: '1',
        email: 'test@test.com',
        displayName: 'Test',
        accessToken: 'token',
      }),
    };

    expect(provider.provider).toBe('test');
    expect(provider.getProviderName()).toBe('test');
  });

  it('should export ExternalUserProfile type', () => {
    const profile: ExternalUserProfile = {
      externalId: 'ext_1',
      email: 'user@example.com',
      displayName: 'User',
      accessToken: 'tok_xxx',
    };

    expect(profile.email).toBe('user@example.com');
  });

  it('should export ExternalIdentity entity class', () => {
    const identity = ExternalIdentity.create({
      userId: 'user-id',
      provider: 'github',
      externalId: 'gh_1',
      accessToken: 'encrypted',
    });

    expect(identity).toBeInstanceOf(ExternalIdentity);
    expect(identity.id).toBeInstanceOf(ExternalIdentityId);
  });

  it('should export error classes', () => {
    const stateError = new InvalidOAuthState();
    const linkError = new IdentityAlreadyLinked('github', 'ext_1');
    const unlinkError = new CannotUnlinkSoleIdentity();

    expect(stateError.code).toBe('INVALID_OAUTH_STATE');
    expect(linkError.code).toBe('IDENTITY_ALREADY_LINKED');
    expect(unlinkError.code).toBe('CANNOT_UNLINK_SOLE_IDENTITY');
  });
});
