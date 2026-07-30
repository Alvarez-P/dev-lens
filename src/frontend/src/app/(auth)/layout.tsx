import type { ReactNode } from 'react';

/**
 * Auth pages layout.
 * Centered card layout with DevLens branding — no sidebar.
 */
export default function AuthLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-950 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-primary-400">DevLens</h1>
        <p className="mt-1 text-sm text-surface-400">Software Intelligence Platform</p>
      </div>
      <div className="w-full max-w-md rounded-xl border border-surface-800 bg-surface-900 p-8 shadow-xl">
        {children}
      </div>
    </div>
  );
}
