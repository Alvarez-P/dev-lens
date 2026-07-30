import { type ReactNode } from 'react';
import { clsx } from 'clsx';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  /** Icon to display above the title (defaults to an inbox icon) */
  icon?: ReactNode;
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** Optional action button or link */
  action?: ReactNode;
  /** Additional class names */
  className?: string;
}

/**
 * Empty state component for when there is no data to display.
 * Shows a centered layout with an icon, title, description, and optional action.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps): JSX.Element {
  return (
    <div className={clsx('flex flex-col items-center justify-center py-16 text-center', className)}>
      <div className="mb-4 text-surface-600">{icon || <Inbox className="h-12 w-12" />}</div>

      <h3 className="text-lg font-semibold text-surface-300">{title}</h3>

      {description && <p className="mt-1 max-w-sm text-sm text-surface-500">{description}</p>}

      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
