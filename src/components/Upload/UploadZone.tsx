import { useCallback, useRef, useState } from 'react'
import { useStore } from '../../store/useStore'
import { readFileAsDataURL } from '../../utils/pdf'
import { savePdfBinary } from '../../utils/idb'

export default function UploadZone() {
  const setPdfMeta = useStore((s) => s.setPdfMeta)
  const setLoading = useStore((s) => s.setLoading)
  const setError = useStore((s) => s.setError)
  const clearAll = useStore((s) => s.clearAll)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (file: File) => {
      if (file.type !== 'application/pdf') {
        setError('Please upload a PDF file')
        return
      }
      setLoading(true)
      setError(null)
      try {
        const dataUrl = await readFileAsDataURL(file)
        await savePdfBinary(dataUrl)
        clearAll()
        setPdfMeta({ name: file.name, totalSize: file.size })
      } catch {
        setError('Failed to load PDF')
      } finally {
        setLoading(false)
      }
    },
    [setPdfMeta, setLoading, setError, clearAll]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  const onDragLeave = useCallback(() => setDragging(false), [])

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-150 ${
        dragging
          ? 'border-brand-400 bg-brand-50'
          : 'border-gray-300 bg-white hover:border-gray-400'
      }`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <div className="mb-4 rounded-full bg-brand-100 p-3 text-brand-600">
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
      </div>
      <h3 className="mb-1 text-lg font-semibold text-gray-700">
        Upload a PDF document
      </h3>
      <p className="mb-6 text-sm text-gray-500">
        Drag and drop your file here, or click to browse
      </p>
      <button
        className="btn-primary"
        onClick={() => inputRef.current?.click()}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Browse Files
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
