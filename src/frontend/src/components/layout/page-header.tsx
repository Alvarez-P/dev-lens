import { type ReactNode } from 'react';
import { clsx } from 'clsx';

export interface PageHeaderProps {
  title: string;

  description?: string;

  actions?: ReactNode;

  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps): React.ReactNode {
  return (
    <div
      className={clsx(
        'flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-surface-100">{title}</h1>
        {description && <p className="mt-1 text-sm text-surface-400">{description}</p>}
      </div>

      {actions && <div className="mt-4 flex items-center gap-3 sm:mt-0">{actions}</div>}
    </div>
  );
}
