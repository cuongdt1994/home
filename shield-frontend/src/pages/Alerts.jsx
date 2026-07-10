import { useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import DataTable from '../components/shared/DataTable';
import Pagination from '../components/shared/Pagination';
import { SeverityBadge } from '../components/shared/StatusBadge';

export default function SuricataAlerts() {
  const [data, setData] = useState({ items: [], total: 0, page: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [srcIp, setSrcIp] = useState('');
  const limit = 50;

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (srcIp) params.src_ip = srcIp;
      const r = await client.get('/alerts', { params });
      setData(r.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, srcIp]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const columns = [
    { key: 'timestamp', label: 'Time', render: (r) => r.timestamp?.slice(11, 19) || '—' },
    { key: 'src_ip', label: 'Source IP' },
    { key: 'src_port', label: 'Src Port' },
    { key: 'dest_ip', label: 'Dest IP' },
    { key: 'dest_port', label: 'Dest Port' },
    { key: 'event_type', label: 'Type' },
    { key: 'alert_category', label: 'Category' },
    { key: 'alert_severity', label: 'Sev', render: (r) => <SeverityBadge severity={r.alert_severity} /> },
    { key: 'alert_signature', label: 'Signature', render: (r) => (
      <span title={r.alert_signature} className="truncate block max-w-xs">{r.alert_signature}</span>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-200">Suricata Alerts</h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Filter by source IP..."
            value={srcIp}
            onChange={(e) => { setSrcIp(e.target.value); setPage(1); }}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
          />
        </div>
      </div>
      <DataTable columns={columns} data={data.items} loading={loading} emptyMessage="No alerts found" />
      <Pagination page={page} total={data.total} limit={limit} onPageChange={setPage} />
    </div>
  );
}
