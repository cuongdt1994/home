import { Menu, LogOut, Moon, Sun } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { useUIStore } from '../../stores/uiStore'
import { useAuthStore } from '../../stores/authStore'
import { logoutApi } from '../../api/auth'
import { Badge } from '../ui/Badge'

const SERVICES = [
  { key: 'suricata', label: 'Suricata' },
  { key: 'ntopng',   label: 'ntopng' },
  { key: 'mikrotik', label: 'MikroTik' },
  { key: 'deepseek', label: 'DeepSeek' },
] as const

interface HeaderProps {
  onMobileMenuOpen: () => void
}

export default function Header({ onMobileMenuOpen }: HeaderProps) {
  const { theme, toggleTheme, wsStatus, serviceStatus } = useUIStore()
  const { username, logout } = useAuthStore()
  const nav = useNavigate()

  const handleLogout = async () => {
    await logoutApi()
    logout()
    nav('/login')
  }

  const wsVariant =
    wsStatus === 'connected' ? 'green' :
    wsStatus === 'connecting' ? 'orange' : 'red'

  const wsLabel =
    wsStatus === 'connected' ? 'Live' :
    wsStatus === 'connecting' ? 'Connecting...' : 'Offline'

  return (
    <header className="sticky top-0 z-30 glass border-b border-white/20">
      <div className="flex items-center justify-between h-14 px-5 sm:px-7">
        {/* ── Left ────────────────────────── */}
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={onMobileMenuOpen}
            className="p-2 -ml-2 rounded-full hover:bg-black/5 text-apple-text-secondary md:hidden shrink-0 transition-colors duration-200"
            aria-label="Open menu"
          >
            <Menu className="w-[18px] h-[18px]" />
          </button>

          {/* Service pills — desktop */}
          <div className="hidden sm:flex items-center gap-2">
            {SERVICES.map(({ key, label }) => {
              const s = serviceStatus[key] || 'unknown'
              return (
                <Badge
                  key={key}
                  variant={
                    s === 'online' ? 'green' :
                    s === 'offline' ? 'red' : 'default'
                  }
                  size="sm"
                  dot
                >
                  {label}
                </Badge>
              )
            })}
          </div>

          {/* Compact dots — mobile */}
          <div className="flex sm:hidden items-center gap-2">
            {SERVICES.map(({ key }) => {
              const s = serviceStatus[key] || 'unknown'
              return (
                <span
                  key={key}
                  className={cn(
                    'w-2 h-2 rounded-full transition-colors duration-300',
                    s === 'online' ? 'bg-apple-green shadow-[0_0_6px_rgba(52,199,89,0.5)]' :
                    s === 'offline' ? 'bg-apple-red' : 'bg-apple-border',
                  )}
                  title={key}
                />
              )
            })}
          </div>
        </div>

        {/* ── Right ───────────────────────── */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* WS badge */}
          <Badge variant={wsVariant} size="sm" dot className="hidden sm:inline-flex">
            {wsLabel}
          </Badge>

          <span className="text-[13px] text-apple-text-secondary font-medium hidden sm:inline-block max-w-[100px] truncate ml-2">
            {username || 'admin'}
          </span>

          <div className="w-px h-4 bg-apple-border-light hidden sm:block mx-1" />

          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-black/5 text-apple-text-secondary hover:text-apple-text transition-colors duration-200"
            title={`Sang chế độ ${theme === 'light' ? 'tối' : 'sáng'}`}
          >
            {theme === 'light' ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />}
          </button>

          <button
            onClick={handleLogout}
            className="p-2 rounded-full hover:bg-apple-red/10 text-apple-text-secondary hover:text-apple-red transition-colors duration-200"
            title="Đăng xuất"
          >
            <LogOut className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>
    </header>
  )
}
