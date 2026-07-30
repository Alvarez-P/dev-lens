import { Injectable } from '@nestjs/common';
import { GitProviderInterface } from './provider.interface';

@Injectable()
export class GitHubProvider implements GitProviderInterface {
  private readonly apiBase = 'https://api.github.com';

  async validateUrl(url: string, credential?: string): Promise<boolean> {
    const apiUrl = this.toApiUrl(url);
    if (!apiUrl) return false;

    try {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
      };
      if (credential) {
        headers['Authorization'] = `Bearer ${credential}`;
      }

      const response = await fetch(apiUrl, { headers });
      return response.ok;
    } catch {
      return false;
    }
  }

  async validateCredentials(_url: string, credential: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBase}/user`, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `Bearer ${credential}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getDefaultBranch(url: string, credential?: string): Promise<string> {
    const apiUrl = this.toApiUrl(url);
    if (!apiUrl) return 'main';

    try {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
      };
      if (credential) {
        headers['Authorization'] = `Bearer ${credential}`;
      }

      const response = await fetch(apiUrl, { headers });
      if (!response.ok) return 'main';

      const data = (await response.json()) as { default_branch?: string };
      return data.default_branch || 'main';
    } catch {
      return 'main';
    }
  }

  async getRepoInfo(
    url: string,
    credential?: string,
  ): Promise<{ name: string; description?: string; visibility?: string; size?: number }> {
    const apiUrl = this.toApiUrl(url);
    if (!apiUrl) {
      return { name: this.extractRepoName(url) };
    }

    try {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
      };
      if (credential) {
        headers['Authorization'] = `Bearer ${credential}`;
      }

      const response = await fetch(apiUrl, { headers });
      if (!response.ok) {
        return { name: this.extractRepoName(url) };
      }

      const data = (await response.json()) as {
        name?: string;
        description?: string;
        visibility?: string;
        size?: number;
      };

      return {
        name: data.name || this.extractRepoName(url),
        description: data.description,
        visibility: data.visibility,
        size: data.size,
      };
    } catch {
      return { name: this.extractRepoName(url) };
    }
  }

  private toApiUrl(url: string): string | null {
    const match = url.match(/github\.com[/:]([\w.-]+)\/([\w.-]+)/);
    if (!match) return null;
    return `${this.apiBase}/repos/${match[1]}/${match[2]}`;
  }

  private extractRepoName(url: string): string {
    const segments = url.replace(/\.git$/, '').split('/');
    return segments[segments.length - 1] || 'unknown';
  }
}
