import { useEffect, useState } from 'react'
import { Shield, Wifi, Activity, Cpu, Brain, ArrowRight } from 'lucide-react'
import { getDashboardSummary, getMikrotikStatus, getTrafficHistory, getTopTalkers } from '../api/client'
import { useAlertStore } from '../stores/alertStore'
import { cn, formatBytes, formatRelativeTime } from '../lib/utils'
import type { DashboardStats, TrafficStat } from '../types'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Card } from '../components/ui/Card'
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
          getDashboardSummary(), getTrafficHistory(120),
          getMikrotikStatus().catch(() => ({})), getTopTalkers(10).catch(() => []),
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
  const trend = latest && prev
    ? ((latest.bytes_in + latest.bytes_out) > (prev.bytes_in + prev.bytes_out) ? 'up' : 'down')
    : undefined

  const chartData = traffic.slice(-60).map(t => ({
    time: t.time?.slice(11, 16) || '',
    in: t.bytes_in, out: t.bytes_out,
  }))

  return (
    <div className="space-y-8 animate-slide-up">
      {/* ── Page header ───────────────────── */}
      <div>
        <h2 className="text-[28px] font-semibold tracking-tight text-apple-text">
          Dashboard
        </h2>
        <p className="text-[15px] text-apple-text-secondary mt-1">
          Giám sát mạng theo thời gian thực
        </p>
      </div>

      {/* ── Stat cards ────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-apple-border-light p-5 h-[124px] animate-pulse">
              <div className="bg-[#f0f0f5] h-full rounded-xl" />
            </div>
          ))
        ) : (
          <>
            <StatCard icon={Shield} label="Tổng cảnh báo" color="blue"
              value={(stats?.total_alerts ?? 0).toLocaleString()}
              sub={`${stats?.critical_alerts ?? 0} nghiêm trọng`} />
            <StatCard icon={Wifi} label="Thiết bị online" color="teal"
              value={`${stats?.online_devices ?? 0}/${stats?.total_devices ?? 0}`} />
            <StatCard icon={Activity} label="Băng thông" color="green" trend={trend}
              value={latest ? formatBytes((latest.bytes_in + latest.bytes_out) || 0) + '/s' : '...'} />
            <StatCard icon={Cpu} label="Router CPU" color="orange"
              value={router?.['cpu-load'] ? `${router['cpu-load']}%` : '...'}
              sub={router?.uptime} />
            <StatCard icon={Brain} label="AI Blocks" color="purple"
              value={(stats?.total_blocks ?? 0).toLocaleString()} />
          </>
        )}
      </div>

      {/* ── Chart + Alerts ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Traffic chart */}
        <Card className="lg:col-span-2" padding="lg">
          <h3 className="text-[17px] font-semibold text-apple-text mb-5">Lưu lượng mạng</h3>
          {loading ? (
            <div className="h-[240px] bg-[#f0f0f5] rounded-2xl animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="inG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0071e3" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#0071e3" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="outG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#86868b" stopOpacity={0.08} />
                    <stop offset="95%" stopColor="#86868b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" fontSize={11} tickLine={false} axisLine={false} color="#aeaeb2" />
                <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={formatBytes} width={60} color="#aeaeb2" />
                <Tooltip formatter={(v: number) => formatBytes(v)} />
                <Area type="monotone" dataKey="in" stroke="#0071e3" fill="url(#inG)" strokeWidth={2} name="Inbound" />
                <Area type="monotone" dataKey="out" stroke="#86868b" fill="url(#outG)" strokeWidth={2} name="Outbound" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Recent alerts */}
        <Card padding="lg">
          <h3 className="text-[17px] font-semibold text-apple-text mb-5">Cảnh báo gần đây</h3>
          <div className="space-y-1">
            {recentAlerts.length === 0 && (
              <p className="text-sm text-apple-text-secondary py-10 text-center">Không có cảnh báo</p>
            )}
            {recentAlerts.map((a, i) => (
              <div key={a.id || i} className="flex items-start gap-2.5 py-2.5 text-sm">
                <span className={cn(
                  'w-2 h-2 rounded-full mt-1.5 shrink-0',
                  a.alert_severity <= 2 ? 'bg-apple-red' : 'bg-apple-orange',
                )} />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium truncate text-apple-text">
                    {a.alert_signature || a.src_ip}
                  </p>
                  <div className="flex items-center gap-1 text-[12px] text-apple-text-secondary mt-0.5">
                    <span className="font-mono text-[11px]">{a.src_ip}</span>
                    <ArrowRight className="w-2.5 h-2.5" />
                    <span className="font-mono text-[11px]">{a.dest_ip}</span>
                    <span className="ml-auto text-apple-text-tertiary">{formatRelativeTime(a.timestamp)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Top Talkers ───────────────────── */}
      <Card padding="lg">
        <h3 className="text-[17px] font-semibold text-apple-text mb-5">Top thiết bị</h3>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-[#f0f0f5] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2.5">
            {talkers.slice(0, 8).map((t, i) => {
              const sent = t.bytes_sent || t.sent || 0
              const rcvd = t.bytes_rcvd || t.rcvd || 0
              const total = sent + rcvd
              const max = Math.max(...talkers.slice(0, 8).map((x: any) =>
                (x.bytes_sent || x.sent || 0) + (x.bytes_rcvd || x.rcvd || 0)), 1)
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[13px] text-apple-text-tertiary w-5 font-medium">{i + 1}</span>
                  <span className="text-[14px] font-mono font-medium flex-1 truncate text-apple-text">
                    {t.ip || t.address || 'Unknown'}
                  </span>
                  <div className="w-36 h-1.5 bg-[#f0f0f5] rounded-full overflow-hidden">
                    <div className="h-full bg-apple-blue rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${Math.max((total / max) * 100, 2)}%` }} />
                  </div>
                  <span className="text-[13px] text-apple-text-secondary w-20 text-right font-medium">
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
