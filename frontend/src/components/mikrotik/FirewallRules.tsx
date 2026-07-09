import { useState } from 'react'
import { ShieldBan, ShieldCheck, Trash2, Search } from 'lucide-react'
import { cn } from '../../lib/utils'

interface Rule {
  '.id'?: string
  id?: string | number
  chain?: string
  Chain?: string
  action?: string
  Action?: string
  'src-address'?: string
  srcAddress?: string
  'dst-address'?: string
  dstAddress?: string
  comment?: string
  Comment?: string
  disabled?: string | boolean
  Disabled?: string | boolean
  [key: string]: any
}

interface Props {
  rules: Rule[]
  onToggle: (ruleId: string, disabled: boolean) => void
  onDelete: (ruleId: string) => void
}

export default function FirewallRules({ rules, onToggle, onDelete }: Props) {
  const [search, setSearch] = useState('')

  const filtered = rules.filter(r => {
    if (!search) return true
    const s = search.toLowerCase()
    const src = (r['src-address'] || r.srcAddress || '').toLowerCase()
    const dst = (r['dst-address'] || r.dstAddress || '').toLowerCase()
    const cmt = (r.comment || r.Comment || '').toLowerCase()
    const act = (r.action || r.Action || '').toLowerCase()
    return src.includes(s) || dst.includes(s) || cmt.includes(s) || act.includes(s)
  })

  return (
    <div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
        <input
          type="text"
          placeholder="Search rules..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-xl border border-surface-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left bg-surface-50">
              <th className="px-4 py-2 font-medium text-surface-500 w-12">#</th>
              <th className="px-4 py-2 font-medium text-surface-500">Chain</th>
              <th className="px-4 py-2 font-medium text-surface-500">Action</th>
              <th className="px-4 py-2 font-medium text-surface-500">Src</th>
              <th className="px-4 py-2 font-medium text-surface-500">Dst</th>
              <th className="px-4 py-2 font-medium text-surface-500">Comment</th>
              <th className="px-4 py-2 font-medium text-surface-500 w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-surface-400">No rules found</td></tr>
            )}
            {filtered.map((rule, i) => {
              const ruleId = rule['.id'] || String(rule.id || i)
              const isDisabled = rule.disabled === 'true' || rule.Disabled === 'true' || rule.disabled === true || rule.Disabled === true
              const isDrop = (rule.action || rule.Action || '') === 'drop'

              return (
                <tr key={ruleId} className="border-t border-surface-100">
                  <td className="px-4 py-2 font-mono text-xs text-surface-400">{ruleId}</td>
                  <td className="px-4 py-2 text-xs">{rule.chain || rule.Chain || '-'}</td>
                  <td className="px-4 py-2">
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-[10px] font-bold',
                      isDrop ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700',
                      isDisabled && 'opacity-40'
                    )}>
                      {isDisabled ? '✕ ' : ''}{rule.action || rule.Action || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs max-w-[120px] truncate">{rule['src-address'] || rule.srcAddress || '*'}</td>
                  <td className="px-4 py-2 font-mono text-xs max-w-[120px] truncate">{rule['dst-address'] || rule.dstAddress || '*'}</td>
                  <td className="px-4 py-2 text-xs text-surface-500 max-w-[180px] truncate">{rule.comment || rule.Comment || '-'}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <button
                        onClick={() => onToggle(ruleId, !isDisabled)}
                        className={cn(
                          'p-1.5 rounded-lg transition-colors text-xs',
                          isDisabled
                            ? 'hover:bg-green-50 text-surface-400 hover:text-green-600'
                            : 'hover:bg-yellow-50 text-surface-600 hover:text-yellow-600'
                        )}
                        title={isDisabled ? 'Enable' : 'Disable'}
                      >
                        {isDisabled ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldBan className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => onDelete(ruleId)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-surface-400 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
