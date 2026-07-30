'use client';

import Link from 'next/link';
import { FolderOpen } from 'lucide-react';

interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  organizationId: string;
}

/**
 * Workspace card component.
 * Displays workspace name and description.
 */
export function WorkspaceCard({ workspace }: { workspace: Workspace }): JSX.Element {
  return (
    <Link
      href={`/workspaces/${workspace.id}`}
      className="group rounded-xl border border-surface-800 bg-surface-900 p-6 transition-all hover:border-primary-500/50 hover:shadow-lg hover:shadow-primary-500/5"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/10 text-primary-400">
          <FolderOpen className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-surface-200 group-hover:text-primary-400 transition-colors">
            {workspace.name}
          </h3>
          {workspace.description && (
            <p className="mt-0.5 truncate text-xs text-surface-500">{workspace.description}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
