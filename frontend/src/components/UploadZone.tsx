import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import axios from 'axios'
import type { UploadData } from '../App'

type Props = {
  onUploaded: (data: UploadData) => void
  apiBase: string
}

const MAX_SIZE = 50 * 1024 * 1024

export default function UploadZone({ onUploaded, apiBase }: Props) {
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  const upload = useCallback(
    async (file: File) => {
      setFileError(null)
      setUploading(true)
      setProgress(0)
      const form = new FormData()
      form.append('file', file)
      try {
        const res = await axios.post(`${apiBase}/upload`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => {
            if (e.total) setProgress(Math.round((e.loaded / e.total) * 100))
          },
        })
        onUploaded(res.data.data)
      } catch (e) {
        const msg = axios.isAxiosError(e)
          ? e.response?.data?.detail?.errors?.[0] ?? e.message
          : String(e)
        setFileError(msg)
      } finally {
        setUploading(false)
      }
    },
    [apiBase, onUploaded]
  )

  const onDrop = useCallback(
    (accepted: File[], rejected: { errors: { message: string }[] }[]) => {
      if (rejected.length > 0) {
        setFileError(rejected[0].errors[0].message)
        return
      }
      if (accepted.length > 0) upload(accepted[0])
    },
    [upload]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    maxSize: MAX_SIZE,
    multiple: false,
    disabled: uploading,
  })

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-xl">
        <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">Upload your dataset</h2>
        <p className="text-gray-500 text-center mb-8 text-sm">
          Supports CSV and Excel (.xlsx) files up to 50 MB
        </p>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-blue-500 bg-blue-50'
              : uploading
              ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
              : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50'
          }`}
        >
          <input {...getInputProps()} />
          <div className="text-5xl mb-4">{isDragActive ? '📂' : '📁'}</div>
          {uploading ? (
            <div className="space-y-3">
              <p className="text-gray-600 font-medium">Uploading...</p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500">{progress}%</p>
            </div>
          ) : isDragActive ? (
            <p className="text-blue-600 font-medium">Drop it here!</p>
          ) : (
            <>
              <p className="text-gray-700 font-medium mb-1">Drag & drop your file here</p>
              <p className="text-gray-400 text-sm">or click to browse</p>
            </>
          )}
        </div>

        {fileError && (
          <p className="mt-4 text-sm text-red-600 text-center">⚠️ {fileError}</p>
        )}

        <div className="mt-6 flex justify-center gap-6 text-xs text-gray-400">
          <span>✓ CSV files</span>
          <span>✓ Excel (.xlsx)</span>
          <span>✓ Up to 50 MB</span>
        </div>
      </div>
    </div>
  )
}
