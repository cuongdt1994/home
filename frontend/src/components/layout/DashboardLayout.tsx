import { useState, useEffect, useCallback } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useUIStore } from '../../stores/uiStore'
import { useAlertStore } from '../../stores/alertStore'

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { setWsStatus } = useUIStore()
  const addAlert = useAlertStore((s) => s.addAlert)
  const loc = useLocation()

  /* ── Responsive sidebar ──────────────── */
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const handle = (e: MediaQueryListEvent | MediaQueryList) => {
      setSidebarOpen(!e.matches)
    }
    handle(mq)
    mq.addEventListener('change', handle)
    return () => mq.removeEventListener('change', handle)
  }, [])

  /* ── Close mobile drawer on nav ──────── */
  useEffect(() => { setMobileOpen(false) }, [loc.pathname])

  /* ── WebSocket ───────────────────────── */
  const handleWs = useCallback((msg: any) => {
    switch (msg.type) {
      case 'connected': setWsStatus('connected'); break
      case 'alert':     addAlert(msg.payload);    break
      case 'heartbeat': setWsStatus('connected'); break
    }
  }, [setWsStatus, addAlert])
  useWebSocket(handleWs)

  return (
    <div className="min-h-screen bg-apple-bg flex">
      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        mobileOpen={mobileOpen}
        onToggle={() => setSidebarOpen(p => !p)}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMobileMenuOpen={() => setMobileOpen(true)} />

        <main className="flex-1 p-5 sm:p-8 lg:p-10 max-w-[1680px] w-full mx-auto">
          <Outlet />
        </main>

        <footer className="px-8 py-4 text-center text-xs text-apple-text-secondary tracking-tight">
          LAN Monitor &copy; {new Date().getFullYear()}
          <span className="mx-1.5 text-apple-text-tertiary">&bull;</span>
          Network Security Dashboard
        </footer>
      </div>
    </div>
  )
}
