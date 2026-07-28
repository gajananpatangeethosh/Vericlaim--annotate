import { type Annotation } from '../../types'
import { CATEGORY_ICONS, CATEGORY_LABELS, SEVERITY_BORDERS, SEVERITY_ICONS } from '../../utils/constants'

interface Props {
  annotation: Annotation
}

export default function ValidationTooltip({ annotation }: Props) {
  const sev = annotation.severity || 'info'
  const accent = SEVERITY_BORDERS[sev]
  const icon = SEVERITY_ICONS[sev]
  const category = annotation.category || 'custom'
  const message = annotation.message || annotation.comment || annotation.text || 'No message'

  return (
    <div
      className="pointer-events-none absolute z-50 animate-fade-in select-none"
      style={{
        bottom: 'calc(100% + 8px)',
        left: '50%',
        transform: 'translateX(-50%)',
        minWidth: 180,
        maxWidth: 280,
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
          {/* Top row: severity icon + category */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">{icon}</span>
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: accent + '20',
                color: accent,
              }}
            >
              {sev}
            </span>
            <span className="text-gray-400">·</span>
            <span className="text-[11px] text-gray-500 flex items-center gap-1">
              <span>{CATEGORY_ICONS[category]}</span>
              <span>{CATEGORY_LABELS[category]}</span>
            </span>
          </div>

          {/* Message */}
          <p className="text-xs font-medium text-gray-800 leading-relaxed break-words">
            {message}
          </p>

          {/* Snippet if present and different from message */}
          {annotation.text && annotation.text !== message && (
            <div
              className="mt-1.5 pt-1.5 border-t border-gray-100"
            >
              <p className="text-[10px] text-gray-400 font-medium mb-0.5">Snippet</p>
              <p className="text-[10px] text-gray-500 italic leading-relaxed">
                &ldquo;{annotation.text.substring(0, 120)}&rdquo;
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
