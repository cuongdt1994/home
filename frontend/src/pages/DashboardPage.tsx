import { useEffect, useState } from 'react'
import {
  Shield,
  Wifi,
  Activity,
  Cpu,
  Brain,
  ArrowRight,
} from 'lucide-react'
import {
  getDashboardSummary,
  getMikrotikStatus,
  getTrafficHistory,
  getTopTalkers,
} from '../api/client'
import { useAlertStore } from '../stores/alertStore'
import { cn, formatBytes, formatRelativeTime } from '../lib/utils'
import type { DashboardStats, TrafficStat } from '../types'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent } from '../components/ui/Card'
import StatCard from '../components/shared/StatCard'

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [traffic, setTraffic] = useState<TrafficStat[]>([])
  const [router, setRouter] = useState<Record<string, any>>({})
  const [talkers, setTalkers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const recentAlerts = useAlertStore((s) => s.recentAlerts.slice(0, 10))

  useEffect(() => {
    (async () => {
      try {
        const [d, t, r, top] = await Promise.allSettled([
          getDashboardSummary(),
          getTrafficHistory(120),
          getMikrotikStatus().catch(() => ({})),
          getTopTalkers(10).catch(() => []),
        ])
        if (d.status === 'fulfilled' && d.value?.stats) setStats(d.value.stats)
        if (t.status === 'fulfilled') setTraffic(t.value || [])
        if (r.status === 'fulfilled') setRouter(r.value)
        if (top.status === 'fulfilled') setTalkers(top.value || [])
      } catch {
        /* graceful degrade */
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const latest = traffic[traffic.length - 1]
  const prev = traffic[traffic.length - 2]
  const trend =
    latest && prev
      ? latest.bytes_in + latest.bytes_out > prev.bytes_in + prev.bytes_out
        ? 'up'
        : 'down'
      : undefined

  const chartData = traffic.slice(-60).map((t) => ({
    time: t.time?.slice(11, 16) || '',
    in: t.bytes_in,
    out: t.bytes_out,
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Page header ───────────────────── */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Dashboard
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time network monitoring overview
        </p>
      </div>

      {/* ── Stat cards ────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-xl p-5 h-[120px] animate-pulse"
              >
                <div className="bg-muted h-full rounded-lg" />
              </div>
            ))
          : <>
              <StatCard
                icon={Shield}
                label="Total Alerts"
                value={(stats?.total_alerts ?? 0).toLocaleString()}
                sub={`${stats?.critical_alerts ?? 0} critical`}
                color="brand"
              />
              <StatCard
                icon={Wifi}
                label="Online Devices"
                value={`${stats?.online_devices ?? 0}/${stats?.total_devices ?? 0}`}
                color="cyan"
              />
              <StatCard
                icon={Activity}
                label="Bandwidth"
                value={
                  latest
                    ? formatBytes((latest.bytes_in + latest.bytes_out) || 0) + '/s'
                    : '...'
                }
                trend={trend}
                color="emerald"
              />
              <StatCard
                icon={Cpu}
                label="Router CPU"
                value={router?.['cpu-load'] ? `${router['cpu-load']}%` : '...'}
                sub={router?.uptime}
                color="amber"
              />
              <StatCard
                icon={Brain}
                label="AI Blocks"
                value={(stats?.total_blocks ?? 0).toLocaleString()}
                color="violet"
              />
            </>}
      </div>

      {/* ── Chart + Alerts ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Traffic chart */}
        <Card className="lg:col-span-2" padding="lg">
          <h3 className="font-semibold text-foreground mb-4">Network Traffic</h3>
          {loading ? (
            <div className="h-[220px] bg-muted rounded-lg animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="inG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="outG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#64748b" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#64748b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatBytes}
                  width={60}
                />
                <Tooltip formatter={(v: number) => formatBytes(v)} />
                <Area
                  type="monotone"
                  dataKey="in"
                  stroke="#2563eb"
                  fill="url(#inG)"
                  strokeWidth={2}
                  name="Inbound"
                />
                <Area
                  type="monotone"
                  dataKey="out"
                  stroke="#64748b"
                  fill="url(#outG)"
                  strokeWidth={2}
                  name="Outbound"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Recent alerts */}
        <Card padding="lg">
          <h3 className="font-semibold text-foreground mb-4">Recent Alerts</h3>
          <div className="space-y-1">
            {recentAlerts.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No alerts yet
              </p>
            )}
            {recentAlerts.map((a, i) => (
              <div
                key={a.id || i}
                className="flex items-start gap-2 py-2 text-sm"
              >
                <span
                  className={cn(
                    'w-1.5 h-1.5 rounded-full mt-1.5 shrink-0',
                    a.alert_severity <= 2 ? 'bg-destructive' : 'bg-amber-500',
                  )}
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">
                    {a.alert_signature || a.src_ip}
                  </p>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <span className="font-mono">{a.src_ip}</span>
                    <ArrowRight className="w-2.5 h-2.5" />
                    <span className="font-mono">{a.dest_ip}</span>
                    <span className="ml-auto">{formatRelativeTime(a.timestamp)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Top Talkers ───────────────────── */}
      <Card padding="lg">
        <h3 className="font-semibold text-foreground mb-4">Top Talkers</h3>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-8 bg-muted rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {talkers.slice(0, 8).map((t, i) => {
              const sent = t.bytes_sent || t.sent || 0
              const rcvd = t.bytes_rcvd || t.rcvd || 0
              const total = sent + rcvd
              const max = Math.max(
                ...talkers.slice(0, 8).map(
                  (x: any) =>
                    (x.bytes_sent || x.sent || 0) +
                    (x.bytes_rcvd || x.rcvd || 0),
                ),
                1,
              )
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-5">{i + 1}</span>
                  <span className="text-sm font-mono font-medium flex-1 truncate">
                    {t.ip || t.address || 'Unknown'}
                  </span>
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max((total / max) * 100, 2)}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-20 text-right">
                    {formatBytes(total)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
