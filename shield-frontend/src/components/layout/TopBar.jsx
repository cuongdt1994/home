import { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../../context/AuthContext';
import client from '../../api/client';

export default function TopBar() {
  const { user, logout } = useContext(AuthContext);
  const [health, setHealth] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const r = await client.get('/overview');
        setHealth(r.data?.services || {});
      } catch (e) { /* ignore */ }
    };
    fetchHealth();
    const i = setInterval(fetchHealth, 30000);
    return () => clearInterval(i);
  }, []);

  const okCount = Object.values(health).filter((s) => s?.ok).length;
  const total = Object.keys(health).length || 1;
  const allOk = okCount === total && total > 0;

  return (
    <header className="h-12 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 shrink-0">
      {/* Mobile menu button */}
      <button
        className="lg:hidden text-gray-400 hover:text-gray-200 p-1"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle sidebar"
      >
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Status bar */}
      <div className="hidden sm:flex items-center gap-3 text-xs">
        <StatusDot label="BE" ok={allOk} />
        {Object.entries(health).slice(0, 4).map(([key, s]) => (
          <StatusDot key={key} label={key.replace(/_/g, ' ').split(' ').map(w => w[0]?.toUpperCase() || '').join('')} ok={s?.ok} />
        ))}
        <span className="text-gray-600">
          DR: <span className={health?.dry_run !== false ? 'text-yellow-400' : 'text-green-400'}>{health?.dry_run !== false ? 'ON' : 'OFF'}</span>
        </span>
      </div>

      {/* User */}
      <div className="flex items-center gap-3 text-sm">
        <span className="text-gray-400 hidden sm:inline">{user?.username}</span>
        <button onClick={logout} className="text-gray-500 hover:text-red-400 transition-colors text-xs px-2 py-1 rounded hover:bg-gray-800">
          Sign Out
        </button>
      </div>
    </header>
  );
}

function StatusDot({ label, ok }) {
  return (
    <span className="flex items-center gap-1 text-gray-500" title={label}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
      {label}
    </span>
  );
}
