import { useEffect, useState } from 'react'
import { Router, ShieldBan } from 'lucide-react'
import ResourceGauge from '../components/mikrotik/ResourceGauge'
import InterfaceList from '../components/mikrotik/InterfaceList'
import FirewallRules from '../components/mikrotik/FirewallRules'
import { CardSkeleton } from '../components/shared/LoadingSpinner'
import {
  getMikrotikStatus, getInterfaces, getFirewallRules,
  blockIp, toggleFirewallRule, deleteFirewallRule, getArpTable
} from '../api/client'

export default function MikrotikPage() {
  const [status, setStatus] = useState<Record<string, any>>({})
  const [interfaces, setInterfaces] = useState<any[]>([])
  const [firewallRules, setFirewallRules] = useState<any[]>([])
  const [arpTable, setArpTable] = useState<any[]>([])
  const [blockIpInput, setBlockIpInput] = useState('')
  const [blockComment, setBlockComment] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [s, ifaces, rules, arp] = await Promise.allSettled([
          getMikrotikStatus().catch(() => ({})),
          getInterfaces().catch(() => []),
          getFirewallRules().catch(() => []),
          getArpTable().catch(() => []),
        ])
        if (s.status === 'fulfilled') setStatus(s.value)
        if (ifaces.status === 'fulfilled') setInterfaces(ifaces.value || [])
        if (rules.status === 'fulfilled') setFirewallRules(rules.value || [])
        if (arp.status === 'fulfilled') setArpTable(arp.value || [])
      } catch {} finally {
        setLoading(false)
      }
    }
    load()
    const t = setInterval(load, 20000)
    return () => clearInterval(t)
  }, [])

  const handleBlock = async () => {
    if (!blockIpInput) return
    try {
      await blockIp(blockIpInput, blockComment || 'Manual block')
      setBlockIpInput('')
      setBlockComment('')
      const rules = await getFirewallRules().catch(() => [])
      setFirewallRules(rules || [])
    } catch {}
  }

  const handleToggle = async (ruleId: string, disabled: boolean) => {
    try {
      await toggleFirewallRule(ruleId, disabled)
      setFirewallRules(prev =>
        prev.map(r => (r['.id'] === ruleId || r.id === ruleId) ? { ...r, disabled: disabled ? 'true' : 'false' } : r)
      )
    } catch {}
  }

  const handleDelete = async (ruleId: string) => {
    if (!confirm('Delete this firewall rule?')) return
    try {
      await deleteFirewallRule(ruleId)
      setFirewallRules(prev => prev.filter(r => r['.id'] !== ruleId && r.id !== ruleId))
    } catch {}
  }

  return (
    <div className="space-y-6 pb-16 lg:pb-0">
      <div>
        <h2 className="text-2xl font-bold text-surface-900">
          <Router className="w-6 h-6 inline mr-2 text-primary-500" />
          MikroTik Router
        </h2>
        <p className="text-surface-500">10.100.101.1 — RouterOS {status.version || ''}</p>
      </div>

      {/* System resources */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <ResourceGauge resources={status} />
      )}

      {/* Interfaces */}
      <div className="bg-white rounded-2xl border border-surface-200 p-5">
        <h3 className="font-semibold text-surface-900 mb-4">Interfaces</h3>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-surface-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <InterfaceList interfaces={interfaces} />
        )}
      </div>

      {/* Quick block */}
      <div className="bg-white rounded-2xl border border-surface-200 p-5">
        <h3 className="font-semibold text-surface-900 mb-3">Quick Block IP</h3>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            placeholder="IP Address to block..."
            value={blockIpInput}
            onChange={(e) => setBlockIpInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleBlock()}
            className="flex-1 min-w-[160px] px-4 py-2.5 rounded-xl border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-300"
          />
          <input
            type="text"
            placeholder="Comment (optional)..."
            value={blockComment}
            onChange={(e) => setBlockComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleBlock()}
            className="flex-1 min-w-[160px] px-4 py-2.5 rounded-xl border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
          <button
            onClick={handleBlock}
            className="px-6 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-colors flex items-center gap-2 shadow-sm"
          >
            <ShieldBan className="w-4 h-4" />
            Block Now
          </button>
        </div>
      </div>

      {/* Firewall rules */}
      <div className="bg-white rounded-2xl border border-surface-200 p-5">
        <h3 className="font-semibold text-surface-900 mb-4">Firewall Rules</h3>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-surface-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <FirewallRules
            rules={firewallRules}
            onToggle={handleToggle}
            onDelete={handleDelete}
          />
        )}
      </div>

      {/* ARP table */}
      <div className="bg-white rounded-2xl border border-surface-200 p-5">
        <h3 className="font-semibold text-surface-900 mb-4">ARP Table ({arpTable.length} entries)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {arpTable.slice(0, 30).map((entry: any, i: number) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 border border-surface-200 hover:bg-surface-100 transition-colors">
              <div>
                <p className="font-mono text-sm font-medium">{entry.address || entry.Address || entry.ip || '-'}</p>
                <p className="text-[10px] text-surface-400 font-mono">{entry['mac-address'] || entry.macAddress || entry.mac || '-'}</p>
              </div>
            </div>
          ))}
          {arpTable.length === 0 && !loading && (
            <p className="text-surface-400 text-sm col-span-full text-center py-4">No ARP entries</p>
          )}
        </div>
      </div>
    </div>
  )
}
