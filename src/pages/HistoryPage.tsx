import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useStore } from '../store/useStore'
import { loadExportFile } from '../utils/idb'
import { downloadPdfBytes } from '../utils/export-pdf'
import type { AuditAction, ExportRecord } from '../types'

const ACTION_META: Record<AuditAction, { icon: string; color: string }> = {
  app_open: { icon: '🚪', color: 'bg-blue-100 text-blue-700' },
  brochure_uploaded: { icon: '📄', color: 'bg-green-100 text-green-700' },
  reference_uploaded: { icon: '📚', color: 'bg-green-100 text-green-700' },
  validation_run: { icon: '🤖', color: 'bg-indigo-100 text-indigo-700' },
  validation_applied: { icon: '✅', color: 'bg-green-100 text-green-700' },
  export_pdf: { icon: '🗞️', color: 'bg-brand-100 text-brand-700' },
  export_reference_pdf: { icon: '📑', color: 'bg-brand-100 text-brand-700' },
  claim_verified: { icon: '💬', color: 'bg-amber-100 text-amber-700' },
  import_json: { icon: '📤', color: 'bg-gray-100 text-gray-700' },
  export_deleted: { icon: '🗑️', color: 'bg-red-100 text-red-700' },
  clear_all: { icon: '🧹', color: 'bg-red-100 text-red-700' },
  brochure_generated: { icon: '🎨', color: 'bg-purple-100 text-purple-700' },
  brochure_pdf_exported: { icon: '📄', color: 'bg-brand-100 text-brand-700' },
}

const ACTION_LABELS: Record<string, string> = {
  app_open: 'App opened',
  brochure_uploaded: 'Brochure uploaded',
  reference_uploaded: 'Research paper uploaded',
  validation_run: 'AI validation run',
  validation_applied: 'Claims applied',
  export_pdf: 'Annotated brochure exported',
  export_reference_pdf: 'Annotated research paper exported',
  claim_verified: 'Claim verified',
  import_json: 'Annotations imported',
  export_deleted: 'Export deleted',
  clear_all: 'Document cleared',
  brochure_generated: 'Brochure generated',
  brochure_pdf_exported: 'Brochure PDF exported',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

async function downloadRecord(record: ExportRecord) {
  const dataUrl = await loadExportFile(record.fileId)
  if (!dataUrl) return
  const bytes = new Uint8Array(await (await fetch(dataUrl)).arrayBuffer())
  const name =
    record.type === 'brochure'
      ? `annotated-${record.brochureName.replace(/\.pdf$/i, '')}.pdf`
      : `annotated-reference-${record.referenceName.replace(/\.pdf$/i, '')}.pdf`
  downloadPdfBytes(bytes, name)
}

export default function HistoryPage() {
  const exportHistory = useStore((s) => s.exportHistory)
  const auditLog = useStore((s) => s.auditLog)
  const deleteExport = useStore((s) => s.deleteExport)
  const clearAuditLog = useStore((s) => s.clearAuditLog)
  const clearExportHistory = useStore((s) => s.clearExportHistory)

  const [tab, setTab] = useState<'documents' | 'audit'>('documents')
  const [filter, setFilter] = useState<'all' | AuditAction>('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  const actions = Object.keys(ACTION_LABELS) as AuditAction[]
  const visibleLog =
    filter === 'all' ? auditLog : auditLog.filter((e) => e.action === filter)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="sticky top-0 z-20 border-b border-gray-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              V
            </div>
            <span className="text-sm font-semibold">VeriClaim — History & Audit Log</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/app" className="btn-ghost text-xs">
              ← Back to App
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* Tabs */}
        <div className="mb-6 flex items-center gap-2">
          <button
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === 'documents'
                ? 'bg-brand-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
            }`}
            onClick={() => setTab('documents')}
          >
            📦 Exported Documents ({exportHistory.length})
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === 'audit'
                ? 'bg-brand-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
            }`}
            onClick={() => setTab('audit')}
          >
            🕐 Audit Log ({auditLog.length})
          </button>
        </div>

        {tab === 'documents' ? (
          <section>
            {exportHistory.length === 0 ? (
              <EmptyState
                title="No exported documents yet"
                desc="Export an annotated brochure or research paper from the app — it will be archived here automatically."
                cta={<Link to="/app" className="btn-primary text-sm">Go to the App</Link>}
              />
            ) : (
              <>
                <div className="mb-4 flex justify-end">
                  <button
                    className="btn-ghost text-xs"
                    onClick={() => {
                      if (window.confirm('Delete all exported documents from history?')) clearExportHistory()
                    }}
                  >
                    🗑️ Clear all
                  </button>
                </div>
                <div className="flex flex-col gap-4">
                  {exportHistory.map((r) => (
                    <div key={r.id} className="card p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xl">
                            {r.type === 'brochure' ? '🗞️' : '📑'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`badge ${
                                  r.type === 'brochure'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-purple-100 text-purple-700'
                                }`}
                              >
                                {r.type === 'brochure' ? 'Annotated Brochure' : 'Annotated Research Paper'}
                              </span>
                              <span className="text-xs text-gray-400">{formatDate(r.createdAt)}</span>
                            </div>
                            <h3 className="mt-1.5 font-semibold">
                              {r.type === 'brochure' ? r.brochureName : r.referenceName}
                            </h3>
                            <p className="mt-0.5 text-xs text-gray-500">
                              {r.type === 'brochure'
                                ? `Brochure: ${r.brochureName}`
                                : `Research paper: ${r.referenceName}`}
                              {r.pages > 0 && ` · ${r.pages} page(s)`}
                              {' · '}
                              {formatBytes(r.sizeBytes)}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <VerdictChips record={r} />
                          <div className="ml-1 flex items-center gap-1.5">
                            <button
                              className="btn-primary text-xs"
                              onClick={() => downloadRecord(r).catch(() => {})}
                              title="Download the annotated PDF"
                            >
                              ⬇️ Download
                            </button>
                            <button
                              className="btn-ghost text-xs !text-red-600"
                              onClick={() => deleteExport(r.id)}
                              title="Delete from history"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        ) : (
          <section>
            {/* Filter */}
            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              <button
                className={`px-2.5 py-1 text-[11px] rounded-full transition-colors ${
                  filter === 'all'
                    ? 'bg-brand-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => setFilter('all')}
              >
                All ({auditLog.length})
              </button>
              {actions.map((a) => {
                const count = auditLog.filter((e) => e.action === a).length
                if (count === 0) return null
                return (
                  <button
                    key={a}
                    className={`px-2.5 py-1 text-[11px] rounded-full transition-colors ${
                      filter === a
                        ? 'bg-brand-600 text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                    onClick={() => setFilter(filter === a ? 'all' : a)}
                  >
                    {ACTION_META[a].icon} {ACTION_LABELS[a]} ({count})
                  </button>
                )
              })}
              {auditLog.length > 0 && (
                <button
                  className="ml-auto px-2.5 py-1 text-[11px] rounded-full text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
                  onClick={() => {
                    if (window.confirm('Clear the entire audit log?')) clearAuditLog()
                  }}
                >
                  Clear log
                </button>
              )}
            </div>

            {visibleLog.length === 0 ? (
              <EmptyState
                title="No audit events"
                desc="Uploads, validations, exports, and claim verdicts will be recorded here as you use the app."
              />
            ) : (
              <div className="relative flex flex-col gap-3 pl-6">
                {/* Timeline spine */}
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200" />
                {visibleLog.map((e) => (
                  <div key={e.id} className="relative">
                    <div className="absolute -left-6 top-1.5 flex h-3.5 w-3.5 items-center justify-center">
                      <span
                        className={`h-3.5 w-3.5 rounded-full border-2 border-white shadow ${ACTION_META[e.action].color}`}
                      />
                    </div>
                    <div className="card px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{ACTION_META[e.action].icon}</span>
                        <span className="text-sm font-medium">{e.label}</span>
                        <span className="ml-auto text-[11px] text-gray-400">
                          {formatDate(e.timestamp)}
                        </span>
                        {e.details && Object.keys(e.details).length > 0 && (
                          <button
                            className="text-[11px] text-brand-600 hover:underline"
                            onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                          >
                            {expanded === e.id ? 'Hide' : 'Details'}
                          </button>
                        )}
                      </div>
                      {expanded === e.id && e.details && (
                        <pre className="mt-2 overflow-x-auto rounded-lg bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-600">
                          {JSON.stringify(e.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}

function VerdictChips({ record }: { record: ExportRecord }) {
  const chips = [
    { label: 'Supported', count: record.verdicts.verified, cls: 'bg-green-100 text-green-700' },
    { label: 'Partial', count: record.verdicts.partial, cls: 'bg-amber-100 text-amber-700' },
    { label: 'Unsupported', count: record.verdicts.unsupported, cls: 'bg-red-100 text-red-700' },
  ]
  return (
    <div className="flex items-center gap-1.5">
      {chips.map((c) => (
        <span key={c.label} className={`badge ${c.cls}`}>
          {c.label}: {c.count}
        </span>
      ))}
    </div>
  )
}

function EmptyState({ title, desc, cta }: { title: string; desc: string; cta?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-3 text-3xl">🗂️</div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-gray-500">{desc}</p>
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  )
}