import type { UploadData, AnalysisData, ColumnInfo } from '../App'

type Props = { uploadData: UploadData; analysis: AnalysisData }

const card = { backgroundColor: '#faf8f5', border: '1px solid #e0d9cf', borderRadius: '12px', padding: '1.1rem' }
const flaggedCard = { backgroundColor: '#fdf6ee', border: '1px solid #e8d5b7', borderRadius: '12px', padding: '1.1rem' }
const labelStyle = { fontSize: '0.72rem', color: '#9c8f80', textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginTop: '0.25rem' }
const val = (flagged: boolean) => ({ fontSize: '1.5rem', fontWeight: 600, color: flagged ? '#a0622a' : '#2c2c2c', fontFamily: 'Playfair Display, serif' })

function IssueCard({ label, value, flagged }: { label: string; value: string; flagged?: boolean }) {
  return (
    <div style={flagged ? flaggedCard : card}>
      <div style={val(!!flagged)}>{value}</div>
      <div style={labelStyle}>{label}</div>
    </div>
  )
}

function countIssues(cols: Record<string, ColumnInfo>) {
  let missingFlagged = 0, outlierCols = 0, skewedCols = 0, variantCols = 0
  for (const info of Object.values(cols)) {
    if (info.missing_flagged) missingFlagged++
    if (info.outliers && info.outliers.count > 0) outlierCols++
    if (info.skew_flagged) skewedCols++
    if (info.categories?.suspected_variants?.length) variantCols++
  }
  return { missingFlagged, outlierCols, skewedCols, variantCols }
}

const sectionLabel = { fontSize: '0.72rem', color: '#9c8f80', textTransform: 'uppercase' as const, letterSpacing: '0.1em', fontWeight: 500, marginBottom: '0.75rem' }
const tableHeader = { padding: '0.65rem 1rem', fontSize: '0.7rem', color: '#9c8f80', textTransform: 'uppercase' as const, letterSpacing: '0.07em', fontWeight: 500, textAlign: 'left' as const, backgroundColor: '#f5f1ec', borderBottom: '1px solid #e0d9cf' }
const tableCell = { padding: '0.6rem 1rem', fontSize: '0.82rem', color: '#5a5048', borderBottom: '1px solid #f0ebe3' }

export default function IssuesSummary({ uploadData, analysis }: Props) {
  const { missingFlagged, outlierCols, skewedCols, variantCols } = countIssues(analysis.columns)
  const totalIssues = missingFlagged + outlierCols + skewedCols + variantCols + (analysis.duplicates.exact_count > 0 ? 1 : 0)

  return (
    <div className="space-y-8">
      {/* File info bar */}
      <div style={{ backgroundColor: '#faf8f5', border: '1px solid #e0d9cf', borderRadius: '12px', padding: '1rem 1.25rem' }} className="flex items-center gap-3">
        <div className="flex-1">
          <p style={{ fontWeight: 500, color: '#2c2c2c', fontSize: '0.9rem' }}>{uploadData.filename}</p>
          <p style={{ color: '#9c8f80', fontSize: '0.78rem', marginTop: '0.1rem' }}>
            {analysis.shape.rows.toLocaleString()} rows · {analysis.shape.cols} columns
          </p>
        </div>
        <span style={{
          padding: '0.25rem 0.85rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 500,
          backgroundColor: totalIssues > 0 ? '#fdf6ee' : '#f0f7f0',
          color: totalIssues > 0 ? '#a0622a' : '#3a7a4a',
          border: `1px solid ${totalIssues > 0 ? '#e8d5b7' : '#b8d9be'}`,
        }}>
          {totalIssues} issue{totalIssues !== 1 ? 's' : ''} detected
        </span>
      </div>

      {/* Description */}
      {uploadData.description && (
        <div style={{ backgroundColor: '#faf8f5', border: '1px solid #e0d9cf', borderRadius: '12px', padding: '1rem 1.25rem' }}>
          <p style={sectionLabel}>Dataset Description</p>
          <p style={{ fontSize: '0.85rem', color: '#5a5048', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{uploadData.description}</p>
        </div>
      )}

      {/* Issue cards */}
      <div>
        <p style={sectionLabel}>Detected Issues</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <IssueCard label="Missing >20%" value={String(missingFlagged)} flagged={missingFlagged > 0} />
          <IssueCard label="Duplicate rows" value={String(analysis.duplicates.exact_count)} flagged={analysis.duplicates.exact_count > 0} />
          <IssueCard label="Outlier columns" value={String(outlierCols)} flagged={outlierCols > 0} />
          <IssueCard label="Skewed columns" value={String(skewedCols)} flagged={skewedCols > 0} />
          <IssueCard label="Category variants" value={String(variantCols)} flagged={variantCols > 0} />
        </div>
      </div>

      {/* Column details table */}
      <div>
        <p style={sectionLabel}>Column Details</p>
        <div style={{ backgroundColor: '#faf8f5', border: '1px solid #e0d9cf', borderRadius: '12px', overflow: 'hidden' }}>
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Column', 'Type', 'Missing', 'Outliers', 'Skew', 'Categories'].map(h => <th key={h} style={tableHeader}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {Object.entries(analysis.columns).map(([col, info]) => (
                  <tr key={col}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f5f1ec')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                    <td style={{ ...tableCell, fontWeight: 500, color: '#2c2c2c' }}>{col}</td>
                    <td style={tableCell}>
                      <span style={{ backgroundColor: '#ede8e0', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem', color: '#7a6f62' }}>{info.dtype}</span>
                    </td>
                    <td style={{ ...tableCell, color: info.missing_flagged ? '#a0622a' : '#5a5048', fontWeight: info.missing_flagged ? 500 : 400 }}>
                      {info.missing_count} ({info.missing_pct}%)
                    </td>
                    <td style={{ ...tableCell, color: info.outliers && info.outliers.count > 0 ? '#a0622a' : '#5a5048', fontWeight: info.outliers && info.outliers.count > 0 ? 500 : 400 }}>
                      {info.outliers ? info.outliers.count : '—'}
                    </td>
                    <td style={{ ...tableCell, color: info.skew_flagged ? '#a0622a' : '#5a5048', fontWeight: info.skew_flagged ? 500 : 400 }}>
                      {info.skewness !== null ? info.skewness : '—'}
                    </td>
                    <td style={{ ...tableCell, color: info.categories?.suspected_variants?.length ? '#a0622a' : '#5a5048', fontWeight: info.categories?.suspected_variants?.length ? 500 : 400 }}>
                      {info.categories ? `${info.categories.unique_count} unique${info.categories.suspected_variants.length > 0 ? ` · ${info.categories.suspected_variants.length} variant(s)` : ''}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Data preview */}
      <div>
        <p style={sectionLabel}>Data Preview — first 10 rows</p>
        <div style={{ backgroundColor: '#faf8f5', border: '1px solid #e0d9cf', borderRadius: '12px', overflow: 'hidden' }}>
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{uploadData.columns.map(col => <th key={col} style={{ ...tableHeader, whiteSpace: 'nowrap' }}>{col}</th>)}</tr>
              </thead>
              <tbody>
                {uploadData.preview.map((row, i) => (
                  <tr key={i}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f5f1ec')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                    {uploadData.columns.map(col => (
                      <td key={col} style={{ ...tableCell, maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row[col] === '' ? <span style={{ color: '#c8b89a', fontStyle: 'italic' }}>null</span> : row[col]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
