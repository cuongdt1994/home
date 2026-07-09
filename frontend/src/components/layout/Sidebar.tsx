import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Shield, Activity, Router, Brain, Settings, X, Wifi
} from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { cn } from '../../lib/utils'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/suricata', icon: Shield, label: 'Suricata' },
  { to: '/ntopng', icon: Activity, label: 'ntopng' },
  { to: '/mikrotik', icon: Router, label: 'MikroTik' },
  { to: '/ai', icon: Brain, label: 'AI Security' },
]

export default function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useUIStore()
  const location = useLocation()

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="fixed inset-0 bg-black/20 z-40 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full bg-white border-r border-surface-200',
          'flex flex-col w-64 shadow-sm',
          'lg:translate-x-0',
          !sidebarOpen && '-translate-x-full'
        )}
        animate={{ x: sidebarOpen ? 0 : -256 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-500 flex items-center justify-center">
              <Wifi className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-surface-900 text-sm">LAN Monitor</h1>
              <p className="text-xs text-surface-400">Network Dashboard</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-surface-100"
          >
            <X className="w-4 h-4 text-surface-500" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = item.end
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => {
                  if (window.innerWidth < 1024) setSidebarOpen(false)
                }}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium',
                  'transition-all duration-200 group',
                  isActive
                    ? 'bg-primary-50 text-primary-700 shadow-sm'
                    : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'
                )}
              >
                <item.icon className={cn(
                  'w-5 h-5 transition-colors',
                  isActive ? 'text-primary-500' : 'text-surface-400 group-hover:text-surface-600'
                )} />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-surface-100">
          <p className="text-xs text-surface-400 text-center">v1.0.0 · LAN Monitor</p>
        </div>
      </motion.aside>
    </>
  )
}
