import { create } from 'zustand'

interface UIState {
  sidebarOpen: boolean
  theme: 'light' | 'dark'
  wsStatus: 'connecting' | 'connected' | 'disconnected'
  serviceStatus: Record<string, 'online' | 'offline' | 'unknown'>
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  toggleTheme: () => void
  setWsStatus: (s: UIState['wsStatus']) => void
  setServiceStatus: (name: string, s: 'online' | 'offline' | 'unknown') => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  theme: 'light',
  wsStatus: 'disconnected',
  serviceStatus: {
    suricata: 'unknown',
    ntopng: 'unknown',
    mikrotik: 'unknown',
    deepseek: 'unknown',
  },
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
  setWsStatus: (wsStatus) => set({ wsStatus }),
  setServiceStatus: (name, s) =>
    set((state) => ({ serviceStatus: { ...state.serviceStatus, [name]: s } })),
}))
