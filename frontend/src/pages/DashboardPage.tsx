import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Shield, Activity, Router, Brain, Wifi, TrendingUp } from 'lucide-react'
import StatCard from '../components/shared/StatCard'
import AlertTimeline from '../components/dashboard/AlertTimeline'
import TrafficChart from '../components/dashboard/TrafficChart'
import TopTalkers from '../components/dashboard/TopTalkers'
import DeviceMap from '../components/dashboard/DeviceMap'
import LoadingSpinner, { CardSkeleton } from '../components/shared/LoadingSpinner'
import { getDashboardSummary, getMikrotikStatus, getTrafficHistory, getTopTalkers, getActiveHosts } from '../api/client'
import { useAlertStore } from '../stores/alertStore'
import { formatBytes } from '../lib/utils'
import type { DashboardStats, TrafficStat, Device } from '../types'

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [trafficHistory, setTrafficHistory] = useState<TrafficStat[]>([])
  const [routerStatus, setRouterStatus] = useState<Record<string, any>>({})
  const [topTalkers, setTopTalkers] = useState<any[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const recentAlerts = useAlertStore((s) => s.recentAlerts)

  useEffect(() => {
    async function load() {
      try {
        const [dash, traffic, router, talkers, hosts] = await Promise.allSettled([
          getDashboardSummary(),
          getTrafficHistory(120),
          getMikrotikStatus().catch(() => ({})),
          getTopTalkers(10).catch(() => []),
          getActiveHosts().catch(() => []),
        ])

        if (dash.status === 'fulfilled' && dash.value?.stats) setStats(dash.value.stats)
        if (traffic.status === 'fulfilled') setTrafficHistory(traffic.value || [])
        if (router.status === 'fulfilled') setRouterStatus(router.value)
        if (talkers.status === 'fulfilled') setTopTalkers(talkers.value || [])
        if (hosts.status === 'fulfilled') {
          const hostList = hosts.value || []
          setDevices(hostList.map((h: any, i: number) => ({
            id: i,
            ip_address: h.ip || h.address || 'unknown',
            mac_address: h.mac || null,
            hostname: h.name || h.hostname || null,
            vendor: null,
            device_type: 'unknown',
            first_seen: '',
            last_seen: '',
            is_online: true,
          })))
        }
      } catch {} finally {
        setLoading(false)
      }
    }
    load()
    const t = setInterval(load, 20000)
    return () => clearInterval(t)
  }, [])

  const latestTraffic = trafficHistory[trafficHistory.length - 1]
  const prevTraffic = trafficHistory[trafficHistory.length - 2]
  const trafficTrend = latestTraffic && prevTraffic
    ? (latestTraffic.bytes_in + latestTraffic.bytes_out) > (prevTraffic.bytes_in + prevTraffic.bytes_out) ? 'up' : 'down'
    : undefined

  return (
    <div className="space-y-6 pb-16 lg:pb-0">
      <div>
        <h2 className="text-2xl font-bold text-surface-900">Dashboard</h2>
        <p className="text-surface-500 mt-1">Tổng quan hệ thống mạng LAN</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            <StatCard icon={Shield} label="Tổng Alerts" value={stats?.total_alerts ?? 0}
              sub={stats ? `${stats.critical_alerts} critical` : undefined} color="red" />
            <StatCard icon={Wifi} label="Thiết bị Online"
              value={`${stats?.online_devices ?? 0} / ${stats?.total_devices ?? 0}`} color="green" />
            <StatCard icon={Activity} label="Bandwidth"
              value={latestTraffic ? formatBytes((latestTraffic.bytes_in + latestTraffic.bytes_out) || 0) + '/s' : '...'}
              color="blue" />
            <StatCard icon={Router} label="Router CPU"
              value={routerStatus?.['cpu-load'] ? `${routerStatus['cpu-load']}%` : '...'}
              sub={routerStatus?.uptime ? `Uptime: ${routerStatus.uptime}` : undefined} color="yellow" />
            <StatCard icon={Brain} label="AI Blocks" value={stats?.total_blocks ?? 0} color="slate" />
          </>
        )}
      </div>

      {/* Charts + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 bg-white rounded-2xl border border-surface-200 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary-500" />
            <h3 className="font-semibold text-surface-900">Traffic History</h3>
          </div>
          {loading ? (
            <div className="h-40 bg-surface-100 rounded-xl animate-pulse" />
          ) : (
            <TrafficChart data={trafficHistory} height={180} />
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-surface-200 p-5"
        >
          <h3 className="font-semibold text-surface-900 mb-4">Recent Alerts</h3>
          <AlertTimeline alerts={recentAlerts} maxHeight="320px" />
        </motion.div>
      </div>

      {/* Top Talkers + Devices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-surface-200 p-5"
        >
          <h3 className="font-semibold text-surface-900 mb-4">Top Talkers</h3>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 bg-surface-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <TopTalkers talkers={topTalkers} limit={8} />
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-surface-200 p-5"
        >
          <h3 className="font-semibold text-surface-900 mb-4">Network Devices</h3>
          {loading ? (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-24 bg-surface-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <DeviceMap devices={devices} />
          )}
        </motion.div>
      </div>
    </div>
  )
}
