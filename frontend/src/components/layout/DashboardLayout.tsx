import { useState, useEffect, useCallback } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
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

  /* Close mobile on route change */
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
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        mobileOpen={mobileOpen}
        onToggle={() => setSidebarOpen(prev => !prev)}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMobileMenuOpen={() => setMobileOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>

        <footer className="px-6 py-3 text-center text-[11px] text-muted-foreground border-t border-border">
          LAN Monitor &copy; {new Date().getFullYear()} &mdash; Network Security Dashboard
        </footer>
      </div>
    </div>
  )
}
