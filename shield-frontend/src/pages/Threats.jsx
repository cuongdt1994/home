import { useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import DataTable from '../components/shared/DataTable';
import Pagination from '../components/shared/Pagination';
import { RiskBadge, MaliciousBadge } from '../components/shared/StatusBadge';

export default function AIDecisions() {
  const [data, setData] = useState({ items: [], total: 0, page: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 50;

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const r = await client.get('/ai-reports', { params: { page, limit } });
      setData(r.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetch(); }, [fetch]);

  const columns = [
    { key: 'created_at', label: 'Time', render: (r) => r.created_at?.slice(0, 19) || '—' },
    { key: 'src_ip', label: 'Source IP' },
    { key: 'is_malicious', label: 'Verdict', render: (r) => <MaliciousBadge isMalicious={r.is_malicious} /> },
    { key: 'risk_score', label: 'Risk', render: (r) => <RiskBadge score={r.risk_score} /> },
    { key: 'reason', label: 'Reason' },
    { key: 'action_taken', label: 'Action' },
    { key: 'latency_ms', label: 'AI Latency', render: (r) => r.latency_ms ? `${Math.round(r.latency_ms)}ms` : '—' },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-200">AI Threat Reports</h2>
      <DataTable columns={columns} data={data.items} loading={loading} emptyMessage="No AI reports yet" />
      <Pagination page={page} total={data.total} limit={limit} onPageChange={setPage} />
    </div>
  );
}
