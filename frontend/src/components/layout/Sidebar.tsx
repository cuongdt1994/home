import { useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Shield,
  Activity,
  Router,
  Brain,
  ChevronLeft,
  Wifi,
  X,
} from 'lucide-react'
import { cn } from '../../lib/utils'

const NAV_ITEMS = [
  { to: '/',         icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/suricata', icon: Shield,          label: 'Suricata' },
  { to: '/ntopng',   icon: Activity,        label: 'Traffic' },
  { to: '/mikrotik', icon: Router,          label: 'MikroTik' },
  { to: '/ai',       icon: Brain,           label: 'AI Security' },
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

  // Close mobile sidebar on route change
  useEffect(() => {
    onMobileClose()
  }, [loc.pathname])

  // Close mobile sidebar on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        mobileOpen &&
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target as Node)
      ) {
        onMobileClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [mobileOpen, onMobileClose])

  // Lock body scroll when mobile sidebar is open
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
        'transition-all duration-300 ease-in-out',
        open ? 'w-60' : 'w-16',
      )}
    >
      {/* ── Logo ─────────────────────────── */}
      <div
        className={cn(
          'flex items-center h-14 px-3 border-b border-sidebar-border shrink-0',
          open ? 'gap-3' : 'justify-center',
        )}
      >
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-sm shadow-primary/25">
          <Wifi className="w-4 h-4 text-primary-foreground" />
        </div>
        {open && (
          <span className="font-bold text-sm text-sidebar-accent-foreground tracking-tight whitespace-nowrap">
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
                'flex items-center rounded-lg text-sm font-medium transition-all duration-150',
                open ? 'gap-3 px-3 py-2.5' : 'justify-center p-2.5',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
              )}
            >
              <item.icon
                className={cn(
                  'w-5 h-5 shrink-0 transition-colors',
                  active && 'text-sidebar-primary',
                )}
              />
              {open && <span className="whitespace-nowrap">{item.label}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* ── Collapse toggle (desktop) ────── */}
      <div className="p-2 border-t border-sidebar-border shrink-0">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center p-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          title={open ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <ChevronLeft
            className={cn(
              'w-4 h-4 transition-transform duration-300',
              !open && 'rotate-180',
            )}
          />
        </button>
      </div>
    </aside>
  )

  return (
    <>
      {/* ── Desktop: persistent ──────────── */}
      <div className="hidden md:block">{sidebarContent}</div>

      {/* ── Mobile: overlay drawer ───────── */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden animate-fade-in"
            onClick={onMobileClose}
          />

          {/* Drawer */}
          <div
            className={cn(
              'fixed inset-y-0 left-0 z-50 w-60 md:hidden',
              'animate-slide-down',
            )}
          >
            {/* Close button */}
            <button
              onClick={onMobileClose}
              className="absolute top-3 right-3 z-10 p-1.5 rounded-lg bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-muted hover:text-sidebar-accent-foreground transition-colors"
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
