import { type HTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { Spinner, type SpinnerProps } from '@/components/atoms/spinner';

type LoadingVariant = 'inline' | 'page' | 'overlay';

export interface LoadingStateProps extends HTMLAttributes<HTMLDivElement> {
  /** Visual variant: inline (centered section), page (full-height), overlay (absolute with backdrop). */
  variant?: LoadingVariant;
  /** Spinner size (defaults to lg for page/overlay, md for inline). */
  spinnerSize?: SpinnerProps['size'];
  /** Optional label below the spinner. */
  label?: string;
}

const variantClasses: Record<LoadingVariant, string> = {
  inline: 'flex items-center justify-center py-12',
  page: 'flex min-h-[60vh] flex-col items-center justify-center',
  overlay:
    'absolute inset-0 z-10 flex flex-col items-center justify-center bg-surface-950/80 backdrop-blur-sm',
};

const defaultSpinnerSize: Record<LoadingVariant, SpinnerProps['size']> = {
  inline: 'md',
  page: 'lg',
  overlay: 'lg',
};

/**
 * Unified loading state for pages, sections, and overlays.
 *
 * Replaces the duplicated `flex justify-center py-12` + `<Spinner />` pattern
 * used across 12+ pages/components. Uses the existing `Spinner` atom.
 */
export function LoadingState({
  variant = 'inline',
  spinnerSize,
  label,
  className,
  ...props
}: LoadingStateProps): React.ReactNode {
  const size = spinnerSize ?? defaultSpinnerSize[variant];

  return (
    <div
      role="status"
      aria-label={label ?? 'Loading'}
      className={clsx(variantClasses[variant], className)}
      {...props}
    >
      <div className="flex flex-col items-center gap-3">
        <Spinner size={size} />
        {label && <p className="text-sm text-surface-400">{label}</p>}
      </div>
    </div>
  );
}
