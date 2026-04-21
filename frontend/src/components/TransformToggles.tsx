import type { AnalysisData, CleanOptions } from '../App'

type Props = {
  analysis: AnalysisData
  options: CleanOptions
  onChange: (opts: CleanOptions) => void
  onClean: () => void
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
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
      }}
        onClick={() => !disabled && onChange(!checked)}
      >
        {checked && <span style={{ color: '#f7f4ef', fontSize: '0.65rem', fontWeight: 700 }}>✓</span>}
      </div>
      <div>
        <p style={{ fontWeight: 500, color: '#2c2c2c', fontSize: '0.875rem' }}>{label}</p>
        <p style={{ color: '#9c8f80', fontSize: '0.78rem', marginTop: '0.2rem', fontWeight: 300 }}>{description}</p>
      </div>
    </label>
  )
}

export default function TransformToggles({ analysis, options, onChange, onClean, loading }: Props) {
  const set = <K extends keyof CleanOptions>(key: K, val: CleanOptions[K]) => onChange({ ...options, [key]: val })
  const cols = Object.values(analysis.columns)
  const missingCols = cols.filter(c => c.missing_count > 0).length
  const outlierCols = cols.filter(c => c.outliers && c.outliers.count > 0).length
  const catCols = cols.filter(c => c.categories !== null).length
  const skewedCols = cols.filter(c => c.skew_flagged).length

  const sectionLabel = { fontSize: '0.72rem', color: '#9c8f80', textTransform: 'uppercase' as const, letterSpacing: '0.1em', fontWeight: 500, marginBottom: '0.75rem' }

  return (
    <div className="space-y-8">
      <div>
        <h2 style={{ fontFamily: 'Playfair Display, serif', color: '#2c2c2c', fontSize: '1.6rem', fontWeight: 500 }}>
          Configure Cleaning
        </h2>
        <p style={{ color: '#9c8f80', fontSize: '0.85rem', marginTop: '0.35rem', fontWeight: 300 }}>
          Select the transformations to apply, then run the cleaner.
        </p>
      </div>

      <div>
        <p style={sectionLabel}>Transformations</p>
        <div className="space-y-2">
          <Toggle
            label={`Fill Missing Values${missingCols > 0 ? ` — ${missingCols} columns affected` : ''}`}
            description="Numeric → median · Categorical → mode"
            checked={options.fill_missing}
            onChange={v => set('fill_missing', v)}
          />
          <Toggle
            label={`Drop Duplicate Rows${analysis.duplicates.exact_count > 0 ? ` — ${analysis.duplicates.exact_count} found` : ''}`}
            description="Remove exact duplicate rows from the dataset"
            checked={options.drop_duplicates}
            onChange={v => set('drop_duplicates', v)}
          />

          {/* Outliers with sub-option */}
          <div style={{
            borderRadius: '10px', border: `1px solid ${options.handle_outliers ? '#c8b89a' : '#e0d9cf'}`,
            backgroundColor: options.handle_outliers ? '#fdf8f2' : '#faf8f5', overflow: 'hidden', transition: 'all 0.15s',
          }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '1rem 1.25rem', cursor: 'pointer' }}>
              <div style={{
                width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0, marginTop: '2px',
                border: `1.5px solid ${options.handle_outliers ? '#9c8f80' : '#c8b89a'}`,
                backgroundColor: options.handle_outliers ? '#9c8f80' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
              }}
                onClick={() => set('handle_outliers', !options.handle_outliers)}
              >
                {options.handle_outliers && <span style={{ color: '#f7f4ef', fontSize: '0.65rem', fontWeight: 700 }}>✓</span>}
              </div>
              <div>
                <p style={{ fontWeight: 500, color: '#2c2c2c', fontSize: '0.875rem' }}>
                  Handle Outliers{outlierCols > 0 ? ` — ${outlierCols} columns affected` : ''}
                </p>
                <p style={{ color: '#9c8f80', fontSize: '0.78rem', marginTop: '0.2rem', fontWeight: 300 }}>
                  IQR method · values beyond 1.5× IQR
                </p>
              </div>
            </label>
            {options.handle_outliers && (
              <div style={{ paddingLeft: '3.25rem', paddingBottom: '1rem', display: 'flex', gap: '1.5rem' }}>
                {(['clip', 'remove'] as const).map(action => (
                  <label key={action} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <div
                      onClick={() => set('outlier_action', action)}
                      style={{
                        width: '14px', height: '14px', borderRadius: '50%',
                        border: `1.5px solid ${options.outlier_action === action ? '#9c8f80' : '#c8b89a'}`,
                        backgroundColor: options.outlier_action === action ? '#9c8f80' : 'transparent',
                        transition: 'all 0.15s',
                      }}
                    />
                    <span style={{ fontSize: '0.8rem', color: '#5a5048', textTransform: 'capitalize' }}>{action} outliers</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <Toggle
            label={`Standardize Categories${catCols > 0 ? ` — ${catCols} columns affected` : ''}`}
            description="Lowercase + strip whitespace · most-common variant wins"
            checked={options.standardize_categories}
            onChange={v => set('standardize_categories', v)}
          />
          <Toggle
            label={`Log-Transform Skewed Columns${skewedCols > 0 ? ` — ${skewedCols} flagged` : ''}`}
            description="Apply log1p to numeric columns with |skew| > 1"
            checked={options.log_transform}
            disabled={skewedCols === 0}
            onChange={v => set('log_transform', v)}
          />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem' }}>
        <p style={{ fontSize: '0.78rem', color: '#b0a090' }}>
          {[
            options.fill_missing && 'Fill missing',
            options.drop_duplicates && 'Drop duplicates',
            options.handle_outliers && `${options.outlier_action} outliers`,
            options.standardize_categories && 'Standardize categories',
            options.log_transform && 'Log transform',
          ].filter(Boolean).join(' · ')}
        </p>
        <button
          onClick={onClean}
          disabled={loading}
          style={{
            backgroundColor: loading ? '#b0a090' : '#2c2c2c', color: '#f7f4ef',
            padding: '0.7rem 2rem', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 500,
            border: 'none', cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.02em',
            display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'background 0.2s',
          }}
          onMouseEnter={e => { if (!loading) (e.currentTarget.style.backgroundColor = '#444') }}
          onMouseLeave={e => { if (!loading) (e.currentTarget.style.backgroundColor = '#2c2c2c') }}
        >
          {loading && (
            <div style={{ width: '14px', height: '14px', border: '2px solid #f7f4ef', borderTopColor: 'transparent', borderRadius: '50%' }}
              className="animate-spin" />
          )}
          Clean Now
        </button>
      </div>
    </div>
  )
}
