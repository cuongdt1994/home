import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Activity, Globe, TrendingUp } from 'lucide-react'
import BandwidthChart from '../components/ntopng/BandwidthChart'
import LiveThroughput from '../components/ntopng/LiveThroughput'
import ProtocolPieChart from '../components/ntopng/ProtocolPieChart'
import TopTalkers from '../components/dashboard/TopTalkers'
import { CardSkeleton } from '../components/shared/LoadingSpinner'
import { getInterfaceData, getActiveHosts, getTopTalkers, getTrafficHistory } from '../api/client'
import { formatBytes } from '../lib/utils'
import type { TrafficStat } from '../types'

export default function NtopngPage() {
  const [interfaceData, setInterfaceData] = useState<any>(null)
  const [hosts, setHosts] = useState<any[]>([])
  const [talkers, setTalkers] = useState<any[]>([])
  const [trafficHistory, setTrafficHistory] = useState<TrafficStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [iface, hostList, top, history] = await Promise.allSettled([
          getInterfaceData().catch(() => null),
          getActiveHosts().catch(() => []),
          getTopTalkers(15).catch(() => []),
          getTrafficHistory(120).catch(() => []),
        ])
        if (iface.status === 'fulfilled') setInterfaceData(iface.value)
        if (hostList.status === 'fulfilled') setHosts(hostList.value || [])
        if (top.status === 'fulfilled') setTalkers(top.value || [])
        if (history.status === 'fulfilled') setTrafficHistory(history.value || [])
      } catch {} finally {
        setLoading(false)
      }
    }
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [])

  const statCards = [
    { label: 'Bytes In', value: interfaceData?.bytes?.rcvd != null ? formatBytes(interfaceData.bytes.rcvd) : 'N/A', icon: TrendingUp, color: 'blue' as const },
    { label: 'Bytes Out', value: interfaceData?.bytes?.sent != null ? formatBytes(interfaceData.bytes.sent) : 'N/A', icon: TrendingUp, color: 'green' as const },
    { label: 'Active Hosts', value: interfaceData?.num_hosts ?? 'N/A', icon: Globe, color: 'yellow' as const },
    { label: 'Active Flows', value: interfaceData?.num_flows ?? 'N/A', icon: Activity, color: 'slate' as const },
  ]

  return (
    <div className="space-y-6 pb-16 lg:pb-0">
      <div>
        <h2 className="text-2xl font-bold text-surface-900">
          <Activity className="w-6 h-6 inline mr-2 text-primary-500" />
          ntopng Traffic Monitor
        </h2>
        <p className="text-surface-500">Real-time network traffic analytics</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
          : statCards.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-2xl border border-surface-200 p-4 hover:shadow-sm transition-shadow"
              >
                <p className="text-sm text-surface-500">{s.label}</p>
                <p className="text-xl font-bold text-surface-900 mt-1">{s.value}</p>
              </motion.div>
            ))
        }
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-surface-200 p-5">
          {loading ? (
            <div className="h-[260px] bg-surface-100 rounded-xl animate-pulse" />
          ) : (
            <BandwidthChart data={trafficHistory} height={260} />
          )}
        </div>
        <div className="bg-white rounded-2xl border border-surface-200 p-5">
          {loading ? (
            <div className="h-[260px] bg-surface-100 rounded-xl animate-pulse" />
          ) : (
            <ProtocolPieChart height={240} />
          )}
        </div>
      </div>

      {/* Live throughput */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LiveThroughput
          bytesIn={interfaceData?.bytes?.rcvd ?? 0}
          bytesOut={interfaceData?.bytes?.sent ?? 0}
        />
        <div className="bg-white rounded-2xl border border-surface-200 p-5">
          <h3 className="font-semibold text-surface-900 mb-4">Top Talkers</h3>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 bg-surface-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <TopTalkers talkers={talkers} limit={8} />
          )}
        </div>
      </div>

      {/* Active hosts */}
      <div className="bg-white rounded-2xl border border-surface-200 p-5">
        <h3 className="font-semibold text-surface-900 mb-4">Active Hosts ({hosts.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left bg-surface-50">
                <th className="px-4 py-2 font-medium text-surface-500">IP</th>
                <th className="px-4 py-2 font-medium text-surface-500">Hostname</th>
                <th className="px-4 py-2 font-medium text-surface-500">MAC</th>
                <th className="px-4 py-2 font-medium text-surface-500">Sent</th>
                <th className="px-4 py-2 font-medium text-surface-500">Received</th>
                <th className="px-4 py-2 font-medium text-surface-500">Flows</th>
              </tr>
            </thead>
            <tbody>
              {hosts.slice(0, 30).map((h: any, i: number) => (
                <tr key={i} className="border-t border-surface-100 hover:bg-surface-50">
                  <td className="px-4 py-2 font-mono text-xs">{h.ip || h.address || '-'}</td>
                  <td className="px-4 py-2 text-xs">{h.name || h.hostname || '-'}</td>
                  <td className="px-4 py-2 font-mono text-[11px] text-surface-400">{h.mac || '-'}</td>
                  <td className="px-4 py-2 text-xs">{formatBytes(h.bytes_sent || h.sent || 0)}</td>
                  <td className="px-4 py-2 text-xs">{formatBytes(h.bytes_rcvd || h.rcvd || 0)}</td>
                  <td className="px-4 py-2 text-xs">{h.num_flows || h.flows || 0}</td>
                </tr>
              ))}
              {hosts.length === 0 && !loading && (
                <tr><td colSpan={6} className="text-center py-8 text-surface-400">No active hosts</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
