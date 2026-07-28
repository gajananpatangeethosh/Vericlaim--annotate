import { useStore } from '../../store/useStore'
import { SEVERITY_COLORS, CATEGORY_ICONS, CATEGORY_LABELS } from '../../utils/constants'

export default function AIDialog() {
  const aiResult = useStore((s) => s.aiResult)
  const aiDialogOpen = useStore((s) => s.aiDialogOpen)
  const aiLoading = useStore((s) => s.aiLoading)
  const aiProgress = useStore((s) => s.aiProgress)
  const setAiDialogOpen = useStore((s) => s.setAiDialogOpen)
  const applyAiResults = useStore((s) => s.applyAiResults)
  const discardAiResults = useStore((s) => s.discardAiResults)
  const apiKey = useStore((s) => s.apiKey)
  const setApiKey = useStore((s) => s.setApiKey)
  const runAiValidation = useStore((s) => s.runAiValidation)

  if (!aiDialogOpen) return null

  const severityBadge = (s: string) => {
    const cls =
      s === 'error'
        ? 'badge-error'
        : s === 'warning'
        ? 'badge-warning'
        : s === 'info'
        ? 'badge-info'
        : 'badge-success'
    return cls
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <h2 className="text-sm font-semibold text-gray-800">AI Document Validation</h2>
          </div>
          <button
            className="btn-icon !p-1"
            onClick={() => setAiDialogOpen(false)}
          >
            ✕
          </button>
        </div>

        {/* API Key input (if not set) */}
        {!apiKey && !aiLoading && (
          <div className="px-5 py-4 border-b border-gray-100">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              OpenRouter API Key
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                placeholder="sk-or-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') runAiValidation()
                }}
              />
              <button
                className="btn-primary text-xs"
                onClick={runAiValidation}
                disabled={!apiKey.trim()}
              >
                Validate
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-gray-400">
              Your key stays in memory and is never stored.
            </p>
          </div>
        )}

        {/* Loading state */}
        {aiLoading && (
          <div className="flex flex-col items-center gap-3 px-5 py-8">
            <svg className="h-8 w-8 animate-spin text-brand-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <p className="text-sm text-gray-600">
              Analyzing document page {aiProgress.current} of {aiProgress.total}...
            </p>
            <div className="h-2 w-full max-w-xs rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-300"
                style={{
                  width: `${(aiProgress.current / Math.max(aiProgress.total, 1)) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Results */}
        {!aiLoading && aiResult && (
          <div className="max-h-80 overflow-y-auto px-5 py-4 scroll-thin">
            {aiResult.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-lg">✅</p>
                <p className="mt-2 text-sm text-gray-600">No issues found in the document.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-gray-500">
                  Found {aiResult.length} issue{aiResult.length > 1 ? 's' : ''}:
                </p>
                {aiResult.map((ann, i) => (
                  <div
                    key={ann.id}
                    className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: SEVERITY_COLORS[ann.severity || 'info'] }}
                      />
                      <span className={`badge text-[10px] ${severityBadge(ann.severity || 'info')}`}>
                        {ann.severity}
                      </span>
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-500">Pg {ann.page}</span>
                      {ann.category && (
                        <>
                          <span className="text-gray-400">·</span>
                          <span className="text-gray-500">{CATEGORY_ICONS[ann.category]} {CATEGORY_LABELS[ann.category]}</span>
                        </>
                      )}
                    </div>
                    <p className="mt-1 font-medium text-gray-700">{ann.message || ann.comment}</p>
                    {ann.text && (
                      <p className="mt-0.5 italic text-gray-500 truncate">
                        "{ann.text.substring(0, 100)}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {!aiLoading && (
          <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
            <button
              className="btn-ghost text-xs"
              onClick={discardAiResults}
            >
              Discard
            </button>
            <button
              className="btn-primary text-xs"
              onClick={applyAiResults}
              disabled={!aiResult || aiResult.length === 0}
            >
              Apply {aiResult && aiResult.length > 0 ? `(${aiResult.length})` : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
