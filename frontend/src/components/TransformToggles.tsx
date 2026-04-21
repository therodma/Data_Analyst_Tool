import type { AnalysisData, CleanOptions, ColumnInstruction, FileSession } from '../App'

type Props = {
  sessions: FileSession[]
  activeSessionId: string
  analysis: AnalysisData
  options: CleanOptions
  onChange: (opts: CleanOptions) => void
  columnInstructions: Record<string, ColumnInstruction>
  onColumnInstruction: (col: string, val: ColumnInstruction) => void
  onCleanAll: () => void
  loading: boolean
}

function Toggle({ label, description, checked, disabled, onChange }: {
  label: string; description: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label style={{
      display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '1rem 1.25rem',
      borderRadius: '10px', cursor: disabled ? 'not-allowed' : 'pointer',
      border: `1px solid ${checked ? '#c8b89a' : '#e0d9cf'}`,
      backgroundColor: checked ? '#fdf8f2' : '#faf8f5',
      opacity: disabled ? 0.4 : 1, transition: 'all 0.15s',
    }}>
      <div style={{
        width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0, marginTop: '2px',
        border: `1.5px solid ${checked ? '#9c8f80' : '#c8b89a'}`,
        backgroundColor: checked ? '#9c8f80' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
      }} onClick={() => !disabled && onChange(!checked)}>
        {checked && <span style={{ color: '#f7f4ef', fontSize: '0.65rem', fontWeight: 700 }}>✓</span>}
      </div>
      <div>
        <p style={{ fontWeight: 500, color: '#2c2c2c', fontSize: '0.875rem' }}>{label}</p>
        <p style={{ color: '#9c8f80', fontSize: '0.78rem', marginTop: '0.2rem', fontWeight: 300 }}>{description}</p>
      </div>
    </label>
  )
}

const INSTRUCTION_OPTIONS: { value: string; label: string }[] = [
  { value: 'none', label: 'No instruction' },
  { value: 'drop', label: 'Drop this column' },
  { value: 'categorical', label: 'Treat as categorical' },
  { value: 'numeric', label: 'Convert to numeric' },
  { value: 'cap', label: 'Cap at value...' },
  { value: 'floor', label: 'Floor at value...' },
]

const sectionLabel = { fontSize: '0.72rem', color: '#9c8f80', textTransform: 'uppercase' as const, letterSpacing: '0.1em', fontWeight: 500, marginBottom: '0.75rem' }

export default function TransformToggles({ sessions, activeSessionId, analysis, options, onChange, columnInstructions, onColumnInstruction, onCleanAll, loading }: Props) {
  const set = <K extends keyof CleanOptions>(key: K, val: CleanOptions[K]) => onChange({ ...options, [key]: val })
  const cols = Object.values(analysis.columns)
  const missingCols = cols.filter(c => c.missing_count > 0).length
  const outlierCols = cols.filter(c => c.outliers && c.outliers.count > 0).length
  const catCols = cols.filter(c => c.categories !== null).length
  const skewedCols = cols.filter(c => c.skew_flagged).length
  const readyCount = sessions.filter(s => s.status === 'ready' || s.status === 'done').length

  const getCapFloorValue = (col: string, type: 'cap' | 'floor') => {
    const instr = columnInstructions[col] ?? 'none'
    if (instr.startsWith(`${type}:`)) return instr.split(':')[1]
    return ''
  }

  const getInstructionType = (col: string) => {
    const instr = columnInstructions[col] ?? 'none'
    if (instr.startsWith('cap:')) return 'cap'
    if (instr.startsWith('floor:')) return 'floor'
    return instr
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 style={{ fontFamily: 'Playfair Display, serif', color: '#2c2c2c', fontSize: '1.6rem', fontWeight: 500 }}>
          Configure Cleaning
        </h2>
        <p style={{ color: '#9c8f80', fontSize: '0.85rem', marginTop: '0.35rem', fontWeight: 300 }}>
          Settings apply to all {sessions.length} file{sessions.length !== 1 ? 's' : ''}. Column instructions apply to the active file.
        </p>
      </div>

      {/* Global toggles */}
      <div>
        <p style={sectionLabel}>Global Transformations</p>
        <div className="space-y-2">
          <Toggle label={`Fill Missing Values${missingCols > 0 ? ` — ${missingCols} columns` : ''}`} description="Numeric → median · Categorical → mode" checked={options.fill_missing} onChange={v => set('fill_missing', v)} />
          <Toggle label={`Drop Duplicate Rows${analysis.duplicates.exact_count > 0 ? ` — ${analysis.duplicates.exact_count} found` : ''}`} description="Remove exact duplicate rows" checked={options.drop_duplicates} onChange={v => set('drop_duplicates', v)} />

          <div style={{ borderRadius: '10px', border: `1px solid ${options.handle_outliers ? '#c8b89a' : '#e0d9cf'}`, backgroundColor: options.handle_outliers ? '#fdf8f2' : '#faf8f5', overflow: 'hidden', transition: 'all 0.15s' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '1rem 1.25rem', cursor: 'pointer' }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0, marginTop: '2px', border: `1.5px solid ${options.handle_outliers ? '#9c8f80' : '#c8b89a'}`, backgroundColor: options.handle_outliers ? '#9c8f80' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                onClick={() => set('handle_outliers', !options.handle_outliers)}>
                {options.handle_outliers && <span style={{ color: '#f7f4ef', fontSize: '0.65rem', fontWeight: 700 }}>✓</span>}
              </div>
              <div>
                <p style={{ fontWeight: 500, color: '#2c2c2c', fontSize: '0.875rem' }}>Handle Outliers{outlierCols > 0 ? ` — ${outlierCols} columns` : ''}</p>
                <p style={{ color: '#9c8f80', fontSize: '0.78rem', marginTop: '0.2rem', fontWeight: 300 }}>IQR method · values beyond 1.5× IQR</p>
              </div>
            </label>
            {options.handle_outliers && (
              <div style={{ paddingLeft: '3.25rem', paddingBottom: '1rem', display: 'flex', gap: '1.5rem' }}>
                {(['clip', 'remove'] as const).map(action => (
                  <label key={action} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <div onClick={() => set('outlier_action', action)} style={{ width: '14px', height: '14px', borderRadius: '50%', border: `1.5px solid ${options.outlier_action === action ? '#9c8f80' : '#c8b89a'}`, backgroundColor: options.outlier_action === action ? '#9c8f80' : 'transparent', transition: 'all 0.15s' }} />
                    <span style={{ fontSize: '0.8rem', color: '#5a5048', textTransform: 'capitalize' }}>{action} outliers</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <Toggle label={`Standardize Categories${catCols > 0 ? ` — ${catCols} columns` : ''}`} description="Lowercase + strip · most-common variant wins" checked={options.standardize_categories} onChange={v => set('standardize_categories', v)} />
          <Toggle label={`Log-Transform Skewed Columns${skewedCols > 0 ? ` — ${skewedCols} flagged` : ''}`} description="Apply log1p to numeric columns with |skew| > 1" checked={options.log_transform} disabled={skewedCols === 0} onChange={v => set('log_transform', v)} />
        </div>
      </div>

      {/* Per-column instructions */}
      <div>
        <p style={sectionLabel}>Column Instructions — {sessions.find(s => s.id === activeSessionId)?.uploadData.filename}</p>
        <div style={{ backgroundColor: '#faf8f5', border: '1px solid #e0d9cf', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Column', 'Type', 'Issues', 'Instruction', 'Value'].map(h => (
                  <th key={h} style={{ padding: '0.65rem 1rem', fontSize: '0.7rem', color: '#9c8f80', textTransform: 'uppercase' as const, letterSpacing: '0.07em', fontWeight: 500, textAlign: 'left' as const, backgroundColor: '#f5f1ec', borderBottom: '1px solid #e0d9cf' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(analysis.columns).map(([col, info]) => {
                const instrType = getInstructionType(col)
                const issues = [
                  info.missing_count > 0 && `${info.missing_count} missing`,
                  info.outliers && info.outliers.count > 0 && `${info.outliers.count} outliers`,
                  info.skew_flagged && `skew ${info.skewness}`,
                  info.categories?.suspected_variants?.length && 'variants',
                ].filter(Boolean).join(', ')

                return (
                  <tr key={col}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f5f1ec')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                    <td style={{ padding: '0.6rem 1rem', fontSize: '0.82rem', fontWeight: 500, color: '#2c2c2c', borderBottom: '1px solid #f0ebe3' }}>{col}</td>
                    <td style={{ padding: '0.6rem 1rem', fontSize: '0.82rem', color: '#5a5048', borderBottom: '1px solid #f0ebe3' }}>
                      <span style={{ backgroundColor: '#ede8e0', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem', color: '#7a6f62' }}>{info.dtype}</span>
                    </td>
                    <td style={{ padding: '0.6rem 1rem', fontSize: '0.78rem', color: issues ? '#a0622a' : '#9c8f80', borderBottom: '1px solid #f0ebe3' }}>{issues || '—'}</td>
                    <td style={{ padding: '0.6rem 1rem', borderBottom: '1px solid #f0ebe3' }}>
                      <select
                        value={instrType}
                        onChange={e => {
                          const v = e.target.value
                          if (v === 'cap' || v === 'floor') onColumnInstruction(col, `${v}:`)
                          else onColumnInstruction(col, v)
                        }}
                        style={{ fontSize: '0.78rem', color: '#5a5048', backgroundColor: '#faf8f5', border: '1px solid #e0d9cf', borderRadius: '6px', padding: '0.25rem 0.5rem', cursor: 'pointer' }}
                      >
                        {INSTRUCTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '0.6rem 1rem', borderBottom: '1px solid #f0ebe3' }}>
                      {(instrType === 'cap' || instrType === 'floor') && (
                        <input
                          type="number"
                          placeholder="value"
                          value={getCapFloorValue(col, instrType)}
                          onChange={e => onColumnInstruction(col, `${instrType}:${e.target.value}`)}
                          style={{ width: '80px', fontSize: '0.78rem', color: '#5a5048', backgroundColor: '#faf8f5', border: '1px solid #e0d9cf', borderRadius: '6px', padding: '0.25rem 0.5rem' }}
                        />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem' }}>
        <p style={{ fontSize: '0.78rem', color: '#b0a090' }}>
          Cleaning {readyCount} file{readyCount !== 1 ? 's' : ''}
        </p>
        <button
          onClick={onCleanAll}
          disabled={loading}
          style={{ backgroundColor: loading ? '#b0a090' : '#2c2c2c', color: '#f7f4ef', padding: '0.7rem 2rem', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 500, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'background 0.2s' }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = '#444' }}
          onMouseLeave={e => { if (!loading) e.currentTarget.style.backgroundColor = '#2c2c2c' }}
        >
          {loading && <div style={{ width: '14px', height: '14px', border: '2px solid #f7f4ef', borderTopColor: 'transparent', borderRadius: '50%' }} className="animate-spin" />}
          Clean {readyCount} File{readyCount !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  )
}
