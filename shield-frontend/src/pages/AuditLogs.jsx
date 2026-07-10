import { useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import DataTable from '../components/shared/DataTable';
import Pagination from '../components/shared/Pagination';
import { ActionBadge } from '../components/shared/StatusBadge';

export default function AuditLogs() {
  const [data, setData] = useState({ items: [], total: 0, page: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 50;

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const r = await client.get('/audit-logs', { params: { page, limit } });
      setData(r.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetch(); }, [fetch]);

  const columns = [
    { key: 'timestamp', label: 'Timestamp', render: (r) => r.timestamp?.slice(0, 19) || '—' },
    { key: 'src_ip', label: 'Source IP' },
    { key: 'risk_score', label: 'Risk', render: (r) => (
      <span className={`font-mono ${r.risk_score >= 8 ? 'text-red-400' : r.risk_score >= 5 ? 'text-orange-400' : 'text-green-400'}`}>
        {r.risk_score}/10
      </span>
    )},
    { key: 'reason', label: 'Reason', render: (r) => <span className="truncate block max-w-xs">{r.reason}</span> },
    { key: 'dry_run', label: 'Dry Run', render: (r) => r.dry_run ? '🔸 Yes' : '🔹 No' },
    { key: 'action', label: 'Action', render: (r) => <ActionBadge action={r.action} /> },
    { key: 'result', label: 'Result' },
    { key: 'deepseek_latency_ms', label: 'AI Latency', render: (r) => r.deepseek_latency_ms ? `${Math.round(r.deepseek_latency_ms)}ms` : '—' },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-200">Audit Logs</h2>
      <DataTable columns={columns} data={data.items} loading={loading} emptyMessage="No audit entries yet" />
      <Pagination page={page} total={data.total} limit={limit} onPageChange={setPage} />
    </div>
  );
}
