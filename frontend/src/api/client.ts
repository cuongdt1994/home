const BASE = '/api'

function getToken(): string | null {
  return localStorage.getItem('access_token')
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

export async function fetchApi<T = any>(path: string, options?: RequestInit): Promise<T> {
  const headers = await authHeaders()
  const res = await fetch(`${BASE}${path}`, {
    headers: { ...headers, ...options?.headers },
    ...options,
  })

  // If 401, redirect to login
  if (res.status === 401) {
    localStorage.removeItem('access_token')
    localStorage.removeItem('username')
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `API ${res.status}`)
  }
  return res.json()
}

// ── Dashboard ─────────────────────────────
export const getDashboardSummary = () => fetchApi<any>('/dashboard/summary')
export const getHealth = () => fetchApi<any>('/dashboard/health')

// ── Suricata ──────────────────────────────
export const getAlerts = (params?: Record<string, string>) => {
  const q = params ? new URLSearchParams(params).toString() : ''
  return fetchApi<any>(`/suricata/alerts${q ? `?${q}` : ''}`)
}
export const getAlertDetail = (id: number) => fetchApi<any>(`/suricata/alerts/${id}`)
export const getAlertStats = () => fetchApi<any>('/suricata/stats')
export const getRecentAlerts = (limit = 20) => fetchApi<any>(`/suricata/recent?limit=${limit}`)
export const getTopSources = (limit = 10) => fetchApi<any>(`/suricata/top-sources?limit=${limit}`)

// ── ntopng ────────────────────────────────
export const getInterfaceData = () => fetchApi<any>('/ntopng/interface')
export const getActiveHosts = () => fetchApi<any>('/ntopng/hosts')
export const getTopTalkers = (limit = 10) => fetchApi<any>(`/ntopng/top-talkers?limit=${limit}`)
export const getTrafficHistory = (limit = 100) => fetchApi<any>(`/ntopng/traffic-history?limit=${limit}`)
export const getHostDetail = (ip: string) => fetchApi<any>(`/ntopng/host/${ip}`)

// ── MikroTik ──────────────────────────────
export const getMikrotikStatus = () => fetchApi<any>('/mikrotik/status')
export const getInterfaces = () => fetchApi<any>('/mikrotik/interfaces')
export const getFirewallRules = () => fetchApi<any>('/mikrotik/firewall')
export const blockIp = (srcIp: string, comment = 'Manual block') =>
  fetchApi<any>(`/mikrotik/firewall/block?src_ip=${encodeURIComponent(srcIp)}&comment=${encodeURIComponent(comment)}`, { method: 'POST' })
export const toggleFirewallRule = (ruleId: string, disable: boolean) =>
  fetchApi<any>(`/mikrotik/firewall/${ruleId}/toggle?disable=${disable}`, { method: 'POST' })
export const deleteFirewallRule = (ruleId: string) =>
  fetchApi<any>(`/mikrotik/firewall/${ruleId}`, { method: 'DELETE' })
export const getArpTable = () => fetchApi<any>('/mikrotik/arp')

// ── AI ────────────────────────────────────
export const analyzeAlert = (alertId: number) =>
  fetchApi<any>(`/ai/analyze/${alertId}`, { method: 'POST' })
export const blockFromAlert = (alertId: number) =>
  fetchApi<any>(`/ai/block/${alertId}`, { method: 'POST' })
export const getAnalysisHistory = (limit = 50) => fetchApi<any>(`/ai/history?limit=${limit}`)
export const getBlockHistory = (limit = 50) => fetchApi<any>(`/ai/blocks?limit=${limit}`)
