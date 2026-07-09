import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useUIStore } from '../../stores/uiStore'
import { useAlertStore } from '../../stores/alertStore'
import type { WSMessage } from '../../types'

export default function DashboardLayout() {
  const { setWsStatus } = useUIStore()
  const addAlert = useAlertStore((s) => s.addAlert)

  useWebSocket((msg: WSMessage) => {
    switch (msg.type) {
      case 'connected': setWsStatus('connected'); break
      case 'alert': addAlert(msg.payload); break
      case 'heartbeat': setWsStatus('connected'); break
    }
  })

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #faf5ff 100%)' }}>
      <Sidebar />
      <div className="lg:ml-72 transition-all duration-300">
        <Header />
        <main className="p-5 md:p-8 max-w-[1600px] mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden"
        style={{ background: 'linear-gradient(180deg, rgba(15,23,42,0.95), rgba(30,27,75,0.98))' }}>
        <div className="flex items-center justify-around h-16 px-2">
          {[
            { to: '/', label: 'Home', icon: '🏠' },
            { to: '/suricata', label: 'IDS', icon: '🛡️' },
            { to: '/ntopng', label: 'Net', icon: '📊' },
            { to: '/mikrotik', label: 'Router', icon: '📡' },
            { to: '/ai', label: 'AI', icon: '🧠' },
          ].map((item) => (
            <a key={item.to} href={item.to}
              className="flex flex-col items-center gap-0.5 text-[10px] font-medium text-slate-400 hover:text-white transition-colors">
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </a>
          ))}
        </div>
      </nav>
      <div className="h-20 lg:h-0" />
    </div>
  )
}
