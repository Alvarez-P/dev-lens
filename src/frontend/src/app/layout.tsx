import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers/providers';

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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
