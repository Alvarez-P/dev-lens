import { create } from 'zustand';

export interface AIStreamState {
  chunks: string[];
  status: 'idle' | 'streaming' | 'done' | 'error';
  errorMessage: string | null;
}

export interface AIStore extends AIStreamState {
  appendChunk(content: string): void;
  setDone(): void;
  setError(message: string): void;
  reset(): void;
}

/**
 * AI streaming panel state (task 6.1, PR15).
 *
 * Follows the `useAppStore` Zustand pattern: `chunks` accumulates the
 * progressive tokens, `status` drives the panel's loading/streaming/done/error
 * UI states, and `reset()` returns to the pristine state for the next request.
 */
export const useAIStore = create<AIStore>((set) => ({
  chunks: [],
  status: 'idle',
  errorMessage: null,

  appendChunk: (content) =>
    set((state) => ({ chunks: [...state.chunks, content], status: 'streaming' })),
  setDone: () => set({ status: 'done' }),
  setError: (message) => set({ status: 'error', errorMessage: message }),
  reset: () => set({ chunks: [], status: 'idle', errorMessage: null }),
}));
