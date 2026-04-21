import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import type { FileRejection } from 'react-dropzone'
import axios from 'axios'
import type { UploadData } from '../App'

type Props = { onUploaded: (data: UploadData) => void; apiBase: string }

const MAX_SIZE = 50 * 1024 * 1024

export default function UploadZone({ onUploaded, apiBase }: Props) {
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  const upload = useCallback(async (file: File) => {
    setFileError(null)
    setUploading(true)
    setProgress(0)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await axios.post(`${apiBase}/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => { if (e.total) setProgress(Math.round((e.loaded / e.total) * 100)) },
      })
      onUploaded(res.data.data)
    } catch (e) {
      setFileError(axios.isAxiosError(e) ? e.response?.data?.detail?.errors?.[0] ?? e.message : String(e))
    } finally {
      setUploading(false)
    }
  }, [apiBase, onUploaded])

  const onDrop = useCallback((accepted: File[], rejected: FileRejection[]) => {
    if (rejected.length > 0) { setFileError(rejected[0].errors[0].message); return }
    if (accepted.length > 0) upload(accepted[0])
  }, [upload])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    maxSize: MAX_SIZE,
    multiple: false,
    disabled: uploading,
  })

  return (
    <div className="flex flex-col items-center justify-center min-h-[62vh]">
      <div className="w-full max-w-lg text-center">
        <h2 style={{ fontFamily: 'Playfair Display, serif', color: '#2c2c2c', fontSize: '2rem', fontWeight: 500 }} className="mb-2">
          Upload your dataset
        </h2>
        <p style={{ color: '#9c8f80', fontSize: '0.875rem', fontWeight: 300 }} className="mb-10">
          CSV and Excel files up to 50 MB
        </p>

        <div
          {...getRootProps()}
          style={{
            border: `2px dashed ${isDragActive ? '#9c8f80' : '#c8b89a'}`,
            borderRadius: '16px',
            padding: '3.5rem 2rem',
            backgroundColor: isDragActive ? '#ede8e0' : uploading ? '#f5f1ec' : '#faf8f5',
            cursor: uploading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <input {...getInputProps()} />

          {uploading ? (
            <div className="space-y-4">
              <div style={{ fontSize: '2rem' }}>⏳</div>
              <p style={{ color: '#7a6f62', fontWeight: 400, fontSize: '0.9rem' }}>Uploading...</p>
              <div style={{ backgroundColor: '#e0d9cf', borderRadius: '999px', height: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', backgroundColor: '#9c8f80', transition: 'width 0.3s ease', borderRadius: '999px' }} />
              </div>
              <p style={{ color: '#b0a090', fontSize: '0.8rem' }}>{progress}%</p>
            </div>
          ) : isDragActive ? (
            <div>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>↓</div>
              <p style={{ color: '#7a6f62', fontWeight: 500, fontSize: '0.95rem' }}>Release to upload</p>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: 0.5 }}>⬆</div>
              <p style={{ color: '#5a5048', fontWeight: 500, fontSize: '0.95rem', marginBottom: '0.35rem' }}>
                Drag & drop your file here
              </p>
              <p style={{ color: '#b0a090', fontSize: '0.82rem' }}>or click to browse</p>
            </div>
          )}
        </div>

        {fileError && (
          <p style={{ color: '#8b3a2f', fontSize: '0.82rem', marginTop: '1rem' }}>{fileError}</p>
        )}

        <div style={{ color: '#c8b89a', fontSize: '0.75rem', letterSpacing: '0.06em' }} className="mt-8 flex justify-center gap-8 uppercase">
          <span>CSV</span>
          <span>Excel .xlsx</span>
          <span>Up to 50 MB</span>
        </div>
      </div>
    </div>
  )
}
