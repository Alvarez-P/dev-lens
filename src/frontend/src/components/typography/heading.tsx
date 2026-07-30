import { type ReactNode, type ElementType } from 'react';
import { clsx } from 'clsx';

type HeadingLevel = 1 | 2 | 3 | 4;

export interface HeadingProps {
  /** Heading level (1-4) */
  level: HeadingLevel;
  /** Heading content */
  children: ReactNode;
  /** Additional class names */
  className?: string;
}

const levelStyles: Record<HeadingLevel, string> = {
  1: 'text-4xl font-bold tracking-tight',
  2: 'text-3xl font-bold tracking-tight',
  3: 'text-2xl font-semibold tracking-tight',
  4: 'text-xl font-semibold',
};

const levelTags: Record<HeadingLevel, ElementType> = {
  1: 'h1',
  2: 'h2',
  3: 'h3',
  4: 'h4',
};

/**
 * Heading component with consistent typography.
 * Renders the appropriate HTML heading tag based on level.
 */
export function Heading({ level, children, className }: HeadingProps): JSX.Element {
  const Tag = levelTags[level];

  return <Tag className={clsx('text-surface-100', levelStyles[level], className)}>{children}</Tag>;
}
