import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import type { FileRejection } from 'react-dropzone'
import axios from 'axios'
import type { UploadData } from '../App'

type Props = { onFilesUploaded: (data: UploadData[]) => void; apiBase: string }

const MAX_SIZE = 50 * 1024 * 1024

type FileEntry = { file: File; progress: number; status: 'pending' | 'uploading' | 'done' | 'error'; error?: string }

export default function MultiUploadZone({ onFilesUploaded, apiBase }: Props) {
  const [dataFiles, setDataFiles] = useState<FileEntry[]>([])
  const [descFile, setDescFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dropError, setDropError] = useState<string | null>(null)

  const onDrop = useCallback((accepted: File[], rejected: FileRejection[]) => {
    if (rejected.length > 0) { setDropError(rejected[0].errors[0].message); return }
    setDropError(null)
    const txtFiles = accepted.filter(f => f.name.endsWith('.txt'))
    const dataFilesNew = accepted.filter(f => !f.name.endsWith('.txt'))
    if (txtFiles.length > 0) setDescFile(txtFiles[txtFiles.length - 1])
    if (dataFilesNew.length > 0) {
      setDataFiles(prev => [
        ...prev,
        ...dataFilesNew.map(f => ({ file: f, progress: 0, status: 'pending' as const }))
      ])
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/plain': ['.txt'],
    },
    maxSize: MAX_SIZE,
    multiple: true,
    disabled: uploading,
  })

  const removeFile = (i: number) => setDataFiles(prev => prev.filter((_, idx) => idx !== i))

  const uploadAll = async () => {
    if (dataFiles.length === 0) return
    setUploading(true)
    const results: UploadData[] = []

    for (let i = 0; i < dataFiles.length; i++) {
      setDataFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'uploading' } : f))
      const form = new FormData()
      form.append('file', dataFiles[i].file)
      if (descFile) form.append('description', descFile)
      try {
        const res = await axios.post(`${apiBase}/upload`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: e => {
            if (e.total) {
              const pct = Math.round((e.loaded / e.total) * 100)
              setDataFiles(prev => prev.map((f, idx) => idx === i ? { ...f, progress: pct } : f))
            }
          },
        })
        results.push(res.data.data)
        setDataFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'done', progress: 100 } : f))
      } catch (e) {
        const msg = axios.isAxiosError(e) ? e.response?.data?.detail?.errors?.[0] ?? e.message : String(e)
        setDataFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'error', error: msg } : f))
      }
    }

    setUploading(false)
    if (results.length > 0) onFilesUploaded(results)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[62vh]">
      <div className="w-full max-w-2xl">
        <h2 style={{ fontFamily: 'Playfair Display, serif', color: '#2c2c2c', fontSize: '2rem', fontWeight: 500, textAlign: 'center' }} className="mb-2">
          Upload your datasets
        </h2>
        <p style={{ color: '#9c8f80', fontSize: '0.875rem', fontWeight: 300, textAlign: 'center' }} className="mb-8">
          CSV and Excel files up to 50 MB · Optionally include a .txt description file
        </p>

        {/* Drop zone */}
        <div {...getRootProps()} style={{
          border: `2px dashed ${isDragActive ? '#9c8f80' : '#c8b89a'}`,
          borderRadius: '16px', padding: '2.5rem 2rem', textAlign: 'center',
          backgroundColor: isDragActive ? '#ede8e0' : '#faf8f5',
          cursor: uploading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
        }}>
          <input {...getInputProps()} />
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem', opacity: 0.5 }}>⬆</div>
          <p style={{ color: '#5a5048', fontWeight: 500, fontSize: '0.95rem', marginBottom: '0.3rem' }}>
            {isDragActive ? 'Release to add files' : 'Drag & drop files here'}
          </p>
          <p style={{ color: '#b0a090', fontSize: '0.82rem' }}>or click to browse · CSV, XLSX, TXT</p>
        </div>

        {dropError && <p style={{ color: '#8b3a2f', fontSize: '0.82rem', marginTop: '0.75rem', textAlign: 'center' }}>{dropError}</p>}

        {/* File list */}
        {(dataFiles.length > 0 || descFile) && (
          <div style={{ marginTop: '1.25rem', backgroundColor: '#faf8f5', border: '1px solid #e0d9cf', borderRadius: '12px', overflow: 'hidden' }}>
            {descFile && (
              <div style={{ padding: '0.65rem 1rem', borderBottom: '1px solid #f0ebe3', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', backgroundColor: '#ede8e0', padding: '0.15rem 0.5rem', borderRadius: '4px', color: '#7a6f62' }}>TXT</span>
                <span style={{ fontSize: '0.82rem', color: '#5a5048', flex: 1 }}>{descFile.name}</span>
                <button onClick={() => setDescFile(null)} style={{ color: '#b0a090', fontSize: '0.75rem', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
              </div>
            )}
            {dataFiles.map((entry, i) => (
              <div key={i} style={{ padding: '0.65rem 1rem', borderBottom: i < dataFiles.length - 1 ? '1px solid #f0ebe3' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', backgroundColor: '#ede8e0', padding: '0.15rem 0.5rem', borderRadius: '4px', color: '#7a6f62' }}>
                    {entry.file.name.endsWith('.xlsx') ? 'XLSX' : 'CSV'}
                  </span>
                  <span style={{ fontSize: '0.82rem', color: '#5a5048', flex: 1 }}>{entry.file.name}</span>
                  <span style={{ fontSize: '0.75rem', color: entry.status === 'error' ? '#8b3a2f' : entry.status === 'done' ? '#3a7a4a' : '#9c8f80' }}>
                    {entry.status === 'done' ? '✓ Done' : entry.status === 'error' ? `⚠ ${entry.error}` : entry.status === 'uploading' ? `${entry.progress}%` : ''}
                  </span>
                  {entry.status === 'pending' && (
                    <button onClick={() => removeFile(i)} style={{ color: '#b0a090', fontSize: '0.75rem', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                  )}
                </div>
                {entry.status === 'uploading' && (
                  <div style={{ marginTop: '0.4rem', backgroundColor: '#e0d9cf', borderRadius: '999px', height: '3px' }}>
                    <div style={{ width: `${entry.progress}%`, height: '100%', backgroundColor: '#9c8f80', borderRadius: '999px', transition: 'width 0.3s' }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {dataFiles.length > 0 && (
          <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={uploadAll}
              disabled={uploading}
              style={{
                backgroundColor: uploading ? '#b0a090' : '#2c2c2c', color: '#f7f4ef',
                padding: '0.7rem 1.75rem', borderRadius: '8px', fontSize: '0.875rem',
                fontWeight: 500, border: 'none', cursor: uploading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}
            >
              {uploading && <div style={{ width: '14px', height: '14px', border: '2px solid #f7f4ef', borderTopColor: 'transparent', borderRadius: '50%' }} className="animate-spin" />}
              Upload {dataFiles.length} file{dataFiles.length !== 1 ? 's' : ''} →
            </button>
          </div>
        )}

        <div style={{ color: '#c8b89a', fontSize: '0.75rem', letterSpacing: '0.06em', marginTop: '1.5rem', display: 'flex', justifyContent: 'center', gap: '2rem' }} className="uppercase">
          <span>Multiple files</span>
          <span>CSV · XLSX</span>
          <span>Up to 50 MB each</span>
        </div>
      </div>
    </div>
  )
}
