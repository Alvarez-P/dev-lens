import { Injectable, Logger } from '@nestjs/common';
import { IGNORED_DIRECTORIES } from '../../analysis/application/file-manifest.service';

/** Source extensions allowed into AI context (REQ-CA-004, ai-context-assembly R5). */
const ALLOWED_EXTENSIONS: ReadonlySet<string> = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.py',
  '.java',
  '.go',
]);

/** Files matching this pattern are excluded unconditionally (REQ-CA-004). */
const ENV_FILE_PATTERN = /(^|[/\\])\.env($|\.)/;

/** Files whose name suggests they hold secrets (ai-context-assembly R5 deny-list). */
const SECRET_FILE_PATTERN = /\.(pem|key)$|secret|credential/i;

export type DenyRule = '.env*' | 'ignored-directory' | 'secret-file';

export interface FileClassification {
  include: boolean;
  /** Present only when the file matched a deny-list rule. */
  rule?: DenyRule;
}

/**
 * Allow/deny-list enforcement BEFORE sketch construction (REQ-CA-004) and
 * before KG context assembly (ai-context-assembly R5).
 *
 * - Allow: `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.java`, `.go`
 * - Deny: `.env*` files — excluded unconditionally, logged at warn
 * - Deny: secret-bearing filenames (`*.pem`, `*.key`, `*secret*`, `*credential*`)
 * - Deny: `IGNORED_DIRECTORIES` — excluded, logged at warn
 * - Everything else: silently skipped (no warning)
 */
@Injectable()
export class SourceFileFilter {
  private readonly logger = new Logger(SourceFileFilter.name);

  classify(filePath: string): FileClassification {
    const envRule = this.envDenyRule(filePath);

    if (envRule !== null) {
      return { include: false, rule: envRule };
    }

    if (this.isSecretFile(filePath)) {
      return { include: false, rule: 'secret-file' };
    }

    if (this.isInIgnoredDirectory(filePath)) {
      return { include: false, rule: 'ignored-directory' };
    }

    return { include: this.extensionOf(filePath) !== '' && this.isAllowedExtension(filePath) };
  }

  /**
   * Filter a list of file paths, warn-logging deny-list exclusions.
   * Non-source files are skipped silently.
   */
  filter(files: readonly string[]): string[] {
    const included: string[] = [];

    for (const filePath of files) {
      const classification = this.classify(filePath);

      if (!classification.include) {
        if (classification.rule !== undefined) {
          this.logger.warn(
            `AI context: excluded ${filePath} (deny-list rule: ${classification.rule})`,
          );
        }

        continue;
      }

      included.push(filePath);
    }

    return included;
  }

  private envDenyRule(filePath: string): DenyRule | null {
    return ENV_FILE_PATTERN.test(filePath) ? '.env*' : null;
  }

  private isSecretFile(filePath: string): boolean {
    return SECRET_FILE_PATTERN.test(filePath);
  }

  private isInIgnoredDirectory(filePath: string): boolean {
    const segments = filePath.split(/[\\/]+/);

    return segments.some((segment) => IGNORED_DIRECTORIES.has(segment));
  }

  private isAllowedExtension(filePath: string): boolean {
    return ALLOWED_EXTENSIONS.has(this.extensionOf(filePath));
  }

  private extensionOf(filePath: string): string {
    const dotIndex = filePath.lastIndexOf('.');

    return dotIndex < 0 ? '' : filePath.slice(dotIndex).toLowerCase();
  }
}
