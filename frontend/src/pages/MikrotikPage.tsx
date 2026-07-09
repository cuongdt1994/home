import { useEffect, useState } from 'react'
import { ShieldBan, Router } from 'lucide-react'
import ResourceGauge from '../components/mikrotik/ResourceGauge'
import InterfaceList from '../components/mikrotik/InterfaceList'
import FirewallRules from '../components/mikrotik/FirewallRules'
import { getMikrotikStatus, getInterfaces, getFirewallRules, blockIp, toggleFirewallRule, deleteFirewallRule, getArpTable } from '../api/client'

export default function MikrotikPage() {
  const [status, setStatus] = useState<Record<string, any>>({})
  const [interfaces, setInterfaces] = useState<any[]>([])
  const [rules, setRules] = useState<any[]>([])
  const [arp, setArp] = useState<any[]>([])
  const [blockIpInput, setBlockIpInput] = useState('')
  const [blockComment, setBlockComment] = useState('')
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
    const t = setInterval(() => { getMikrotikStatus().then(setStatus).catch(() => {}) }, 20000)
    return () => clearInterval(t)
  }, [])

  const handleBlock = async () => {
    if (!blockIpInput) return
    try {
      await blockIp(blockIpInput, blockComment || 'Manual block')
      setBlockIpInput(''); setBlockComment('')
      setRules((await getFirewallRules().catch(() => [])) || [])
    } catch {}
  }

  const handleToggle = async (ruleId: string, disabled: boolean) => {
    try {
      await toggleFirewallRule(ruleId, disabled)
      setRules(prev => prev.map(r => (r['.id'] === ruleId || r.id === ruleId) ? { ...r, disabled: disabled ? 'true' : 'false' } : r))
    } catch {}
  }

  const handleDelete = async (ruleId: string) => {
    if (!confirm('Delete this rule?')) return
    try { await deleteFirewallRule(ruleId); setRules(prev => prev.filter(r => r['.id'] !== ruleId && r.id !== ruleId)) } catch {}
  }

  return (
    <div className="space-y-8 pb-20 lg:pb-0">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">MikroTik Router</h2>
        <p className="text-slate-500 text-sm mt-1">10.100.101.1 · RouterOS {status.version || ''}</p>
      </div>

      {loading ? <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="bg-white rounded-3xl border border-slate-100 p-5 h-[120px] animate-shimmer" />)}</div>
        : <ResourceGauge resources={status} />}

      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-brand-50 text-brand-600"><Router className="w-5 h-5" /></div>
          <div><h3 className="font-semibold text-slate-900">Interfaces</h3><p className="text-xs text-slate-400">Network interfaces</p></div>
        </div>
        {loading ? <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 animate-shimmer rounded-2xl" />)}</div>
          : <InterfaceList interfaces={interfaces} />}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-xl bg-rose-50 text-rose-600"><ShieldBan className="w-5 h-5" /></div>
          <div><h3 className="font-semibold text-slate-900">Quick Block IP</h3><p className="text-xs text-slate-400">Add firewall drop rule instantly</p></div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <input type="text" placeholder="IP to block..." value={blockIpInput}
            onChange={(e) => setBlockIpInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleBlock()}
            className="flex-1 min-w-[160px] px-5 py-3 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-300" />
          <input type="text" placeholder="Comment..." value={blockComment}
            onChange={(e) => setBlockComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleBlock()}
            className="flex-1 min-w-[160px] px-5 py-3 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
          <button onClick={handleBlock}
            className="px-8 py-3 bg-rose-500 text-white rounded-2xl text-sm font-semibold hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20">
            Block IP
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-amber-50 text-amber-600"><ShieldBan className="w-5 h-5" /></div>
          <div><h3 className="font-semibold text-slate-900">Firewall Rules</h3><p className="text-xs text-slate-400">{rules.length} rules</p></div>
        </div>
        {loading ? <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-10 animate-shimmer rounded-lg" />)}</div>
          : <FirewallRules rules={rules} onToggle={handleToggle} onDelete={handleDelete} />}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-violet-50 text-violet-600"><Router className="w-5 h-5" /></div>
          <div><h3 className="font-semibold text-slate-900">ARP Table</h3><p className="text-xs text-slate-400">{arp.length} entries</p></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {arp.slice(0, 30).map((e: any, i: number) => (
            <div key={i} className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-all border border-slate-50">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <div>
                <p className="font-mono text-sm font-semibold">{e.address || e.Address || e.ip || '-'}</p>
                <p className="text-[10px] text-slate-400 font-mono">{e['mac-address'] || e.macAddress || e.mac || '-'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
