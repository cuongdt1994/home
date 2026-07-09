import { useEffect, useState, useRef } from 'react'
import { ArrowUp, ArrowDown, Gauge } from 'lucide-react'
import { formatBitsPerSec } from '../../lib/utils'

interface Props { bytesIn: number; bytesOut: number }

export default function LiveThroughput({ bytesIn, bytesOut }: Props) {
  const [currentIn, setCurrentIn] = useState(0)
  const [currentOut, setCurrentOut] = useState(0)
  const prevRef = useRef({ in: bytesIn, out: bytesOut, time: Date.now() })

  useEffect(() => {
    const now = Date.now()
    const elapsed = (now - prevRef.current.time) / 1000
    if (elapsed > 0) {
      setCurrentIn(Math.max(0, (bytesIn - prevRef.current.in) / elapsed))
      setCurrentOut(Math.max(0, (bytesOut - prevRef.current.out) / elapsed))
    }
    prevRef.current = { in: bytesIn, out: bytesOut, time: now }
  }, [bytesIn, bytesOut])

  const total = currentIn + currentOut

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600"><Gauge className="w-5 h-5" /></div>
        <div><h3 className="font-semibold text-slate-900">Live Throughput</h3><p className="text-xs text-slate-400">Current bandwidth</p></div>
      </div>
      <div className="text-center mb-6">
        <p className="text-4xl font-bold text-slate-900 tracking-tight">{formatBitsPerSec(total * 8)}</p>
        <p className="text-sm text-slate-400 mt-1">Total throughput</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-brand-50 rounded-2xl p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 text-brand-600 text-xs font-semibold mb-1.5">
            <ArrowDown className="w-3.5 h-3.5" /> Download
          </div>
          <p className="text-xl font-bold text-brand-700">{formatBitsPerSec(currentIn * 8)}</p>
        </div>
        <div className="bg-emerald-50 rounded-2xl p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 text-emerald-600 text-xs font-semibold mb-1.5">
            <ArrowUp className="w-3.5 h-3.5" /> Upload
          </div>
          <p className="text-xl font-bold text-emerald-700">{formatBitsPerSec(currentOut * 8)}</p>
        </div>
      </div>
    </div>
  )
}
