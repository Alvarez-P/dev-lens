import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ui/theme-provider';
import { ToastProvider } from '@/components/ui/toast-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import { ErrorBoundary } from '@/components/ui/error-boundary';

export const metadata: Metadata = {
  title: 'DevLens',
  description:
    'DevLens — Software Intelligence Platform. Transform source code into living knowledge.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-surface-950 text-surface-50 antialiased">
        <ThemeProvider>
          <ErrorBoundary>
            <QueryProvider>
              <ToastProvider>{children}</ToastProvider>
            </QueryProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}
