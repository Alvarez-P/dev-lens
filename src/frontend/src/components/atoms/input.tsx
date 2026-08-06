'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { clsx } from 'clsx';

type InputVariant = 'default' | 'filled';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: InputVariant;

  label?: string;

  error?: string;

  helperText?: string;

  leftIcon?: ReactNode;

  rightIcon?: ReactNode;
}

const variantClasses: Record<InputVariant, string> = {
  default:
    'bg-surface-900/60 backdrop-blur-sm border-white/[0.06] text-surface-100 placeholder:text-surface-500',
  filled: 'bg-white/[0.04] border-transparent text-surface-100 placeholder:text-surface-500',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      variant = 'default',
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      disabled,
      className,
      id,
      ...props
    },
    ref,
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-surface-300">
            {label}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-surface-400">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={clsx(
              'block w-full rounded-lg border px-3 py-2 text-sm',
              'transition-colors duration-150',
              'focus-ring',
              'disabled:cursor-not-allowed disabled:opacity-50',
              variantClasses[variant],
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              error ? 'border-error-500 focus:border-error-500 focus:ring-error-500/30' : '',
              className,
            )}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={
              error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
            }
            {...props}
          />

          {rightIcon && (
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-surface-400">
              {rightIcon}
            </div>
          )}
        </div>

        {error && (
          <p id={`${inputId}-error`} className="mt-1.5 text-sm text-error-500" role="alert">
            {error}
          </p>
        )}

        {!error && helperText && (
          <p id={`${inputId}-helper`} className="mt-1.5 text-sm text-surface-500">
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
