import { useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import DataTable from '../components/shared/DataTable';
import Pagination from '../components/shared/Pagination';
import { RiskBadge, ActionBadge } from '../components/shared/StatusBadge';

export default function BlockedIPs() {
  const [data, setData] = useState({ items: [], total: 0, page: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 50;

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const r = await client.get('/blocked-ips', { params: { page, limit } });
      setData(r.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetch(); }, [fetch]);

  const columns = [
    { key: 'blocked_at', label: 'Blocked At', render: (r) => r.blocked_at?.slice(0, 19) || '—' },
    { key: 'ip_address', label: 'IP Address' },
    { key: 'risk_score', label: 'Risk', render: (r) => <RiskBadge score={r.risk_score} /> },
    { key: 'reason', label: 'Reason' },
    { key: 'action', label: 'Action', render: (r) => <ActionBadge action={r.action} /> },
    { key: 'dry_run', label: 'Dry Run', render: (r) => r.dry_run ? '🔸 Yes' : '🔹 No' },
    { key: 'mikrotik_result', label: 'Result', render: (r) => (
      <span title={r.mikrotik_result} className="truncate block max-w-[150px]">{r.mikrotik_result || '—'}</span>
    )},
    { key: 'expires_at', label: 'Expires', render: (r) => r.expires_at?.slice(0, 10) || '—' },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-200">Blocked IP History</h2>
      <DataTable columns={columns} data={data.items} loading={loading} emptyMessage="No IPs blocked yet" />
      <Pagination page={page} total={data.total} limit={limit} onPageChange={setPage} />
    </div>
  );
}
