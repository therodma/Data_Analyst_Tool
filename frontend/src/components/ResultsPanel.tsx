import type { CleanResult } from '../App'

type Props = {
  result: CleanResult
  sessionId: string
  apiBase: string
  onReset: () => void
}

type StatRow = {
  col: string
  before: { missing: number; unique: number; mean?: number; std?: number }
  after: { missing: number; unique: number; mean?: number; std?: number }
}

export default function ResultsPanel({ result, sessionId, apiBase, onReset }: Props) {
  const { report, before_stats, after_stats } = result

  const rowsRemoved = report.before_shape.rows - report.after_shape.rows
  const colsChanged = Object.keys(report.column_changes).length

  const statRows: StatRow[] = Object.keys(before_stats)
    .filter((col) => col in after_stats)
    .map((col) => ({ col, before: before_stats[col], after: after_stats[col] }))

  const downloadCSV = () => {
    window.open(`${apiBase}/download/${sessionId}`, '_blank')
  }

  return (
    <div className="space-y-8">
      {/* Success banner */}
      <div className="p-5 bg-green-50 border border-green-200 rounded-2xl flex items-center gap-4">
        <span className="text-4xl">✅</span>
        <div>
          <h2 className="text-lg font-bold text-green-800">Cleaning Complete!</h2>
          <p className="text-green-700 text-sm mt-0.5">
            {rowsRemoved > 0 && `${rowsRemoved} rows removed · `}
            {colsChanged} column{colsChanged !== 1 ? 's' : ''} transformed ·{' '}
            {report.before_shape.rows} → {report.after_shape.rows} rows
          </p>
        </div>
        <button
          onClick={downloadCSV}
          className="ml-auto px-5 py-2.5 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors text-sm whitespace-nowrap"
        >
          ⬇ Download CSV
        </button>
      </div>

      {/* Shape diff */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Before', shape: report.before_shape, color: 'gray' },
          { label: 'After', shape: report.after_shape, color: 'blue' },
        ].map(({ label, shape, color }) => (
          <div key={label} className={`p-4 rounded-xl border border-${color}-200 bg-${color}-50`}>
            <p className={`text-xs font-semibold text-${color}-500 uppercase mb-1`}>{label}</p>
            <p className={`text-2xl font-bold text-${color}-800`}>
              {shape.rows.toLocaleString()} × {shape.cols}
            </p>
            <p className={`text-sm text-${color}-600`}>rows × columns</p>
          </div>
        ))}
      </div>

      {/* Transformations applied */}
      {(report.transformations_applied.length > 0 || colsChanged > 0) && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Transformations Applied
          </h3>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {report.transformations_applied.map((t, i) => (
              <div key={i} className="px-4 py-3 text-sm text-gray-700 flex gap-2">
                <span className="text-green-500">✓</span> {t}
              </div>
            ))}
            {Object.entries(report.column_changes).map(([col, changes]) =>
              changes.map((c, i) => (
                <div key={`${col}-${i}`} className="px-4 py-3 text-sm text-gray-700 flex gap-2">
                  <span className="text-green-500">✓</span>
                  <span>
                    <span className="font-medium">{col}</span>: {c}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Before/After stats diff */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Before / After Statistics
        </h3>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Column</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Missing (before)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Missing (after)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Unique (before)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Unique (after)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Mean (after)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {statRows.map(({ col, before, after }) => {
                  const missingChanged = before.missing !== after.missing
                  const uniqueChanged = before.unique !== after.unique
                  return (
                    <tr key={col} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800 max-w-[140px] truncate">{col}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{before.missing}</td>
                      <td className={`px-4 py-3 text-right font-medium ${missingChanged ? 'text-green-600' : 'text-gray-500'}`}>
                        {after.missing}
                        {missingChanged && <span className="ml-1 text-xs">↓</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">{before.unique}</td>
                      <td className={`px-4 py-3 text-right font-medium ${uniqueChanged ? 'text-blue-600' : 'text-gray-500'}`}>
                        {after.unique}
                        {uniqueChanged && <span className="ml-1 text-xs">~</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">
                        {after.mean !== undefined ? after.mean : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            💡 Recommended Next Steps
          </h3>
          <div className="space-y-2">
            {report.recommendations.map((rec, i) => (
              <div key={i} className="flex gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800">
                <span className="shrink-0">→</span>
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button
          onClick={onReset}
          className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors text-sm"
        >
          ← Clean Another File
        </button>
        <button
          onClick={downloadCSV}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors text-sm"
        >
          ⬇ Download Cleaned CSV
        </button>
      </div>
    </div>
  )
}
