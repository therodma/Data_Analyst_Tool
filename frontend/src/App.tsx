import { useState } from 'react'
import axios from 'axios'
import MultiUploadZone from './components/MultiUploadZone'
import IssuesSummary from './components/IssuesSummary'
import TransformToggles from './components/TransformToggles'
import ResultsPanel from './components/ResultsPanel'
import JSZip from 'jszip'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export type UploadData = {
  session_id: string
  filename: string
  shape: { rows: number; cols: number }
  columns: string[]
  preview: Record<string, string>[]
  description: string
}

export type AnalysisData = {
  shape: { rows: number; cols: number }
  columns: Record<string, ColumnInfo>
  duplicates: { exact_count: number; exact_pct: number }
  histograms: Record<string, { bin: number; count: number }[]>
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

export type ColumnInstruction = 'none' | 'drop' | 'categorical' | 'numeric' | string

export type CleanResult = {
  report: {
    before_shape: { rows: number; cols: number }
    after_shape: { rows: number; cols: number }
    transformations_applied: string[]
    column_changes: Record<string, string[]>
    recommendations: string[]
    instruction_log: string[]
    description: string
  }
  before_stats: Record<string, { missing: number; unique: number; mean?: number; std?: number }>
  after_stats: Record<string, { missing: number; unique: number; mean?: number; std?: number }>
  after_histograms: Record<string, { bin: number; count: number }[]>
  download_url: string
  cleaned_filename: string
}

export type FileSession = {
  id: string
  uploadData: UploadData
  analysis: AnalysisData | null
  result: CleanResult | null
  status: 'analyzing' | 'ready' | 'cleaning' | 'done' | 'error'
  error: string | null
}

type Step = 1 | 2 | 3 | 4
const STEPS = ['Upload', 'Analyze', 'Configure', 'Results']

export default function App() {
  const [step, setStep] = useState<Step>(1)
  const [sessions, setSessions] = useState<FileSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [globalLoading, setGlobalLoading] = useState(false)
  const [options, setOptions] = useState<CleanOptions>({
    fill_missing: true,
    drop_duplicates: true,
    handle_outliers: true,
    outlier_action: 'clip',
    standardize_categories: true,
    log_transform: false,
  })
  const [columnInstructions, setColumnInstructions] = useState<Record<string, Record<string, ColumnInstruction>>>({})

  const updateSession = (id: string, patch: Partial<FileSession>) =>
    setSessions(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))

  const onFilesUploaded = async (uploads: UploadData[]) => {
    const newSessions: FileSession[] = uploads.map(u => ({
      id: u.session_id,
      uploadData: u,
      analysis: null,
      result: null,
      status: 'analyzing',
      error: null,
    }))
    setSessions(newSessions)
    setActiveSessionId(newSessions[0]?.id ?? null)
    setStep(2)

    await Promise.all(newSessions.map(s => runAnalysis(s.id)))
  }

  const runAnalysis = async (session_id: string) => {
    try {
      const res = await axios.post(`${API}/analyze`, { session_id })
      updateSession(session_id, { analysis: res.data.data, status: 'ready' })
    } catch (e) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.detail?.errors?.[0] ?? e.message : String(e)
      updateSession(session_id, { status: 'error', error: msg })
    }
  }

  const onCleanAll = async () => {
    setGlobalLoading(true)
    const readySessions = sessions.filter(s => s.status === 'ready' || s.status === 'done')
    await Promise.all(readySessions.map(s => cleanSession(s.id)))
    setGlobalLoading(false)
    setStep(4)
  }

  const cleanSession = async (session_id: string) => {
    updateSession(session_id, { status: 'cleaning' })
    try {
      const res = await axios.post(`${API}/clean`, {
        session_id,
        options,
        column_instructions: columnInstructions[session_id] ?? {},
      })
      updateSession(session_id, { result: res.data.data, status: 'done' })
    } catch (e) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.detail?.errors?.[0] ?? e.message : String(e)
      updateSession(session_id, { status: 'error', error: msg })
    }
  }

  const downloadAll = async () => {
    const doneSessions = sessions.filter(s => s.status === 'done' && s.result)
    if (doneSessions.length === 1) {
      window.open(`${API}/download/${doneSessions[0].id}`, '_blank')
      return
    }
    const zip = new JSZip()
    await Promise.all(doneSessions.map(async s => {
      const res = await axios.get(`${API}/download/${s.id}`, { responseType: 'blob' })
      zip.file(s.result!.cleaned_filename, res.data)
    }))
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cleaned_files.zip'
    a.click()
    URL.revokeObjectURL(url)
  }

  const reset = () => {
    setSessions([])
    setActiveSessionId(null)
    setColumnInstructions({})
    setStep(1)
  }

  const activeSession = sessions.find(s => s.id === activeSessionId) ?? null
  const allReady = sessions.length > 0 && sessions.every(s => s.status === 'ready' || s.status === 'done' || s.status === 'error')
  const allDone = sessions.length > 0 && sessions.filter(s => s.status !== 'error').every(s => s.status === 'done')

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f7f4ef' }}>
      {/* Header */}
      <header style={{ backgroundColor: '#f0ebe3', borderBottom: '1px solid #e0d9cf' }} className="px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 style={{ fontFamily: 'Playfair Display, serif', color: '#2c2c2c', fontSize: '1.4rem', fontWeight: 600 }}>
              Data Cleaning Tool
            </h1>
            <p style={{ color: '#9c8f80', fontSize: '0.75rem', fontWeight: 300, letterSpacing: '0.08em' }} className="uppercase tracking-widest mt-0.5">
              Automated Analysis & Transformation
            </p>
          </div>
          {step > 1 && (
            <button onClick={reset} style={{ color: '#9c8f80', fontSize: '0.8rem' }} className="hover:underline">
              Start over
            </button>
          )}
        </div>
      </header>

      {/* Step indicator */}
      <div style={{ backgroundColor: '#f0ebe3', borderBottom: '1px solid #e0d9cf' }} className="px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-2">
          {STEPS.map((label, i) => {
            const s = (i + 1) as Step
            const active = step === s
            const done = step > s
            return (
              <div key={label} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div style={{
                    width: '22px', height: '22px', borderRadius: '50%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 600,
                    backgroundColor: active ? '#2c2c2c' : done ? '#c8b89a' : 'transparent',
                    color: active ? '#f7f4ef' : done ? '#f7f4ef' : '#b0a090',
                    border: active || done ? 'none' : '1px solid #c8b89a',
                  }}>
                    {done ? '✓' : s}
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: active ? 500 : 400, color: active ? '#2c2c2c' : done ? '#9c8f80' : '#b0a090' }}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && <span style={{ color: '#c8b89a', fontSize: '0.7rem' }}>›</span>}
              </div>
            )
          })}
        </div>
      </div>

      {/* File tabs (steps 2-4) */}
      {step > 1 && sessions.length > 1 && (
        <div style={{ backgroundColor: '#f5f1ec', borderBottom: '1px solid #e0d9cf' }} className="px-6 py-2">
          <div className="max-w-6xl mx-auto flex gap-2 overflow-x-auto">
            {sessions.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSessionId(s.id)}
                style={{
                  padding: '0.3rem 0.85rem', borderRadius: '6px', fontSize: '0.78rem', whiteSpace: 'nowrap',
                  border: `1px solid ${activeSessionId === s.id ? '#9c8f80' : '#e0d9cf'}`,
                  backgroundColor: activeSessionId === s.id ? '#2c2c2c' : 'transparent',
                  color: activeSessionId === s.id ? '#f7f4ef' : '#7a6f62',
                  cursor: 'pointer',
                }}
              >
                {s.status === 'analyzing' ? '⏳ ' : s.status === 'error' ? '⚠ ' : s.status === 'done' ? '✓ ' : ''}
                {s.uploadData.filename}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-6 py-10">
        {step === 1 && <MultiUploadZone onFilesUploaded={onFilesUploaded} apiBase={API} />}

        {step === 2 && activeSession && (
          <div className="space-y-6">
            {activeSession.status === 'analyzing' && (
              <div style={{ backgroundColor: '#f0ebe3', border: '1px solid #e0d9cf', borderRadius: '10px' }} className="px-4 py-3 flex items-center gap-3">
                <div style={{ width: '16px', height: '16px', border: '2px solid #9c8f80', borderTopColor: 'transparent', borderRadius: '50%' }} className="animate-spin" />
                <span style={{ color: '#7a6f62', fontSize: '0.85rem' }}>Analyzing {activeSession.uploadData.filename}...</span>
              </div>
            )}
            {activeSession.status === 'error' && (
              <div style={{ backgroundColor: '#fdf0ee', border: '1px solid #e8c4bc', color: '#8b3a2f', borderRadius: '10px' }} className="px-4 py-3 text-sm">
                {activeSession.error}
              </div>
            )}
            {activeSession.analysis && (
              <IssuesSummary uploadData={activeSession.uploadData} analysis={activeSession.analysis} />
            )}
            {allReady && (
              <div className="flex justify-end">
                <button
                  onClick={() => setStep(3)}
                  style={{ backgroundColor: '#2c2c2c', color: '#f7f4ef', padding: '0.7rem 1.75rem', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 500, border: 'none', cursor: 'pointer' }}
                >
                  Configure Cleaning →
                </button>
              </div>
            )}
          </div>
        )}

        {step === 3 && activeSession?.analysis && (
          <TransformToggles
            sessions={sessions}
            activeSessionId={activeSessionId!}
            analysis={activeSession.analysis}
            options={options}
            onChange={setOptions}
            columnInstructions={columnInstructions[activeSessionId!] ?? {}}
            onColumnInstruction={(col, val) => setColumnInstructions(prev => ({
              ...prev,
              [activeSessionId!]: { ...(prev[activeSessionId!] ?? {}), [col]: val }
            }))}
            onCleanAll={onCleanAll}
            loading={globalLoading}
          />
        )}

        {step === 4 && (
          <div className="space-y-8">
            {/* Download all banner */}
            {allDone && (
              <div style={{ backgroundColor: '#f5f9f5', border: '1px solid #c0d9c0', borderRadius: '12px', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontFamily: 'Playfair Display, serif', color: '#2c4a2c', fontSize: '1.2rem', fontWeight: 500 }}>
                    All Files Cleaned
                  </h2>
                  <p style={{ color: '#5a7a5a', fontSize: '0.82rem', marginTop: '0.2rem', fontWeight: 300 }}>
                    {sessions.filter(s => s.status === 'done').length} file{sessions.filter(s => s.status === 'done').length !== 1 ? 's' : ''} ready to download
                  </p>
                </div>
                <button
                  onClick={downloadAll}
                  style={{ backgroundColor: '#2c4a2c', color: '#f7f4ef', padding: '0.6rem 1.25rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 500, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {sessions.filter(s => s.status === 'done').length > 1 ? 'Download All as ZIP' : 'Download Cleaned File'}
                </button>
              </div>
            )}

            {/* Per-file tabs */}
            {sessions.length > 1 && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {sessions.map(s => (
                  <button key={s.id} onClick={() => setActiveSessionId(s.id)}
                    style={{
                      padding: '0.3rem 0.85rem', borderRadius: '6px', fontSize: '0.78rem',
                      border: `1px solid ${activeSessionId === s.id ? '#9c8f80' : '#e0d9cf'}`,
                      backgroundColor: activeSessionId === s.id ? '#2c2c2c' : 'transparent',
                      color: activeSessionId === s.id ? '#f7f4ef' : '#7a6f62', cursor: 'pointer',
                    }}>
                    {s.status === 'done' ? '✓ ' : s.status === 'error' ? '⚠ ' : ''}{s.uploadData.filename}
                  </button>
                ))}
              </div>
            )}

            {activeSession?.result && activeSession.analysis && (
              <ResultsPanel
                result={activeSession.result}
                analysis={activeSession.analysis}
                sessionId={activeSession.id}
                apiBase={API}
                onReset={reset}
                onDownloadAll={downloadAll}
                multiFile={sessions.length > 1}
              />
            )}
          </div>
        )}
      </main>
    </div>
  )
}
