/**
 * Supported git hosting providers.
 */
export enum GitProvider {
  GITHUB = 'GITHUB',
  GITLAB = 'GITLAB',
  BITBUCKET = 'BITBUCKET',
  AZURE_DEVOPS = 'AZURE_DEVOPS',
  GENERIC = 'GENERIC',
}

/**
 * Map host to GitProvider.
 */
export function detectProvider(url: { host: string }): GitProvider {
  const host = url.host.toLowerCase();
  if (host.includes('github')) return GitProvider.GITHUB;
  if (host.includes('gitlab')) return GitProvider.GITLAB;
  if (host.includes('bitbucket')) return GitProvider.BITBUCKET;
  if (host.includes('azure') || host.includes('dev.azure')) return GitProvider.AZURE_DEVOPS;
  return GitProvider.GENERIC;
}
