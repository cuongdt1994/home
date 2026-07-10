import { useState, useEffect } from 'react';
import client from '../api/client';
import ServiceHealthCard from '../components/shared/ServiceHealthCard';

export default function MikroTikHealth() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/mikrotik/health')
      .then((r) => setHealth(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mt-20" />;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-200">MikroTik Health</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="CPU Load" value={health?.cpu_percent != null ? `${health.cpu_percent}%` : '—'} />
        <StatCard label="Memory" value={health?.memory_percent != null ? `${health.memory_percent}%` : '—'} />
        <StatCard label="Total RAM" value={health?.total_memory_mb != null ? `${health.total_memory_mb} MB` : '—'} />
        <StatCard label="Uptime" value={health?.uptime || '—'} />
      </div>

      {health?.interfaces?.length > 0 && (
        <>
          <h3 className="text-lg font-semibold text-gray-300 mt-6">Interfaces</h3>
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800/50 text-left">
                  <th className="px-4 py-3 text-gray-400">Name</th>
                  <th className="px-4 py-3 text-gray-400">RX Bytes</th>
                  <th className="px-4 py-3 text-gray-400">TX Bytes</th>
                </tr>
              </thead>
              <tbody>
                {health.interfaces.map((iface, i) => (
                  <tr key={i} className="border-t border-gray-800/50">
                    <td className="px-4 py-3 text-gray-300 font-mono text-xs">{iface.name || iface.raw}</td>
                    <td className="px-4 py-3 text-gray-400">{iface.rx_bytes || '—'}</td>
                    <td className="px-4 py-3 text-gray-400">{iface.tx_bytes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <div className="text-sm text-gray-400">{label}</div>
      <div className="text-xl font-bold text-white mt-1">{value}</div>
    </div>
  );
}
