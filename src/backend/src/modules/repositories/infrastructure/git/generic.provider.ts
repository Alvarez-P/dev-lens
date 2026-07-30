import { Injectable } from '@nestjs/common';
import { GitProviderInterface } from './provider.interface';

/**
 * Generic git provider — handles any git URL that is not GitHub/GitLab/Bitbucket.
 * Only validates URL format; no API calls.
 */
@Injectable()
export class GenericProvider implements GitProviderInterface {
  async validateUrl(_url: string, _credential?: string): Promise<boolean> {
    // Generic: basic format validation is done by RepositoryUrl VO
    // Can't verify without an API — assume valid
    return true;
  }

  async validateCredentials(_url: string, _credential: string): Promise<boolean> {
    // For generic providers, credential validation always returns true
    // Users can test manually
    return true;
  }

  async getDefaultBranch(_url: string, _credential?: string): Promise<string> {
    return 'main';
  }

  async getRepoInfo(
    url: string,
    _credential?: string,
  ): Promise<{ name: string; description?: string; visibility?: string; size?: number }> {
    const segments = url.replace(/\.git$/, '').split('/');
    return { name: segments[segments.length - 1] || 'unknown' };
  }
}
