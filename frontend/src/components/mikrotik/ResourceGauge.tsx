import { Cpu, HardDrive, Clock, Microchip } from 'lucide-react'
import { cn } from '../../lib/utils'
import { formatBytes } from '../../lib/utils'

interface Props {
  resources: Record<string, any>
}

export default function ResourceGauge({ resources }: Props) {
  const cpuLoad = parseFloat(resources['cpu-load'] || resources['cpuLoad'] || '0')
  const freeMem = parseFloat(resources['free-memory'] || resources['freeMemory'] || '0')
  const totalMem = parseFloat(resources['total-memory'] || resources['totalMemory'] || '1')
  const usedPercent = totalMem > 0 ? ((totalMem - freeMem) / totalMem) * 100 : 0
  const uptime = resources['uptime'] || 'N/A'
  const cpuCount = resources['cpu-count'] || resources['cpuCount'] || 'N/A'
  const version = resources['version'] || ''

  const gauges = [
    {
      label: 'CPU',
      value: cpuLoad,
      unit: '%',
      icon: Cpu,
      color: cpuLoad > 80 ? 'text-red-500' : cpuLoad > 50 ? 'text-yellow-500' : 'text-green-500',
      bg: cpuLoad > 80 ? 'bg-red-500' : cpuLoad > 50 ? 'bg-yellow-500' : 'bg-green-500',
    },
    {
      label: 'Memory',
      value: usedPercent,
      unit: '%',
      icon: HardDrive,
      color: usedPercent > 80 ? 'text-red-500' : usedPercent > 50 ? 'text-yellow-500' : 'text-green-500',
      bg: usedPercent > 80 ? 'bg-red-500' : usedPercent > 50 ? 'bg-yellow-500' : 'bg-green-500',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {gauges.map((g) => (
        <div key={g.label} className="bg-white rounded-2xl border border-surface-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className={cn('p-2 rounded-lg', g.color.replace('text-', 'bg-').replace('500', '50'))}>
              <g.icon className={cn('w-4 h-4', g.color)} />
            </div>
            <span className="text-xs font-medium text-surface-500">{g.label}</span>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-surface-900">{g.value.toFixed(1)}{g.unit}</p>
          </div>
          <div className="mt-2 h-2 bg-surface-100 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700', g.bg)}
              style={{ width: `${Math.min(g.value, 100)}%` }}
            />
          </div>
        </div>
      ))}

      <div className="bg-white rounded-2xl border border-surface-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-lg bg-slate-50">
            <Clock className="w-4 h-4 text-slate-500" />
          </div>
          <span className="text-xs font-medium text-surface-500">Uptime</span>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-surface-900 font-mono">{uptime}</p>
        </div>
        <p className="text-center text-[10px] text-surface-400 mt-2">{version}</p>
      </div>

      <div className="bg-white rounded-2xl border border-surface-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-lg bg-purple-50">
            <Microchip className="w-4 h-4 text-purple-500" />
          </div>
          <span className="text-xs font-medium text-surface-500">CPU Cores</span>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-surface-900">{cpuCount}</p>
        </div>
        <p className="text-center text-[10px] text-surface-400 mt-2">Free: {formatBytes(freeMem)}</p>
      </div>
    </div>
  )
}
