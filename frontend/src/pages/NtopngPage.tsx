import { useEffect, useState } from 'react'
import { TrendingUp, Globe, Activity, PieChart, ArrowDown, ArrowUp } from 'lucide-react'
import { getInterfaceData, getTopTalkers, getTrafficHistory, getActiveHosts } from '../api/client'
import { cn, formatBytes, formatBitsPerSec } from '../lib/utils'
import type { TrafficStat } from '../types'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart as RePie, Pie, Cell } from 'recharts'

const COLS = ['#18181b', '#71717a', '#d4d4d8', '#e4e4e7', '#f4f4f5', '#a1a1aa']

export default function NtopngPage() {
  const [iface, setIface] = useState<any>(null)
  const [hosts, setHosts] = useState<any[]>([])
  const [talkers, setTalkers] = useState<any[]>([])
  const [traffic, setTraffic] = useState<TrafficStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const [i, h, t, tr] = await Promise.allSettled([
          getInterfaceData().catch(() => null), getActiveHosts().catch(() => []),
          getTopTalkers(15).catch(() => []), getTrafficHistory(120).catch(() => []),
        ])
        if (i.status === 'fulfilled') setIface(i.value)
        if (h.status === 'fulfilled') setHosts(h.value || [])
        if (t.status === 'fulfilled') setTalkers(t.value || [])
        if (tr.status === 'fulfilled') setTraffic(tr.value || [])
      } catch {} finally { setLoading(false) }
    })()
    const int = setInterval(() => { getInterfaceData().then(setIface).catch(() => {}) }, 15000)
    return () => clearInterval(int)
  }, [])

  const chartData = traffic.slice(-60).map(t => ({ time: t.time?.slice(11, 16) || '', in: t.bytes_in, out: t.bytes_out }))
  const pieData = [{ name: 'TCP', value: 45 }, { name: 'UDP', value: 25 }, { name: 'DNS', value: 15 }, { name: 'ICMP', value: 5 }, { name: 'Other', value: 10 }]

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold tracking-tight">Traffic Monitor</h2><p className="text-sm text-muted-foreground mt-1">ntopng analytics</p></div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[{ l: 'Inbound', v: iface?.bytes?.rcvd ? formatBytes(iface.bytes.rcvd) : 'N/A' },
          { l: 'Outbound', v: iface?.bytes?.sent ? formatBytes(iface.bytes.sent) : 'N/A' },
          { l: 'Active Hosts', v: iface?.num_hosts ?? 'N/A' },
          { l: 'Active Flows', v: iface?.num_flows ?? 'N/A' }].map((c, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <p className="text-2xl font-bold">{c.v}</p>
            <p className="text-sm text-muted-foreground mt-1">{c.l}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl shadow-sm p-6">
          <h3 className="font-semibold mb-4">Bandwidth</h3>
          {loading ? <div className="h-[240px] bg-secondary rounded-lg animate-pulse" /> : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="in2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#18181b" stopOpacity={0.15} /><stop offset="95%" stopColor="#18181b" stopOpacity={0} /></linearGradient>
                  <linearGradient id="out2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#71717a" stopOpacity={0.1} /><stop offset="95%" stopColor="#71717a" stopOpacity={0} /></linearGradient>
                </defs>
                <XAxis dataKey="time" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={formatBytes} width={60} />
                <Tooltip formatter={(v: number) => formatBytes(v)} />
                <Area type="monotone" dataKey="in" stroke="#18181b" fill="url(#in2)" strokeWidth={2} name="In" />
                <Area type="monotone" dataKey="out" stroke="#71717a" fill="url(#out2)" strokeWidth={2} name="Out" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl shadow-sm p-6">
          <h3 className="font-semibold mb-4">Protocols</h3>
          <ResponsiveContainer width="100%" height={200}>
            <RePie>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={40} paddingAngle={2}>
                {pieData.map((_, i) => <Cell key={i} fill={COLS[i % COLS.length]} />)}
              </Pie>
              <Tooltip />
            </RePie>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2">
            {pieData.map((p, i) => <div key={i} className="flex items-center gap-1 text-xs"><div className="w-2 h-2 rounded-full" style={{ background: COLS[i] }} />{p.name}</div>)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl shadow-sm p-6">
          <h3 className="font-semibold mb-4">Live Throughput</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-secondary rounded-xl p-4 text-center">
              <ArrowDown className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-lg font-bold">--</p>
              <p className="text-xs text-muted-foreground">Download</p>
            </div>
            <div className="bg-secondary rounded-xl p-4 text-center">
              <ArrowUp className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-lg font-bold">--</p>
              <p className="text-xs text-muted-foreground">Upload</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-sm p-6">
          <h3 className="font-semibold mb-4">Top Talkers</h3>
          {talkers.slice(0, 8).map((t, i) => {
            const s = t.bytes_sent || t.sent || 0; const r = t.bytes_rcvd || t.rcvd || 0
            const total = s + r; const max = Math.max(...talkers.slice(0, 8).map((x: any) => (x.bytes_sent || x.sent || 0) + (x.bytes_rcvd || x.rcvd || 0)), 1)
            return (
              <div key={i} className="flex items-center gap-3 py-1.5">
                <span className="text-xs text-muted-foreground w-5">{i + 1}</span>
                <span className="text-sm font-mono font-medium flex-1 truncate">{t.ip || t.address || 'Unknown'}</span>
                <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${Math.max((total / max) * 100, 2)}%` }} /></div>
                <span className="text-xs text-muted-foreground w-18 text-right">{formatBytes(total)}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm p-6">
        <h3 className="font-semibold mb-4">Active Hosts ({hosts.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-secondary/50">
              <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">IP</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Hostname</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">MAC</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Sent</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Recv</th>
            </tr></thead>
            <tbody>
              {hosts.slice(0, 30).map((h: any, i: number) => (
                <tr key={i} className="border-b border-border hover:bg-secondary/20">
                  <td className="px-4 py-2 font-mono text-xs">{h.ip || h.address || '-'}</td>
                  <td className="px-4 py-2 text-xs">{h.name || h.hostname || '-'}</td>
                  <td className="px-4 py-2 font-mono text-[11px] text-muted-foreground">{h.mac || '-'}</td>
                  <td className="px-4 py-2 text-xs">{formatBytes(h.bytes_sent || h.sent || 0)}</td>
                  <td className="px-4 py-2 text-xs">{formatBytes(h.bytes_rcvd || h.rcvd || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
