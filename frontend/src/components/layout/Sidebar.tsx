import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, Shield, Activity, Router, Brain, X, Wifi, ChevronRight } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { cn } from '../../lib/utils'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true, gradient: 'from-brand-400 to-brand-600' },
  { to: '/suricata', icon: Shield, label: 'Suricata IDS', gradient: 'from-rose-400 to-rose-600' },
  { to: '/ntopng', icon: Activity, label: 'Traffic', gradient: 'from-cyan-400 to-cyan-600' },
  { to: '/mikrotik', icon: Router, label: 'MikroTik', gradient: 'from-amber-400 to-amber-600' },
  { to: '/ai', icon: Brain, label: 'AI Security', gradient: 'from-violet-400 to-violet-600' },
]

export default function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useUIStore()
  const location = useLocation()

  return (
    <>
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)} />
        )}
      </AnimatePresence>

      <motion.aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full flex flex-col w-72',
          'lg:translate-x-0', !sidebarOpen && '-translate-x-full'
        )}
        style={{ background: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)' }}
        animate={{ x: sidebarOpen ? 0 : -288 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {/* Logo */}
        <div className="px-6 py-6 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #5c7cfa, #8b5cf6)' }}>
                <Wifi className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-white text-sm tracking-wide">LAN MONITOR</h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Dashboard v2</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-xl hover:bg-white/10 text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          <p className="px-3 text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-3">Navigation</p>
          {navItems.map((item) => {
            const isActive = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
            return (
              <NavLink key={item.to} to={item.to} end={item.end}
                onClick={() => { if (window.innerWidth < 1024) setSidebarOpen(false) }}
                className={cn(
                  'group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-200 relative overflow-hidden',
                  isActive
                    ? 'text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                )}>
                {isActive && (
                  <motion.div layoutId="sidebar-active" className="absolute inset-0 rounded-2xl bg-white/10"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }} />
                )}
                <span className="relative z-10">
                  <item.icon className={cn('w-5 h-5 transition-colors', isActive && 'drop-shadow-lg')} />
                </span>
                <span className="relative z-10">{item.label}</span>
                {isActive && <ChevronRight className="w-4 h-4 ml-auto relative z-10" />}
              </NavLink>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-glow" />
            <span className="text-xs text-slate-500">System Online</span>
          </div>
        </div>
      </motion.aside>
    </>
  )
}
