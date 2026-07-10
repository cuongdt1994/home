import { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import client from '../api/client';
import useSSE from '../hooks/useSSE';
import { useToast } from '../components/shared/Toast';

const COLORS = ['#ef4444', '#f97316', '#eab308', '#3b82f6', '#22c55e'];

export default function Overview() {
  const [data, setData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const addToast = useToast();

  const fetchOverview = useCallback(async () => {
    try {
      const [overviewRes, alertsRes] = await Promise.all([
        client.get('/overview'),
        client.get('/alerts/stats', { params: { hours: 24 } }),
      ]);
      setData(overviewRes.data);
      setAlerts(alertsRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  // Realtime SSE events → toast notifications
  const handleSSEEvent = useCallback((event) => {
    if (event.type === 'ai_decision' && event.data?.is_malicious) {
      addToast(`🧠 AI flagged ${event.data.src_ip}: ${event.data.reason}`, 'warning');
    } else if (event.type === 'blocked_ip' && !event.data?.dry_run) {
      addToast(`🚫 Blocked ${event.data.ip_address}: ${event.data.reason}`, 'error', 8000);
    } else if (event.type === 'blocked_ip' && event.data?.dry_run) {
      addToast(`🔸 DRY-RUN would block ${event.data.ip_address}`, 'info');
    }
  }, [addToast]);

  const { connected } = useSSE(handleSSEEvent, { enabled: true });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-gray-900 rounded-lg border border-gray-800 p-4 animate-pulse">
              <div className="h-4 bg-gray-800 rounded w-20 mb-2" />
              <div className="h-8 bg-gray-800 rounded w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-200">Overview</h2>
        <div className="flex items-center gap-2 text-xs">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-gray-500">{connected ? 'Live' : 'Polling'}</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Alerts (24h)" value={data?.alerts_24h ?? 0} color="blue" />
        <StatCard label="AI Reports" value={data?.ai_reports_24h ?? 0} color="purple" />
        <StatCard label="Malicious" value={data?.malicious_24h ?? 0} color="red" />
        <StatCard label="Blocked IPs" value={data?.total_blocked_ips ?? 0} color="orange" />
        <StatCard label="Dry Run" value={data?.dry_run ? 'ON' : 'OFF'} color={data?.dry_run ? 'yellow' : 'green'} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Severity distribution */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Alert Severity Distribution</h3>
          {alerts?.by_severity ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={Object.entries(alerts.by_severity).map(([k, v]) => ({ name: `Sev ${k}`, value: v }))}
                  cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {Object.keys(alerts.by_severity).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-600 text-center py-8">No data</p>}
        </div>

        {/* Top sources */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Top Source IPs (24h)</h3>
          {alerts?.top_sources?.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={alerts.top_sources.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" stroke="#6b7280" fontSize={11} />
                <YAxis type="category" dataKey="src_ip" stroke="#6b7280" fontSize={11} width={120} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-600 text-center py-8">No data</p>}
        </div>
      </div>

      {/* Service health */}
      <h3 className="text-lg font-semibold text-gray-300">Service Health</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {data?.services && Object.entries(data.services).map(([name, status]) => (
          <ServiceHealthCard key={name} name={name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} status={status} />
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, color = 'blue' }) {
  const colors = {
    blue: 'border-blue-800 bg-blue-950/30', purple: 'border-purple-800 bg-purple-950/30',
    red: 'border-red-800 bg-red-950/30', orange: 'border-orange-800 bg-orange-950/30',
    green: 'border-green-800 bg-green-950/30', yellow: 'border-yellow-800 bg-yellow-950/30',
  };
  return (
    <div className={`rounded-lg border p-4 ${colors[color] || colors.blue}`}>
      <div className="text-xs text-gray-400 uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold text-white mt-1">{value}</div>
    </div>
  );
}

function ServiceHealthCard({ name, status }) {
  const ok = status?.ok ?? false;
  const latency = status?.latency_ms;
  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{name}</span>
        <span className={`w-2 h-2 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
      </div>
      <div className={`text-sm font-semibold mt-1 ${ok ? 'text-green-400' : 'text-red-400'}`}>
        {ok ? 'Online' : 'Offline'}
      </div>
      {latency != null && <span className="text-xs text-gray-600">{Math.round(latency)}ms</span>}
    </div>
  );
}
