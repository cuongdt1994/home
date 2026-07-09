import { Menu, Sun, Moon, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import WebSocketStatus from '../shared/WebSocketStatus'
import { useUIStore } from '../../stores/uiStore'
import { useAuthStore } from '../../stores/authStore'
import { logoutApi } from '../../api/auth'
import { cn } from '../../lib/utils'

const services = [
  { key: 'suricata', label: 'Suricata' },
  { key: 'ntopng', label: 'ntopng' },
  { key: 'mikrotik', label: 'MikroTik' },
  { key: 'deepseek', label: 'DeepSeek' },
]

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
    <header className="sticky top-0 z-30 glass border-b border-white/20">
      <div className="flex items-center justify-between px-5 md:px-8 h-[72px]">
        <div className="flex items-center gap-4">
          <button onClick={toggleSidebar}
            className="p-2.5 rounded-xl hover:bg-white/50 transition-all">
            <Menu className="w-5 h-5 text-slate-600" />
          </button>

          <div className="hidden md:flex items-center gap-2">
            {services.map((s) => {
              const status = serviceStatus[s.key] || 'unknown'
              return (
                <div key={s.key} className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all border',
                  status === 'online' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  status === 'offline' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                  'bg-slate-50 text-slate-500 border-slate-200'
                )}>
                  <span className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    status === 'online' ? 'bg-emerald-500 animate-pulse-glow' :
                    status === 'offline' ? 'bg-rose-500' : 'bg-slate-300'
                  )} />
                  {s.label}
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <WebSocketStatus status={wsStatus} />

          <span className="hidden sm:block text-xs font-medium text-slate-500 bg-white/50 px-3 py-1.5 rounded-full">
            {username || 'admin'}
          </span>

          <button onClick={toggleTheme}
            className="p-2.5 rounded-xl hover:bg-white/50 transition-all text-slate-500">
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          <button onClick={handleLogout}
            className="p-2.5 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-all">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
