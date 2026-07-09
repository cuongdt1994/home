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

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="flex items-center justify-between h-14 px-4 sm:px-6">
        {/* ── Left: mobile trigger + service pills ── */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile sidebar trigger */}
          <button
            onClick={onMobileMenuOpen}
            className="p-2 -ml-2 rounded-lg hover:bg-accent text-muted-foreground md:hidden shrink-0"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Service status pills */}
          <div className="hidden sm:flex items-center gap-2 flex-wrap">
            {SERVICES.map(({ key, label }) => {
              const status = serviceStatus[key] || 'unknown'
              return (
                <Badge
                  key={key}
                  variant={
                    status === 'online' ? 'success' :
                    status === 'offline' ? 'destructive' : 'default'
                  }
                  size="sm"
                  dot
                >
                  {label}
                </Badge>
              )
            })}
          </div>

          {/* Compact status dots on mobile */}
          <div className="flex sm:hidden items-center gap-1.5">
            {SERVICES.map(({ key }) => {
              const status = serviceStatus[key] || 'unknown'
              return (
                <span
                  key={key}
                  className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    status === 'online' ? 'bg-emerald-500' :
                    status === 'offline' ? 'bg-red-500' : 'bg-slate-300',
                  )}
                  title={key}
                />
              )
            })}
          </div>
        </div>

        {/* ── Right: WS status, user, theme, logout ── */}
        <div className="flex items-center gap-2 shrink-0">
          {/* WebSocket indicator */}
          <Badge
            variant={
              wsStatus === 'connected' ? 'success' :
              wsStatus === 'connecting' ? 'warning' : 'destructive'
            }
            size="sm"
            dot
            className="hidden sm:inline-flex"
          >
            {wsStatus === 'connected' ? 'Live' : wsStatus === 'connecting' ? '...' : 'Off'}
          </Badge>

          {/* Username */}
          <span className="text-xs text-muted-foreground font-medium hidden sm:inline-block max-w-[100px] truncate">
            {username || 'admin'}
          </span>

          <div className="w-px h-5 bg-border hidden sm:block" />

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? (
              <Moon className="w-4 h-4" />
            ) : (
              <Sun className="w-4 h-4" />
            )}
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-destructive transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
