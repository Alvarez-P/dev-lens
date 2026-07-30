import { create } from 'zustand';

type Theme = 'light' | 'dark';

interface AppState {
  isSidebarOpen: boolean;

  theme: Theme;

  toggleSidebar: () => void;

  setSidebarOpen: (open: boolean) => void;

  setTheme: (theme: Theme) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isSidebarOpen: true,
  theme: 'dark',

  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  setTheme: (theme) => set({ theme }),
}));
