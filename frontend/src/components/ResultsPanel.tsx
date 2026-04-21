import type { CleanResult } from '../App'

type Props = { result: CleanResult; sessionId: string; apiBase: string; onReset: () => void }

type StatRow = {
  col: string
  before: { missing: number; unique: number; mean?: number; std?: number }
  after: { missing: number; unique: number; mean?: number; std?: number }
}

const sectionLabel = { fontSize: '0.72rem', color: '#9c8f80', textTransform: 'uppercase' as const, letterSpacing: '0.1em', fontWeight: 500, marginBottom: '0.75rem' }
const tableHeader = { padding: '0.65rem 1rem', fontSize: '0.7rem', color: '#9c8f80', textTransform: 'uppercase' as const, letterSpacing: '0.07em', fontWeight: 500, textAlign: 'left' as const, backgroundColor: '#f5f1ec', borderBottom: '1px solid #e0d9cf' }
const tableCell = { padding: '0.6rem 1rem', fontSize: '0.82rem', color: '#5a5048', borderBottom: '1px solid #f0ebe3' }

export default function ResultsPanel({ result, sessionId, apiBase, onReset }: Props) {
  const { report, before_stats, after_stats } = result
  const rowsRemoved = report.before_shape.rows - report.after_shape.rows
  const colsChanged = Object.keys(report.column_changes).length

  const statRows: StatRow[] = Object.keys(before_stats)
    .filter(col => col in after_stats)
    .map(col => ({ col, before: before_stats[col], after: after_stats[col] }))

  const downloadCSV = () => window.open(`${apiBase}/download/${sessionId}`, '_blank')

  return (
    <div className="space-y-8">
      {/* Success banner */}
      <div style={{ backgroundColor: '#f5f9f5', border: '1px solid #c0d9c0', borderRadius: '12px', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', color: '#2c4a2c', fontSize: '1.2rem', fontWeight: 500 }}>
            Cleaning Complete
          </h2>
          <p style={{ color: '#5a7a5a', fontSize: '0.82rem', marginTop: '0.2rem', fontWeight: 300 }}>
            {rowsRemoved > 0 && `${rowsRemoved} rows removed · `}
            {colsChanged} column{colsChanged !== 1 ? 's' : ''} transformed · {report.before_shape.rows} → {report.after_shape.rows} rows
          </p>
        </div>
        <button
          onClick={downloadCSV}
          style={{ backgroundColor: '#2c4a2c', color: '#f7f4ef', padding: '0.6rem 1.25rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 500, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 0.2s' }}
          onMouseEnter={e => ((e.currentTarget.style.backgroundColor = '#3a5e3a'))}
          onMouseLeave={e => ((e.currentTarget.style.backgroundColor = '#2c4a2c'))}
        >
          Download CSV
        </button>
      </div>

      {/* Shape diff */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Before', shape: report.before_shape, bg: '#faf8f5', border: '#e0d9cf', labelColor: '#9c8f80', valColor: '#2c2c2c' },
          { label: 'After', shape: report.after_shape, bg: '#f5f9f5', border: '#c0d9c0', labelColor: '#5a7a5a', valColor: '#2c4a2c' },
        ].map(({ label, shape, bg, border, labelColor, valColor }) => (
          <div key={label} style={{ backgroundColor: bg, border: `1px solid ${border}`, borderRadius: '12px', padding: '1.1rem 1.25rem' }}>
            <p style={{ fontSize: '0.72rem', color: labelColor, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>{label}</p>
            <p style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.6rem', fontWeight: 500, color: valColor, marginTop: '0.25rem' }}>
              {shape.rows.toLocaleString()} <span style={{ fontSize: '1rem', opacity: 0.5 }}>×</span> {shape.cols}
            </p>
            <p style={{ fontSize: '0.75rem', color: labelColor, marginTop: '0.1rem' }}>rows × columns</p>
          </div>
        ))}
      </div>

      {/* Transformations applied */}
      {(report.transformations_applied.length > 0 || colsChanged > 0) && (
        <div>
          <p style={sectionLabel}>Transformations Applied</p>
          <div style={{ backgroundColor: '#faf8f5', border: '1px solid #e0d9cf', borderRadius: '12px', overflow: 'hidden' }}>
            {report.transformations_applied.map((t, i) => (
              <div key={i} style={{ padding: '0.65rem 1.25rem', fontSize: '0.82rem', color: '#5a5048', borderBottom: '1px solid #f0ebe3', display: 'flex', gap: '0.75rem' }}>
                <span style={{ color: '#7a9a7a', flexShrink: 0 }}>✓</span> {t}
              </div>
            ))}
            {Object.entries(report.column_changes).map(([col, changes]) =>
              changes.map((c, i) => (
                <div key={`${col}-${i}`} style={{ padding: '0.65rem 1.25rem', fontSize: '0.82rem', color: '#5a5048', borderBottom: '1px solid #f0ebe3', display: 'flex', gap: '0.75rem' }}>
                  <span style={{ color: '#7a9a7a', flexShrink: 0 }}>✓</span>
                  <span><span style={{ fontWeight: 500, color: '#2c2c2c' }}>{col}</span>: {c}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Before/After stats */}
      <div>
        <p style={sectionLabel}>Before / After Statistics</p>
        <div style={{ backgroundColor: '#faf8f5', border: '1px solid #e0d9cf', borderRadius: '12px', overflow: 'hidden' }}>
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Column', 'Missing before', 'Missing after', 'Unique before', 'Unique after', 'Mean after'].map(h => (
                    <th key={h} style={{ ...tableHeader, textAlign: h === 'Column' ? 'left' : 'right' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {statRows.map(({ col, before, after }) => {
                  const missingChanged = before.missing !== after.missing
                  const uniqueChanged = before.unique !== after.unique
                  return (
                    <tr key={col}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f5f1ec')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                      <td style={{ ...tableCell, fontWeight: 500, color: '#2c2c2c' }}>{col}</td>
                      <td style={{ ...tableCell, textAlign: 'right' }}>{before.missing}</td>
                      <td style={{ ...tableCell, textAlign: 'right', color: missingChanged ? '#3a7a4a' : '#5a5048', fontWeight: missingChanged ? 500 : 400 }}>
                        {after.missing}{missingChanged && ' ↓'}
                      </td>
                      <td style={{ ...tableCell, textAlign: 'right' }}>{before.unique}</td>
                      <td style={{ ...tableCell, textAlign: 'right', color: uniqueChanged ? '#a0622a' : '#5a5048', fontWeight: uniqueChanged ? 500 : 400 }}>
                        {after.unique}
                      </td>
                      <td style={{ ...tableCell, textAlign: 'right' }}>{after.mean !== undefined ? after.mean : '—'}</td>
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
          <p style={sectionLabel}>Recommended Next Steps</p>
          <div className="space-y-2">
            {report.recommendations.map((rec, i) => (
              <div key={i} style={{ backgroundColor: '#fdf8f2', border: '1px solid #e8d5b7', borderRadius: '10px', padding: '0.75rem 1.1rem', fontSize: '0.82rem', color: '#7a5a2a', display: 'flex', gap: '0.75rem' }}>
                <span style={{ flexShrink: 0, color: '#c8a060' }}>→</span>
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem' }}>
        <button
          onClick={onReset}
          style={{ backgroundColor: 'transparent', color: '#9c8f80', padding: '0.65rem 1.25rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 400, border: '1px solid #e0d9cf', cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseEnter={e => ((e.currentTarget.style.borderColor = '#c8b89a'))}
          onMouseLeave={e => ((e.currentTarget.style.borderColor = '#e0d9cf'))}
        >
          ← Clean Another File
        </button>
        <button
          onClick={downloadCSV}
          style={{ backgroundColor: '#2c2c2c', color: '#f7f4ef', padding: '0.65rem 1.5rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 500, border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}
          onMouseEnter={e => ((e.currentTarget.style.backgroundColor = '#444'))}
          onMouseLeave={e => ((e.currentTarget.style.backgroundColor = '#2c2c2c'))}
        >
          Download Cleaned CSV
        </button>
      </div>
    </div>
  )
}
