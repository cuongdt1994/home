import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/overview', label: 'Overview', icon: '📊' },
  { to: '/alerts', label: 'Suricata Alerts', icon: '🚨' },
  { to: '/ai-decisions', label: 'AI Decisions', icon: '🧠' },
  { to: '/blocked-ips', label: 'Blocked IPs', icon: '🚫' },
  { to: '/mikrotik', label: 'MikroTik Health', icon: '📡' },
  { to: '/ntopng', label: 'ntopng Stats', icon: '📈' },
  { to: '/audit-logs', label: 'Audit Logs', icon: '📋' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-xl font-bold text-blue-400 flex items-center gap-2">
          🛡️ AI Shield
        </h1>
      </div>
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400 font-medium'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`
            }
          >
            <span className="text-lg">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-gray-800 text-xs text-gray-600 text-center">
        AI Shield v1.0.0
      </div>
    </aside>
  );
}
