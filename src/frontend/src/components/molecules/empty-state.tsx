import { type ReactNode } from 'react';
import { clsx } from 'clsx';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  icon?: ReactNode;

  title: string;

  description?: string;

  action?: ReactNode;

  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps): React.ReactNode {
  return (
    <div className={clsx('flex flex-col items-center justify-center py-16 text-center', className)}>
      <div className="mb-4 text-surface-600">{icon || <Inbox className="h-12 w-12" />}</div>

      <h3 className="text-lg font-semibold text-surface-300">{title}</h3>

      {description && <p className="mt-1 max-w-sm text-sm text-surface-500">{description}</p>}

      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
