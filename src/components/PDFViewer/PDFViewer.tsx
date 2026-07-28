import { useRef, useEffect, useState, useCallback } from 'react'
import { pdfjs, Document } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import { useStore } from '../../store/useStore'
import { loadPdfBinary } from '../../utils/idb'
import PDFPage from './PDFPage'
import UploadZone from '../Upload/UploadZone'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

export default function PDFViewer() {
  const pdfMeta = useStore((s) => s.pdfMeta)
  const numPages = useStore((s) => s.numPages)
  const setNumPages = useStore((s) => s.setNumPages)
  const setPageDimensions = useStore((s) => s.setPageDimensions)
  const loading = useStore((s) => s.loading)
  const error = useStore((s) => s.error)
  const setLoading = useStore((s) => s.setLoading)
  const setError = useStore((s) => s.setError)
  const scrollToPage = useStore((s) => s.scrollToPage)
  const setScrollToPage = useStore((s) => s.setScrollToPage)
  const zoom = useStore((s) => s.zoom)
  const setZoom = useStore((s) => s.setZoom)

  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const [pdfData, setPdfData] = useState<string | null>(null)

  // Load PDF from IndexedDB on mount or when pdfMeta changes
  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const data = await loadPdfBinary()
      if (data) {
        setPdfData(data)
      }
      setLoading(false)
    })()
  }, [pdfMeta])

  // Handle document load
  const handleDocLoad = useCallback(
    async (pdf: any) => {
      setNumPages(pdf.numPages)
      setError(null)
      try {
        const page = await pdf.getPage(1)
        const viewport = page.getViewport({ scale: 1 })
        useStore.getState().setPageDimensions(viewport.width, viewport.height)
      } catch {
        // fallback to defaults
      }
    },
    [setNumPages, setError]
  )

  // Scroll to annotation page
  useEffect(() => {
    if (scrollToPage && pageRefs.current.has(scrollToPage)) {
      const el = pageRefs.current.get(scrollToPage)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setScrollToPage(null)
      }
    }
  }, [scrollToPage, setScrollToPage])

  // Fit width handler
  const fitWidth = useCallback(() => {
    if (!containerRef.current || !pdfMeta) return
    const containerW = containerRef.current.clientWidth - 48
    const naturalW = useStore.getState().pageWidth || 794
    const fit = containerW / naturalW
    setZoom(Math.round(fit * 100) / 100)
  }, [setZoom, pdfMeta])

  // Fit page handler
  const fitPage = useCallback(() => {
    if (!containerRef.current || !pdfMeta) return
    const containerW = containerRef.current.clientWidth - 48
    const containerH = 900
    const pW = useStore.getState().pageWidth || 794
    const pH = useStore.getState().pageHeight || 1123
    const fit = Math.min(containerW / pW, containerH / pH)
    setZoom(Math.round(Math.min(fit, 1) * 100) / 100)
  }, [setZoom, pdfMeta])

  // Expose fit functions on the store for Toolbar access
  useEffect(() => {
    useStore.getState().setFitWidthFn(fitWidth)
    useStore.getState().setFitPageFn(fitPage)
    return () => {
      useStore.getState().setFitWidthFn(null)
      useStore.getState().setFitPageFn(null)
    }
  }, [fitWidth, fitPage])

  const getPageRef = useCallback((pageNum: number) => {
    return (el: HTMLDivElement | null) => {
      if (el) pageRefs.current.set(pageNum, el)
      else pageRefs.current.delete(pageNum)
    }
  }, [])

  if (!pdfMeta) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <UploadZone />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <svg className="h-8 w-8 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span className="text-sm">Loading PDF...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <button className="btn-primary mt-3" onClick={() => useStore.getState().clearAll()}>
            Upload a different PDF
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex flex-1 flex-col overflow-auto scroll-thin bg-gray-50">
      {pdfData && (
        <Document
          file={pdfData}
          onLoadSuccess={handleDocLoad}
          onLoadError={(err) => setError('Failed to load PDF: ' + err.message)}
          className="flex flex-col items-center gap-4 py-6"
        >
          {Array.from({ length: numPages }, (_, i) => (
            <div
              key={`page-${i + 1}`}
              ref={getPageRef(i + 1)}
              className="shadow-card rounded-lg overflow-hidden bg-white"
            >
              <PDFPage
                pageNumber={i + 1}
              />
            </div>
          ))}
        </Document>
      )}
    </div>
  )
}
