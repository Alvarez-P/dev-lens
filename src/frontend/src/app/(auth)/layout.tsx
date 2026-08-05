import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }): React.ReactNode {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-950 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-primary-400">DevLens</h1>
        <p className="mt-1 text-sm text-surface-400">Software Intelligence Platform</p>
      </div>
      <div className="w-full max-w-md rounded-xl border border-white/[0.05] bg-surface-900/80 backdrop-blur-xl p-8 shadow-xl shadow-black/30">
        {children}
      </div>
    </div>
  );
}
