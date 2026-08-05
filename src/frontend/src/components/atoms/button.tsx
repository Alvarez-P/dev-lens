'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { Spinner } from './spinner';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;

  size?: ButtonSize;

  isLoading?: boolean;

  leftIcon?: ReactNode;

  rightIcon?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary-600 text-surface-950 hover:bg-primary-500 active:bg-primary-700 disabled:bg-primary-600/30 disabled:text-surface-950/50',
  secondary:
    'bg-white/[0.05] text-surface-200 hover:bg-white/[0.08] active:bg-white/[0.03] disabled:bg-white/[0.05]/50',
  outline:
    'border border-white/[0.08] text-surface-200 hover:bg-white/[0.04] active:bg-white/[0.02] disabled:border-white/[0.04] disabled:text-surface-500',
  ghost:
    'text-surface-300 hover:bg-white/[0.04] hover:text-surface-100 active:bg-white/[0.02] disabled:text-surface-600',
  danger: 'bg-error-600 text-white hover:bg-error-700 active:bg-error-800 disabled:bg-error-600/50',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={clsx(
          'inline-flex items-center justify-center font-medium rounded-lg',
          'transition-all duration-150 ease-in-out',
          'focus-ring',
          'cursor-pointer disabled:cursor-not-allowed',
          'select-none',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {isLoading ? <Spinner size={size === 'lg' ? 'md' : 'sm'} /> : leftIcon}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  },
);

Button.displayName = 'Button';
