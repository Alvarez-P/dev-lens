'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { Toast, type ToastData, type ToastType } from './toast';

interface ToastContextType {
  toast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let toastIdCounter = 0;

function generateToastId(): string {
  toastIdCounter += 1;
  return `toast-${toastIdCounter}-${Date.now()}`;
}

/**
 * Provider component that manages toast notifications.
 * Wraps the app and provides the `useToast()` hook.
 * Toasts stack from the top-right corner.
 */
export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info', duration?: number) => {
    const newToast: ToastData = {
      id: generateToastId(),
      message,
      type,
      duration,
    };

    setToasts((prev) => [...prev, newToast]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}

      {/* Toast container — fixed position top-right */}
      <div
        className="pointer-events-none fixed right-4 top-4 z-[100] flex flex-col gap-2"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast toast={toast} onDismiss={dismissToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Hook to show toast notifications.
 *
 * @example
 * ```tsx
 * const { toast } = useToast();
 * toast('Operation successful', 'success');
 * toast('Something went wrong', 'error', 8000);
 * ```
 */
export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
