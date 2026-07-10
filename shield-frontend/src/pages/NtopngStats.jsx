import { useState, useEffect } from 'react';
import client from '../api/client';
import DataTable from '../components/shared/DataTable';

export default function NtopngStats() {
  const [topHosts, setTopHosts] = useState([]);
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      client.get('/ntopng/top-hosts', { params: { limit: 20 } }),
      client.get('/ntopng/active-flows', { params: { limit: 50 } }),
    ])
      .then(([hostsRes, flowsRes]) => {
        setTopHosts(hostsRes.data.data || []);
        setFlows(flowsRes.data.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const hostColumns = [
    { key: 'ip', label: 'Host IP', render: (r) => r.label || r.ip || JSON.stringify(r).slice(0, 40) },
    { key: 'bytes_sent', label: 'Bytes Sent', render: (r) => r.bytes?.sent || '—' },
    { key: 'bytes_rcvd', label: 'Bytes Received', render: (r) => r.bytes?.rcvd || '—' },
    { key: 'throughput', label: 'Throughput', render: (r) => r.throughput?.value || '—' },
  ];

  const flowColumns = [
    { key: 'client', label: 'Client', render: (r) => r.client?.ip || JSON.stringify(r).slice(0, 40) },
    { key: 'server', label: 'Server', render: (r) => r.server?.ip || '—' },
    { key: 'proto', label: 'Proto', render: (r) => r.protocol || r.proto || '—' },
    { key: 'bytes', label: 'Bytes', render: (r) => r.bytes || '—' },
    { key: 'duration', label: 'Duration', render: (r) => r.duration || '—' },
  ];

  if (loading) {
    return <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mt-20" />;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-200">ntopng Statistics</h2>

      <h3 className="text-lg font-semibold text-gray-300">Top Hosts</h3>
      <DataTable columns={hostColumns} data={topHosts} emptyMessage="No host data available" />

      <h3 className="text-lg font-semibold text-gray-300 mt-6">Active Flows</h3>
      <DataTable columns={flowColumns} data={flows} emptyMessage="No active flows" />
    </div>
  );
}
