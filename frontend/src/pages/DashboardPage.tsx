import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Shield, Wifi, Activity, Cpu, Brain, TrendingUp, AlertTriangle, Zap, Globe } from 'lucide-react'
import StatCard from '../components/shared/StatCard'
import AlertTimeline from '../components/dashboard/AlertTimeline'
import TrafficChart from '../components/dashboard/TrafficChart'
import TopTalkers from '../components/dashboard/TopTalkers'
import DeviceMap from '../components/dashboard/DeviceMap'
import { getDashboardSummary, getMikrotikStatus, getTrafficHistory, getTopTalkers, getActiveHosts } from '../api/client'
import { useAlertStore } from '../stores/alertStore'
import { formatBytes } from '../lib/utils'
import type { DashboardStats, TrafficStat, Device } from '../types'

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [traffic, setTraffic] = useState<TrafficStat[]>([])
  const [router, setRouter] = useState<Record<string, any>>({})
  const [talkers, setTalkers] = useState<any[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const recentAlerts = useAlertStore((s) => s.recentAlerts)

  useEffect(() => {
    (async () => {
      try {
        const [dash, t, r, top, hosts] = await Promise.allSettled([
          getDashboardSummary(), getTrafficHistory(120),
          getMikrotikStatus().catch(() => ({})),
          getTopTalkers(10).catch(() => []), getActiveHosts().catch(() => []),
        ])
        if (dash.status === 'fulfilled' && dash.value?.stats) setStats(dash.value.stats)
        if (t.status === 'fulfilled') setTraffic(t.value || [])
        if (r.status === 'fulfilled') setRouter(r.value)
        if (top.status === 'fulfilled') setTalkers(top.value || [])
        if (hosts.status === 'fulfilled') {
          setDevices((hosts.value || []).map((h: any, i: number) => ({
            id: i, ip_address: h.ip || h.address || '?', mac_address: h.mac || null,
            hostname: h.name || null, vendor: null, device_type: 'unknown',
            first_seen: '', last_seen: '', is_online: true,
          })))
        }
      } catch {} finally { setLoading(false) }
    })()
    const t = setInterval(() => {
      getDashboardSummary().then(d => d?.stats && setStats(d.stats)).catch(() => {})
    }, 15000)
    return () => clearInterval(t)
  }, [])

  const latest = traffic[traffic.length - 1]
  const prev = traffic[traffic.length - 2]
  const trend = latest && prev ? ((latest.bytes_in + latest.bytes_out) > (prev.bytes_in + prev.bytes_out) ? 'up' : 'down') : undefined

  return (
    <div className="space-y-8 pb-20 lg:pb-0">
      {/* Hero */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard</h2>
          <p className="text-slate-500 mt-1.5 text-sm">Real-time network overview</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-glow" />
            <span className="text-xs font-semibold text-slate-600">Live Monitoring</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-semibold text-slate-600">{recentAlerts.length} alerts today</span>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-3xl border border-slate-100 p-5 h-[144px] animate-shimmer" />
          ))
        ) : (
          <>
            <StatCard icon={Shield} label="Total Alerts" value={(stats?.total_alerts ?? 0).toLocaleString()}
              sub={`${stats?.critical_alerts ?? 0} critical`} color="rose" delay={0} />
            <StatCard icon={Wifi} label="Online Devices"
              value={`${stats?.online_devices ?? 0}/${stats?.total_devices ?? 0}`} color="emerald" delay={1} />
            <StatCard icon={Activity} label="Bandwidth"
              value={latest ? formatBytes((latest.bytes_in + latest.bytes_out) || 0) + '/s' : '...'}
              color="brand" trend={trend} delay={2} />
            <StatCard icon={Cpu} label="Router CPU"
              value={router?.['cpu-load'] ? `${router['cpu-load']}%` : '...'}
              sub={router?.uptime || undefined} color="amber" delay={3} />
            <StatCard icon={Brain} label="AI Blocks" value={(stats?.total_blocks ?? 0).toLocaleString()}
              color="violet" delay={4} />
          </>
        )}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Traffic chart — 2/3 width */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-brand-50 text-brand-600"><TrendingUp className="w-5 h-5" /></div>
            <div>
              <h3 className="font-semibold text-slate-900">Network Traffic</h3>
              <p className="text-xs text-slate-400">Real-time bandwidth monitoring</p>
            </div>
          </div>
          {loading ? <div className="h-[260px] animate-shimmer rounded-2xl" /> : <TrafficChart data={traffic} height={260} />}
        </motion.div>

        {/* Recent alerts */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600"><AlertTriangle className="w-5 h-5" /></div>
            <div>
              <h3 className="font-semibold text-slate-900">Live Alerts</h3>
              <p className="text-xs text-slate-400">Latest Suricata events</p>
            </div>
          </div>
          <AlertTimeline alerts={recentAlerts} maxHeight="340px" />
        </motion.div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-cyan-50 text-cyan-600"><Globe className="w-5 h-5" /></div>
            <div>
              <h3 className="font-semibold text-slate-900">Top Talkers</h3>
              <p className="text-xs text-slate-400">Highest bandwidth consumers</p>
            </div>
          </div>
          {loading ? <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-8 animate-shimmer rounded-lg" />)}</div>
            : <TopTalkers talkers={talkers} limit={8} />}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-violet-50 text-violet-600"><Wifi className="w-5 h-5" /></div>
            <div>
              <h3 className="font-semibold text-slate-900">Network Devices</h3>
              <p className="text-xs text-slate-400">Discovered LAN devices</p>
            </div>
          </div>
          {loading ? <div className="grid grid-cols-3 gap-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 animate-shimmer rounded-2xl" />)}</div>
            : <DeviceMap devices={devices} />}
        </motion.div>
      </div>
    </div>
  )
}
