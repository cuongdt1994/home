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

  useEffect(() => { onMobileClose() }, [loc.pathname])

  /* Close mobile drawer on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (mobileOpen && sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        onMobileClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [mobileOpen, onMobileClose])

  /* Lock scroll khi mobile open */
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
        'h-full flex flex-col bg-sidebar-bg border-r border-sidebar-border',
        'transition-all duration-400 ease-out',
        open ? 'w-60' : 'w-[68px]',
      )}
    >
      {/* ── Logo ─────────────────────────── */}
      <div
        className={cn(
          'flex items-center h-14 px-3 border-b border-sidebar-border shrink-0',
          open ? 'gap-3' : 'justify-center',
        )}
      >
        <div className="w-8 h-8 rounded-xl bg-apple-blue flex items-center justify-center shrink-0 shadow-lg shadow-apple-blue/25">
          <Wifi className="w-4 h-4 text-white" />
        </div>
        {open && (
          <span className="font-semibold text-[15px] text-sidebar-text-hover tracking-tight whitespace-nowrap">
            LAN Monitor
          </span>
        )}
      </div>

      {/* ── Navigation ───────────────────── */}
      <nav className="flex-1 py-4 px-2.5 space-y-0.5 overflow-y-auto sidebar-scroll">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.to)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'flex items-center rounded-xl text-[14px] font-medium transition-all duration-200 ease-out',
                open ? 'gap-3 px-3 py-2.5' : 'justify-center p-2.5',
                active
                  ? 'bg-apple-blue text-sidebar-text-active shadow-lg shadow-apple-blue/20'
                  : 'text-sidebar-text hover:bg-sidebar-bg-hover hover:text-sidebar-text-hover',
              )}
            >
              <item.icon className={cn('w-[18px] h-[18px] shrink-0')} />
              {open && <span className="whitespace-nowrap">{item.label}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* ── Collapse button ──────────────── */}
      <div className="p-2.5 border-t border-sidebar-border shrink-0">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center p-2 rounded-xl text-sidebar-text hover:bg-sidebar-bg-hover hover:text-sidebar-text-hover transition-all duration-200"
          title={open ? 'Thu gọn' : 'Mở rộng'}
        >
          <ChevronLeft
            className={cn(
              'w-[18px] h-[18px] transition-transform duration-400 ease-out',
              !open && 'rotate-180',
            )}
          />
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
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden animate-fade-in"
            onClick={onMobileClose}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-64 md:hidden animate-slide-down">
            <button
              onClick={onMobileClose}
              className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-sidebar-bg-hover text-sidebar-text hover:bg-white/15 hover:text-white transition-colors"
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
