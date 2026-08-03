import type { Annotation } from '../../types'
import { cssToScreen } from '../../utils/coordinates'
import { VERDICT_COLORS, VERDICT_LABELS, VERDICT_ICONS } from '../../utils/constants'
import { useStore } from '../../store/useStore'

interface Props {
  /** Annotations whose reference evidence lives on this reference page */
  annotations: Annotation[]
  zoom: number
  /** Same numbering as the brochure claims (claim #N ↔ reference #N) */
  indexMap: Map<string, number>
  /** Annotation to flash after a "View in Reference" jump */
  flashId: string | null
}

const SEVERITY_TO_VERDICT: Record<string, string> = {
  success: 'verified',
  warning: 'partial',
  error: 'unsupported',
}

export default function ReferenceAnnotationLayer({
  annotations,
  zoom,
  indexMap,
  flashId,
}: Props) {
  const setActiveView = useStore((s) => s.setActiveView)
  const setSelectedAnnotationId = useStore((s) => s.setSelectedAnnotationId)
  const setScrollToPage = useStore((s) => s.setScrollToPage)

  const goToClaim = (ann: Annotation) => {
    setActiveView('brochure')
    setSelectedAnnotationId(ann.id)
    setScrollToPage(ann.page)
  }

  return (
    <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
      {annotations.map((ann) => {
        const verdict = SEVERITY_TO_VERDICT[ann.severity || 'info'] || 'unsupported'
        const accent =
          VERDICT_COLORS[verdict as keyof typeof VERDICT_COLORS] ||
          ann.color ||
          '#3b82f6'
        const verdictLabel =
          VERDICT_LABELS[verdict as keyof typeof VERDICT_LABELS] || verdict
        const verdictIcon =
          VERDICT_ICONS[verdict as keyof typeof VERDICT_ICONS] || '\u2139\uFE0F'

        let evidence = ''
        if (ann.comment) {
          const evMatch = ann.comment.match(/Evidence:\s*([\s\S]*)$/i)
          if (evMatch) evidence = evMatch[1].trim()
        }

        const lineBounds = ann.referenceLineBounds && ann.referenceLineBounds.length >= 1
          ? ann.referenceLineBounds
          : ann.referenceBounds
          ? [ann.referenceBounds]
          : null

        const isFlashing = flashId === ann.id
        const isNotFound = ann.referenceLocationStatus === 'not_found'

        return (
          <div key={ann.id}>
            {/* Per-line evidence fills */}
            {lineBounds?.map((lb, i) => {
              const s = cssToScreen(lb, zoom)
              return (
                <div
                  key={`ref-fill-${ann.id}-${i}`}
                  className="absolute rounded pointer-events-none"
                  style={{
                    left: s.x,
                    top: s.y,
                    width: s.width,
                    height: s.height,
                    backgroundColor: ann.color + '66',
                    borderLeft: i === 0 ? `3px solid ${ann.color}` : undefined,
                    opacity: isNotFound ? 0.6 : 1,
                  }}
                />
              )
            })}

            {/* Interaction container: badge + tooltip */}
            {ann.referenceBounds && (
              <div
                data-ref-ann-id={ann.id}
                className={`group absolute ${isFlashing ? 'animate-ref-flash' : ''}`}
                style={{
                  left: cssToScreen(ann.referenceBounds, zoom).x,
                  top: cssToScreen(ann.referenceBounds, zoom).y,
                  width: cssToScreen(ann.referenceBounds, zoom).width,
                  height: cssToScreen(ann.referenceBounds, zoom).height,
                  pointerEvents: 'auto',
                  cursor: 'pointer',
                  borderRadius: 4,
                  transition: 'transform 0.15s ease',
                  transform: 'scale(1)',
                }}
                onClick={() => goToClaim(ann)}
                title="Go to claim in brochure"
              >
                {/* Numbered badge — matches the claim number */}
                {indexMap.has(ann.id) && (
                  <div
                    className="absolute z-30 flex items-center justify-center rounded-full bg-white shadow-md select-none"
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

                {/* Hover tooltip */}
                <div
                  className="pointer-events-none absolute z-40 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-150"
                  style={{
                    bottom: 'calc(100% + 8px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    minWidth: 240,
                    maxWidth: 340,
                  }}
                >
                  <div
                    className="rounded-xl bg-white shadow-xl border overflow-hidden"
                    style={{ borderColor: accent + '50', borderWidth: 1 }}
                  >
                    <div className="h-1.5 w-full" style={{ backgroundColor: accent }} />
                    <div className="px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="flex items-center gap-1.5">
                          <span className="text-sm">{verdictIcon}</span>
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: accent + '20', color: accent }}
                          >
                            {verdictLabel}
                          </span>
                        </span>
                        <span className="text-[9px] text-gray-400 font-medium uppercase tracking-wider">
                          Ref page {ann.referencePage}
                        </span>
                      </div>

                      <p className="text-[10px] text-gray-400 font-medium mb-0.5">Validates claim</p>
                      <p className="text-xs font-medium text-gray-800 leading-relaxed break-words italic mb-2">
                        &ldquo;{(ann.text || '').substring(0, 150)}
                        {(ann.text || '').length > 150 ? '...' : ''}&rdquo;
                      </p>

                      {evidence && (
                        <div className="pt-1.5 border-t border-gray-100">
                          <p className="text-[10px] text-gray-400 font-medium mb-0.5">Evidence quote</p>
                          <p className="text-[10px] text-gray-500 italic leading-relaxed break-words">
                            &ldquo;{evidence.substring(0, 200)}{evidence.length > 200 ? '...' : ''}&rdquo;
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-2 rotate-45"
                    style={{
                      backgroundColor: 'white',
                      borderRight: `1px solid ${accent}50`,
                      borderBottom: `1px solid ${accent}50`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
