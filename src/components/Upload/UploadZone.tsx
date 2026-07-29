import { useCallback, useRef, useState } from 'react'
import { useStore } from '../../store/useStore'
import { readFileAsDataURL } from '../../utils/pdf'
import { savePdfBinary, PDF_KEYS } from '../../utils/idb'

export default function UploadZone() {
  const setPdfMeta = useStore((s) => s.setPdfMeta)
  const setReferencePdfMeta = useStore((s) => s.setReferencePdfMeta)
  const setLoading = useStore((s) => s.setLoading)
  const setError = useStore((s) => s.setError)
  const clearAll = useStore((s) => s.clearAll)
  const [dragging, setDragging] = useState<'brochure' | 'reference' | null>(null)
  const brochureInputRef = useRef<HTMLInputElement>(null)
  const referenceInputRef = useRef<HTMLInputElement>(null)

  const handleBrochureFile = useCallback(
    async (file: File) => {
      if (file.type !== 'application/pdf') {
        setError('Please upload a PDF file for the brochure')
        return
      }
      setLoading(true)
      setError(null)
      try {
        const dataUrl = await readFileAsDataURL(file)
        await savePdfBinary(dataUrl, PDF_KEYS.brochure)
        clearAll()
        setPdfMeta({ name: file.name, totalSize: file.size })
      } catch {
        setError('Failed to load brochure PDF')
      } finally {
        setLoading(false)
      }
    },
    [setPdfMeta, setLoading, setError, clearAll]
  )

  const handleReferenceFile = useCallback(
    async (file: File) => {
      if (file.type !== 'application/pdf') {
        setError('Please upload a PDF file for the reference paper')
        return
      }
      setError(null)
      try {
        const dataUrl = await readFileAsDataURL(file)
        await savePdfBinary(dataUrl, PDF_KEYS.reference)
        setReferencePdfMeta({ name: file.name, totalSize: file.size })
      } catch {
        setError('Failed to load reference PDF')
      }
    },
    [setReferencePdfMeta, setError]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(null)
      const file = e.dataTransfer.files[0]
      if (!file) return
      const target = (e.currentTarget as HTMLElement).dataset.zone
      if (target === 'reference') {
        handleReferenceFile(file)
      } else {
        handleBrochureFile(file)
      }
    },
    [handleBrochureFile, handleReferenceFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const target = (e.currentTarget as HTMLElement).dataset.zone
    setDragging(target === 'reference' ? 'reference' : 'brochure')
  }, [])

  const handleDragLeave = useCallback(() => setDragging(null), [])

  const dropZoneClass = (zone: 'brochure' | 'reference') =>
    `flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all duration-150 ${
      dragging === zone
        ? 'border-brand-400 bg-brand-50'
        : 'border-gray-200 bg-white hover:border-gray-300'
    }`

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      {/* Brand */}
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-2xl text-white shadow-lg">
          ✓
        </div>
        <h1 className="text-xl font-bold text-gray-800">VeriClaim</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload a brochure and a research paper to verify claims
        </p>
      </div>

      {/* Brochure upload */}
      <div
        className={dropZoneClass('brochure')}
        data-zone="brochure"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="mb-3 rounded-full bg-brand-100 p-2.5 text-brand-600">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <h3 className="mb-1 text-sm font-semibold text-gray-700">Upload Brochure PDF</h3>
        <p className="mb-4 text-xs text-gray-500">
          The document containing claims to verify
        </p>
        <button
          className="btn-primary text-xs"
          onClick={() => brochureInputRef.current?.click()}
        >
          Browse Brochure
        </button>
        <input
          ref={brochureInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleBrochureFile(file)
            e.target.value = ''
          }}
        />
      </div>

      {/* Separator */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">AND</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      {/* Reference upload */}
      <div
        className={dropZoneClass('reference')}
        data-zone="reference"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="mb-3 rounded-full bg-amber-100 p-2.5 text-amber-600">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
        </div>
        <h3 className="mb-1 text-sm font-semibold text-gray-700">Upload Research Paper (Reference)</h3>
        <p className="mb-4 text-xs text-gray-500">
          The reference document to verify claims against
        </p>
        <button
          className="btn-ghost text-xs"
          onClick={() => referenceInputRef.current?.click()}
        >
          Browse Reference
        </button>
        <input
          ref={referenceInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleReferenceFile(file)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
