import { useState, useEffect } from 'react';
import client from '../api/client';

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    client.get('/settings')
      .then((r) => setSettings(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleToggleDryRun = async () => {
    setSaving(true);
    setMessage('');
    try {
      await client.put('/settings', { dry_run: !settings.dry_run });
      setSettings((s) => ({ ...s, dry_run: !s.dry_run }));
      setMessage('Dry-run mode updated (reverts on restart unless .env is changed)');
    } catch (e) {
      setMessage('Failed to update: ' + (e.response?.data?.detail || e.message));
    } finally {
      setSaving(false);
    }
  };

  const handleRiskScoreChange = async (newScore) => {
    setSaving(true);
    setMessage('');
    try {
      await client.put('/settings', { ai_block_risk_score: newScore });
      setSettings((s) => ({ ...s, ai_block_risk_score: newScore }));
      setMessage('Risk score threshold updated');
    } catch (e) {
      setMessage('Failed to update: ' + (e.response?.data?.detail || e.message));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mt-20" />;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-200">Settings</h2>

      {message && (
        <div className="bg-blue-900/30 border border-blue-800 text-blue-400 text-sm rounded-lg p-3">
          {message}
        </div>
      )}

      {/* Dry-run toggle */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-gray-200 font-medium">Dry-Run Mode</h3>
            <p className="text-sm text-gray-500 mt-1">
              When enabled, no firewall rules are pushed to MikroTik. Blocks are logged only.
            </p>
          </div>
          <button
            onClick={handleToggleDryRun}
            disabled={saving}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
              settings?.dry_run ? 'bg-yellow-600' : 'bg-green-600'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${
                settings?.dry_run ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        <div className="mt-2 text-sm">
          Status: <span className={settings?.dry_run ? 'text-yellow-400 font-medium' : 'text-green-400 font-medium'}>
            {settings?.dry_run ? 'DRY-RUN (safe)' : 'LIVE (blocking enabled)'}
          </span>
        </div>
      </div>

      {/* AI Risk Score */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-5">
        <div>
          <h3 className="text-gray-200 font-medium">AI Block Risk Score Threshold</h3>
          <p className="text-sm text-gray-500 mt-1">
            IPs with risk score ≥ this value will be blocked (0-10). Default: 8
          </p>
        </div>
        <div className="mt-4 flex items-center gap-4">
          <input
            type="range"
            min="0"
            max="10"
            value={settings?.ai_block_risk_score ?? 8}
            onChange={(e) => setSettings((s) => ({ ...s, ai_block_risk_score: parseInt(e.target.value) }))}
            onMouseUp={(e) => handleRiskScoreChange(parseInt(e.target.value))}
            onTouchEnd={(e) => handleRiskScoreChange(parseInt(e.target.value))}
            className="flex-1 accent-blue-500"
          />
          <span className="text-2xl font-bold text-blue-400 w-8 text-center">
            {settings?.ai_block_risk_score ?? 8}
          </span>
        </div>
      </div>

      {/* Configuration info */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-5">
        <h3 className="text-gray-200 font-medium mb-3">Configuration Summary</h3>
        <dl className="space-y-2 text-sm">
          {[
            ['MikroTik Host', settings?.mikrotik_host],
            ['Blacklist Timeout', settings?.mikrotik_blacklist_timeout],
            ['ntopng Base URL', settings?.ntopng_base_url],
            ['AI Concurrent Requests', settings?.ai_max_concurrent_requests],
            ['DeepSeek Timeout', `${settings?.deepseek_timeout_seconds}s`],
            ['Alert Retention', `${settings?.retention_alert_days} days`],
            ['AI Report Retention', `${settings?.retention_ai_report_days} days`],
            ['Audit Retention', `${settings?.retention_audit_days} days`],
            ['Prune Interval', `${settings?.prune_interval_hours}h`],
            ['Telegram Configured', settings?.telegram_configured ? '✅ Yes' : '❌ No'],
            ['DeepSeek Configured', settings?.deepseek_configured ? '✅ Yes' : '❌ No'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between">
              <dt className="text-gray-500">{label}</dt>
              <dd className="text-gray-300 font-mono">{String(value)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
