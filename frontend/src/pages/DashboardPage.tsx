import { useEffect, useState } from 'react'
import { Shield, Wifi, Activity, Cpu, Brain, ArrowRight, Server, AlertTriangle } from 'lucide-react'
import { getDashboardSummary, getMikrotikStatus, getTrafficHistory, getTopTalkers } from '../api/client'
import { useAlertStore } from '../stores/alertStore'
import { cn, formatBytes, formatRelativeTime, severityColor } from '../lib/utils'
import type { DashboardStats, TrafficStat } from '../types'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
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
      } catch {} finally { setLoading(false) }
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
    <div className="space-y-8 animate-slide-up">
      {/* ── Page header ───────────────────── */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1">Real-time network monitoring overview</p>
      </div>

      {/* ── Stat cards ────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-5 h-[120px] animate-pulse">
                <div className="bg-muted h-full rounded-lg" />
              </div>
            ))
          : <>
              <StatCard icon={Shield} label="Total Alerts" color="accent"
                value={(stats?.total_alerts ?? 0).toLocaleString()}
                sub={`${stats?.critical_alerts ?? 0} critical`} />
              <StatCard icon={Wifi} label="Online Devices" color="info"
                value={`${stats?.online_devices ?? 0}/${stats?.total_devices ?? 0}`} />
              <StatCard icon={Activity} label="Bandwidth" color="success" trend={trend}
                value={latest ? formatBytes((latest.bytes_in + latest.bytes_out) || 0) + '/s' : '...'} />
              <StatCard icon={Cpu} label="Router CPU" color="warning"
                value={router?.['cpu-load'] ? `${router['cpu-load']}%` : '...'}
                sub={router?.uptime} />
              <StatCard icon={Brain} label="AI Blocks" color="destructive"
                value={(stats?.total_blocks ?? 0).toLocaleString()} />
            </>}
      </div>

      {/* ── Chart + Alerts ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Traffic chart */}
        <Card glass className="lg:col-span-2" padding="lg">
          <CardHeader>
            <CardTitle>Network Traffic</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[240px] bg-muted rounded-xl animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="inG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="outG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a1a1aa" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#a1a1aa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" fontSize={11} tickLine={false} axisLine={false} stroke="#52525b" />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={formatBytes} width={60} stroke="#52525b" />
                  <Tooltip
                    contentStyle={{
                      background: '#18181b', border: '1px solid #27272a', borderRadius: '12px',
                      color: '#fafafa', fontSize: '13px',
                    }}
                    formatter={(v: number) => formatBytes(v)}
                  />
                  <Area type="monotone" dataKey="in" stroke="#3b82f6" fill="url(#inG)" strokeWidth={2} name="Inbound" />
                  <Area type="monotone" dataKey="out" stroke="#a1a1aa" fill="url(#outG)" strokeWidth={2} name="Outbound" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent alerts */}
        <Card glass padding="lg">
          <CardHeader>
            <CardTitle>Recent Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {recentAlerts.length === 0 && (
                <p className="text-sm text-muted-foreground py-10 text-center">No alerts yet</p>
              )}
              {recentAlerts.map((a, i) => (
                <div key={a.id || i} className="flex items-start gap-2.5 py-2.5 text-sm">
                  <span className={cn(
                    'w-2 h-2 rounded-full mt-1.5 shrink-0',
                    a.alert_severity <= 2 ? 'bg-destructive' : 'bg-yellow-500',
                  )} />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium truncate text-foreground">
                      {a.alert_signature || a.src_ip}
                    </p>
                    <div className="flex items-center gap-1 text-[12px] text-muted-foreground mt-0.5">
                      <span className="font-mono text-[11px]">{a.src_ip}</span>
                      <ArrowRight className="w-2.5 h-2.5" />
                      <span className="font-mono text-[11px]">{a.dest_ip}</span>
                      <span className="ml-auto">{formatRelativeTime(a.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Top Talkers ───────────────────── */}
      <Card glass padding="lg">
        <CardHeader>
          <CardTitle>Top Talkers</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {talkers.slice(0, 8).map((t, i) => {
                const sent = t.bytes_sent || t.sent || 0
                const rcvd = t.bytes_rcvd || t.rcvd || 0
                const total = sent + rcvd
                const max = Math.max(
                  ...talkers.slice(0, 8).map(
                    (x: any) => (x.bytes_sent || x.sent || 0) + (x.bytes_rcvd || x.rcvd || 0),
                  ),
                  1,
                )
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-5 font-medium">{i + 1}</span>
                    <span className="text-sm font-mono font-medium flex-1 truncate text-foreground">
                      {t.ip || t.address || 'Unknown'}
                    </span>
                    <div className="w-36 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${Math.max((total / max) * 100, 2)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-20 text-right font-medium">
                      {formatBytes(total)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
