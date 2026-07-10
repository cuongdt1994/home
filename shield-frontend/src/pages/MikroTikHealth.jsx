import { useState, useEffect, useCallback } from 'react';
import client from '../api/client';

export default function MikroTikHealth() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedIface, setSelectedIface] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(10); // seconds, 0 = off
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | running | inactive | disabled | dynamic | physical | virtual

  const fetchHealth = useCallback(async () => {
    try {
      const r = await client.get('/mikrotik/health');
      setHealth(r.data);
      setError('');
    } catch (e) {
      if (!health) setError('Unable to reach MikroTik backend');
      setHealth((prev) => prev ? { ...prev, reachable: false } : prev);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const i = setInterval(fetchHealth, autoRefresh * 1000);
    return () => clearInterval(i);
  }, [autoRefresh, fetchHealth]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-gray-900 rounded-lg border border-gray-800 p-4 h-20" />
          ))}
        </div>
        <div className="h-64 bg-gray-900 rounded-lg border border-gray-800" />
      </div>
    );
  }

  const sys = health?.system || {};
  const mem = health?.memory || {};
  const stor = health?.storage || {};
  const hlt = health?.health || {};
  const ifaces = health?.interfaces?.items || [];
  const summary = health?.interfaces?.summary || {};

  // Filter and search
  let filteredIfaces = ifaces;
  if (search) {
    const q = search.toLowerCase();
    filteredIfaces = filteredIfaces.filter((i) =>
      i.name?.toLowerCase().includes(q) ||
      i.comment?.toLowerCase().includes(q) ||
      i.type?.toLowerCase().includes(q) ||
      i.mac_address?.toLowerCase().includes(q)
    );
  }
  if (filter === 'running') filteredIfaces = filteredIfaces.filter((i) => i.running);
  else if (filter === 'inactive') filteredIfaces = filteredIfaces.filter((i) => !i.running && !i.disabled);
  else if (filter === 'disabled') filteredIfaces = filteredIfaces.filter((i) => i.disabled);
  else if (filter === 'dynamic') filteredIfaces = filteredIfaces.filter((i) => i.dynamic);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-200">MikroTik Health</h2>
        <div className="flex items-center gap-2 text-xs">
          <span className={`w-2 h-2 rounded-full ${
            !health?.reachable ? 'bg-red-500' : health?.partial ? 'bg-yellow-500' : 'bg-green-500'
          }`} />
          <span className="text-gray-500">
            {!health?.reachable ? 'Offline' : health?.partial ? 'Partial' : 'Online'}
          </span>
          {health?.latency_ms != null && (
            <span className="text-gray-600">· {Math.round(health.latency_ms)}ms</span>
          )}
          <select value={autoRefresh} onChange={(e) => setAutoRefresh(parseInt(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-400">
            <option value={0}>No refresh</option>
            <option value={5}>5s</option>
            <option value={10}>10s</option>
            <option value={30}>30s</option>
          </select>
          <button onClick={fetchHealth} disabled={loading}
            className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded bg-gray-800 disabled:opacity-40">
            Refresh
          </button>
        </div>
      </div>

      {/* Warnings */}
      {health?.warnings?.length > 0 && (
        <div className="bg-yellow-900/30 border border-yellow-800 text-yellow-400 text-sm rounded-lg p-3">
          {health.warnings.map((w, i) => <p key={i}>⚠ {w}</p>)}
        </div>
      )}

      {/* Error state */}
      {error && !health?.reachable && (
        <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm rounded-lg p-3">
          {error}
        </div>
      )}

      {/* System cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <StatCard label="Identity" value={sys.identity || health?.system?.board_name || '—'} />
        <StatCard label="Model" value={sys.model || '—'} />
        <StatCard label="Version" value={sys.routeros_version || sys.architecture || '—'} />
        <StatCard label="CPU" value={
          sys.cpu_load_percent != null ? `${sys.cpu_load_percent}%` : '—'
        } warn={sys.cpu_load_percent > 80} />
        <StatCard label="CPU Temp" value={
          hlt.cpu_temperature_c != null ? `${hlt.cpu_temperature_c}°C` : '—'
        } warn={hlt.cpu_temperature_c > 60} />
        <StatCard label="Uptime" value={sys.uptime_display || '—'} />
      </div>

      {/* Memory & Storage */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Memory</h3>
          <div className="space-y-2 text-sm">
            <Row label="Total" value={mem.total_display || '—'} />
            <Row label="Used" value={mem.used_display || '—'} />
            <Row label="Free" value={mem.free_display || '—'} />
            <Row label="Usage" value={mem.usage_percent != null ? `${mem.usage_percent}%` : '—'}
              warn={mem.usage_percent > 85} />
          </div>
          {mem.usage_percent != null && (
            <div className="mt-3 bg-gray-800 rounded-full h-2 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${mem.usage_percent > 85 ? 'bg-red-500' : 'bg-blue-500'}`}
                style={{ width: `${Math.min(mem.usage_percent, 100)}%` }} />
            </div>
          )}
        </div>
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Storage</h3>
          <div className="space-y-2 text-sm">
            <Row label="Total" value={stor.total_bytes != null ? formatBytes(stor.total_bytes) : '—'} />
            <Row label="Used" value={stor.used_bytes != null ? formatBytes(stor.used_bytes) : '—'} />
            <Row label="Free" value={stor.free_bytes != null ? formatBytes(stor.free_bytes) : '—'} />
            <Row label="Usage" value={stor.usage_percent != null ? `${stor.usage_percent}%` : '—'}
              warn={stor.usage_percent > 85} />
          </div>
        </div>
      </div>

      {/* Interfaces */}
      <div className="bg-gray-900 rounded-lg border border-gray-800">
        <div className="p-4 border-b border-gray-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm">
            <h3 className="font-medium text-gray-300">Interfaces</h3>
            <span className="text-gray-500">{summary.total || 0} total</span>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-gray-500">{summary.running || 0} running</span>
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
            <span className="text-gray-500">{summary.inactive || 0} inactive</span>
            <span className="w-1.5 h-1.5 rounded-full bg-gray-600" />
            <span className="text-gray-500">{summary.disabled || 0} disabled</span>
          </div>
          <div className="flex items-center gap-2">
            <input type="text" placeholder="Search..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 w-36 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <select value={filter} onChange={(e) => setFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-400">
              <option value="all">All</option>
              <option value="running">Running</option>
              <option value="inactive">Inactive</option>
              <option value="disabled">Disabled</option>
              <option value="dynamic">Dynamic</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800/30 text-left text-gray-500">
                <th className="px-4 py-2.5 w-8"></th>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5 text-right">RX Total</th>
                <th className="px-4 py-2.5 text-right">TX Total</th>
                <th className="px-4 py-2.5 text-right">RX Pkts</th>
                <th className="px-4 py-2.5 text-right">TX Pkts</th>
                <th className="px-4 py-2.5">MAC</th>
              </tr>
            </thead>
            <tbody>
              {filteredIfaces.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-600">
                    {ifaces.length === 0
                      ? health?.errors?.interfaces === 'command_failed'
                        ? 'SSH is online but interface command failed — check permissions'
                        : health?.reachable
                          ? 'No interface records returned by RouterOS — check account permissions'
                          : 'MikroTik router is unreachable over SSH'
                      : search || filter !== 'all'
                        ? 'No interfaces match filters'
                        : 'No interface data'}
                  </td>
                </tr>
              )}
              {filteredIfaces.map((iface) => (
                <tr key={iface.name} onClick={() => setSelectedIface(iface)}
                  className={`border-t border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer ${
                    iface.disabled ? 'opacity-40' : ''
                  }`}>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      iface.running ? 'bg-green-500' : iface.disabled ? 'bg-gray-600' : 'bg-yellow-500'
                    }`} title={iface.status} />
                  </td>
                  <td className="px-4 py-2.5 text-gray-200 font-mono text-xs">
                    {iface.name}
                    {iface.comment && <span className="text-gray-600 ml-1.5">{iface.comment}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{iface.type || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-right font-mono text-xs">{formatBytes(iface.rx_bytes)}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-right font-mono text-xs">{formatBytes(iface.tx_bytes)}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-right font-mono text-[11px]">{fmtNum(iface.rx_packets)}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-right font-mono text-[11px]">{fmtNum(iface.tx_packets)}</td>
                  <td className="px-4 py-2.5 text-gray-600 font-mono text-[10px]">{iface.mac_address || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interface detail modal */}
      {selectedIface && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedIface(null)}>
          <div className="bg-gray-900 rounded-xl border border-gray-700 p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-200">{selectedIface.name}</h3>
                <span className="text-xs text-gray-500">{selectedIface.type} · {selectedIface.status}</span>
              </div>
              <button onClick={() => setSelectedIface(null)} className="text-gray-500 hover:text-gray-300 text-xl">&times;</button>
            </div>
            <dl className="space-y-2 text-sm">
              {Object.entries(selectedIface)
                .filter(([k]) => !k.startsWith('_') && !k.startsWith('.'))
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between py-1 border-b border-gray-800/50">
                    <dt className="text-gray-500 capitalize">{k.replace(/_/g, ' ')}</dt>
                    <dd className="text-gray-300 font-mono text-xs text-right max-w-[250px] truncate">
                      {v === null ? 'N/A' :
                       v === true ? 'Yes' : v === false ? 'No' :
                       typeof v === 'number' && (k.includes('byte') || k.includes('packet'))
                         ? formatBytes(v) : String(v)}
                    </dd>
                  </div>
                ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Helpers ---

function StatCard({ label, value, warn }) {
  return (
    <div className={`rounded-lg border p-3 ${warn ? 'border-red-800 bg-red-950/30' : 'border-gray-800 bg-gray-900'}`}>
      <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
      <div className={`text-base font-bold mt-0.5 truncate ${warn ? 'text-red-400' : 'text-gray-100'}`}>{value}</div>
    </div>
  );
}

function Row({ label, value, warn }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={`font-mono text-xs ${warn ? 'text-red-400' : 'text-gray-300'}`}>{value}</span>
    </div>
  );
}

function formatBytes(bytes) {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

function fmtNum(n) {
  if (n == null) return '—';
  return n.toLocaleString();
}
