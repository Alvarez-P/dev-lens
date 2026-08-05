import { type ReactNode, type ElementType } from 'react';
import { clsx } from 'clsx';

type TextVariant = 'body' | 'caption' | 'label' | 'code';

export interface TextProps {
  variant?: TextVariant;

  muted?: boolean;

  children: ReactNode;

  className?: string;

  as?: ElementType;
}

const variantStyles: Record<TextVariant, string> = {
  body: 'text-base',
  caption: 'text-sm',
  label: 'text-sm font-medium',
  code: 'text-sm font-mono rounded bg-white/[0.05] px-1.5 py-0.5',
};

const defaultTags: Record<TextVariant, ElementType> = {
  body: 'p',
  caption: 'span',
  label: 'label',
  code: 'code',
};

export function Text({
  variant = 'body',
  muted = false,
  children,
  className,
  as,
}: TextProps): React.ReactNode {
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
