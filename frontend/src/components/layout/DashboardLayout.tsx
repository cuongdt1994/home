import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import Header from './Header'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useUIStore } from '../../stores/uiStore'
import { useAlertStore } from '../../stores/alertStore'
import { cn } from '../../lib/utils'

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { setWsStatus } = useUIStore()
  const addAlert = useAlertStore((s) => s.addAlert)
  const loc = useLocation()

  // Auto-collapse on mobile
  useEffect(() => { if (window.innerWidth < 768) setSidebarOpen(false) }, [loc.pathname])

  useWebSocket((msg) => {
    switch (msg.type) {
      case 'connected': setWsStatus('connected'); break
      case 'alert': addAlert(msg.payload); break
      case 'heartbeat': setWsStatus('connected'); break
    }
  })

  return (
    <div className="min-h-screen bg-background">
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <div className={cn('transition-all duration-200', sidebarOpen ? 'md:ml-60' : 'md:ml-16')}>
        <Header />

        {/* Mobile menu button */}
        <div className="md:hidden flex items-center gap-2 px-4 py-2 border-b border-border">
          <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 rounded-md hover:bg-accent">
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold">LAN Monitor</span>
        </div>

        <main className="p-6 max-w-[1600px] mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
