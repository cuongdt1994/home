export default function ServiceHealthCard({ name, status }) {
  const ok = status?.ok ?? false;
  const latency = status?.latency_ms;

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">{name}</span>
        <span
          className={`inline-block w-2.5 h-2.5 rounded-full ${
            ok ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={`text-lg font-semibold ${ok ? 'text-green-400' : 'text-red-400'}`}>
          {ok ? 'Online' : 'Offline'}
        </span>
        {latency != null && (
          <span className="text-xs text-gray-500">{Math.round(latency)}ms</span>
        )}
      </div>
    </div>
  );
}
