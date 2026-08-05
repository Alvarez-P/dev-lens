'use client';

import { type ReactNode, useEffect, useState, useCallback } from 'react';
import { clsx } from 'clsx';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

export interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

const typeStyles: Record<ToastType, string> = {
  success: 'border-success-500/30 bg-success-500/10 text-success-400',
  error: 'border-error-500/30 bg-error-500/10 text-error-400',
  warning: 'border-warning-500/30 bg-warning-500/10 text-warning-400',
  info: 'border-primary-500/30 bg-primary-500/10 text-primary-400',
};

const typeIcons: Record<ToastType, ReactNode> = {
  success: <CheckCircle className="h-5 w-5" />,
  error: <AlertCircle className="h-5 w-5" />,
  warning: <AlertTriangle className="h-5 w-5" />,
  info: <Info className="h-5 w-5" />,
};

export function Toast({ toast, onDismiss }: ToastProps): React.ReactNode {
  const { id, message, type, duration = 5000 } = toast;
  const [isExiting, setIsExiting] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onDismiss(id), 200);
  }, [id, onDismiss]);

  useEffect(() => {
    const timer = setTimeout(handleDismiss, duration);
    return () => clearTimeout(timer);
  }, [duration, handleDismiss]);

  return (
    <div
      role="alert"
      className={clsx(
        'flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-md',
        'min-w-[320px] max-w-[420px]',
        'animate-slide-in',
        isExiting && 'animate-fade-in opacity-0',
        typeStyles[type],
      )}
    >
      <span className="mt-0.5 shrink-0">{typeIcons[type]}</span>
      <p className="flex-1 text-sm">{message}</p>
      <button
        onClick={handleDismiss}
        className="shrink-0 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
