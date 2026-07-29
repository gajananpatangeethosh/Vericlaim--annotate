import { type Annotation } from '../../types'
import { VERDICT_COLORS, VERDICT_LABELS, VERDICT_ICONS } from '../../utils/constants'

interface Props {
  annotation: Annotation
}

const SEVERITY_TO_VERDICT: Record<string, string> = {
  success: 'verified',
  warning: 'partial',
  error: 'unsupported',
}

export default function ClaimTooltip({ annotation }: Props) {
  const severity = annotation.severity || 'info'
  const verdict = SEVERITY_TO_VERDICT[severity] || 'unsupported'
  const accent = VERDICT_COLORS[verdict as keyof typeof VERDICT_COLORS] || annotation.color || '#3b82f6'
  const verdictLabel = VERDICT_LABELS[verdict as keyof typeof VERDICT_LABELS] || verdict
  const verdictIcon = VERDICT_ICONS[verdict as keyof typeof VERDICT_ICONS] || '\u2139\uFE0F'

  const claimText = annotation.text || 'No claim text'
  const message = annotation.message || ''

  // Parse evidence from comment field: "[VERIFIED] message\n\nEvidence:\n evidence"
  let evidence = ''
  if (annotation.comment) {
    const evMatch = annotation.comment.match(/Evidence:\s*([\s\S]*)$/i)
    if (evMatch) {
      evidence = evMatch[1].trim()
    }
  }

  return (
    <div
      className="pointer-events-none absolute z-50 animate-fade-in select-none"
      style={{
        bottom: 'calc(100% + 8px)',
        left: '50%',
        transform: 'translateX(-50%)',
        minWidth: 220,
        maxWidth: 320,
      }}
    >
      {/* Main card */}
      <div
        className="rounded-xl bg-white shadow-xl border overflow-hidden"
        style={{ borderColor: accent + '50', borderWidth: 1 }}
      >
        {/* Colored header bar */}
        <div className="h-1.5 w-full" style={{ backgroundColor: accent }} />

        <div className="px-3 py-2.5">
          {/* Verdict badge */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">{verdictIcon}</span>
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: accent + '20',
                color: accent,
              }}
            >
              {verdictLabel}
            </span>
          </div>

          {/* Claim text */}
          <div className="mb-2">
            <p className="text-[10px] text-gray-400 font-medium mb-0.5">Claim</p>
            <p className="text-xs font-medium text-gray-800 leading-relaxed break-words italic">
              &ldquo;{claimText.substring(0, 150)}{claimText.length > 150 ? '...' : ''}&rdquo;
            </p>
          </div>

          {/* Reason */}
          {message && (
            <div className="mb-2">
              <p className="text-[10px] text-gray-400 font-medium mb-0.5">Reason</p>
              <p className="text-xs text-gray-700 leading-relaxed break-words">
                {message}
              </p>
            </div>
          )}

          {/* Evidence */}
          {evidence && (
            <div className="pt-1.5 border-t border-gray-100">
              <p className="text-[10px] text-gray-400 font-medium mb-0.5">Evidence from Reference</p>
              <p className="text-[10px] text-gray-500 italic leading-relaxed break-words">
                &ldquo;{evidence.substring(0, 200)}{evidence.length > 200 ? '...' : ''}&rdquo;
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Arrow */}
      <div
        className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-2 rotate-45"
        style={{
          backgroundColor: 'white',
          borderRight: `1px solid ${accent}50`,
          borderBottom: `1px solid ${accent}50`,
        }}
      />
    </div>
  )
}
