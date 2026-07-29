import { useState, useCallback, useRef, useEffect } from 'react'
import type { Annotation, Bounds, Severity } from '../../types'
import { SEVERITY_BORDERS, SEVERITY_ICONS, CATEGORY_ICONS, CATEGORY_LABELS } from '../../utils/constants'
import { findClaimBoundsFromSpans, computeUnionBounds } from '../../utils/text-positions'
import { findClaimBoundsPerLine } from '../../utils/ai'
import { normaliseBounds } from '../../utils/pdf'
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
  textSpans,
  pageNumber,
  pdfItems,
  onSelect,
  onDelete,
  onUpdate,
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

  const [effectiveAnnotations, setEffectiveAnnotations] = useState<Annotation[]>(annotations)

  useEffect(() => {
    const layerEl = layerRef.current
    const wrapperRect = layerEl?.parentElement?.getBoundingClientRect()

    const next = annotations.map((ann) => {
      if (!ann.text || ann.type !== 'highlight') return ann

      // Strategy 1: DOM text spans (most accurate when available)
      if (textSpans.length > 0 && wrapperRect) {
        const domResult = findClaimBoundsFromSpans(textSpans, ann.text, wrapperRect)
        if (domResult && domResult.length > 0) {
          const lineBounds = domResult.map((b) => normaliseBounds(b, zoom))
          const bounds = lineBounds.length === 1 ? lineBounds[0] : computeUnionBounds(lineBounds)
          return { ...ann, bounds, lineBounds }
        }
      }

      // Strategy 2: pdf.js text items (fallback)
      if (pdfItems && pdfItems.items.length > 0) {
        const perLine = findClaimBoundsPerLine(pdfItems.items, ann.text, pdfItems.pageHeight)
        if (perLine && perLine.length > 0) {
          const bounds = perLine.length === 1 ? perLine[0] : computeUnionBounds(perLine)
          return { ...ann, bounds, lineBounds: perLine }
        }
      }

      return ann
    })
    setEffectiveAnnotations(next)
  }, [annotations, textSpans, pdfItems, pageNumber, zoom])

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

  return (
    <div
      ref={layerRef}
      className="absolute inset-0"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ pointerEvents: 'none' }}
    >
      {effectiveAnnotations.map((ann) => {
        const sx = ann.bounds.x * zoom
        const sy = ann.bounds.y * zoom
        const sw = ann.bounds.width * zoom
        const sh = ann.bounds.height * zoom
        const sel = isSelected(ann.id)
        const hov = isHovered(ann.id)
        const accent = getAccentColor(ann)
        const isDragging = dragging?.id === ann.id

        const minSize = 20
        const showHandles = sel && sw > minSize * zoom && sh > minSize * zoom
        const isHighlight = ann.type === 'highlight'
        const isRect = ann.type === 'rectangle'
        const isValid = ann.type === 'validation'
        const hasLineBounds = isHighlight && ann.lineBounds && ann.lineBounds.length > 1

        return (
          <div
            key={ann.id}
            data-ann-id={ann.id}
            className={`group absolute ${isHighlight ? 'rounded' : 'rounded-lg'} ${
              sel ? 'z-20' : hov ? 'z-10' : 'z-0'
            }`}
            style={{
              left: sx,
              top: sy,
              width: sw,
              height: sh,
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
              cursor: sel ? 'move' : 'pointer',
            }}
            onMouseDown={(e) => handleMouseDown(e, ann)}
            onMouseEnter={() => handleMouseEnter(ann.id)}
            onMouseLeave={handleMouseLeave}
          >
            {/* ── Per-line highlight rects ── */}
            {hasLineBounds && ann.lineBounds!.map((lb, i) => (
              <div
                key={`line-${i}`}
                className="absolute rounded"
                style={{
                  left: lb.x * zoom - sx,
                  top: lb.y * zoom - sy,
                  width: lb.width * zoom,
                  height: lb.height * zoom,
                  backgroundColor: ann.color + '66',
                }}
              />
            ))}
            {/* ── Highlight: left accent bar ── */}
            {isHighlight && (
              <div
                className="absolute left-0 top-0 bottom-0 w-1 rounded-l"
                style={{
                  backgroundColor: accent,
                  opacity: 0.7,
                }}
              />
            )}

            {/* ── Validation: subtle left accent ── */}
            {isValid && (
              <div
                className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l"
                style={{ backgroundColor: accent }}
              />
            )}

            {/* ── Numbered badge ── */}
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

            {/* ── Validation: severity badge (top-right) ── */}
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

            {/* ── Validation: category icon watermark ── */}
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

            {/* ── Validation: message label on hover ── */}
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

            {/* ── Validation tooltip ── */}
            {isValid && (
              <div className="hidden group-hover:block">
                <ValidationTooltip annotation={ann} />
              </div>
            )}

            {/* ── Highlight claim tooltip ── */}
            {isHighlight && hov && (
              <div className="hidden group-hover:block">
                <ClaimTooltip annotation={ann} />
              </div>
            )}

            {/* ── Comment icon ── */}
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

            {/* ── Resize handles ── */}
            {showHandles && (
              <>
                {['nw', 'ne', 'sw', 'se'].map((handle) => {
                  const isCorner = true
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

                {/* Edge drag zones (larger invisible targets) */}
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

            {/* ── Selected border glow (appears on top) ── */}
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
        )
      })}
    </div>
  )
}
