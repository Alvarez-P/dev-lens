import { Injectable } from '@nestjs/common';
import { GitProviderInterface } from './provider.interface';

@Injectable()
export class BitbucketProvider implements GitProviderInterface {
  private readonly apiBase = 'https://api.bitbucket.org/2.0';

  /**
   * Validate a Bitbucket repository URL.
   */
  async validateUrl(url: string, credential?: string): Promise<boolean> {
    const repoPath = this.toRepoPath(url);
    if (!repoPath) return false;

    try {
      const headers: Record<string, string> = {};
      if (credential) {
        headers['Authorization'] = `Bearer ${credential}`;
      }

      const response = await fetch(`${this.apiBase}/repositories/${repoPath}`, { headers });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Validate credentials against Bitbucket API.
   */
  async validateCredentials(_url: string, credential: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBase}/user`, {
        headers: { Authorization: `Bearer ${credential}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get the default branch from Bitbucket API.
   */
  async getDefaultBranch(url: string, credential?: string): Promise<string> {
    const repoPath = this.toRepoPath(url);
    if (!repoPath) return 'main';

    try {
      const headers: Record<string, string> = {};
      if (credential) {
        headers['Authorization'] = `Bearer ${credential}`;
      }

      const response = await fetch(`${this.apiBase}/repositories/${repoPath}`, { headers });
      if (!response.ok) return 'main';

      const data = (await response.json()) as { mainbranch?: { name?: string } };
      return data.mainbranch?.name || 'main';
    } catch {
      return 'main';
    }
  }

  /**
   * Get repository info from Bitbucket API.
   */
  async getRepoInfo(
    url: string,
    credential?: string,
  ): Promise<{ name: string; description?: string; visibility?: string; size?: number }> {
    const repoPath = this.toRepoPath(url);
    if (!repoPath) {
      return { name: this.extractRepoName(url) };
    }

    try {
      const headers: Record<string, string> = {};
      if (credential) {
        headers['Authorization'] = `Bearer ${credential}`;
      }

      const response = await fetch(`${this.apiBase}/repositories/${repoPath}`, { headers });
      if (!response.ok) {
        return { name: this.extractRepoName(url) };
      }

      const data = (await response.json()) as {
        name?: string;
        description?: string;
        is_private?: boolean;
      };

      return {
        name: data.name || this.extractRepoName(url),
        description: data.description,
        visibility: data.is_private === true ? 'private' : 'public',
      };
    } catch {
      return { name: this.extractRepoName(url) };
    }
  }

  /**
   * Convert git URL to API repo path.
   * e.g., https://bitbucket.org/workspace/repo → workspace/repo
   */
  private toRepoPath(url: string): string | null {
    const match = url.match(/bitbucket\.org[/:]([\w.-]+\/[\w.-]+)/);
    if (!match) return null;
    return match[1].replace(/\.git$/, '');
  }

  private extractRepoName(url: string): string {
    const segments = url.replace(/\.git$/, '').split('/');
    return segments[segments.length - 1] || 'unknown';
  }
}
