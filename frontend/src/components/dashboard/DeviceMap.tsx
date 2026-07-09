import { Wifi, Server, Monitor, Smartphone, Router } from 'lucide-react'
import type { Device } from '../../types'
import { cn } from '../../lib/utils'

interface Props {
  devices: Device[]
}

const iconMap: Record<string, typeof Wifi> = {
  router: Router,
  server: Server,
  workstation: Monitor,
  mobile: Smartphone,
  iot: Wifi,
  unknown: Wifi,
}

export default function DeviceMap({ devices }: Props) {
  if (devices.length === 0) {
    return <p className="text-sm text-surface-400 text-center py-8">No devices discovered</p>
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {devices.map((d) => {
        const Icon = iconMap[d.device_type] || iconMap.unknown
        return (
          <div
            key={d.id}
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-200 hover:shadow-md',
              d.is_online
                ? 'bg-white border-surface-200 hover:border-primary-200'
                : 'bg-surface-50 border-surface-200 opacity-60'
            )}
          >
            <div className={cn(
              'p-3 rounded-xl',
              d.is_online ? 'bg-primary-50 text-primary-500' : 'bg-surface-100 text-surface-400'
            )}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="text-center min-w-0 w-full">
              <p className="text-sm font-medium text-surface-800 truncate">
                {d.hostname || d.ip_address}
              </p>
              <p className="text-xs text-surface-400 font-mono truncate">{d.ip_address}</p>
              {d.mac_address && (
                <p className="text-[10px] text-surface-300 font-mono truncate">{d.mac_address}</p>
              )}
            </div>
            <span className={cn(
              'px-2 py-0.5 rounded-full text-[10px] font-bold',
              d.is_online ? 'bg-green-50 text-green-700' : 'bg-surface-100 text-surface-500'
            )}>
              {d.is_online ? 'Online' : 'Offline'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
