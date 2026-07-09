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

  // Auto-collapse sidebar on smaller screens
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const handle = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        setSidebarOpen(false)
      } else {
        setSidebarOpen(true)
      }
    }
    handle(mq)
    mq.addEventListener('change', handle)
    return () => mq.removeEventListener('change', handle)
  }, [])

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [loc.pathname])

  // WebSocket message handler
  const handleWsMessage = useCallback(
    (msg: any) => {
      switch (msg.type) {
        case 'connected':
          setWsStatus('connected')
          break
        case 'alert':
          addAlert(msg.payload)
          break
        case 'heartbeat':
          setWsStatus('connected')
          break
      }
    },
    [setWsStatus, addAlert],
  )

  useWebSocket(handleWsMessage)

  return (
    <div className="min-h-screen bg-background flex">
      {/* ── Sidebar ──────────────────────── */}
      <Sidebar
        open={sidebarOpen}
        mobileOpen={mobileOpen}
        onToggle={() => setSidebarOpen((prev) => !prev)}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* ── Main content area ────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMobileMenuOpen={() => setMobileOpen(true)} />

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>

        {/* Subtle footer */}
        <footer className="px-6 py-3 border-t border-border text-center text-xs text-muted-foreground">
          LAN Monitor &copy; {new Date().getFullYear()} &mdash; Network Security Dashboard
        </footer>
      </div>
    </div>
  )
}
