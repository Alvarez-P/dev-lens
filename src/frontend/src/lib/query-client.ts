import { QueryClient } from '@tanstack/react-query';

/**
 * Configured QueryClient with sensible defaults for the DevLens application.
 *
 * Defaults:
 * - staleTime: 30 seconds (data is fresh for 30s before refetch)
 * - retry: 1 (retry once on failure)
 * - refetchOnWindowFocus: false (no automatic refetch on tab switch)
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
