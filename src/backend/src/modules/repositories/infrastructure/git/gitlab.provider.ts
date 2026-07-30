import { Injectable } from '@nestjs/common';
import { GitProviderInterface } from './provider.interface';

@Injectable()
export class GitLabProvider implements GitProviderInterface {
  private readonly apiBase = 'https://gitlab.com/api/v4';

  /**
   * Validate a GitLab repository URL.
   */
  async validateUrl(url: string, credential?: string): Promise<boolean> {
    const projectPath = this.toProjectPath(url);
    if (!projectPath) return false;

    try {
      const headers: Record<string, string> = {};
      if (credential) {
        headers['Authorization'] = `Bearer ${credential}`;
      }

      const response = await fetch(`${this.apiBase}/projects/${encodeURIComponent(projectPath)}`, {
        headers,
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Validate credentials against GitLab API.
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
   * Get the default branch from GitLab API.
   */
  async getDefaultBranch(url: string, credential?: string): Promise<string> {
    const projectPath = this.toProjectPath(url);
    if (!projectPath) return 'main';

    try {
      const headers: Record<string, string> = {};
      if (credential) {
        headers['Authorization'] = `Bearer ${credential}`;
      }

      const response = await fetch(`${this.apiBase}/projects/${encodeURIComponent(projectPath)}`, {
        headers,
      });
      if (!response.ok) return 'main';

      const data = (await response.json()) as { default_branch?: string };
      return data.default_branch || 'main';
    } catch {
      return 'main';
    }
  }

  /**
   * Get repository info from GitLab API.
   */
  async getRepoInfo(
    url: string,
    credential?: string,
  ): Promise<{ name: string; description?: string; visibility?: string; size?: number }> {
    const projectPath = this.toProjectPath(url);
    if (!projectPath) {
      return { name: this.extractRepoName(url) };
    }

    try {
      const headers: Record<string, string> = {};
      if (credential) {
        headers['Authorization'] = `Bearer ${credential}`;
      }

      const response = await fetch(`${this.apiBase}/projects/${encodeURIComponent(projectPath)}`, {
        headers,
      });
      if (!response.ok) {
        return { name: this.extractRepoName(url) };
      }

      const data = (await response.json()) as {
        name?: string;
        description?: string;
        visibility?: string;
      };

      return {
        name: data.name || this.extractRepoName(url),
        description: data.description,
        visibility: data.visibility,
      };
    } catch {
      return { name: this.extractRepoName(url) };
    }
  }

  /**
   * Convert git URL to API project path.
   * e.g., https://gitlab.com/group/subgroup/repo → group/subgroup/repo
   */
  private toProjectPath(url: string): string | null {
    const match = url.match(/gitlab\.com[/:](.+?)(?:\.git)?$/);
    if (!match) return null;
    return match[1];
  }

  private extractRepoName(url: string): string {
    const segments = url.replace(/\.git$/, '').split('/');
    return segments[segments.length - 1] || 'unknown';
  }
}
