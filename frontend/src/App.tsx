import { useState } from 'react'
import axios from 'axios'
import UploadZone from './components/UploadZone'
import IssuesSummary from './components/IssuesSummary'
import TransformToggles from './components/TransformToggles'
import ResultsPanel from './components/ResultsPanel'

const API = 'http://localhost:8000'

export type UploadData = {
  session_id: string
  filename: string
  shape: { rows: number; cols: number }
  columns: string[]
  preview: Record<string, string>[]
}

export type AnalysisData = {
  shape: { rows: number; cols: number }
  columns: Record<string, ColumnInfo>
  duplicates: { exact_count: number; exact_pct: number }
}

export type ColumnInfo = {
  dtype: string
  missing_count: number
  missing_pct: number
  missing_flagged: boolean
  outliers: { count: number; pct: number; lower_bound: number; upper_bound: number } | null
  skewness: number | null
  skew_flagged: boolean
  categories: {
    unique_count: number
    value_counts: Record<string, number>
    suspected_variants: string[][]
  } | null
}

export type CleanOptions = {
  fill_missing: boolean
  drop_duplicates: boolean
  handle_outliers: boolean
  outlier_action: 'clip' | 'remove'
  standardize_categories: boolean
  log_transform: boolean
}

export type CleanResult = {
  report: {
    before_shape: { rows: number; cols: number }
    after_shape: { rows: number; cols: number }
    transformations_applied: string[]
    column_changes: Record<string, string[]>
    recommendations: string[]
  }
  before_stats: Record<string, { missing: number; unique: number; mean?: number; std?: number }>
  after_stats: Record<string, { missing: number; unique: number; mean?: number; std?: number }>
  download_url: string
}

type Step = 1 | 2 | 3 | 4

const STEPS = ['Upload', 'Analyze', 'Configure', 'Results']

export default function App() {
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [uploadData, setUploadData] = useState<UploadData | null>(null)
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)
  const [cleanResult, setCleanResult] = useState<CleanResult | null>(null)
  const [options, setOptions] = useState<CleanOptions>({
    fill_missing: true,
    drop_duplicates: true,
    handle_outliers: true,
    outlier_action: 'clip',
    standardize_categories: true,
    log_transform: false,
  })

  const handleError = (e: unknown) => {
    const msg =
      axios.isAxiosError(e)
        ? e.response?.data?.detail?.errors?.[0] ?? e.message
        : String(e)
    setError(msg)
    setLoading(false)
  }

  const onUploaded = (data: UploadData) => {
    setUploadData(data)
    setError(null)
    runAnalysis(data.session_id)
  }

  const runAnalysis = async (session_id: string) => {
    setLoading(true)
    setLoadingMsg('Reading dataset...')
    try {
      await delay(300)
      setLoadingMsg('Detecting missing values...')
      await delay(300)
      setLoadingMsg('Checking for duplicates...')
      await delay(200)
      setLoadingMsg('Detecting outliers...')
      await delay(200)
      setLoadingMsg('Checking categories...')
      const res = await axios.post(`${API}/analyze`, { session_id })
      setAnalysisData(res.data.data)
      setStep(2)
    } catch (e) {
      handleError(e)
    } finally {
      setLoading(false)
    }
  }

  const onClean = async () => {
    if (!uploadData) return
    setLoading(true)
    setLoadingMsg('Applying transformations...')
    setError(null)
    try {
      const res = await axios.post(`${API}/clean`, {
        session_id: uploadData.session_id,
        options,
      })
      setCleanResult(res.data.data)
      setStep(4)
    } catch (e) {
      handleError(e)
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setStep(1)
    setUploadData(null)
    setAnalysisData(null)
    setCleanResult(null)
    setError(null)
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🧹</span>
            <h1 className="text-xl font-bold text-gray-900">Data Cleaner</h1>
          </div>
          {step > 1 && (
            <button onClick={reset} className="text-sm text-gray-500 hover:text-gray-700 underline">
              Start over
            </button>
          )}
        </div>
      </header>

      {/* Step indicator */}
      <div className="bg-white border-b border-gray-100 px-6 py-3">
        <div className="max-w-5xl mx-auto flex gap-1">
          {STEPS.map((label, i) => {
            const s = (i + 1) as Step
            const active = step === s
            const done = step > s
            return (
              <div key={label} className="flex items-center gap-1">
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    active
                      ? 'bg-blue-600 text-white'
                      : done
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  <span>{done ? '✓' : s}</span>
                  <span>{label}</span>
                </div>
                {i < STEPS.length - 1 && <span className="text-gray-300 text-xs">›</span>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            ⚠️ {error}
          </div>
        )}

        {loading && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-blue-700 text-sm font-medium">{loadingMsg}</span>
          </div>
        )}

        {step === 1 && <UploadZone onUploaded={onUploaded} apiBase={API} />}

        {step === 2 && uploadData && analysisData && (
          <IssuesSummary
            uploadData={uploadData}
            analysis={analysisData}
            onNext={() => setStep(3)}
          />
        )}

        {step === 3 && analysisData && (
          <TransformToggles
            analysis={analysisData}
            options={options}
            onChange={setOptions}
            onClean={onClean}
            loading={loading}
          />
        )}

        {step === 4 && cleanResult && uploadData && (
          <ResultsPanel
            result={cleanResult}
            sessionId={uploadData.session_id}
            apiBase={API}
            onReset={reset}
          />
        )}
      </main>
    </div>
  )
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
