/**
 * Interface for git provider-specific operations.
 * Domain code never touches provider-specific APIs directly.
 */
export interface GitProviderInterface {
  /**
   * Validate that a repository URL is reachable and valid.
   */
  validateUrl(url: string, credential?: string): Promise<boolean>;

  /**
   * Validate that credentials work against the provider.
   */
  validateCredentials(url: string, credential: string): Promise<boolean>;

  /**
   * Get the default branch name for a repository.
   */
  getDefaultBranch(url: string, credential?: string): Promise<string>;

  /**
   * Get repository metadata (name, description, visibility, size).
   */
  getRepoInfo(
    url: string,
    credential?: string,
  ): Promise<{ name: string; description?: string; visibility?: string; size?: number }>;
}
