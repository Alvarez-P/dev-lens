'use client';

import { useEffect, useCallback, type ReactNode, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { X } from 'lucide-react';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps {
  isOpen: boolean;

  onClose: () => void;

  title?: string;

  size?: ModalSize;

  children: ReactNode;

  footer?: ReactNode;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

export function Modal({
  isOpen,
  onClose,
  title,
  size = 'md',
  children,
  footer,
}: ModalProps): React.ReactNode {
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
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md animate-fade-in"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      <div
        className={clsx(
          'relative z-10 w-full animate-scale-in',
          'rounded-xl border border-white/[0.05] bg-surface-900/90 backdrop-blur-xl shadow-xl shadow-black/40',
          sizeClasses[size],
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-white/[0.04] px-6 py-4">
            <h2 id="modal-title" className="text-lg font-semibold text-surface-100">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-surface-400 transition-colors hover:bg-white/[0.04] hover:text-surface-200"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        <div className="px-6 py-4">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-white/[0.04] px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
