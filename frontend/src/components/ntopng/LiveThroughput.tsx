import { useEffect, useState, useRef } from 'react'
import { ArrowUp, ArrowDown, Gauge } from 'lucide-react'
import { formatBitsPerSec } from '../../lib/utils'

interface Props {
  bytesIn: number
  bytesOut: number
}

export default function LiveThroughput({ bytesIn, bytesOut }: Props) {
  const [currentIn, setCurrentIn] = useState(0)
  const [currentOut, setCurrentOut] = useState(0)
  const prevRef = useRef({ in: bytesIn, out: bytesOut, time: Date.now() })

  useEffect(() => {
    const now = Date.now()
    const elapsed = (now - prevRef.current.time) / 1000 // seconds
    if (elapsed > 0) {
      const bytesPerSecIn = (bytesIn - prevRef.current.in) / elapsed
      const bytesPerSecOut = (bytesOut - prevRef.current.out) / elapsed
      setCurrentIn(Math.max(0, bytesPerSecIn))
      setCurrentOut(Math.max(0, bytesPerSecOut))
    }
    prevRef.current = { in: bytesIn, out: bytesOut, time: now }
  }, [bytesIn, bytesOut])

  const total = currentIn + currentOut

  return (
    <div className="bg-white rounded-2xl border border-surface-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Gauge className="w-5 h-5 text-primary-500" />
        <h3 className="font-semibold text-surface-900">Live Throughput</h3>
      </div>

      <div className="text-center mb-4">
        <p className="text-3xl font-bold text-surface-900">{formatBitsPerSec(total * 8)}</p>
        <p className="text-xs text-surface-400 mt-1">Total bandwidth</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-blue-600 text-xs font-medium mb-1">
            <ArrowDown className="w-3 h-3" />
            Download
          </div>
          <p className="text-lg font-bold text-blue-700">{formatBitsPerSec(currentIn * 8)}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-green-600 text-xs font-medium mb-1">
            <ArrowUp className="w-3 h-3" />
            Upload
          </div>
          <p className="text-lg font-bold text-green-700">{formatBitsPerSec(currentOut * 8)}</p>
        </div>
      </div>
    </div>
  )
}
