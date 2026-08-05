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

export function WorkspaceCard({ workspace }: { workspace: Workspace }): React.ReactNode {
  return (
    <Link
      href={`/workspaces/${workspace.id}`}
      className="group rounded-xl border border-white/[0.04] bg-surface-900/60 backdrop-blur-sm p-6 transition-all duration-300 hover:border-primary-500/20 hover:shadow-glow"
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
