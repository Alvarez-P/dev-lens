'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { Spinner } from './spinner';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button visual variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Show loading spinner and disable interaction */
  isLoading?: boolean;
  /** Icon to show before the button text */
  leftIcon?: ReactNode;
  /** Icon to show after the button text */
  rightIcon?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 disabled:bg-primary-600/50',
  secondary:
    'bg-surface-700 text-surface-100 hover:bg-surface-600 active:bg-surface-500 disabled:bg-surface-700/50',
  outline:
    'border border-surface-600 text-surface-200 hover:bg-surface-800 active:bg-surface-700 disabled:border-surface-600/50 disabled:text-surface-500',
  ghost:
    'text-surface-300 hover:bg-surface-800 hover:text-surface-100 active:bg-surface-700 disabled:text-surface-600',
  danger: 'bg-error-600 text-white hover:bg-error-700 active:bg-error-800 disabled:bg-error-600/50',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2.5',
};

/**
 * Button component with multiple variants, sizes, and loading state support.
 * Uses forwardRef for form integration and composition.
 */
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
