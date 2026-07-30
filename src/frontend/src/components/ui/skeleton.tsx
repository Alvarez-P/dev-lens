import { type HTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: string | number;

  height?: string | number;

  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full' | 'none';
}

const roundedClasses = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  full: 'rounded-full',
};

export function Skeleton({
  width,
  height = '1rem',
  rounded = 'md',
  className,
  style,
  ...props
}: SkeletonProps): React.ReactNode {
  return (
    <div
      className={clsx('animate-pulse bg-surface-700', roundedClasses[rounded], className)}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        ...style,
      }}
      role="presentation"
      aria-hidden="true"
      {...props}
    />
  );
}
