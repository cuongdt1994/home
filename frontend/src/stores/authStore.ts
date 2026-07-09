import { create } from 'zustand'

interface AuthState {
  token: string | null
  username: string | null
  isAuthenticated: boolean
  login: (token: string, username: string) => void
  logout: () => void
  setToken: (token: string) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('access_token'),
  username: localStorage.getItem('username'),
  isAuthenticated: !!localStorage.getItem('access_token'),

  login: (token, username) => {
    localStorage.setItem('access_token', token)
    localStorage.setItem('username', username)
    set({ token, username, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('username')
    set({ token: null, username: null, isAuthenticated: false })
  },

  setToken: (token) => {
    localStorage.setItem('access_token', token)
    set({ token, isAuthenticated: true })
  },
}))
