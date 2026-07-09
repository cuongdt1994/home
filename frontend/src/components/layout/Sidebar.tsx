import { useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Activity,
  Shield,
  Settings,
  ChevronLeft,
  Wifi,
  X,
} from 'lucide-react'
import { cn } from '../../lib/utils'

const NAV_ITEMS = [
  { to: '/',         icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/suricata', icon: Activity,        label: 'Network Traffic' },
  { to: '/ntopng',   icon: Shield,          label: 'Security Logs' },
  { to: '/mikrotik', icon: Settings,        label: 'Settings' },
]

interface SidebarProps {
  open: boolean
  mobileOpen: boolean
  onToggle: () => void
  onMobileClose: () => void
}

export default function Sidebar({ open, mobileOpen, onToggle, onMobileClose }: SidebarProps) {
  const loc = useLocation()
  const sidebarRef = useRef<HTMLElement>(null)

  /* Close mobile on route change */
  useEffect(() => { onMobileClose() }, [loc.pathname])

  /* Outside click → close mobile */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (mobileOpen && sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        onMobileClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [mobileOpen, onMobileClose])

  /* Lock body scroll when mobile open */
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const isActive = (to: string) =>
    to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to)

  const sidebarContent = (
    <aside
      ref={sidebarRef}
      className={cn(
        'h-full flex flex-col bg-sidebar border-r border-sidebar-border',
        'transition-all duration-300 ease-out',
        open ? 'w-60' : 'w-[64px]',
      )}
    >
      {/* ── Logo ─────────────────────────── */}
      <div className={cn(
        'flex items-center h-14 px-3 border-b border-sidebar-border shrink-0',
        open ? 'gap-3' : 'justify-center',
      )}>
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0 shadow-md shadow-accent/25">
          <Wifi className="w-4 h-4 text-white" />
        </div>
        {open && (
          <span className="font-semibold text-sm text-sidebar-accent-foreground tracking-tight whitespace-nowrap">
            LAN Monitor
          </span>
        )}
      </div>

      {/* ── Navigation ───────────────────── */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto sidebar-scroll">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.to)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'flex items-center rounded-lg text-sm font-medium transition-all duration-200',
                open ? 'gap-3 px-3 py-2.5' : 'justify-center p-2.5',
                active
                  ? 'bg-accent text-white shadow-md shadow-accent/20'
                  : 'text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-accent-foreground',
              )}
            >
              <item.icon className={cn('w-[18px] h-[18px] shrink-0')} />
              {open && <span className="whitespace-nowrap">{item.label}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* ── Collapse toggle ──────────────── */}
      <div className="p-2 border-t border-sidebar-border shrink-0">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center p-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-accent-foreground transition-colors"
          title={open ? 'Collapse' : 'Expand'}
        >
          <ChevronLeft className={cn(
            'w-[18px] h-[18px] transition-transform duration-300',
            !open && 'rotate-180',
          )} />
        </button>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop: persistent */}
      <div className="hidden md:block shrink-0">{sidebarContent}</div>

      {/* Mobile: overlay drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden animate-fade-in"
            onClick={onMobileClose}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-64 md:hidden animate-slide-down">
            <button
              onClick={onMobileClose}
              className="absolute top-3 right-3 z-10 p-1.5 rounded-lg bg-sidebar-hover text-sidebar-foreground hover:bg-zinc-700 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            {sidebarContent}
          </div>
        </>
      )}
    </>
  )
}
