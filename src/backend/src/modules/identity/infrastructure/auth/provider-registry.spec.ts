import { ProviderRegistry } from './provider-registry';
import {
  ExternalIdentityProvider,
  ExternalUserProfile,
} from '../../domain/external-identity-provider.interface';

class MockGithubProvider implements ExternalIdentityProvider {
  readonly provider = 'github';

  getProviderName(): string {
    return 'github';
  }

  getAuthorizationUrl(state: string, redirectUri: string): string {
    return `https://github.com/login/oauth/authorize?state=${state}&redirect_uri=${redirectUri}`;
  }

  async exchangeCode(_code: string, _redirectUri: string): Promise<ExternalUserProfile> {
    return {
      externalId: 'gh_123',
      email: 'octocat@github.com',
      displayName: 'Octocat',
      avatarUrl: 'https://avatars.githubusercontent.com/u/583231',
      accessToken: 'gho_mock_token',
    };
  }
}

class MockGitlabProvider implements ExternalIdentityProvider {
  readonly provider = 'gitlab';

  getProviderName(): string {
    return 'gitlab';
  }

  getAuthorizationUrl(state: string, redirectUri: string): string {
    return `https://gitlab.com/oauth/authorize?state=${state}&redirect_uri=${redirectUri}`;
  }

  async exchangeCode(_code: string, _redirectUri: string): Promise<ExternalUserProfile> {
    return {
      externalId: 'gl_456',
      email: 'user@gitlab.com',
      displayName: 'GitLab User',
      accessToken: 'glpat_mock',
    };
  }
}

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  describe('register', () => {
    it('should register a provider successfully', () => {
      const provider = new MockGithubProvider();

      expect(() => registry.register(provider)).not.toThrow();
    });

    it('should throw when registering a duplicate provider', () => {
      registry.register(new MockGithubProvider());

      expect(() => registry.register(new MockGithubProvider())).toThrow();
      expect(() => registry.register(new MockGithubProvider())).toThrow(/already registered/i);
    });

    it('should register multiple different providers', () => {
      registry.register(new MockGithubProvider());
      registry.register(new MockGitlabProvider());

      const github = registry.resolve('github');
      const gitlab = registry.resolve('gitlab');

      expect(github.getAuthorizationUrl('s', 'r')).toContain('github.com');
      expect(gitlab.getAuthorizationUrl('s', 'r')).toContain('gitlab.com');
    });
  });

  describe('resolve', () => {
    it('should resolve a registered provider by name', () => {
      registry.register(new MockGithubProvider());

      const provider = registry.resolve('github');

      expect(provider).toBeDefined();
      expect(provider.getProviderName()).toBe('github');
    });

    it('should throw when resolving an unregistered provider', () => {
      expect(() => registry.resolve('bitbucket')).toThrow();
      expect(() => registry.resolve('bitbucket')).toThrow(/not found/i);
    });

    it('should return the correct provider when multiple are registered', () => {
      registry.register(new MockGithubProvider());
      registry.register(new MockGitlabProvider());

      const github = registry.resolve('github');
      const gitlab = registry.resolve('gitlab');

      expect(github.getAuthorizationUrl('s', 'r')).toContain('github.com');
      expect(gitlab.getAuthorizationUrl('s', 'r')).toContain('gitlab.com');
    });
  });

  describe('getRegisteredProviders', () => {
    it('should return empty array when no providers are registered', () => {
      expect(registry.getRegisteredProviders()).toEqual([]);
    });

    it('should return all registered provider names', () => {
      registry.register(new MockGithubProvider());
      registry.register(new MockGitlabProvider());

      const names = registry.getRegisteredProviders();

      expect(names).toContain('github');
      expect(names).toContain('gitlab');
      expect(names).toHaveLength(2);
    });
  });
});
