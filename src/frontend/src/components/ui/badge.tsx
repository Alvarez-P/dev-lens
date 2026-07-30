import { type HTMLAttributes, type ReactNode } from 'react';
import { clsx } from 'clsx';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';
type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Badge color variant */
  variant?: BadgeVariant;
  /** Badge size */
  size?: BadgeSize;
  /** Badge content */
  children: ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-surface-700 text-surface-300 border-surface-600',
  success: 'bg-success-500/10 text-success-400 border-success-500/30',
  warning: 'bg-warning-500/10 text-warning-400 border-warning-500/30',
  error: 'bg-error-500/10 text-error-400 border-error-500/30',
  info: 'bg-primary-500/10 text-primary-400 border-primary-500/30',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

/**
 * Badge component for labels, statuses, and tags.
 */
export function Badge({
  variant = 'default',
  size = 'sm',
  children,
  className,
  ...props
}: BadgeProps): JSX.Element {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border font-medium',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
