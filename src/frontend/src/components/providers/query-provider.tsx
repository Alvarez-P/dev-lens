'use client';

import { type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';

interface QueryProviderProps {
  children: ReactNode;
}

/**
 * Client component that wraps the application with React Query's QueryClientProvider.
 * Must be imported in the root layout.
 */
export function QueryProvider({ children }: QueryProviderProps): JSX.Element {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
