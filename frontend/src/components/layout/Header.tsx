import { Menu, Moon, Sun, Wifi, WifiOff, LogOut, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import WebSocketStatus from '../shared/WebSocketStatus'
import { useUIStore } from '../../stores/uiStore'
import { useAuthStore } from '../../stores/authStore'
import { logoutApi } from '../../api/auth'
import { cn } from '../../lib/utils'

const serviceNames: Record<string, string> = {
  suricata: 'Suricata',
  ntopng: 'ntopng',
  mikrotik: 'MikroTik',
  deepseek: 'DeepSeek',
}

export default function Header() {
  const { toggleSidebar, theme, toggleTheme, wsStatus, serviceStatus } = useUIStore()
  const { username, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logoutApi()
    logout()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-surface-200">
      <div className="flex items-center justify-between px-4 md:px-6 h-16">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-xl hover:bg-surface-100 transition-colors"
          >
            <Menu className="w-5 h-5 text-surface-600" />
          </button>
          <div className="hidden sm:flex items-center gap-2">
            {Object.entries(serviceStatus).map(([key, status]) => (
              <div
                key={key}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                  status === 'online'
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : status === 'offline'
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-surface-100 text-surface-500 border-surface-200'
                )}
              >
                {status === 'online' ? (
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 pulse-live" />
                ) : status === 'offline' ? (
                  <WifiOff className="w-3 h-3" />
                ) : (
                  <Wifi className="w-3 h-3" />
                )}
                {serviceNames[key]}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* WebSocket status */}
          <WebSocketStatus status={wsStatus} />

          {/* User info */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-surface-600">
            <User className="w-3.5 h-3.5" />
            <span>{username || 'admin'}</span>
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl hover:bg-surface-100 transition-colors"
            title={theme === 'light' ? 'Dark mode' : 'Light mode'}
          >
            {theme === 'light' ? (
              <Moon className="w-5 h-5 text-surface-600" />
            ) : (
              <Sun className="w-5 h-5 text-surface-600" />
            )}
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl hover:bg-red-50 text-surface-400 hover:text-red-500 transition-colors"
            title="Đăng xuất"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  )
}
