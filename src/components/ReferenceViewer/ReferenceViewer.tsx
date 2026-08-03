import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { pdfjs, Document, Page } from 'react-pdf'
import { useStore } from '../../store/useStore'
import { loadPdfBinary, PDF_KEYS } from '../../utils/idb'
import ReferenceAnnotationLayer from './ReferenceAnnotationLayer'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

const FLASH_DURATION_MS = 1900

export default function ReferenceViewer() {
  const referencePdfMeta = useStore((s) => s.referencePdfMeta)
  const zoom = useStore((s) => s.zoom)
  const setZoom = useStore((s) => s.setZoom)
  const annotations = useStore((s) => s.annotations)
  const scrollToReferencePage = useStore((s) => s.scrollToReferencePage)
  const setScrollToReferencePage = useStore((s) => s.setScrollToReferencePage)
  const flashRefAnnotationId = useStore((s) => s.flashRefAnnotationId)
  const setFlashRefAnnotationId = useStore((s) => s.setFlashRefAnnotationId)
  const setActiveView = useStore((s) => s.setActiveView)

  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const [pdfData, setPdfData] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [numPages, setNumPages] = useState(0)
  const [pageDims, setPageDims] = useState<{ width: number; height: number }>({
    width: 595,
    height: 842,
  })

  // Load reference PDF from IndexedDB when metadata changes
  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const data = await loadPdfBinary(PDF_KEYS.reference)
      setPdfData(data)
      setLoading(false)
    })()
  }, [referencePdfMeta])

  // Scroll to the target page after a "View in Reference" jump
  useEffect(() => {
    if (scrollToReferencePage && pageRefs.current.has(scrollToReferencePage)) {
      const el = pageRefs.current.get(scrollToReferencePage)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setScrollToReferencePage(null)
      }
    }
  }, [scrollToReferencePage, setScrollToReferencePage])

  // Clear the flash marker after the animation finishes
  useEffect(() => {
    if (!flashRefAnnotationId) return
    const t = setTimeout(() => {
      setFlashRefAnnotationId(null)
    }, FLASH_DURATION_MS)
    return () => clearTimeout(t)
  }, [flashRefAnnotationId, setFlashRefAnnotationId])

  // Fit width/page handlers (registered while reference view is active)
  const fitWidth = useCallback(() => {
    if (!containerRef.current || !referencePdfMeta) return
    const containerW = containerRef.current.clientWidth - 48
    const fit = containerW / pageDims.width
    setZoom(Math.round(fit * 100) / 100)
  }, [setZoom, referencePdfMeta, pageDims])

  const fitPage = useCallback(() => {
    if (!containerRef.current || !referencePdfMeta) return
    const containerW = containerRef.current.clientWidth - 48
    const containerH = 900
    const fit = Math.min(containerW / pageDims.width, containerH / pageDims.height)
    setZoom(Math.round(Math.min(fit, 1) * 100) / 100)
  }, [setZoom, referencePdfMeta, pageDims])

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

  // Claim numbering — identical to the brochure viewer so claim #N maps to
  // reference highlight #N
  const indexMap = useMemo(() => {
    const sorted = [...annotations].sort(
      (a, b) => a.page - b.page || a.createdAt.localeCompare(b.createdAt)
    )
    return new Map(sorted.map((a, i) => [a.id, i + 1]))
  }, [annotations])

  if (!referencePdfMeta) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center max-w-sm">
          <p className="text-sm font-medium text-amber-800">No reference paper uploaded</p>
          <p className="mt-1 text-xs text-amber-700">
            Upload a research paper via the 📚 Reference button, then run validation to see
            evidence highlights here.
          </p>
          <button
            className="btn-primary mt-3 text-xs"
            onClick={() => setActiveView('brochure')}
          >
            Back to Brochure
          </button>
        </div>
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
          <span className="text-sm">Loading reference PDF...</span>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex flex-1 flex-col overflow-auto scroll-thin bg-gray-50">
      {pdfData && (
        <Document
          file={pdfData}
          onLoadSuccess={(pdf: any) => setNumPages(pdf.numPages)}
          className="flex flex-col items-center gap-4 py-6"
        >
          {Array.from({ length: numPages }, (_, i) => {
            const pageNumber = i + 1
            const refAnns = annotations.filter(
              (a) =>
                a.referencePage === pageNumber &&
                a.referenceLocationStatus === 'found' &&
                a.referenceBounds
            )
            return (
              <div
                key={`ref-page-${pageNumber}`}
                ref={getPageRef(pageNumber)}
                className="shadow-card rounded-lg overflow-hidden bg-white"
              >
                <div
                  className="relative mx-auto"
                  style={{
                    width: pageDims.width * zoom,
                    minHeight: pageDims.height * zoom,
                  }}
                >
                  <Page
                    pageNumber={pageNumber}
                    scale={zoom}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    onLoadSuccess={({ width, height }: { width: number; height: number }) => {
                      if (pageNumber === 1) setPageDims({ width, height })
                    }}
                  />
                  {refAnns.length > 0 && (
                    <ReferenceAnnotationLayer
                      annotations={refAnns}
                      zoom={zoom}
                      indexMap={indexMap}
                      flashId={flashRefAnnotationId}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </Document>
      )}
    </div>
  )
}
