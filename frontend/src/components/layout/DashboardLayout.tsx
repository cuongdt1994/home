import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useUIStore } from '../../stores/uiStore'
import { useAlertStore } from '../../stores/alertStore'
import type { WSMessage } from '../../types'

export default function DashboardLayout() {
  const { setWsStatus, setServiceStatus } = useUIStore()
  const addAlert = useAlertStore((s) => s.addAlert)

  useWebSocket((msg: WSMessage) => {
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
      case 'traffic':
        // Handled by ntopng page
        break
      case 'analysis':
        // Handled by AI page
        break
    }
  })

  return (
    <div className="min-h-screen bg-surface-50">
      <Sidebar />
      <div className="lg:ml-64 transition-all duration-300">
        <Header />
        <main className="p-4 md:p-6 max-w-[1600px] mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-surface-200 z-40 lg:hidden">
        <div className="flex items-center justify-around h-14 px-2">
          {[
            { to: '/', label: 'Home', emoji: '📊' },
            { to: '/suricata', label: 'IDS', emoji: '🛡️' },
            { to: '/ntopng', label: 'Traffic', emoji: '📈' },
            { to: '/mikrotik', label: 'Router', emoji: '📡' },
            { to: '/ai', label: 'AI', emoji: '🧠' },
          ].map((item) => (
            <a
              key={item.to}
              href={item.to}
              className="flex flex-col items-center gap-0.5 text-[10px] font-medium text-surface-500 hover:text-primary-600"
            >
              <span className="text-lg">{item.emoji}</span>
              {item.label}
            </a>
          ))}
        </div>
      </nav>
      {/* Spacer for mobile bottom nav */}
      <div className="h-16 lg:h-0" />
    </div>
  )
}
