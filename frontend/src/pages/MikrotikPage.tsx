import { useEffect, useState } from 'react'
import { ShieldBan, EthernetPort, Wifi as WifiIcon } from 'lucide-react'
import { getMikrotikStatus, getInterfaces, getFirewallRules, blockIp as apiBlock, toggleFirewallRule, deleteFirewallRule, getArpTable } from '../api/client'
import { cn, formatBytes } from '../lib/utils'

export default function MikrotikPage() {
  const [status, setStatus] = useState<Record<string, any>>({})
  const [interfaces, setInterfaces] = useState<any[]>([])
  const [rules, setRules] = useState<any[]>([])
  const [arp, setArp] = useState<any[]>([])
  const [ip, setIp] = useState('')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const [s, i, r, a] = await Promise.allSettled([
          getMikrotikStatus().catch(() => ({})), getInterfaces().catch(() => []),
          getFirewallRules().catch(() => []), getArpTable().catch(() => []),
        ])
        if (s.status === 'fulfilled') setStatus(s.value)
        if (i.status === 'fulfilled') setInterfaces(i.value || [])
        if (r.status === 'fulfilled') setRules(r.value || [])
        if (a.status === 'fulfilled') setArp(a.value || [])
      } catch {} finally { setLoading(false) }
    })()
  }, [])

  const doBlock = async () => { if (!ip) return; await apiBlock(ip, comment || 'Manual'); setIp(''); setComment(''); setRules(await getFirewallRules().catch(() => []) || []) }

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold tracking-tight">MikroTik Router</h2><p className="text-sm text-muted-foreground mt-1">10.100.101.1</p></div>

      {/* Resources */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: 'CPU Load', v: status['cpu-load'] ? `${status['cpu-load']}%` : 'N/A' },
          { l: 'Free Memory', v: status['free-memory'] ? formatBytes(Number(status['free-memory'])) : 'N/A' },
          { l: 'Total Memory', v: status['total-memory'] ? formatBytes(Number(status['total-memory'])) : 'N/A' },
          { l: 'Uptime', v: status.uptime || 'N/A' },
        ].map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <p className="text-2xl font-bold">{s.v}</p>
            <p className="text-sm text-muted-foreground mt-1">{s.l}</p>
          </div>
        ))}
      </div>

      {/* Quick Block */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold mb-3">Quick Block IP</h3>
        <div className="flex gap-3 flex-wrap">
          <input placeholder="IP address..." value={ip} onChange={e => setIp(e.target.value)} onKeyDown={e => e.key === 'Enter' && doBlock()}
            className="flex-1 min-w-[160px] h-9 px-3 rounded-lg border border-input bg-transparent text-sm outline-none focus:ring-2 focus:ring-ring" />
          <input placeholder="Comment..." value={comment} onChange={e => setComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && doBlock()}
            className="flex-1 min-w-[160px] h-9 px-3 rounded-lg border border-input bg-transparent text-sm outline-none focus:ring-2 focus:ring-ring" />
          <button onClick={doBlock}
            className="h-9 px-6 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 flex items-center gap-2">
            <ShieldBan className="w-4 h-4" /> Block
          </button>
        </div>
      </div>

      {/* Interfaces */}
      <div className="bg-card border border-border rounded-xl shadow-sm p-6">
        <h3 className="font-semibold mb-4">Interfaces</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {interfaces.map((iface: any, i: number) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-border">
              <div className="p-2 rounded-lg bg-secondary">{iface.type && iface.type.toLowerCase().includes('wireless') ? <WifiIcon className="w-4 h-4" /> : <EthernetPort className="w-4 h-4" />}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{iface.name || iface.Name}</p>
                <p className="text-xs text-muted-foreground font-mono">{iface['mac-address'] || iface.macAddress || '-'}</p>
                <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                  <span>RX: {formatBytes(Number(iface['rx-byte'] || iface.rxByte || 0))}</span>
                  <span>TX: {formatBytes(Number(iface['tx-byte'] || iface.txByte || 0))}</span>
                </div>
              </div>
              <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold', iface.running || iface.Running ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
                {iface.running || iface.Running ? 'Up' : 'Down'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Firewall rules */}
      <div className="bg-card border border-border rounded-xl shadow-sm p-6">
        <h3 className="font-semibold mb-4">Firewall Rules ({rules.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-secondary/50">
              <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">#</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Chain</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Action</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Src</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Comment</th>
            </tr></thead>
            <tbody>
              {rules.slice(0, 50).map((r: any, i: number) => (
                <tr key={r['.id'] || r.id || i} className="border-b border-border">
                  <td className="px-4 py-2 text-xs font-mono text-muted-foreground">{r['.id'] || r.id || i}</td>
                  <td className="px-4 py-2 text-xs">{r.chain || r.Chain}</td>
                  <td className="px-4 py-2"><span className={cn('px-2 py-0.5 rounded text-[10px] font-bold', (r.action || r.Action) === 'drop' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700')}>{r.action || r.Action}</span></td>
                  <td className="px-4 py-2 font-mono text-xs">{r['src-address'] || r.srcAddress || '*'}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground max-w-[200px] truncate">{r.comment || r.Comment || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ARP */}
      <div className="bg-card border border-border rounded-xl shadow-sm p-6">
        <h3 className="font-semibold mb-4">ARP Table ({arp.length})</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {arp.slice(0, 30).map((e: any, i: number) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border">
              <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
              <div className="min-w-0">
                <p className="font-mono text-sm font-medium">{e.address || e.Address || e.ip || '-'}</p>
                <p className="text-[10px] text-muted-foreground font-mono">{e['mac-address'] || e.macAddress || e.mac || '-'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
