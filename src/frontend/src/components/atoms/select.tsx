'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
  type SelectHTMLAttributes,
} from 'react';
import { clsx } from 'clsx';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  placeholder?: string;
  /** Called with a synthetic event carrying `event.target.value`. */
  onChange?: (event: { target: { value: string } }) => void;
}

/**
 * Custom select with fully styled dark-theme dropdown.
 *
 * Replaces the native `<select>` which cannot style hover states or
 * dropdown borders consistently across browsers.
 */
export function Select({
  label,
  error,
  helperText,
  options,
  placeholder,
  disabled,
  className,
  id,
  value,
  defaultValue,
  onChange,
  ...props
}: SelectProps): React.ReactNode {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState<string>(
    (value as string) ?? defaultValue ?? '',
  );
  const [activeIndex, setActiveIndex] = useState(-1);
  const [focused, setFocused] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const currentValue = (value as string) ?? internalValue;
  const selectedOption = options.find((o) => o.value === currentValue);
  const displayLabel = selectedOption?.label ?? placeholder ?? 'Select...';

  // Sync external value changes
  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value as string);
    }
  }, [value]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const selectOption = useCallback(
    (optionValue: string) => {
      setInternalValue(optionValue);
      setOpen(false);
      triggerRef.current?.focus();

      if (onChange) {
        onChange({ target: { value: optionValue } });
      }
    },
    [onChange],
  );

  const scrollActiveIntoView = useCallback(() => {
    if (listRef.current && activeIndex >= 0) {
      const item = listRef.current.children[activeIndex] as HTMLElement | undefined;
      item?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [activeIndex]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!open) {
          setOpen(true);
          setActiveIndex(options.findIndex((o) => o.value === currentValue));
        } else {
          setActiveIndex((prev) => {
            const next = prev < options.length - 1 ? prev + 1 : 0;
            return next;
          });
        }
        break;

      case 'ArrowUp':
        event.preventDefault();
        if (!open) {
          setOpen(true);
          setActiveIndex(options.findIndex((o) => o.value === currentValue));
        } else {
          setActiveIndex((prev) => {
            const next = prev > 0 ? prev - 1 : options.length - 1;
            return next;
          });
        }
        break;

      case 'Enter':
      case ' ':
        event.preventDefault();
        if (open && activeIndex >= 0 && activeIndex < options.length) {
          selectOption(options[activeIndex].value);
        } else {
          setOpen(true);
          setActiveIndex(options.findIndex((o) => o.value === currentValue));
        }
        break;

      case 'Escape':
        event.preventDefault();
        setOpen(false);
        break;
    }
  };

  // Scroll active option into view when it changes
  useEffect(() => {
    if (open) scrollActiveIntoView();
  }, [activeIndex, open, scrollActiveIntoView]);

  return (
    <div ref={containerRef}>
      {label && (
        <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-surface-300">
          {label}
        </label>
      )}

      <div className="relative">
        <button
          ref={triggerRef}
          id={selectId}
          type="button"
          role="combobox"
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={
            error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined
          }
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onClick={() => {
            if (disabled) return;
            setOpen((prev) => !prev);
            if (!open) {
              setActiveIndex(options.findIndex((o) => o.value === currentValue));
            }
          }}
          onKeyDown={handleKeyDown}
          className={clsx(
            'flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm',
            'transition-colors duration-150',
            'focus-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error
              ? 'border-error-500 focus:border-error-500'
              : clsx(
                  'border-white/[0.08]',
                  focused || open
                    ? 'bg-surface-800'
                    : 'bg-surface-900/60 backdrop-blur-sm hover:border-white/[0.14]',
                ),
            currentValue ? 'text-surface-100' : 'text-surface-500',
            className,
          )}
          {...props}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronDown
            className={clsx(
              'ml-2 h-4 w-4 shrink-0 text-surface-400 transition-transform duration-150',
              open && 'rotate-180',
            )}
          />
        </button>

        {open && (
          <ul
            ref={listRef}
            role="listbox"
            aria-label={label ?? 'Options'}
            className={clsx(
              'absolute left-0 z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg',
              'border border-white/[0.08] bg-surface-900 py-1 shadow-lg shadow-black/40 backdrop-blur-xl',
              'animate-scale-in origin-top',
            )}
          >
            {options.map((option, index) => {
              const isSelected = option.value === currentValue;
              const isActive = index === activeIndex;

              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  id={`${selectId}-option-${index}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    selectOption(option.value);
                  }}
                  className={clsx(
                    'cursor-pointer px-3 py-2 text-sm transition-colors duration-75',
                    isActive && 'bg-primary-500/10 text-primary-200',
                    !isActive && isSelected && 'text-surface-100',
                    !isActive &&
                      !isSelected &&
                      'text-surface-300 hover:bg-white/[0.04] hover:text-surface-100',
                    isSelected && 'font-medium',
                  )}
                >
                  {option.label}
                </li>
              );
            })}
          </ul>
        )}
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
}

Select.displayName = 'Select';
