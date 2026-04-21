import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend
} from 'recharts'
import type { CleanResult, AnalysisData } from '../App'

type Props = {
  result: CleanResult
  analysis: AnalysisData
  sessionId: string
  apiBase: string
  onReset: () => void
  onDownloadAll: () => void
  multiFile: boolean
}

const sectionLabel = { fontSize: '0.72rem', color: '#9c8f80', textTransform: 'uppercase' as const, letterSpacing: '0.1em', fontWeight: 500, marginBottom: '0.75rem' }
const tableHeader = { padding: '0.65rem 1rem', fontSize: '0.7rem', color: '#9c8f80', textTransform: 'uppercase' as const, letterSpacing: '0.07em', fontWeight: 500, textAlign: 'left' as const, backgroundColor: '#f5f1ec', borderBottom: '1px solid #e0d9cf' }
const tableCell = { padding: '0.6rem 1rem', fontSize: '0.82rem', color: '#5a5048', borderBottom: '1px solid #f0ebe3' }
const card = { backgroundColor: '#faf8f5', border: '1px solid #e0d9cf', borderRadius: '12px', padding: '1.25rem', overflow: 'hidden' }

type StatRow = {
  col: string
  before: { missing: number; unique: number; mean?: number; std?: number }
  after: { missing: number; unique: number; mean?: number; std?: number }
}

export default function ResultsPanel({ result, analysis, sessionId, apiBase, onReset, onDownloadAll, multiFile }: Props) {
  const { report, before_stats, after_stats, after_histograms, cleaned_filename } = result
  const [activeHistCol, setActiveHistCol] = useState<string>(() => Object.keys(after_histograms)[0] ?? '')

  const rowsRemoved = report.before_shape.rows - report.after_shape.rows
  const colsChanged = Object.keys(report.column_changes).length

  const statRows: StatRow[] = Object.keys(before_stats)
    .filter(col => col in after_stats)
    .map(col => ({ col, before: before_stats[col], after: after_stats[col] }))

  const downloadCSV = () => window.open(`${apiBase}/download/${sessionId}`, '_blank')

  // Missing values chart data
  const missingChartData = Object.entries(before_stats)
    .map(([col]) => ({
      col: col.length > 12 ? col.slice(0, 12) + '…' : col,
      Before: before_stats[col]?.missing ?? 0,
      After: after_stats[col]?.missing ?? 0,
    }))
    .filter(d => d.Before > 0 || d.After > 0)

  // Outlier chart data
  const outlierChartData = Object.entries(analysis.columns)
    .filter(([, info]) => info.outliers && info.outliers.count > 0)
    .map(([col, info]) => ({
      col: col.length > 12 ? col.slice(0, 12) + '…' : col,
      Outliers: info.outliers!.count,
    }))

  // Histogram data for selected column
  const histData = after_histograms[activeHistCol] ?? []
  const numericCols = Object.keys(after_histograms)

  const tooltipStyle = { backgroundColor: '#faf8f5', border: '1px solid #e0d9cf', borderRadius: '8px', fontSize: '0.78rem', color: '#5a5048' }

  return (
    <div className="space-y-8">
      {/* Success banner */}
      <div style={{ backgroundColor: '#f5f9f5', border: '1px solid #c0d9c0', borderRadius: '12px', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', color: '#2c4a2c', fontSize: '1.2rem', fontWeight: 500 }}>Cleaning Complete</h2>
          <p style={{ color: '#5a7a5a', fontSize: '0.82rem', marginTop: '0.2rem', fontWeight: 300 }}>
            {rowsRemoved > 0 && `${rowsRemoved} rows removed · `}
            {colsChanged} column{colsChanged !== 1 ? 's' : ''} transformed · {report.before_shape.rows} → {report.after_shape.rows} rows
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={downloadCSV}
            style={{ backgroundColor: '#2c4a2c', color: '#f7f4ef', padding: '0.6rem 1.25rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 500, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            ↓ {cleaned_filename}
          </button>
          {multiFile && (
            <button onClick={onDownloadAll}
              style={{ backgroundColor: '#2c2c2c', color: '#f7f4ef', padding: '0.6rem 1.25rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 500, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              ↓ Download All ZIP
            </button>
          )}
        </div>
      </div>

      {/* Description */}
      {report.description && (
        <div style={card}>
          <p style={sectionLabel}>Dataset Description</p>
          <p style={{ fontSize: '0.85rem', color: '#5a5048', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{report.description}</p>
        </div>
      )}

      {/* Shape diff */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Before', shape: report.before_shape, bg: '#faf8f5', border: '#e0d9cf', lc: '#9c8f80', vc: '#2c2c2c' },
          { label: 'After', shape: report.after_shape, bg: '#f5f9f5', border: '#c0d9c0', lc: '#5a7a5a', vc: '#2c4a2c' },
        ].map(({ label, shape, bg, border, lc, vc }) => (
          <div key={label} style={{ backgroundColor: bg, border: `1px solid ${border}`, borderRadius: '12px', padding: '1.1rem 1.25rem' }}>
            <p style={{ fontSize: '0.72rem', color: lc, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>{label}</p>
            <p style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.6rem', fontWeight: 500, color: vc, marginTop: '0.25rem' }}>
              {shape.rows.toLocaleString()} <span style={{ fontSize: '1rem', opacity: 0.5 }}>×</span> {shape.cols}
            </p>
            <p style={{ fontSize: '0.75rem', color: lc, marginTop: '0.1rem' }}>rows × columns</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Missing values chart */}
        {missingChartData.length > 0 && (
          <div style={card}>
            <p style={sectionLabel}>Missing Values — Before vs After</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={missingChartData} margin={{ top: 4, right: 8, left: -10, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0d9cf" />
                <XAxis dataKey="col" tick={{ fontSize: 10, fill: '#9c8f80' }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10, fill: '#9c8f80' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '0.75rem', color: '#9c8f80' }} />
                <Bar dataKey="Before" fill="#c8b89a" radius={[3, 3, 0, 0]} />
                <Bar dataKey="After" fill="#7a9a7a" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Outliers chart */}
        {outlierChartData.length > 0 && (
          <div style={card}>
            <p style={sectionLabel}>Outliers per Column</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={outlierChartData} margin={{ top: 4, right: 8, left: -10, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0d9cf" />
                <XAxis dataKey="col" tick={{ fontSize: 10, fill: '#9c8f80' }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10, fill: '#9c8f80' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="Outliers" fill="#c8a060" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Distribution histogram */}
      {numericCols.length > 0 && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <p style={{ ...sectionLabel, marginBottom: 0 }}>Distribution — After Cleaning</p>
            <select
              value={activeHistCol}
              onChange={e => setActiveHistCol(e.target.value)}
              style={{ fontSize: '0.78rem', color: '#5a5048', backgroundColor: '#faf8f5', border: '1px solid #e0d9cf', borderRadius: '6px', padding: '0.25rem 0.5rem', cursor: 'pointer' }}
            >
              {numericCols.map(col => <option key={col} value={col}>{col}</option>)}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={histData} margin={{ top: 4, right: 8, left: -10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0d9cf" />
              <XAxis dataKey="bin" tick={{ fontSize: 10, fill: '#9c8f80' }} />
              <YAxis tick={{ fontSize: 10, fill: '#9c8f80' }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, 'Count']} labelFormatter={l => `Bin: ${l}`} />
              <Bar dataKey="count" fill="#9c8f80" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Transformations applied */}
      {(report.transformations_applied.length > 0 || colsChanged > 0 || report.instruction_log?.length > 0) && (
        <div>
          <p style={sectionLabel}>Transformations Applied</p>
          <div style={{ backgroundColor: '#faf8f5', border: '1px solid #e0d9cf', borderRadius: '12px', overflow: 'hidden' }}>
            {report.instruction_log?.map((t, i) => (
              <div key={`instr-${i}`} style={{ padding: '0.65rem 1.25rem', fontSize: '0.82rem', color: '#5a5048', borderBottom: '1px solid #f0ebe3', display: 'flex', gap: '0.75rem' }}>
                <span style={{ color: '#c8a060', flexShrink: 0 }}>→</span> {t}
              </div>
            ))}
            {report.transformations_applied.map((t, i) => (
              <div key={`global-${i}`} style={{ padding: '0.65rem 1.25rem', fontSize: '0.82rem', color: '#5a5048', borderBottom: '1px solid #f0ebe3', display: 'flex', gap: '0.75rem' }}>
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
                  const mc = before.missing !== after.missing
                  const uc = before.unique !== after.unique
                  return (
                    <tr key={col}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f5f1ec')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                      <td style={{ ...tableCell, fontWeight: 500, color: '#2c2c2c' }}>{col}</td>
                      <td style={{ ...tableCell, textAlign: 'right' }}>{before.missing}</td>
                      <td style={{ ...tableCell, textAlign: 'right', color: mc ? '#3a7a4a' : '#5a5048', fontWeight: mc ? 500 : 400 }}>{after.missing}{mc && ' ↓'}</td>
                      <td style={{ ...tableCell, textAlign: 'right' }}>{before.unique}</td>
                      <td style={{ ...tableCell, textAlign: 'right', color: uc ? '#a0622a' : '#5a5048', fontWeight: uc ? 500 : 400 }}>{after.unique}</td>
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
                <span style={{ flexShrink: 0, color: '#c8a060' }}>→</span><span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem' }}>
        <button onClick={onReset}
          style={{ backgroundColor: 'transparent', color: '#9c8f80', padding: '0.65rem 1.25rem', borderRadius: '8px', fontSize: '0.82rem', border: '1px solid #e0d9cf', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#c8b89a')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#e0d9cf')}>
          ← Clean Another File
        </button>
        <button onClick={multiFile ? onDownloadAll : downloadCSV}
          style={{ backgroundColor: '#2c2c2c', color: '#f7f4ef', padding: '0.65rem 1.5rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 500, border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#444')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#2c2c2c')}>
          {multiFile ? '↓ Download All ZIP' : `↓ ${cleaned_filename}`}
        </button>
      </div>
    </div>
  )
}
