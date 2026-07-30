import { type ReactNode, type ElementType } from 'react';
import { clsx } from 'clsx';

type TextVariant = 'body' | 'caption' | 'label' | 'code';

export interface TextProps {
  /** Text variant */
  variant?: TextVariant;
  /** Whether to use muted styling */
  muted?: boolean;
  /** Content */
  children: ReactNode;
  /** Additional class names */
  className?: string;
  /** HTML element to render as (polymorphic) */
  as?: ElementType;
}

const variantStyles: Record<TextVariant, string> = {
  body: 'text-base',
  caption: 'text-sm',
  label: 'text-sm font-medium',
  code: 'text-sm font-mono rounded bg-surface-800 px-1.5 py-0.5',
};

const defaultTags: Record<TextVariant, ElementType> = {
  body: 'p',
  caption: 'span',
  label: 'label',
  code: 'code',
};

/**
 * Text component with consistent typography.
 * Polymorphic — renders as the specified `as` element or a sensible default.
 */
export function Text({
  variant = 'body',
  muted = false,
  children,
  className,
  as,
}: TextProps): JSX.Element {
  const Tag = as || defaultTags[variant];

  return (
    <Tag
      className={clsx(
        variantStyles[variant],
        muted ? 'text-surface-400' : 'text-surface-200',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
