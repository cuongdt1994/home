import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Shield, Activity, Router, Brain, ChevronLeft, Wifi } from 'lucide-react'
import { cn } from '../../lib/utils'

const items = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/suricata', icon: Shield, label: 'Suricata' },
  { to: '/ntopng', icon: Activity, label: 'Traffic' },
  { to: '/mikrotik', icon: Router, label: 'MikroTik' },
  { to: '/ai', icon: Brain, label: 'AI Security' },
]

interface Props {
  open: boolean
  onToggle: () => void
}

export default function Sidebar({ open, onToggle }: Props) {
  const loc = useLocation()

  return (
    <aside className={cn(
      'fixed top-0 left-0 z-40 h-full flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-200',
      open ? 'w-60' : 'w-16'
    )}>
      {/* Logo */}
      <div className={cn('flex items-center h-14 px-4 border-b border-sidebar-border', open ? 'gap-3' : 'justify-center')}>
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Wifi className="w-4 h-4 text-primary-foreground" />
        </div>
        {open && <span className="font-semibold text-sm text-sidebar-primary">LAN Monitor</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {items.map((item) => {
          const active = item.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(item.to)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'flex items-center rounded-lg text-sm font-medium transition-colors',
                open ? 'gap-3 px-3 py-2' : 'justify-center p-2.5',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {open && <span>{item.label}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* Collapse button */}
      <div className="p-2 border-t border-sidebar-border">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center p-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <ChevronLeft className={cn('w-4 h-4 transition-transform', !open && 'rotate-180')} />
        </button>
      </div>
    </aside>
  )
}
