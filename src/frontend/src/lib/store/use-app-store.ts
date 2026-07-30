import { create } from 'zustand';

type Theme = 'light' | 'dark';

interface AppState {
  /** Whether the sidebar is open */
  isSidebarOpen: boolean;
  /** Current theme */
  theme: Theme;

  /** Toggle sidebar open/closed */
  toggleSidebar: () => void;
  /** Set sidebar state */
  setSidebarOpen: (open: boolean) => void;
  /** Set theme */
  setTheme: (theme: Theme) => void;
}

/**
 * Global application state store.
 * Manages UI state like sidebar visibility and theme.
 */
export const useAppStore = create<AppState>((set) => ({
  // State
  isSidebarOpen: true,
  theme: 'dark',

  // Actions
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  setTheme: (theme) => set({ theme }),
}));
