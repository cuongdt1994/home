import { create } from 'zustand'
import type { Alert } from '../types'

interface AlertState {
  alerts: Alert[]
  recentAlerts: Alert[]
  addAlert: (alert: Alert) => void
  setAlerts: (alerts: Alert[]) => void
  setRecentAlerts: (alerts: Alert[]) => void
}

export const useAlertStore = create<AlertState>((set) => ({
  alerts: [],
  recentAlerts: [],
  addAlert: (alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts].slice(0, 500),
      recentAlerts: [alert, ...state.recentAlerts].slice(0, 50),
    })),
  setAlerts: (alerts) => set({ alerts }),
  setRecentAlerts: (alerts) => set({ recentAlerts: alerts }),
}))
