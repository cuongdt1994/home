import { useState, useEffect, useCallback } from 'react';
import client from '../api/client';

export default function NtopngStats() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedIface, setSelectedIface] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(0);

  const fetchStats = useCallback(async (ifid) => {
    try {
      const params = ifid ? { ifid } : {};
      const r = await client.get('/ntopng/statistics', { params });
      setData(r.data);
      setError('');
    } catch (e) {
      setError('Failed to fetch ntopng data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(selectedIface); }, [selectedIface, fetchStats]);

  useEffect(() => {
    if (!autoRefresh) return;
    const i = setInterval(() => fetchStats(selectedIface), autoRefresh * 1000);
    return () => clearInterval(i);
  }, [autoRefresh, selectedIface, fetchStats]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-gray-900 rounded-lg border border-gray-800 p-4 h-20" />
          ))}
        </div>
      </div>
    );
  }

  const stats = data?.statistics || {};
  const apps = data?.applications || [];
  const hosts = data?.hosts || [];
  const flows = data?.flows || [];
  const ifaces = data?.interfaces || [];

  // Error state
  if (!data?.reachable && !data?.stale) {
    const msg = data?.errors?.message || 'ntopng is unreachable';
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-200">ntopng Statistics</h2>
        <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm rounded-lg p-4">
          <p className="font-medium">⚠ {msg}</p>
          {data?.errors?.interfaces === 'auth_failed' && (
            <p className="mt-1 text-red-500 text-xs">
              ntopng authentication failed — check NTOPNG_USER and NTOPNG_PASSWORD in .env
            </p>
          )}
          {data?.errors?.interfaces === 'connection_failed' && (
            <p className="mt-1 text-red-500 text-xs">
              Cannot reach ntopng. If running in Docker, use the container name (e.g. NTOPNG_BASE_URL=http://ntopng:3000) instead of 127.0.0.1.
            </p>
          )}
        </div>
        <button onClick={() => { setLoading(true); fetchStats(selectedIface); }}
          className="px-4 py-2 bg-blue-600 rounded-lg text-sm hover:bg-blue-700">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-200">ntopng Statistics</h2>
          <span className={`text-xs px-2 py-0.5 rounded ${
            !data?.reachable ? 'bg-red-900/50 text-red-400' :
            data?.partial ? 'bg-yellow-900/50 text-yellow-400' :
            data?.stale ? 'bg-gray-700 text-gray-400' : 'bg-green-900/50 text-green-400'
          }`}>
            {!data?.reachable ? 'Offline' : data?.stale ? 'Stale' : data?.partial ? 'Partial' : 'Live'}
          </span>
          {data?.latency_ms != null && <span className="text-xs text-gray-500">{Math.round(data.latency_ms)}ms</span>}
        </div>
        <div className="flex items-center gap-2">
          <select value={autoRefresh} onChange={(e) => setAutoRefresh(parseInt(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-400">
            <option value={0}>No refresh</option>
            <option value={5}>5s</option>
            <option value={10}>10s</option>
          </select>
          <button onClick={() => fetchStats(selectedIface)}
            className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded bg-gray-800">Refresh</button>
        </div>
      </div>

      {/* Interface selector */}
      {ifaces.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">Interface:</span>
          {ifaces.map((iface) => (
            <button key={iface.ifid} onClick={() => setSelectedIface(iface.ifid)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                (selectedIface || data?.selected_ifid) === iface.ifid
                  ? 'bg-blue-600/20 border-blue-700 text-blue-400'
                  : 'border-gray-700 text-gray-400 hover:border-gray-600'
              }`}>
              {iface.name}
              <span className={`ml-1.5 inline-block w-1.5 h-1.5 rounded-full ${iface.active ? 'bg-green-500' : 'bg-gray-600'}`} />
            </button>
          ))}
        </div>
      )}

      {/* Warnings */}
      {data?.warnings?.length > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-800/50 text-yellow-500 text-xs rounded-lg p-3">
          {data.warnings.map((w, i) => <p key={i}>⚠ {w}</p>)}
        </div>
      )}

      {/* Traffic cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard label="Throughput" value={fmtBitrate(stats.throughput_bps)} />
        <StatCard label="Download" value={fmtBitrate(stats.download_bps)} />
        <StatCard label="Upload" value={fmtBitrate(stats.upload_bps)} />
        <StatCard label="PPS" value={stats.throughput_pps ? `${fmtNum(stats.throughput_pps)} pps` : '—'} />
        <StatCard label="Total Traffic" value={formatBytes(stats.total_bytes)} />
        <StatCard label="Total Packets" value={fmtNum(stats.total_packets)} />
        <StatCard label="Active Hosts" value={stats.active_hosts ?? '—'} />
        <StatCard label="Active Flows" value={stats.active_flows ?? '—'} />
      </div>

      {/* L7 Applications */}
      {apps.length > 0 && (
        <div className="bg-gray-900 rounded-lg border border-gray-800">
          <div className="p-4 border-b border-gray-800">
            <h3 className="text-sm font-medium text-gray-300">Top Applications (L7)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800/30 text-left text-gray-500">
                  <th className="px-4 py-2.5">Application</th>
                  <th className="px-4 py-2.5 text-right">Traffic</th>
                  <th className="px-4 py-2.5 text-right">%</th>
                  <th className="px-4 py-2.5 text-right">Flows</th>
                  <th className="px-4 py-2.5 text-right">Packets</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((a, i) => (
                  <tr key={i} className="border-t border-gray-800/50">
                    <td className="px-4 py-2.5 text-gray-200 text-xs">{a.name}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-right font-mono text-xs">{formatBytes(a.bytes)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-12 bg-gray-800 rounded-full h-1.5 overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(a.percentage || 0, 100)}%` }} />
                        </div>
                        <span className="text-gray-400 w-10 text-right">{a.percentage}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-right font-mono text-xs">{fmtNum(a.flows)}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-right font-mono text-xs">{fmtNum(a.packets)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data?.errors?.applications && apps.length === 0 && (
        <p className="text-xs text-gray-600">
          {data.errors.applications === 'api_error_rc-2'
            ? 'L7 application data not available for this interface (no classified traffic or unsupported edition)'
            : `L7 applications unavailable: ${data.errors.applications}`}
        </p>
      )}

      {/* Hosts + Flows row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {hosts.length > 0 && (
          <div className="bg-gray-900 rounded-lg border border-gray-800">
            <div className="p-4 border-b border-gray-800">
              <h3 className="text-sm font-medium text-gray-300">Top Hosts</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800/30 text-left text-gray-500">
                    <th className="px-4 py-2.5">Host</th>
                    <th className="px-4 py-2.5 text-right">Traffic</th>
                    <th className="px-4 py-2.5 text-right">Flows</th>
                  </tr>
                </thead>
                <tbody>
                  {hosts.map((h, i) => (
                    <tr key={i} className="border-t border-gray-800/50">
                      <td className="px-4 py-2.5 text-gray-200 text-xs">
                        {h.name || h.ip || '—'}
                        {h.local && <span className="ml-1 text-[10px] text-gray-600">(local)</span>}
                      </td>
                      <td className="px-4 py-2.5 text-gray-400 text-right font-mono text-xs">
                        {typeof h.total_bytes === 'number' ? formatBytes(h.total_bytes) : formatBytes(h.throughput)}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-right font-mono text-xs">{fmtNum(h.active_flows)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {flows.length > 0 && (
          <div className="bg-gray-900 rounded-lg border border-gray-800">
            <div className="p-4 border-b border-gray-800">
              <h3 className="text-sm font-medium text-gray-300">Active Flows</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800/30 text-left text-gray-500">
                    <th className="px-4 py-2.5">Client → Server</th>
                    <th className="px-4 py-2.5">App</th>
                    <th className="px-4 py-2.5 text-right">Bytes</th>
                  </tr>
                </thead>
                <tbody>
                  {flows.slice(0, 20).map((f, i) => (
                    <tr key={i} className="border-t border-gray-800/50">
                      <td className="px-4 py-2.5 text-gray-200 text-[11px] font-mono">
                        {f.client_ip}:{f.client_port} → {f.server_ip}:{f.server_port}
                      </td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{f.application || f.proto || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-400 text-right font-mono text-xs">{formatBytes(f.bytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* System info */}
      {data?.system?.version && (
        <div className="text-xs text-gray-600">
          ntopng {data.system.version} {data.system.edition ? `(${data.system.edition})` : ''}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-3">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
      <div className="text-base font-bold mt-0.5 text-gray-100 truncate">{value}</div>
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

function fmtBitrate(bps) {
  if (bps == null) return '—';
  if (bps < 1000) return `${bps} bps`;
  if (bps < 1000000) return `${(bps / 1000).toFixed(0)} Kbps`;
  if (bps < 1000000000) return `${(bps / 1000000).toFixed(1)} Mbps`;
  return `${(bps / 1000000000).toFixed(2)} Gbps`;
}

function fmtNum(n) {
  if (n == null) return '—';
  return n.toLocaleString();
}
