import { LogOut, Moon, Sun, Wifi } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { useUIStore } from '../../stores/uiStore'
import { useAuthStore } from '../../stores/authStore'
import { logoutApi } from '../../api/auth'

export default function Header() {
  const { theme, toggleTheme, wsStatus, serviceStatus } = useUIStore()
  const { username, logout } = useAuthStore()
  const nav = useNavigate()

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between h-14 px-6">
        {/* Status pills */}
        <div className="flex items-center gap-3">
          {[
            { k: 'suricata', l: 'Suricata' },
            { k: 'ntopng', l: 'ntopng' },
            { k: 'mikrotik', l: 'MikroTik' },
            { k: 'deepseek', l: 'DeepSeek' },
          ].map(({ k, l }) => {
            const s = serviceStatus[k] || 'unknown'
            return (
              <div key={k} className="flex items-center gap-1.5">
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  s === 'online' ? 'bg-green-500' : s === 'offline' ? 'bg-destructive' : 'bg-muted-foreground/30'
                )} />
                <span className="text-xs text-muted-foreground hidden sm:inline">{l}</span>
              </div>
            )
          })}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* WS */}
          <span className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-md border',
            wsStatus === 'connected' ? 'bg-green-50 text-green-700 border-green-200' :
            wsStatus === 'connecting' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
            'bg-red-50 text-red-700 border-red-200'
          )}>
            {wsStatus === 'connected' ? 'Live' : wsStatus === 'connecting' ? '...' : 'Off'}
          </span>

          <span className="text-xs text-muted-foreground hidden sm:inline">{username || 'admin'}</span>

          <button onClick={toggleTheme} className="p-2 rounded-md hover:bg-accent text-muted-foreground">
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          <button onClick={async () => { await logoutApi(); logout(); nav('/login') }}
            className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-destructive">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
