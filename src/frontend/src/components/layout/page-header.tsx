import { type ReactNode } from 'react';
import { clsx } from 'clsx';

export interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Optional description below the title */
  description?: string;
  /** Optional action buttons or elements aligned to the right */
  actions?: ReactNode;
  /** Additional class names */
  className?: string;
}

/**
 * Consistent page header component.
 * Provides a standard heading style across all pages.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps): JSX.Element {
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
