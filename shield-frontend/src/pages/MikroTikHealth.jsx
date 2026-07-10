import { useState, useEffect, useCallback } from 'react';
import client from '../api/client';

export default function MikroTikHealth() {
  const [health, setHealth] = useState(null);
  const [interfaces, setInterfaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedIface, setSelectedIface] = useState(null);

  const fetchHealth = useCallback(async () => {
    try {
      const [hRes, iRes] = await Promise.all([
        client.get('/mikrotik/health'),
        client.get('/mikrotik/interfaces'),
      ]);
      setHealth(hRes.data.data || hRes.data);
      setInterfaces(iRes.data.data || []);
      setError('');
    } catch (e) {
      setError('Failed to fetch MikroTik data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-gray-900 rounded-lg border border-gray-800 p-4 h-20" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !health) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 text-lg">⚠ {error}</p>
        <button onClick={fetchHealth} className="mt-4 px-4 py-2 bg-blue-600 rounded-lg text-sm hover:bg-blue-700">
          Retry
        </button>
      </div>
    );
  }

  const running = interfaces.filter((i) => i.running && !i.disabled).length;
  const total = interfaces.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-200">MikroTik Health</h2>
        <button onClick={fetchHealth} className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1 rounded bg-gray-800">
          Refresh
        </button>
      </div>

      {/* System resource cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="CPU Load" value={health?.cpu_percent != null ? `${health.cpu_percent}%` : '—'} warn={health?.cpu_percent > 80} />
        <StatCard label="Memory" value={health?.memory_percent != null ? `${health.memory_percent}%` : '—'} warn={health?.memory_percent > 85} />
        <StatCard label="Total RAM" value={health?.total_memory_mb ? `${health.total_memory_mb} MB` : '—'} />
        <StatCard label="Uptime" value={health?.uptime || '—'} />
        <StatCard label="Model" value={health?.board_name || health?.version || '—'} />
      </div>

      {/* Interface summary */}
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <span className="text-gray-300 font-medium">{total} interfaces</span>
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        <span>{running} running</span>
        <span className="w-1.5 h-1.5 rounded-full bg-gray-600" />
        <span>{total - running} inactive/disabled</span>
      </div>

      {/* Interface table */}
      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800/50 text-left">
              <th className="px-4 py-3 text-gray-400 font-medium w-8"></th>
              <th className="px-4 py-3 text-gray-400 font-medium">Name</th>
              <th className="px-4 py-3 text-gray-400 font-medium text-right">RX</th>
              <th className="px-4 py-3 text-gray-400 font-medium text-right">TX</th>
              <th className="px-4 py-3 text-gray-400 font-medium text-right">RX Pkts</th>
              <th className="px-4 py-3 text-gray-400 font-medium text-right">TX Pkts</th>
              <th className="px-4 py-3 text-gray-400 font-medium">MAC</th>
            </tr>
          </thead>
          <tbody>
            {interfaces.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-600">
                  No interface data — MikroTik may be unreachable
                </td>
              </tr>
            )}
            {interfaces.map((iface, i) => (
              <tr
                key={iface.name || i}
                onClick={() => setSelectedIface(iface)}
                className={`border-t border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer ${
                  iface.disabled ? 'opacity-40' : ''
                }`}
              >
                <td className="px-4 py-2.5">
                  <span className={`inline-block w-2 h-2 rounded-full ${
                    iface.running ? 'bg-green-500' : iface.disabled ? 'bg-gray-600' : 'bg-red-500'
                  }`} title={iface.running ? 'Running' : iface.disabled ? 'Disabled' : 'Down'} />
                </td>
                <td className="px-4 py-2.5 text-gray-200 font-mono text-xs">
                  {iface.name}
                  {iface.comment && <span className="text-gray-600 ml-1">— {iface.comment}</span>}
                </td>
                <td className="px-4 py-2.5 text-gray-400 text-right font-mono text-xs">{_formatBytes(iface.rx_bytes)}</td>
                <td className="px-4 py-2.5 text-gray-400 text-right font-mono text-xs">{_formatBytes(iface.tx_bytes)}</td>
                <td className="px-4 py-2.5 text-gray-500 text-right font-mono text-xs">{_formatNum(iface.rx_packets)}</td>
                <td className="px-4 py-2.5 text-gray-500 text-right font-mono text-xs">{_formatNum(iface.tx_packets)}</td>
                <td className="px-4 py-2.5 text-gray-600 font-mono text-[11px]">{iface.mac_address || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail modal */}
      {selectedIface && (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4" onClick={() => setSelectedIface(null)}>
          <div className="bg-gray-900 rounded-xl border border-gray-700 p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-200">{selectedIface.name}</h3>
              <button onClick={() => setSelectedIface(null)} className="text-gray-500 hover:text-gray-300 text-xl">&times;</button>
            </div>
            <dl className="space-y-2 text-sm">
              {Object.entries(selectedIface).filter(([k]) => !k.startsWith('_')).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-gray-500 capitalize">{k.replace(/_/g, ' ')}</dt>
                  <dd className="text-gray-300 font-mono text-xs">
                    {typeof v === 'boolean' ? (v ? '✅' : '❌') :
                     typeof v === 'number' && (k.includes('byte') || k.includes('packet')) ? _formatBytes(v) :
                     String(v ?? '—')}
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

function StatCard({ label, value, warn }) {
  return (
    <div className={`rounded-lg border p-4 ${
      warn ? 'border-red-800 bg-red-950/30' : 'border-gray-800 bg-gray-900'
    }`}>
      <div className="text-xs text-gray-400 uppercase tracking-wider">{label}</div>
      <div className={`text-xl font-bold mt-1 ${warn ? 'text-red-400' : 'text-white'}`}>{value}</div>
    </div>
  );
}

function _formatBytes(bytes) {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

function _formatNum(n) {
  if (n == null) return '—';
  return n.toLocaleString();
}
