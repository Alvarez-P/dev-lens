'use client';

import { clsx } from 'clsx';
import { Key, Github, Gitlab, Globe, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface CredentialCardProps {
  id: string;
  name: string;
  provider: string;
  type: string;
  createdAt: string;
  expiresAt: string | null;
  onDelete?: (id: string) => void;
  className?: string;
}

const providerIcons: Record<string, React.ReactNode> = {
  GITHUB: <Github className="h-5 w-5" />,
  GITLAB: <Gitlab className="h-5 w-5" />,
  BITBUCKET: <Globe className="h-5 w-5" />,
  AZURE_DEVOPS: <Globe className="h-5 w-5" />,
  GENERIC: <Key className="h-5 w-5" />,
};

const typeLabels: Record<string, string> = {
  PAT: 'Personal Access Token',
  SSH_KEY: 'SSH Key',
  OAUTH: 'OAuth Token',
};

/**
 * Card for credential management.
 * Shows provider, type, expiration status.
 * NEVER exposes the actual credential value.
 */
export function CredentialCard({
  id,
  name,
  provider,
  type,
  createdAt,
  expiresAt,
  onDelete,
  className,
}: CredentialCardProps): JSX.Element {
  const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;

  return (
    <div className={clsx('rounded-xl border border-surface-800 bg-surface-900 p-4', className)}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-500/10 text-warning-400">
            {providerIcons[provider] || <Key className="h-5 w-5" />}
          </div>
          <div>
            <h3 className="font-medium text-surface-100">{name}</h3>
            <p className="text-xs text-surface-500">{typeLabels[type] || type}</p>
          </div>
        </div>

        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(id)}
            className="text-surface-500 hover:text-error-400"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-surface-500">
        <span className="rounded-md bg-surface-800 px-2 py-0.5">{provider}</span>
        <span>Created {new Date(createdAt).toLocaleDateString()}</span>
        {expiresAt && (
          <span className={isExpired ? 'text-error-400' : ''}>
            {isExpired ? 'Expired' : `Expires ${new Date(expiresAt).toLocaleDateString()}`}
          </span>
        )}
      </div>
    </div>
  );
}
