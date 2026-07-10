const severityColors = {
  1: 'bg-red-900/50 text-red-400 border-red-800',
  2: 'bg-orange-900/50 text-orange-400 border-orange-800',
  3: 'bg-yellow-900/50 text-yellow-400 border-yellow-800',
  4: 'bg-blue-900/50 text-blue-400 border-blue-800',
};

const riskColors = (score) => {
  if (score >= 8) return 'bg-red-900/50 text-red-400 border-red-800';
  if (score >= 5) return 'bg-orange-900/50 text-orange-400 border-orange-800';
  return 'bg-green-900/50 text-green-400 border-green-800';
};

export function SeverityBadge({ severity }) {
  const colorClass = severityColors[severity] || 'bg-gray-800 text-gray-400 border-gray-700';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${colorClass}`}>
      {severity || '?'}
    </span>
  );
}

export function RiskBadge({ score }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${riskColors(score)}`}>
      {score}/10
    </span>
  );
}

export function MaliciousBadge({ isMalicious }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${
        isMalicious
          ? 'bg-red-900/50 text-red-400 border-red-800'
          : 'bg-green-900/50 text-green-400 border-green-800'
      }`}
    >
      {isMalicious ? '⚠ Malicious' : '✓ Safe'}
    </span>
  );
}

export function ActionBadge({ action }) {
  const colors = {
    blocked: 'bg-red-900/50 text-red-400 border-red-800',
    would_block: 'bg-yellow-900/50 text-yellow-400 border-yellow-800',
    dry_run_blocked: 'bg-yellow-900/50 text-yellow-400 border-yellow-800',
    allowed: 'bg-green-900/50 text-green-400 border-green-800',
    whitelist_override: 'bg-blue-900/50 text-blue-400 border-blue-800',
    already_blocked: 'bg-purple-900/50 text-purple-400 border-purple-800',
  };
  const colorClass = colors[action] || 'bg-gray-800 text-gray-400 border-gray-700';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${colorClass}`}>
      {action}
    </span>
  );
}
