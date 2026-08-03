import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { Page } from 'react-pdf'
import { useStore } from '../../store/useStore'
import { v4 as uuid } from 'uuid'
import AnnotationLayer from './AnnotationLayer'
import { screenToCss } from '../../utils/coordinates'
import { observeTextLayer, getCachedTextSpans } from '../../utils/text-positions'
import type { Bounds } from '../../types'
import type { TextSpan } from '../../utils/text-positions'

interface Props {
  pageNumber: number
}

interface DrawingState {
  startX: number
  startY: number
  currentX: number
  currentY: number
}

const HIGHLIGHT_COLOR = '#fef08a'
const COMMENT_BOX_SIZE = 24

export default function PDFPage({ pageNumber }: Props) {
  const zoom = useStore((s) => s.zoom)
  const currentTool = useStore((s) => s.currentTool)
  const addAnnotation = useStore((s) => s.addAnnotation)
  const updateAnnotation = useStore((s) => s.updateAnnotation)
  const deleteAnnotation = useStore((s) => s.deleteAnnotation)
  const setSelectedAnnotationId = useStore((s) => s.setSelectedAnnotationId)
  const setScrollToPage = useStore((s) => s.setScrollToPage)
  const annotations = useStore((s) => s.annotations)
  const selectedAnnotationId = useStore((s) => s.selectedAnnotationId)
  const hoveredAnnotationId = useStore((s) => s.hoveredAnnotationId)
  const debugMode = useStore((s) => s.debugMode)

  const wrapperRef = useRef<HTMLDivElement>(null)
  const [pageLoaded, setPageLoaded] = useState(false)
  const [pageW, setPageW] = useState(0)
  const [pageH, setPageH] = useState(0)
  const [drawing, setDrawing] = useState<DrawingState | null>(null)
  const brochureItems = useStore((s) => s.brochureItems)
  const [textSpans, setTextSpans] = useState<TextSpan[]>([])

  const pageAnnotations = annotations.filter((a) => a.page === pageNumber)
  const pdfItemsForPage = brochureItems?.find((p) => p.page === pageNumber) ?? null

  const sortedAll = useMemo(
    () =>
      [...annotations].sort((a, b) => a.page - b.page || a.createdAt.localeCompare(b.createdAt)),
    [annotations]
  )
  const indexMap = useMemo(
    () => new Map(sortedAll.map((a, i) => [a.id, i + 1])),
    [sortedAll]
  )

  const handlePageLoad = useCallback((page: { width: number; height: number }) => {
    setPageW(page.width)
    setPageH(page.height)
    setPageLoaded(true)
  }, [])

  useEffect(() => {
    if (!pageLoaded || !wrapperRef.current) return

    const cached = getCachedTextSpans(wrapperRef.current)
    if (cached.length > 0) {
      setTextSpans(cached)
      return
    }

    const cleanup = observeTextLayer(wrapperRef.current, (spans) => {
      setTextSpans(spans)
    })

    return cleanup
  }, [pageLoaded, zoom])

  /* ─── Text selection (highlight mode) ─── */
  useEffect(() => {
    if (currentTool !== 'highlight') return
    const handleMouseUp = (e: MouseEvent) => {
      const wrapper = wrapperRef.current
      if (!wrapper) return
      const wrapperRect = wrapper.getBoundingClientRect()
      if (
        e.clientX < wrapperRect.left ||
        e.clientX > wrapperRect.right ||
        e.clientY < wrapperRect.top ||
        e.clientY > wrapperRect.bottom
      )
        return

      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.toString().trim()) return

      const range = sel.getRangeAt(0)
      let rect: DOMRect | null = null
      try {
        rect = range.getBoundingClientRect()
      } catch {
        return
      }
      if (!rect || rect.width === 0 || rect.height === 0) return

      const screenBounds: Bounds = {
        x: rect.left - wrapperRect.left,
        y: rect.top - wrapperRect.top,
        width: rect.width,
        height: rect.height,
      }

      const cssBounds = screenToCss(screenBounds, zoom)

      const now = new Date().toISOString()
      const selectedText = sel.toString().trim()

      addAnnotation({
        id: uuid(),
        page: pageNumber,
        type: 'highlight',
        text: selectedText,
        bounds: cssBounds,
        color: HIGHLIGHT_COLOR,
        createdAt: now,
        updatedAt: now,
      })

      sel.removeAllRanges()
    }

    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [currentTool, zoom, pageNumber, addAnnotation])

  /* ─── Mouse drawing (rectangle / validation / comment) ─── */
  const isActive =
    currentTool === 'rectangle' ||
    currentTool === 'validation' ||
    currentTool === 'comment'

  const getRelPos = useCallback(
    (clientX: number, clientY: number) => {
      const rect = wrapperRef.current?.getBoundingClientRect()
      if (!rect) return { x: 0, y: 0 }
      const screenBounds: Bounds = {
        x: clientX - rect.left,
        y: clientY - rect.top,
        width: 0,
        height: 0,
      }
      const cssBounds = screenToCss(screenBounds, zoom)
      return { x: cssBounds.x, y: cssBounds.y }
    },
    [zoom]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isActive) return
      if (e.button !== 0) return
      if (currentTool === 'comment') {
        const pos = getRelPos(e.clientX, e.clientY)
        const now = new Date().toISOString()
        addAnnotation({
          id: uuid(),
          page: pageNumber,
          type: 'rectangle',
          text: 'Comment',
          bounds: {
            x: pos.x - COMMENT_BOX_SIZE / 2,
            y: pos.y - COMMENT_BOX_SIZE / 2,
            width: COMMENT_BOX_SIZE,
            height: COMMENT_BOX_SIZE,
          },
          color: '#93c5fd',
          comment: '',
          createdAt: now,
          updatedAt: now,
        })
        return
      }
      const pos = getRelPos(e.clientX, e.clientY)
      setDrawing({ startX: pos.x, startY: pos.y, currentX: pos.x, currentY: pos.y })
    },
    [isActive, currentTool, getRelPos, addAnnotation, pageNumber]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!drawing) return
      const pos = getRelPos(e.clientX, e.clientY)
      setDrawing((d) => (d ? { ...d, currentX: pos.x, currentY: pos.y } : null))
    },
    [drawing, getRelPos]
  )

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!drawing) return
      const minSize = 5
      const x = Math.min(drawing.startX, drawing.currentX)
      const y = Math.min(drawing.startY, drawing.currentY)
      const w = Math.abs(drawing.currentX - drawing.startX)
      const h = Math.abs(drawing.currentY - drawing.startY)

      if (w > minSize || h > minSize) {
        const now = new Date().toISOString()
        const type = currentTool === 'validation' ? 'validation' : 'rectangle'
        addAnnotation({
          id: uuid(),
          page: pageNumber,
          type,
          text: type === 'validation' ? 'Validation point' : '',
          bounds: { x, y, width: w, height: h },
          color: type === 'validation' ? '#fca5a5' : '#93c5fd',
          severity: type === 'validation' ? 'error' : undefined,
          category: type === 'validation' ? 'custom' : undefined,
          comment: '',
          createdAt: now,
          updatedAt: now,
        })
      }
      setDrawing(null)
    },
    [drawing, currentTool, addAnnotation, pageNumber]
  )

  const isDrawing = drawing !== null

  const overlayPointerEvents = isActive ? 'auto' : 'none'

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (currentTool === 'erase') {
        const target = (e.target as HTMLElement).closest('[data-ann-id]')
        if (target) {
          const id = target.getAttribute('data-ann-id')
          if (id) deleteAnnotation(id)
        }
      }
    },
    [currentTool, deleteAnnotation]
  )

  return (
    <div
      ref={wrapperRef}
      data-page-number={pageNumber}
      className="relative mx-auto"
      style={{
        width: pageLoaded ? pageW * zoom : '100%',
        minHeight: pageLoaded ? pageH * zoom : 500,
      }}
    >
      <Page
        pageNumber={pageNumber}
        scale={zoom}
        renderTextLayer={true}
        renderAnnotationLayer={false}
        onLoadSuccess={handlePageLoad}
      />

      {pageLoaded && (
        <div
          className="absolute inset-0 select-none"
          style={{ pointerEvents: overlayPointerEvents }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={handleOverlayClick}
        >
          <AnnotationLayer
            annotations={pageAnnotations}
            zoom={zoom}
            pageWidth={pageW}
            pageHeight={pageH}
            selectedId={selectedAnnotationId}
            hoveredId={hoveredAnnotationId}
            indexMap={indexMap}
            textSpans={textSpans}
            pageNumber={pageNumber}
            pdfItems={pdfItemsForPage}
            onSelect={(id) => setSelectedAnnotationId(id)}
            onDelete={(id) => deleteAnnotation(id)}
            onUpdate={(id, partial) => updateAnnotation(id, partial)}
            debugMode={debugMode}
          />

          {isDrawing && (
            <div
              className="absolute border-2 border-dashed border-brand-500 bg-brand-100/20 pointer-events-none"
              style={{
                left: Math.min(drawing.startX, drawing.currentX) * zoom,
                top: Math.min(drawing.startY, drawing.currentY) * zoom,
                width: Math.abs(drawing.currentX - drawing.startX) * zoom,
                height: Math.abs(drawing.currentY - drawing.startY) * zoom,
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}