import { useStore } from '../../store/useStore'
import { VERDICT_COLORS, VERDICT_LABELS, VERDICT_ICONS } from '../../utils/constants'
import { PROVIDERS, PROVIDER_IDS } from '../../utils/providers'

export default function AIDialog() {
  const aiResult = useStore((s) => s.aiResult)
  const aiError = useStore((s) => s.aiError)
  const aiDialogOpen = useStore((s) => s.aiDialogOpen)
  const aiLoading = useStore((s) => s.aiLoading)
  const aiProgress = useStore((s) => s.aiProgress)
  const referencePdfMeta = useStore((s) => s.referencePdfMeta)
  const setAiDialogOpen = useStore((s) => s.setAiDialogOpen)
  const applyAiResults = useStore((s) => s.applyAiResults)
  const discardAiResults = useStore((s) => s.discardAiResults)
  const apiKey = useStore((s) => s.apiKeys[s.aiProvider])
  const setApiKey = useStore((s) => s.setApiKey)
  const aiProvider = useStore((s) => s.aiProvider)
  const setAiProvider = useStore((s) => s.setAiProvider)
  const aiModel = useStore((s) => s.aiModel)
  const setAiModel = useStore((s) => s.setAiModel)
  const runAiValidation = useStore((s) => s.runAiValidation)

  if (!aiDialogOpen) return null

  const verdictBadge = (v: string) => {
    if (v === 'verified') return 'badge-success'
    if (v === 'partial') return 'badge-warning'
    return 'badge-error'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔍</span>
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Claim Verification</h2>
              {referencePdfMeta && (
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Against: {referencePdfMeta.name}
                </p>
              )}
            </div>
          </div>
          <button
            className="btn-icon !p-1"
            onClick={() => setAiDialogOpen(false)}
          >
            ✕
          </button>
        </div>

        {/* No reference PDF loaded */}
        {!aiLoading && !aiResult && !referencePdfMeta && (
          <div className="px-5 py-8 text-center">
            <p className="text-2xl mb-2">📚</p>
            <p className="text-sm text-gray-600 mb-1">No reference PDF uploaded</p>
            <p className="text-xs text-gray-400">
              Upload a research paper PDF to run claim verification
            </p>
          </div>
        )}

        {/* Error state */}
        {!aiLoading && aiError && (
          <div className="px-5 py-4">
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0">❌</span>
                <div>
                  <p className="font-semibold text-red-700">Verification Failed</p>
                  <p className="mt-0.5 text-red-600 leading-relaxed">{aiError}</p>
                </div>
              </div>
            </div>
            {!apiKey.trim() && (
              <p className="mt-2 text-[10px] text-gray-400 text-center">
                Enter your {PROVIDERS[aiProvider].label} API key and try again
              </p>
            )}
          </div>
        )}

        {/* Provider / Model / API Key config (shown whenever a reference PDF is loaded
            and there are no results to display yet) */}
        {!aiLoading && referencePdfMeta && !(aiResult && aiResult.length > 0) && (
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="grid grid-cols-2 gap-2 mb-2.5">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Provider
                </label>
                <select
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 text-xs focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                  value={aiProvider}
                  onChange={(e) => setAiProvider(e.target.value as any)}
                >
                  {PROVIDER_IDS.map((id) => (
                    <option key={id} value={id}>
                      {PROVIDERS[id].label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Model
                </label>
                <select
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 text-xs focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                >
                  {PROVIDERS[aiProvider].models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {PROVIDERS[aiProvider].label} API Key
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                placeholder={PROVIDERS[aiProvider].keyPlaceholder}
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
                Verify Claims
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
              Verifying claims on page {aiProgress.current} of {aiProgress.total}...
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
                <p className="mt-2 text-sm text-gray-600">No claims detected in the brochure.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-gray-500">
                  Found {aiResult.length} claim{aiResult.length > 1 ? 's' : ''}:
                </p>
                {aiResult.map((ann, i) => {
                  const comment = ann.comment || ''
                  const verdictMatch = comment.match(/^\[(VERIFIED|PARTIAL|UNSUPPORTED)\]/)
                  const verdict = verdictMatch
                    ? verdictMatch[1].toLowerCase()
                    : ann.severity === 'success'
                    ? 'verified'
                    : ann.severity === 'warning'
                    ? 'partial'
                    : 'unsupported'
                  const evidenceMatch = comment.match(/Evidence:\n([\s\S]*)$/)
                  const evidence = evidenceMatch ? evidenceMatch[1].trim() : ''

                  return (
                    <div
                      key={ann.id}
                      className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: VERDICT_COLORS[verdict as keyof typeof VERDICT_COLORS] || '#6b7280' }}
                        />
                        <span className={`badge text-[10px] ${verdictBadge(verdict)}`}>
                          {VERDICT_ICONS[verdict as keyof typeof VERDICT_ICONS]} {VERDICT_LABELS[verdict as keyof typeof VERDICT_LABELS] || verdict}
                        </span>
                        <span className="text-gray-400">·</span>
                        <span className="text-gray-500">Pg {ann.page}</span>
                      </div>
                      {ann.text && (
                        <p className="mt-1.5 font-medium text-gray-800 text-[11px] leading-relaxed">
                          "{ann.text}"
                        </p>
                      )}
                      <p className="mt-1 text-gray-600 leading-relaxed">{ann.message}</p>
                      {evidence && (
                        <details className="mt-1.5">
                          <summary className="text-[10px] text-gray-400 cursor-pointer hover:text-gray-600">
                            {VERDICT_ICONS[verdict as keyof typeof VERDICT_ICONS]} Evidence
                          </summary>
                          <p className="mt-1 text-[10px] text-gray-500 italic leading-relaxed border-l-2 border-gray-200 pl-2">
                            {evidence}
                          </p>
                        </details>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {!aiLoading && aiResult && (
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
              disabled={aiResult.length === 0}
            >
              Apply {aiResult.length > 0 ? `(${aiResult.length})` : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
