'use client';

import { useEffect, useCallback, type ReactNode, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { X } from 'lucide-react';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Callback when the modal should close */
  onClose: () => void;
  /** Modal title shown in the header */
  title?: string;
  /** Modal size */
  size?: ModalSize;
  /** Modal body content */
  children: ReactNode;
  /** Optional footer content */
  footer?: ReactNode;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

/**
 * Portal-based modal component with backdrop overlay.
 * Closes on Escape key press and backdrop click.
 * Animated with CSS transitions for smooth open/close.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  size = 'md',
  children,
  footer,
}: ModalProps): JSX.Element | null {
  const handleEscape = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleEscape]);

  const handleBackdropClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div
        className={clsx(
          'relative z-10 w-full animate-scale-in',
          'rounded-xl border border-surface-700 bg-surface-900 shadow-xl',
          sizeClasses[size],
        )}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between border-b border-surface-700 px-6 py-4">
            <h2 id="modal-title" className="text-lg font-semibold text-surface-100">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-4">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-surface-700 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
