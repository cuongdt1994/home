import { EthernetPort, Wifi } from 'lucide-react'
import { formatBytes } from '../../lib/utils'
import { cn } from '../../lib/utils'

interface InterfaceData {
  name?: string
  Name?: string
  type?: string
  Type?: string
  'mac-address'?: string
  macAddress?: string
  'rx-byte'?: string | number
  rxByte?: string | number
  'tx-byte'?: string | number
  txByte?: string | number
  running?: string | boolean
  Running?: string | boolean
  disabled?: string | boolean
  [key: string]: any
}

interface Props {
  interfaces: InterfaceData[]
}

export default function InterfaceList({ interfaces }: Props) {
  if (interfaces.length === 0) {
    return <p className="text-sm text-surface-400 text-center py-8">No interfaces found</p>
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {interfaces.map((iface, i) => {
        const name = iface.name || iface.Name || `iface-${i}`
        const isRunning = iface.running || iface.Running || iface.disabled === 'false' || iface.disabled === false
        const rxBytes = Number(iface['rx-byte'] || iface.rxByte || 0)
        const txBytes = Number(iface['tx-byte'] || iface.txByte || 0)
        const isWireless = (iface.type || iface.Type || '').toLowerCase().includes('wireless') || name.toLowerCase().includes('wlan')

        return (
          <div
            key={i}
            className={cn(
              'bg-white rounded-2xl border p-4 transition-all hover:shadow-sm',
              isRunning ? 'border-surface-200' : 'border-surface-100 opacity-60'
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={cn('p-2 rounded-lg', isRunning ? 'bg-primary-50 text-primary-500' : 'bg-surface-100 text-surface-400')}>
                  {isWireless ? <Wifi className="w-4 h-4" /> : <EthernetPort className="w-4 h-4" />}
                </div>
                <div>
                  <p className="font-semibold text-surface-800 text-sm">{name}</p>
                  <p className="text-[10px] text-surface-400 font-mono">{iface['mac-address'] || iface.macAddress || '-'}</p>
                </div>
              </div>
              <span className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-bold',
                isRunning ? 'bg-green-50 text-green-700' : 'bg-surface-100 text-surface-500'
              )}>
                {isRunning ? 'Running' : 'Down'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-surface-50 rounded-lg p-2">
                <p className="text-surface-400">RX</p>
                <p className="font-semibold text-surface-700 font-mono">{formatBytes(rxBytes)}</p>
              </div>
              <div className="bg-surface-50 rounded-lg p-2">
                <p className="text-surface-400">TX</p>
                <p className="font-semibold text-surface-700 font-mono">{formatBytes(txBytes)}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
