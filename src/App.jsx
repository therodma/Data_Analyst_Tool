import { useState, useRef, useCallback } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend
} from 'chart.js'
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend)

const CHART_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6']

function ChartRenderer({ chart }) {
  const config = {
    data: {
      labels: chart.labels,
      datasets: chart.datasets.map((ds, i) => ({
        ...ds,
        backgroundColor: ds.backgroundColor || CHART_COLORS.map(c => c + 'cc'),
        borderColor: ds.borderColor || CHART_COLORS[i % CHART_COLORS.length],
        borderWidth: 2,
        tension: 0.4,
        fill: false,
      })),
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'DM Sans', size: 12 } } },
        title: {
          display: true,
          text: chart.subtitle ? [chart.title, chart.subtitle] : chart.title,
          font: { family: 'DM Sans', size: 14, weight: '600' },
          color: '#1e1b4b',
        },
      },
      scales: ['bar', 'line'].includes(chart.type) ? {
        x: { title: { display: !!chart.xLabel, text: chart.xLabel, font: { family: 'DM Sans' } }, ticks: { font: { family: 'DM Sans' } } },
        y: { title: { display: !!chart.yLabel, text: chart.yLabel, font: { family: 'DM Sans' } }, ticks: { font: { family: 'DM Sans' } } },
      } : undefined,
    },
  }
  const props = { data: config.data, options: config.options }
  if (chart.type === 'bar') return <Bar {...props} />
  if (chart.type === 'line') return <Line {...props} />
  if (chart.type === 'pie') return <Pie {...props} />
  if (chart.type === 'doughnut') return <Doughnut {...props} />
  return null
}

function MetricCard({ card }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-indigo-50">
      <p className="text-xs font-500 text-indigo-400 uppercase tracking-widest mb-1">{card.label}</p>
      <p className="text-3xl font-700 text-indigo-900">{card.value}</p>
      {card.change && <p className={`text-sm mt-1 font-500 ${card.change.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>{card.change}</p>}
      {card.context && <p className="text-xs text-slate-400 mt-1">{card.context}</p>}
    </div>
  )
}

export default function App() {
  const [csvText, setCsvText] = useState('')
  const [questions, setQuestions] = useState('')
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  const readFile = (file) => {
    setUploading(true)
    setUploadProgress(0)
    const reader = new FileReader()
    reader.onprogress = (e) => {
      if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 90))
    }
    reader.onload = (e) => {
      setCsvText(e.target.result)
      setUploadProgress(100)
      setTimeout(() => { setUploading(false); setUploadProgress(0) }, 800)
    }
    reader.readAsText(file)
  }

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) readFile(file)
  }, [])

  const PROMPT = (csv, qs) => `You are a data analyst. Analyze this CSV data and return ONLY valid JSON (no markdown, no explanation).

CSV DATA:
${csv.slice(0, 8000)}

BUSINESS QUESTIONS:
${qs || 'Provide general insights'}

Return this exact JSON structure:
{
  "title": "Specific dashboard title based on the data",
  "metrics": [
    { "label": "Metric Name", "value": "123", "change": "+5.2%", "context": "vs last period" }
  ],
  "charts": [
    {
      "type": "bar|line|pie|doughnut",
      "title": "Specific chart title using actual column names",
      "subtitle": "optional subtitle",
      "xLabel": "Actual column name for X axis",
      "yLabel": "Actual column name for Y axis",
      "labels": ["label1", "label2"],
      "datasets": [{ "label": "Series name", "data": [1, 2, 3] }]
    }
  ],
  "insights": ["Specific insight 1", "Specific insight 2", "Specific insight 3"]
}

Rules:
- 3-5 metrics, 2-4 charts, exactly 3 insights
- All titles/labels must reference actual column names from the CSV
- Values must come from the actual data
- Return ONLY the JSON object`

  const generate = async () => {
    if (!csvText.trim()) return setError('Please provide CSV data.')
    setError('')
    setLoading(true)
    try {
      let res, attempts = 0
      while (attempts < 3) {
        res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_OPENROUTER_KEY}`,
          },
          body: JSON.stringify({
            model: 'meta-llama/llama-3.3-70b-instruct:free',
            messages: [{ role: 'user', content: PROMPT(csvText, questions) }],
          }),
        })
        if (res.status !== 429) break
        attempts++
        await new Promise(r => setTimeout(r, 2000 * attempts))
      }
      if (!res.ok) {
        const err = await res.json()
        if (res.status === 429) throw new Error('The free AI model is busy — please wait a moment and try again.')
        throw new Error(err.error?.message || `API error ${res.status}`)
      }
      const data = await res.json()
      const text = data.choices[0].message.content.trim()
      const json = JSON.parse(text.startsWith('{') ? text : text.slice(text.indexOf('{')))
      setDashboard(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-700 text-indigo-900 tracking-tight">DataBoard</h1>
          <p className="text-slate-500 mt-2">AI-powered analytics dashboard generator</p>
        </div>

        {/* Input Panel */}
        <div className="bg-white rounded-3xl shadow-sm border border-indigo-100 p-8 mb-8 space-y-6">
          {/* Drop Zone */}
          <div>
            <label className="block text-sm font-600 text-slate-700 mb-2">Upload CSV / TSV File</label>
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${dragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50'}`}
            >
              <p className="text-slate-400 text-sm">Drag & drop a CSV/TSV file here, or <span className="text-indigo-500 font-600">click to browse</span></p>
              <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={e => e.target.files[0] && readFile(e.target.files[0])} />
            </div>
            {uploading && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
            {!uploading && uploadProgress === 0 && csvText && (
              <p className="mt-2 text-xs text-emerald-500">✓ File loaded</p>
            )}
          </div>

          {/* Paste CSV */}
          <div>
            <label className="block text-sm font-600 text-slate-700 mb-2">Or Paste CSV Data</label>
            <textarea
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              rows={6}
              placeholder="Paste your CSV data here..."
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 resize-y"
            />
          </div>

          {/* Business Questions */}
          <div>
            <label className="block text-sm font-600 text-slate-700 mb-2">Business Questions</label>
            <textarea
              value={questions}
              onChange={e => setQuestions(e.target.value)}
              rows={3}
              placeholder="e.g. Which product category drives the most revenue? What are the monthly growth trends?"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 resize-y"
            />
          </div>

          {error && <p className="text-rose-500 text-sm bg-rose-50 rounded-xl px-4 py-3">{error}</p>}

          <button
            onClick={generate}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-600 py-4 rounded-2xl transition-colors text-sm tracking-wide"
          >
            {loading ? 'Generating Dashboard...' : 'Generate Dashboard'}
          </button>
        </div>

        {/* Dashboard Output */}
        {dashboard && (
          <div className="space-y-8">
            <h2 className="text-2xl font-700 text-indigo-900">{dashboard.title}</h2>

            {/* Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {dashboard.metrics?.map((card, i) => <MetricCard key={i} card={card} />)}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {dashboard.charts?.map((chart, i) => (
                <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-indigo-50">
                  <ChartRenderer chart={chart} />
                </div>
              ))}
            </div>

            {/* Insights */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-indigo-50">
              <h3 className="text-base font-700 text-indigo-900 mb-4">Key Insights</h3>
              <ul className="space-y-3">
                {dashboard.insights?.map((insight, i) => (
                  <li key={i} className="flex gap-3 text-sm text-slate-600">
                    <span className="text-indigo-400 font-700 shrink-0">→</span>
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
