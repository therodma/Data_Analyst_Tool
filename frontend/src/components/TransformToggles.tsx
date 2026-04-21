import type { AnalysisData, CleanOptions } from '../App'

type Props = {
  analysis: AnalysisData
  options: CleanOptions
  onChange: (opts: CleanOptions) => void
  onClean: () => void
  loading: boolean
}

type ToggleProps = {
  id: keyof CleanOptions
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: (val: boolean) => void
}

function Toggle({ id, label, description, checked, disabled, onChange }: ToggleProps) {
  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${
        checked ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 w-4 h-4 accent-blue-600"
      />
      <div>
        <p className="font-medium text-gray-800">{label}</p>
        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
      </div>
    </label>
  )
}

function countAffected(analysis: AnalysisData) {
  const cols = Object.values(analysis.columns)
  return {
    missingCols: cols.filter((c) => c.missing_count > 0).length,
    outlierCols: cols.filter((c) => c.outliers && c.outliers.count > 0).length,
    catCols: cols.filter((c) => c.categories !== null).length,
    skewedCols: cols.filter((c) => c.skew_flagged).length,
  }
}

export default function TransformToggles({ analysis, options, onChange, onClean, loading }: Props) {
  const set = <K extends keyof CleanOptions>(key: K, val: CleanOptions[K]) =>
    onChange({ ...options, [key]: val })

  const { missingCols, outlierCols, catCols, skewedCols } = countAffected(analysis)

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-1">Configure Cleaning</h2>
        <p className="text-gray-500 text-sm">Toggle the transformations you want to apply, then click Clean Now.</p>
      </div>

      <div className="space-y-3">
        <Toggle
          id="fill_missing"
          label={`Fill Missing Values ${missingCols > 0 ? `(${missingCols} cols affected)` : ''}`}
          description="Numeric columns → median; categorical columns → mode"
          checked={options.fill_missing}
          onChange={(v) => set('fill_missing', v)}
        />
        <Toggle
          id="drop_duplicates"
          label={`Drop Duplicate Rows ${analysis.duplicates.exact_count > 0 ? `(${analysis.duplicates.exact_count} duplicates)` : ''}`}
          description="Remove exact duplicate rows from the dataset"
          checked={options.drop_duplicates}
          onChange={(v) => set('drop_duplicates', v)}
        />

        {/* Outlier handling with sub-option */}
        <div
          className={`rounded-xl border transition-colors ${
            options.handle_outliers ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'
          }`}
        >
          <label className="flex items-start gap-4 p-4 cursor-pointer">
            <input
              type="checkbox"
              checked={options.handle_outliers}
              onChange={(e) => set('handle_outliers', e.target.checked)}
              className="mt-1 w-4 h-4 accent-blue-600"
            />
            <div className="flex-1">
              <p className="font-medium text-gray-800">
                Handle Outliers {outlierCols > 0 ? `(${outlierCols} cols affected)` : ''}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">IQR method — values beyond 1.5× IQR</p>
            </div>
          </label>
          {options.handle_outliers && (
            <div className="px-12 pb-4 flex gap-4">
              {(['clip', 'remove'] as const).map((action) => (
                <label key={action} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="outlier_action"
                    value={action}
                    checked={options.outlier_action === action}
                    onChange={() => set('outlier_action', action)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-gray-700 capitalize">{action} outliers</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <Toggle
          id="standardize_categories"
          label={`Standardize Categories ${catCols > 0 ? `(${catCols} cols affected)` : ''}`}
          description="Lowercase + strip whitespace; most-common variant wins for fuzzy duplicates"
          checked={options.standardize_categories}
          onChange={(v) => set('standardize_categories', v)}
        />
        <Toggle
          id="log_transform"
          label={`Log-Transform Skewed Columns ${skewedCols > 0 ? `(${skewedCols} cols flagged)` : ''}`}
          description="Apply log1p to numeric columns with |skew| > 1 (only if all values > 0)"
          checked={options.log_transform}
          disabled={skewedCols === 0}
          onChange={(v) => set('log_transform', v)}
        />
      </div>

      <div className="flex items-center justify-between pt-2">
        <p className="text-sm text-gray-400">
          {[
            options.fill_missing && 'Fill missing',
            options.drop_duplicates && 'Drop duplicates',
            options.handle_outliers && `${options.outlier_action} outliers`,
            options.standardize_categories && 'Standardize categories',
            options.log_transform && 'Log transform',
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <button
          onClick={onClean}
          disabled={loading}
          className="px-8 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {loading && (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          🧹 Clean Now
        </button>
      </div>
    </div>
  )
}
