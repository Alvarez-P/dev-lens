import { Injectable } from '@nestjs/common';
import { GitProvider } from '../../domain/git-provider.enum';
import { GitProviderInterface } from './provider.interface';
import { GitHubProvider } from './github.provider';
import { GitLabProvider } from './gitlab.provider';
import { BitbucketProvider } from './bitbucket.provider';
import { GenericProvider } from './generic.provider';

@Injectable()
export class GitProviderFactory {
  constructor(
    private readonly githubProvider: GitHubProvider,
    private readonly gitlabProvider: GitLabProvider,
    private readonly bitbucketProvider: BitbucketProvider,
    private readonly genericProvider: GenericProvider,
  ) {}

  /**
   * Get the appropriate provider implementation for the given enum.
   */
  getProvider(provider: GitProvider): GitProviderInterface {
    switch (provider) {
      case GitProvider.GITHUB:
        return this.githubProvider;
      case GitProvider.GITLAB:
        return this.gitlabProvider;
      case GitProvider.BITBUCKET:
        return this.bitbucketProvider;
      case GitProvider.AZURE_DEVOPS:
        // Falls back to generic for Azure DevOps (can be extended)
        return this.genericProvider;
      case GitProvider.GENERIC:
        return this.genericProvider;
      default:
        return this.genericProvider;
    }
  }
}
