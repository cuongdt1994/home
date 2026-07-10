export default function DataTable({ columns, data, loading, emptyMessage = 'No data found' }) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">📭</p>
        <p className="mt-2">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-800/50 text-left">
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-3 text-gray-400 font-medium whitespace-nowrap">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={row.id || i}
              className="border-t border-gray-800/50 hover:bg-gray-800/30 transition-colors"
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-gray-300 max-w-xs truncate">
                  {col.render ? col.render(row) : row[col.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
