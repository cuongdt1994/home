// ── Alert ─────────────────────────────────────────────
export interface Alert {
  id: number
  timestamp: string
  src_ip: string
  src_port: number | null
  dest_ip: string
  dest_port: number | null
  proto: string
  alert_signature: string
  alert_category: string
  alert_severity: number // 1=Critical, 2=High, 3=Medium, 4=Low
  alert_action: string
  created_at: string
}

export interface AlertStats {
  total_alerts: number
  critical: number
  high: number
  medium: number
  today: number
}

// ── Device ────────────────────────────────────────────
export interface Device {
  id: number
  ip_address: string
  mac_address: string | null
  hostname: string | null
  vendor: string | null
  device_type: string
  first_seen: string
  last_seen: string
  is_online: boolean
}

// ── Traffic ───────────────────────────────────────────
export interface TrafficStat {
  time: string
  bytes_in: number
  bytes_out: number
  packets_in: number
  packets_out: number
  active_hosts: number
  active_flows: number
}

export interface InterfaceStats {
  bytes?: { rcvd: number; sent: number }
  packets?: { rcvd: number; sent: number }
  num_hosts?: number
  num_flows?: number
  speed?: number
}

// ── MikroTik ──────────────────────────────────────────
export interface FirewallRule {
  id: number
  mikrotik_id: string | null
  chain: string
  action: string
  src_ip: string | null
  comment: string | null
  disabled: boolean
  source: string
  created_at: string
  expires_at: string | null
}

export interface SystemResource {
  [key: string]: string | number
}

// ── AI ────────────────────────────────────────────────
export interface Analysis {
  id: number
  alert_id: number
  decision: 'block' | 'flag' | 'allow'
  confidence: number
  reasoning: string
  analyzed_at: string
}

export interface BlockEvent {
  id: number
  analysis_id: number | null
  target_ip: string
  action: string
  triggered_by: string
  comment: string | null
  created_at: string
}

// ── Dashboard ─────────────────────────────────────────
export interface DashboardStats {
  total_alerts: number
  critical_alerts: number
  online_devices: number
  total_devices: number
  total_blocks: number
}

export interface DashboardSummary {
  stats: DashboardStats
  recent_alerts: Alert[]
}

// ── WebSocket ─────────────────────────────────────────
export interface WSMessage {
  type: 'alert' | 'traffic' | 'device' | 'analysis' | 'block' | 'heartbeat' | 'connected'
  payload: any
  timestamp: string
}
