import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

export function formatBitsPerSec(bps: number): string {
  if (bps === 0) return '0 bps'
  const units = ['bps', 'Kbps', 'Mbps', 'Gbps']
  const i = Math.floor(Math.log(bps) / Math.log(1000))
  return `${(bps / Math.pow(1000, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN')
  } catch {
    return iso
  }
}

export function formatRelativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const secs = Math.floor(diff / 1000)
    if (secs < 60) return `${secs}s ago`
    const mins = Math.floor(secs / 60)
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  } catch {
    return iso
  }
}

export function severityLabel(severity: number): string {
  switch (severity) {
    case 1: return 'Critical'
    case 2: return 'High'
    case 3: return 'Medium'
    default: return 'Low'
  }
}

export function severityColor(severity: number): string {
  switch (severity) {
    case 1: return 'text-red-600 bg-red-50 border-red-200'
    case 2: return 'text-orange-600 bg-orange-50 border-orange-200'
    case 3: return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    default: return 'text-slate-500 bg-slate-50 border-slate-200'
  }
}

export function decisionColor(decision: string): string {
  switch (decision) {
    case 'block': return 'text-red-600 bg-red-50'
    case 'flag': return 'text-yellow-600 bg-yellow-50'
    case 'allow': return 'text-green-600 bg-green-50'
    default: return 'text-slate-500 bg-slate-50'
  }
}
