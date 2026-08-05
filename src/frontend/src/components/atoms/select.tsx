'use client';

import { forwardRef, type SelectHTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;

  error?: string;

  helperText?: string;

  options: SelectOption[];

  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, options, placeholder, disabled, className, id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-surface-300">
            {label}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            className={clsx(
              'block w-full appearance-none rounded-lg border bg-surface-900/60 backdrop-blur-sm px-3 py-2 pr-10 text-sm text-surface-100',
              'transition-colors duration-150',
              'focus-ring',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error
                ? 'border-error-500 focus:border-error-500 focus:ring-error-500/30'
                : 'border-white/[0.06] focus:border-primary-500/50',
              className,
            )}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={
              error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined
            }
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-surface-400">
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>

        {error && (
          <p id={`${selectId}-error`} className="mt-1.5 text-sm text-error-500" role="alert">
            {error}
          </p>
        )}

        {!error && helperText && (
          <p id={`${selectId}-helper`} className="mt-1.5 text-sm text-surface-500">
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Select.displayName = 'Select';
