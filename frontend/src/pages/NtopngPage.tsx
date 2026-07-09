import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Activity, Globe, TrendingUp, PieChart } from 'lucide-react'
import BandwidthChart from '../components/ntopng/BandwidthChart'
import LiveThroughput from '../components/ntopng/LiveThroughput'
import ProtocolPieChart from '../components/ntopng/ProtocolPieChart'
import TopTalkers from '../components/dashboard/TopTalkers'
import { getInterfaceData, getActiveHosts, getTopTalkers, getTrafficHistory } from '../api/client'
import { formatBytes } from '../lib/utils'
import type { TrafficStat } from '../types'

export default function NtopngPage() {
  const [iface, setIface] = useState<any>(null)
  const [hosts, setHosts] = useState<any[]>([])
  const [talkers, setTalkers] = useState<any[]>([])
  const [traffic, setTraffic] = useState<TrafficStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const [i, h, top, t] = await Promise.allSettled([
          getInterfaceData().catch(() => null), getActiveHosts().catch(() => []),
          getTopTalkers(15).catch(() => []), getTrafficHistory(120).catch(() => []),
        ])
        if (i.status === 'fulfilled') setIface(i.value)
        if (h.status === 'fulfilled') setHosts(h.value || [])
        if (top.status === 'fulfilled') setTalkers(top.value || [])
        if (t.status === 'fulfilled') setTraffic(t.value || [])
      } catch {} finally { setLoading(false) }
    })()
    const interval = setInterval(() => {
      getInterfaceData().then(setIface).catch(() => {})
      getTrafficHistory(60).then(d => setTraffic(d || [])).catch(() => {})
    }, 15000)
    return () => clearInterval(interval)
  }, [])

  const cards = [
    { label: 'Inbound', value: iface?.bytes?.rcvd != null ? formatBytes(iface.bytes.rcvd) : 'N/A', icon: TrendingUp },
    { label: 'Outbound', value: iface?.bytes?.sent != null ? formatBytes(iface.bytes.sent) : 'N/A', icon: TrendingUp },
    { label: 'Active Hosts', value: iface?.num_hosts ?? 'N/A', icon: Globe },
    { label: 'Active Flows', value: iface?.num_flows ?? 'N/A', icon: Activity },
  ]

  return (
    <div className="space-y-8 pb-20 lg:pb-0">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Traffic Monitor</h2>
        <p className="text-slate-500 text-sm mt-1">ntopng real-time analytics</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-white rounded-3xl border border-slate-100 p-5 h-[100px] animate-shimmer" />)
          : cards.map((c, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm card-hover">
              <div className="p-2 rounded-xl bg-brand-50 text-brand-600 w-fit mb-3"><c.icon className="w-4 h-4" /></div>
              <p className="text-2xl font-bold text-slate-900">{c.value}</p>
              <p className="text-sm text-slate-500 font-medium mt-1">{c.label}</p>
            </motion.div>
          ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-brand-50 text-brand-600"><Activity className="w-5 h-5" /></div>
            <h3 className="font-semibold text-slate-900">Bandwidth Usage</h3>
          </div>
          {loading ? <div className="h-[260px] animate-shimmer rounded-2xl" /> : <BandwidthChart data={traffic} height={260} />}
        </div>
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-violet-50 text-violet-600"><PieChart className="w-5 h-5" /></div>
            <h3 className="font-semibold text-slate-900">Protocols</h3>
          </div>
          {loading ? <div className="h-[240px] animate-shimmer rounded-2xl" /> : <ProtocolPieChart height={220} />}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LiveThroughput bytesIn={iface?.bytes?.rcvd ?? 0} bytesOut={iface?.bytes?.sent ?? 0} />
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-cyan-50 text-cyan-600"><Globe className="w-5 h-5" /></div>
            <div><h3 className="font-semibold text-slate-900">Top Talkers</h3><p className="text-xs text-slate-400">By bandwidth</p></div>
          </div>
          {loading ? <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-8 animate-shimmer rounded-lg" />)}</div>
            : <TopTalkers talkers={talkers} limit={8} />}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600"><Globe className="w-5 h-5" /></div>
          <div><h3 className="font-semibold text-slate-900">Active Hosts</h3><p className="text-xs text-slate-400">{hosts.length} online</p></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left bg-slate-50/50">
              <th className="px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">IP</th>
              <th className="px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Hostname</th>
              <th className="px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">MAC</th>
              <th className="px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Sent</th>
              <th className="px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Received</th>
              <th className="px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Flows</th>
            </tr></thead>
            <tbody>
              {hosts.slice(0, 30).map((h: any, i: number) => (
                <tr key={i} className="border-t border-slate-50 hover:bg-slate-50/50">
                  <td className="px-6 py-3 font-mono text-xs font-medium">{h.ip || h.address || '-'}</td>
                  <td className="px-6 py-3 text-xs">{h.name || h.hostname || '-'}</td>
                  <td className="px-6 py-3 font-mono text-[11px] text-slate-400">{h.mac || '-'}</td>
                  <td className="px-6 py-3 text-xs font-medium">{formatBytes(h.bytes_sent || h.sent || 0)}</td>
                  <td className="px-6 py-3 text-xs font-medium">{formatBytes(h.bytes_rcvd || h.rcvd || 0)}</td>
                  <td className="px-6 py-3 text-xs">{h.num_flows || h.flows || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
