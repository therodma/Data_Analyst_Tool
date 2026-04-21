import type { UploadData, AnalysisData, ColumnInfo } from '../App'

type Props = {
  uploadData: UploadData
  analysis: AnalysisData
  onNext: () => void
}

function IssueCard({
  icon,
  label,
  value,
  flagged,
}: {
  icon: string
  label: string
  value: string
  flagged?: boolean
}) {
  return (
    <div
      className={`rounded-xl p-4 border ${
        flagged ? 'border-orange-200 bg-orange-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="text-2xl mb-1">{icon}</div>
      <div className={`text-xl font-bold ${flagged ? 'text-orange-600' : 'text-gray-800'}`}>
        {value}
      </div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

function countIssues(cols: Record<string, ColumnInfo>) {
  let missingFlagged = 0,
    outlierCols = 0,
    skewedCols = 0,
    variantCols = 0

  for (const info of Object.values(cols)) {
    if (info.missing_flagged) missingFlagged++
    if (info.outliers && info.outliers.count > 0) outlierCols++
    if (info.skew_flagged) skewedCols++
    if (info.categories?.suspected_variants?.length) variantCols++
  }
  return { missingFlagged, outlierCols, skewedCols, variantCols }
}

export default function IssuesSummary({ uploadData, analysis, onNext }: Props) {
  const { missingFlagged, outlierCols, skewedCols, variantCols } = countIssues(analysis.columns)
  const totalIssues = missingFlagged + outlierCols + skewedCols + variantCols + (analysis.duplicates.exact_count > 0 ? 1 : 0)

  return (
    <div className="space-y-8">
      {/* File info */}
      <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200">
        <span className="text-2xl">📊</span>
        <div>
          <p className="font-semibold text-gray-800">{uploadData.filename}</p>
          <p className="text-sm text-gray-500">
            {analysis.shape.rows.toLocaleString()} rows × {analysis.shape.cols} columns
          </p>
        </div>
        <div className="ml-auto">
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              totalIssues > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
            }`}
          >
            {totalIssues} issue{totalIssues !== 1 ? 's' : ''} found
          </span>
        </div>
      </div>

      {/* Issue cards */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Detected Issues
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <IssueCard
            icon="🔲"
            label="Cols with >20% missing"
            value={String(missingFlagged)}
            flagged={missingFlagged > 0}
          />
          <IssueCard
            icon="👯"
            label="Duplicate rows"
            value={String(analysis.duplicates.exact_count)}
            flagged={analysis.duplicates.exact_count > 0}
          />
          <IssueCard
            icon="📍"
            label="Cols with outliers"
            value={String(outlierCols)}
            flagged={outlierCols > 0}
          />
          <IssueCard
            icon="📐"
            label="Skewed columns"
            value={String(skewedCols)}
            flagged={skewedCols > 0}
          />
          <IssueCard
            icon="🔤"
            label="Category variants"
            value={String(variantCols)}
            flagged={variantCols > 0}
          />
        </div>
      </div>

      {/* Per-column breakdown */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Column Details
        </h3>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Column', 'Type', 'Missing', 'Outliers', 'Skew', 'Categories'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Object.entries(analysis.columns).map(([col, info]) => (
                  <tr key={col} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800 max-w-[150px] truncate">{col}</td>
                    <td className="px-4 py-3 text-gray-500">
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{info.dtype}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={info.missing_flagged ? 'text-orange-600 font-semibold' : 'text-gray-600'}>
                        {info.missing_count} ({info.missing_pct}%)
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {info.outliers ? (
                        <span className={info.outliers.count > 0 ? 'text-orange-600 font-semibold' : ''}>
                          {info.outliers.count}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {info.skewness !== null ? (
                        <span className={info.skew_flagged ? 'text-orange-600 font-semibold' : 'text-gray-600'}>
                          {info.skewness}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {info.categories ? (
                        <span className={info.categories.suspected_variants.length > 0 ? 'text-orange-600 font-semibold' : ''}>
                          {info.categories.unique_count} unique
                          {info.categories.suspected_variants.length > 0 &&
                            ` · ${info.categories.suspected_variants.length} variant group(s)`}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
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
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Data Preview (first 10 rows)
        </h3>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {uploadData.columns.map((col) => (
                    <th key={col} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {uploadData.preview.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {uploadData.columns.map((col) => (
                      <td key={col} className="px-4 py-2 text-gray-700 max-w-[150px] truncate">
                        {row[col] === '' ? <span className="text-gray-300 italic">null</span> : row[col]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
        >
          Configure Cleaning →
        </button>
      </div>
    </div>
  )
}
