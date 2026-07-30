import {
  ExternalIdentity,
  ExternalIdentityId,
} from '@/modules/identity/domain/external-identity.entity';

describe('ExternalIdentity', () => {
  const userId = '550e8400-e29b-41d4-a716-446655440000';

  describe('create', () => {
    it('should create an ExternalIdentity with all required fields', () => {
      const identity = ExternalIdentity.create({
        userId,
        provider: 'github',
        externalId: 'gh_12345',
        accessToken: 'encrypted_token',
        refreshToken: 'encrypted_refresh',
        tokenExpiresAt: new Date('2025-12-31'),
        displayName: 'Octocat',
        avatarUrl: 'https://avatars.githubusercontent.com/u/583231',
      });

      expect(identity.id).toBeDefined();
      expect(identity.id.toString()).toBeTruthy();
      expect(identity.userId).toBe(userId);
      expect(identity.provider).toBe('github');
      expect(identity.externalId).toBe('gh_12345');
      expect(identity.accessToken).toBe('encrypted_token');
      expect(identity.refreshToken).toBe('encrypted_refresh');
      expect(identity.tokenExpiresAt).toEqual(new Date('2025-12-31'));
      expect(identity.displayName).toBe('Octocat');
      expect(identity.avatarUrl).toBe('https://avatars.githubusercontent.com/u/583231');
      expect(identity.createdAt).toBeInstanceOf(Date);
      expect(identity.updatedAt).toBeInstanceOf(Date);
    });

    it('should create an ExternalIdentity with minimal required fields', () => {
      const identity = ExternalIdentity.create({
        userId,
        provider: 'github',
        externalId: 'gh_67890',
        accessToken: 'encrypted_token',
      });

      expect(identity.userId).toBe(userId);
      expect(identity.provider).toBe('github');
      expect(identity.externalId).toBe('gh_67890');
      expect(identity.accessToken).toBe('encrypted_token');
      expect(identity.refreshToken).toBeNull();
      expect(identity.tokenExpiresAt).toBeNull();
      expect(identity.displayName).toBeNull();
      expect(identity.avatarUrl).toBeNull();
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute an ExternalIdentity from stored data', () => {
      const id = ExternalIdentityId.create();
      const now = new Date();

      const identity = ExternalIdentity.reconstitute({
        id: id.toString(),
        userId,
        provider: 'github',
        externalId: 'gh_12345',
        accessToken: 'encrypted_token',
        refreshToken: 'encrypted_refresh',
        tokenExpiresAt: new Date('2025-12-31'),
        displayName: 'Octocat',
        avatarUrl: 'https://avatars.githubusercontent.com/u/583231',
        createdAt: now,
        updatedAt: now,
      });

      expect(identity.id.toString()).toBe(id.toString());
      expect(identity.userId).toBe(userId);
      expect(identity.provider).toBe('github');
      expect(identity.externalId).toBe('gh_12345');
      expect(identity.accessToken).toBe('encrypted_token');
      expect(identity.refreshToken).toBe('encrypted_refresh');
      expect(identity.tokenExpiresAt).toEqual(new Date('2025-12-31'));
      expect(identity.displayName).toBe('Octocat');
      expect(identity.createdAt).toBe(now);
      expect(identity.updatedAt).toBe(now);
    });

    it('should reconstitute with minimal nullable fields', () => {
      const now = new Date();

      const identity = ExternalIdentity.reconstitute({
        id: 'some-uuid',
        userId,
        provider: 'gitlab',
        externalId: 'gl_999',
        accessToken: 'encrypted',
        createdAt: now,
        updatedAt: now,
      });

      expect(identity.provider).toBe('gitlab');
      expect(identity.refreshToken).toBeNull();
      expect(identity.tokenExpiresAt).toBeNull();
      expect(identity.displayName).toBeNull();
      expect(identity.avatarUrl).toBeNull();
    });
  });
});

describe('ExternalIdentityId', () => {
  it('should create a unique ID', () => {
    const id1 = ExternalIdentityId.create();
    const id2 = ExternalIdentityId.create();

    expect(id1.toString()).toBeTruthy();
    expect(id1.toString()).not.toBe(id2.toString());
  });

  it('should reconstruct from a string value', () => {
    const id = ExternalIdentityId.from('550e8400-e29b-41d4-a716-446655440000');

    expect(id.toString()).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(id.value).toBe('550e8400-e29b-41d4-a716-446655440000');
  });
});
