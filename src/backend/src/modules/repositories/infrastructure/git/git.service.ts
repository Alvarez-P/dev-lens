import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../../../config/config.service';
import simpleGit from 'simple-git';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';

export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  timestamp: Date;
}

@Injectable()
export class GitService {
  private readonly storagePath: string;

  constructor(private readonly configService: ConfigService) {
    this.storagePath = configService.repo.storagePath;
  }

  /**
   * Get the local storage path for a repository.
   */
  getRepoPath(repositoryId: string): string {
    return path.join(this.storagePath, repositoryId);
  }

  /**
   * Clone a repository with --depth 1 for performance.
   */
  async clone(
    url: string,
    targetPath: string,
    branch?: string,
    credential?: string,
  ): Promise<void> {
    // Ensure parent directory exists
    await fs.mkdir(path.dirname(targetPath), { recursive: true });

    // Build authenticated URL if credential is provided
    const cloneUrl = credential ? this.injectCredential(url, credential) : url;

    const git = simpleGit();

    const options: string[] = ['--depth', '1'];
    if (branch) {
      options.push('--branch', branch);
    }

    await git.clone(cloneUrl, targetPath, options);
  }

  /**
   * Pull latest changes from remote.
   */
  async pull(targetPath: string, _branch?: string, credential?: string): Promise<void> {
    const git = simpleGit(targetPath);

    // If we have a credential, we need to update the remote URL
    if (credential) {
      const remotes = await git.getRemotes(true);
      const origin = remotes.find((r) => r.name === 'origin');
      if (origin && origin.refs.fetch) {
        const authenticatedUrl = this.injectCredential(origin.refs.fetch, credential);
        await git.remote(['set-url', 'origin', authenticatedUrl]);
      }
    }

    await git.pull();
  }

  /**
   * Get current HEAD commit info.
   */
  async getCurrentCommit(targetPath: string): Promise<CommitInfo> {
    const git = simpleGit(targetPath);

    const log = await git.log({ maxCount: 1 });
    const latest = log.latest;

    if (!latest) {
      throw new Error('No commits found in repository');
    }

    return {
      sha: latest.hash,
      message: latest.message,
      author: latest.author_name,
      timestamp: new Date(latest.date),
    };
  }

  /**
   * Count source files in a repository (excludes node_modules, .git).
   */
  async getFileCount(targetPath: string): Promise<number> {
    try {
      const { stdout } = await this.exec(
        `find "${targetPath}" -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.go" -o -name "*.py" -o -name "*.java" -o -name "*.rs" -o -name "*.rb" -o -name "*.php" -o -name "*.c" -o -name "*.cpp" -o -name "*.h" -o -name "*.hpp" -o -name "*.cs" -o -name "*.swift" -o -name "*.kt" -o -name "*.scala" -o -name "*.vue" -o -name "*.svelte" -o -name "*.md" -o -name "*.json" -o -name "*.yaml" -o -name "*.yml" -o -name "*.toml" -o -name "*.css" -o -name "*.scss" -o -name "*.less" -o -name "*.html" \\) 2>/dev/null | wc -l`,
      );
      return parseInt(stdout.trim(), 10) || 0;
    } catch {
      // Fallback: count all non-binary files
      try {
        const { stdout } = await this.exec(
          `find "${targetPath}" -type f -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | wc -l`,
        );
        return parseInt(stdout.trim(), 10) || 0;
      } catch {
        return 0;
      }
    }
  }

  /**
   * Get total size of a repository in bytes.
   */
  async getRepoSize(targetPath: string): Promise<number> {
    try {
      const { stdout } = await this.exec(`du -sb "${targetPath}" 2>/dev/null | cut -f1`);
      return parseInt(stdout.trim(), 10) || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Check if a repository path exists (has been cloned).
   */
  async exists(targetPath: string): Promise<boolean> {
    try {
      await fs.access(path.join(targetPath, '.git'));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Inject credential token into a git URL for authentication.
   * Supports https:// and git@ patterns.
   */
  private injectCredential(url: string, credential: string): string {
    if (url.startsWith('https://')) {
      // https://github.com/org/repo → https://token@github.com/org/repo
      return url.replace('https://', `https://${credential}@`);
    }

    if (url.startsWith('git@')) {
      // git@github.com:org/repo → https://token@github.com/org/repo
      // simple-git handles SSH keys differently — keep as-is for SSH
      return url;
    }

    return url;
  }

  /**
   * Execute a shell command and return stdout/stderr.
   */
  private async exec(command: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      try {
        const stdout = execSync(command, {
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024, // 10MB
        });
        resolve({ stdout: stdout.trim(), stderr: '' });
      } catch (error: any) {
        reject(new Error(error?.stderr || error?.message || 'Command failed'));
      }
    });
  }
}
