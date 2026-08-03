import { useState, useCallback, useRef } from 'react'
import type { Annotation, Bounds, Severity } from '../../types'
import { SEVERITY_BORDERS, SEVERITY_ICONS, CATEGORY_ICONS, CATEGORY_LABELS } from '../../utils/constants'
import { cssToScreen } from '../../utils/coordinates'
import type { TextSpan } from '../../utils/text-positions'
import type { PageWithItems } from '../../utils/ai'
import ValidationTooltip from '../ValidationTooltip/ValidationTooltip'
import ClaimTooltip from '../ValidationTooltip/ClaimTooltip'

interface Props {
  annotations: Annotation[]
  zoom: number
  pageWidth: number
  pageHeight: number
  selectedId: string | null
  hoveredId: string | null
  indexMap: Map<string, number>
  textSpans: TextSpan[]
  pageNumber: number
  pdfItems: PageWithItems | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onUpdate: (id: string, partial: Partial<Annotation>) => void
  debugMode?: boolean
}

const HANDLE_SIZE = 8

function getAccentColor(ann: Annotation): string {
  if (ann.type === 'validation' && ann.severity) {
    return SEVERITY_BORDERS[ann.severity]
  }
  if (ann.type === 'rectangle') return ann.color
  return '#3b82f6'
}

function getFillColor(ann: Annotation): string {
  if (ann.type === 'highlight') return ann.color + '66'
  if (ann.type === 'validation') return ann.color + '18'
  return 'transparent'
}

export default function AnnotationLayer({
  annotations,
  zoom,
  selectedId,
  hoveredId,
  indexMap,
  pageNumber,
  pdfItems,
  onSelect,
  onDelete,
  onUpdate,
  debugMode = false,
}: Props) {
  const [dragging, setDragging] = useState<{
    id: string
    startX: number
    startY: number
    origBounds: Bounds
    handle?: string
  } | null>(null)

  const layerRef = useRef<HTMLDivElement>(null)
  const hoveredRef = useRef<string | null>(null)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, ann: Annotation) => {
      if (e.button !== 0) return
      onSelect(ann.id)
      const target = e.target as HTMLElement
      const handle = target.getAttribute('data-handle') || undefined
      const rect = layerRef.current?.getBoundingClientRect()
      if (!rect) return
      setDragging({
        id: ann.id,
        startX: (e.clientX - rect.left) / zoom,
        startY: (e.clientY - rect.top) / zoom,
        origBounds: { ...ann.bounds },
        handle,
      })
    },
    [onSelect, zoom]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging || !layerRef.current) return
      const rect = layerRef.current.getBoundingClientRect()
      const mx = (e.clientX - rect.left) / zoom
      const my = (e.clientY - rect.top) / zoom
      const dx = mx - dragging.startX
      const dy = my - dragging.startY

      let newBounds: Bounds
      if (dragging.handle) {
        const h = dragging.handle
        const b = dragging.origBounds
        let { x, y, width, height } = b
        if (h === 'nw') { x += dx; y += dy; width -= dx; height -= dy }
        else if (h === 'ne') { y += dy; width += dx; height -= dy }
        else if (h === 'sw') { x += dx; width -= dx; height += dy }
        else if (h === 'se') { width += dx; height += dy }
        else { x += dx; y += dy }
        if (width < 10) width = 10
        if (height < 10) height = 10
        newBounds = { x, y, width, height }
      } else {
        newBounds = {
          x: dragging.origBounds.x + dx,
          y: dragging.origBounds.y + dy,
          width: dragging.origBounds.width,
          height: dragging.origBounds.height,
        }
      }
      onUpdate(dragging.id, { bounds: newBounds })
    },
    [dragging, onUpdate, zoom]
  )

  const handleMouseUp = useCallback(() => {
    setDragging(null)
  }, [])

  const handleMouseEnter = useCallback((id: string) => {
    hoveredRef.current = id
  }, [])

  const handleMouseLeave = useCallback(() => {
    hoveredRef.current = null
  }, [])

  const isSelected = (id: string) => id === selectedId
  const isHovered = (id: string) => id === hoveredRef.current || id === hoveredId

  const getSeverityLabel = (s: Severity) => s.charAt(0).toUpperCase() + s.slice(1)

  const debugOverlay = (ann: Annotation) => {
    if (!debugMode) return null
    return (
      <div
        className="absolute z-40 pointer-events-none"
        style={{ top: 0, left: 0, fontSize: 8, lineHeight: '10px' }}
      >
        <div className="bg-black/70 text-white px-1 py-0.5 rounded" style={{ whiteSpace: 'nowrap' }}>
          loc:{ann.locationStatus || 'found'} type:{ann.type}
        </div>
        {ann.bounds && (
          <div className="bg-black/70 text-white px-1 py-0.5 rounded mt-0.5">
            b:({Math.round(ann.bounds.x)},{Math.round(ann.bounds.y)}) {Math.round(ann.bounds.width)}x{Math.round(ann.bounds.height)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      ref={layerRef}
      className="absolute inset-0 overflow-visible"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ pointerEvents: 'none' }}
    >
      {annotations.map((ann) => {
        const screenBounds = cssToScreen(ann.bounds, zoom)
        const sx = screenBounds.x
        const sy = screenBounds.y
        const sw = screenBounds.width
        const sh = screenBounds.height
        const sel = isSelected(ann.id)
        const hov = isHovered(ann.id)
        const accent = getAccentColor(ann)
        const isDragging = dragging?.id === ann.id
        const isNotFound = ann.locationStatus === 'not_found'

        const minSize = 20
        const showHandles = sel && sw > minSize * zoom && sh > minSize * zoom
        const isHighlight = ann.type === 'highlight'
        const isRect = ann.type === 'rectangle'
        const isValid = ann.type === 'validation'
        // hasLineBounds: true when there are multiple per-line rects OR even a
        // single lineBound (we always use lineBounds[] for highlight fills so the
        // fill is painted at the exact item position, not the union box).
        const hasLineBounds = isHighlight && ann.lineBounds && ann.lineBounds.length >= 1

        const annCursor = isNotFound ? 'help' : sel ? 'move' : 'pointer'

        return (
          <div key={ann.id}>
            {/* ── Per-line highlight fills ─────────────────────────────────────
                Each lineBound is rendered as its own absolute div on the page
                layer, positioned directly from its CSS-space coordinates.
                This avoids the (lbScreen.x - sx) offset drift that occurs when
                the union bounding box origin doesn't coincide with the first
                line's top-left corner. */}
            {hasLineBounds && ann.lineBounds!.map((lb, i) => {
              const lbScreen = cssToScreen(lb, zoom)
              return (
                <div
                  key={`line-fill-${ann.id}-${i}`}
                  className="absolute rounded pointer-events-none"
                  style={{
                    left: lbScreen.x,
                    top: lbScreen.y,
                    width: lbScreen.width,
                    height: lbScreen.height,
                    backgroundColor: ann.color + '66',
                    opacity: isNotFound ? 0.6 : 1,
                    // Subtle left accent bar on the first line only
                    borderLeft: i === 0 ? `3px solid ${ann.color}` : undefined,
                  }}
                />
              )
            })}

            {/* ── Interaction / tooltip container ──────────────────────────────
                Sits at the union bounding box position. Has no background when
                lineBounds are present (fills are drawn above). Handles mouse
                events, resize handles, tooltips, and numbered badge. */}
            <div
              data-ann-id={ann.id}
              className={`group absolute ${isHighlight ? 'rounded' : 'rounded-lg'} ${
                sel ? 'z-20' : hov ? 'z-10' : 'z-0'
              }`}
              style={{
                left: sx,
                top: sy,
                width: sw,
                height: sh,
                // No fill for highlight — fill is drawn per-line above
                backgroundColor: hasLineBounds ? 'transparent' : getFillColor(ann),
                pointerEvents: 'auto',
                transition: isDragging
                  ? 'none'
                  : 'box-shadow 0.2s ease, transform 0.15s ease',
                transform: hov && !sel ? 'scale(1.02)' : 'scale(1)',
                transformOrigin: 'center center',
                boxShadow: sel
                  ? `0 0 0 2px ${accent}, 0 4px 16px ${accent}40`
                  : hov
                  ? `0 0 0 1px ${accent}60, 0 2px 8px rgba(0,0,0,0.08)`
                  : isRect || isValid
                  ? `0 0 0 1.5px ${accent}40`
                  : 'none',
                cursor: annCursor,
                opacity: isNotFound ? 0.6 : 1,
              }}
              onMouseDown={(e) => handleMouseDown(e, ann)}
              onMouseEnter={() => handleMouseEnter(ann.id)}
              onMouseLeave={handleMouseLeave}
            >
              {isNotFound && (
                <div
                  className="absolute inset-0 z-30 flex items-center justify-center"
                  style={{ pointerEvents: 'none' }}
                >
                  <span className="text-[9px] font-medium text-gray-500 bg-white/80 px-1.5 py-0.5 rounded">
                    Manual confirmation required
                  </span>
                </div>
              )}

              {/* Left accent bar for single-rect highlights (no lineBounds) */}
              {isHighlight && !hasLineBounds && (
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 rounded-l"
                  style={{
                    backgroundColor: accent,
                    opacity: 0.7,
                  }}
                />
              )}

              {isValid && (
                <div
                  className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l"
                  style={{ backgroundColor: accent }}
                />
              )}

              {indexMap.has(ann.id) && !isDragging && (
                <div
                  className={`absolute z-30 flex items-center justify-center rounded-full bg-white shadow-md select-none transition-transform duration-150 ${
                    hov || sel ? 'scale-110' : 'scale-100'
                  }`}
                  style={{
                    width: 20,
                    height: 20,
                    top: -10,
                    left: -10,
                    border: `2px solid ${accent}`,
                  }}
                >
                  <span className="text-[9px] font-bold leading-none" style={{ color: accent }}>
                    {indexMap.get(ann.id)}
                  </span>
                </div>
              )}

              {isValid && !isDragging && (
                <div
                  className="absolute z-30 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white shadow-sm border transition-opacity duration-150"
                  style={{
                    top: -8,
                    right: -8,
                    borderColor: accent,
                    borderWidth: 1.5,
                    opacity: hov || sel ? 1 : 0.85,
                  }}
                >
                  <span className="text-[10px]">{SEVERITY_ICONS[ann.severity || 'info']}</span>
                  {hov && (
                    <span className="text-[8px] font-semibold uppercase tracking-wider" style={{ color: accent }}>
                      {getSeverityLabel(ann.severity || 'info')}
                    </span>
                  )}
                </div>
              )}

              {isValid && ann.category && sw > 40 * zoom && sh > 30 * zoom && (
                <div
                  className="absolute flex items-center justify-center opacity-30 pointer-events-none select-none"
                  style={{
                    left: 4,
                    bottom: 2,
                    fontSize: Math.min(14, Math.max(8, sh / zoom * 0.4)),
                  }}
                >
                  <span>{CATEGORY_ICONS[ann.category]}</span>
                </div>
              )}

              {isValid && hov && ann.comment && sw > 80 * zoom && (
                <div
                  className="absolute left-0 right-0 z-30 px-2 py-0.5 text-[9px] font-medium truncate rounded-b-lg"
                  style={{
                    bottom: 0,
                    backgroundColor: accent + '20',
                    color: accent,
                  }}
                >
                  {ann.comment || ann.message}
                </div>
              )}

              {debugOverlay(ann)}

              <div
                style={{
                  pointerEvents: 'none',
                  opacity: hov || sel ? 1 : 0,
                  visibility: hov || sel ? 'visible' : 'hidden',
                  transition: 'opacity 0.15s ease, visibility 0.15s ease',
                }}
              >
                {isValid && (
                  <ValidationTooltip annotation={ann} />
                )}
                {isHighlight && !isNotFound && (
                  <ClaimTooltip annotation={ann} />
                )}
              </div>

              {isRect && ann.text === 'Comment' && !isDragging && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm text-xs"
                    style={{ border: `1.5px solid ${accent}` }}
                  >
                    💬
                  </div>
                </div>
              )}

              {showHandles && (
                <>
                  {['nw', 'ne', 'sw', 'se'].map((handle) => {
                    return (
                      <div
                        key={handle}
                        data-handle={handle}
                        className="absolute z-30 rounded-full bg-white shadow-md border-2 border-brand-500 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                        style={{
                          width: HANDLE_SIZE,
                          height: HANDLE_SIZE,
                          [handle.includes('n') ? 'top' : 'bottom']: -HANDLE_SIZE / 2,
                          [handle.includes('w') ? 'left' : 'right']: -HANDLE_SIZE / 2,
                          cursor: handle + '-resize',
                          pointerEvents: 'auto',
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation()
                          onSelect(ann.id)
                          const rect = layerRef.current?.getBoundingClientRect()
                          if (!rect) return
                          setDragging({
                            id: ann.id,
                            startX: (e.clientX - rect.left) / zoom,
                            startY: (e.clientY - rect.top) / zoom,
                            origBounds: { ...ann.bounds },
                            handle,
                          })
                        }}
                      />
                    )
                  })}

                  {['n', 's', 'e', 'w'].map((edge) => (
                    <div
                      key={edge}
                      data-handle={edge}
                      className="absolute z-20 opacity-0"
                      style={{
                        [edge === 'n' || edge === 's' ? 'height' : 'width']: 10,
                        [edge === 'n' || edge === 's' ? 'width' : 'height']: '100%',
                        [edge.includes('n') ? 'top' : edge.includes('s') ? 'bottom' : 'top']: edge.includes('n') || edge.includes('s') ? -5 : 0,
                        [edge.includes('w') ? 'left' : edge.includes('e') ? 'right' : 'left']: edge.includes('w') || edge.includes('e') ? -5 : 0,
                        cursor: edge + '-resize',
                        pointerEvents: 'auto',
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation()
                        onSelect(ann.id)
                        const rect = layerRef.current?.getBoundingClientRect()
                        if (!rect) return
                        setDragging({
                          id: ann.id,
                          startX: (e.clientX - rect.left) / zoom,
                          startY: (e.clientY - rect.top) / zoom,
                          origBounds: { ...ann.bounds },
                          handle: edge,
                        })
                      }}
                    />
                  ))}
                </>
              )}

              {sel && (
                <div
                  className="absolute inset-0 rounded-lg pointer-events-none"
                  style={{
                    boxShadow: `inset 0 0 0 2px ${accent}`,
                    borderRadius: isHighlight ? '4px' : '8px',
                  }}
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}