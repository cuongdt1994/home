import { Menu, LogOut, Moon, Sun, CheckCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { useUIStore } from '../../stores/uiStore'
import { useAuthStore } from '../../stores/authStore'
import { logoutApi } from '../../api/auth'
import { Badge } from '../ui/Badge'

interface TopbarProps {
  onMobileMenuOpen: () => void
}

export default function Topbar({ onMobileMenuOpen }: TopbarProps) {
  const { theme, toggleTheme, wsStatus } = useUIStore()
  const { username, logout } = useAuthStore()
  const nav = useNavigate()

  const handleLogout = async () => {
    await logoutApi()
    logout()
    nav('/login')
  }

  return (
    <header className="sticky top-0 z-30 glass border-b border-white/5">
      <div className="flex items-center justify-between h-14 px-4 sm:px-6">
        {/* ── Left ────────────────────────── */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onMobileMenuOpen}
            className="p-2 -ml-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground md:hidden shrink-0 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-[18px] h-[18px]" />
          </button>

          {/* System status */}
          <Badge variant="success" size="sm" dot>
            <CheckCircle className="w-3 h-3 mr-0.5" />
            System Online
          </Badge>
        </div>

        {/* ── Right ───────────────────────── */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* WS status */}
          <Badge
            variant={
              wsStatus === 'connected' ? 'success' :
              wsStatus === 'connecting' ? 'warning' : 'destructive'
            }
            size="sm"
            dot
            className="hidden sm:inline-flex"
          >
            {wsStatus === 'connected' ? 'Live' : wsStatus === 'connecting' ? 'Connecting' : 'Offline'}
          </Badge>

          <span className="text-xs text-muted-foreground font-medium hidden sm:inline-block ml-1 max-w-[100px] truncate">
            {username || 'admin'}
          </span>

          <div className="w-px h-4 bg-border hidden sm:block mx-1" />

          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />}
          </button>

          <button
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>
    </header>
  )
}
