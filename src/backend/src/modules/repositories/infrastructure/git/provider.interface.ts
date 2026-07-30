export interface GitProviderInterface {
  validateUrl(url: string, credential?: string): Promise<boolean>;

  validateCredentials(url: string, credential: string): Promise<boolean>;

  getDefaultBranch(url: string, credential?: string): Promise<string>;

  getRepoInfo(
    url: string,
    credential?: string,
  ): Promise<{ name: string; description?: string; visibility?: string; size?: number }>;
}
