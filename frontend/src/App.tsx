import { useState } from 'react'
import axios from 'axios'
import UploadZone from './components/UploadZone'
import IssuesSummary from './components/IssuesSummary'
import TransformToggles from './components/TransformToggles'
import ResultsPanel from './components/ResultsPanel'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

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
    const msg = axios.isAxiosError(e)
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
      const res = await axios.post(`${API}/clean`, { session_id: uploadData.session_id, options })
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
    <div className="min-h-screen" style={{ backgroundColor: '#f7f4ef' }}>
      {/* Header */}
      <header style={{ backgroundColor: '#f0ebe3', borderBottom: '1px solid #e0d9cf' }} className="px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 style={{ fontFamily: 'Playfair Display, serif', color: '#2c2c2c', fontSize: '1.4rem', fontWeight: 600 }}>
              Data Cleaning Tool
            </h1>
            <p style={{ color: '#9c8f80', fontSize: '0.75rem', fontWeight: 300, letterSpacing: '0.08em' }} className="uppercase tracking-widest mt-0.5">
              Automated Analysis & Transformation
            </p>
          </div>
          {step > 1 && (
            <button
              onClick={reset}
              style={{ color: '#9c8f80', fontSize: '0.8rem', fontWeight: 400 }}
              className="hover:underline transition-all"
            >
              Start over
            </button>
          )}
        </div>
      </header>

      {/* Step indicator */}
      <div style={{ backgroundColor: '#f0ebe3', borderBottom: '1px solid #e0d9cf' }} className="px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-2">
          {STEPS.map((label, i) => {
            const s = (i + 1) as Step
            const active = step === s
            const done = step > s
            return (
              <div key={label} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div
                    style={{
                      width: '22px', height: '22px', borderRadius: '50%', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 600,
                      backgroundColor: active ? '#2c2c2c' : done ? '#c8b89a' : 'transparent',
                      color: active ? '#f7f4ef' : done ? '#f7f4ef' : '#b0a090',
                      border: active ? 'none' : done ? 'none' : '1px solid #c8b89a',
                    }}
                  >
                    {done ? '✓' : s}
                  </div>
                  <span style={{
                    fontSize: '0.8rem', fontWeight: active ? 500 : 400,
                    color: active ? '#2c2c2c' : done ? '#9c8f80' : '#b0a090',
                  }}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <span style={{ color: '#c8b89a', fontSize: '0.7rem' }}>›</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-6 py-10">
        {error && (
          <div style={{ backgroundColor: '#fdf0ee', border: '1px solid #e8c4bc', color: '#8b3a2f', borderRadius: '10px' }}
            className="mb-6 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {loading && (
          <div style={{ backgroundColor: '#f0ebe3', border: '1px solid #e0d9cf', borderRadius: '10px' }}
            className="mb-6 px-4 py-3 flex items-center gap-3">
            <div style={{ width: '16px', height: '16px', border: '2px solid #9c8f80', borderTopColor: 'transparent', borderRadius: '50%' }}
              className="animate-spin" />
            <span style={{ color: '#7a6f62', fontSize: '0.85rem', fontWeight: 400 }}>{loadingMsg}</span>
          </div>
        )}

        {step === 1 && <UploadZone onUploaded={onUploaded} apiBase={API} />}
        {step === 2 && uploadData && analysisData && (
          <IssuesSummary uploadData={uploadData} analysis={analysisData} onNext={() => setStep(3)} />
        )}
        {step === 3 && analysisData && (
          <TransformToggles analysis={analysisData} options={options} onChange={setOptions} onClean={onClean} loading={loading} />
        )}
        {step === 4 && cleanResult && uploadData && (
          <ResultsPanel result={cleanResult} sessionId={uploadData.session_id} apiBase={API} onReset={reset} />
        )}
      </main>
    </div>
  )
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
