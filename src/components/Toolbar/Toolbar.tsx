import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { v4 as uuid } from 'uuid'
import { useStore } from '../../store/useStore'
import { exportAnnotations, importAnnotations, generateFakeValidations } from '../../utils/pdf'
import { exportAnnotatedPDF, exportAnnotatedReferencePDF, downloadPdfBytes, pdfBytesToDataUrl } from '../../utils/export-pdf'
import { savePdfBinary, saveExportFile, PDF_KEYS } from '../../utils/idb'
import { readFileAsDataURL } from '../../utils/pdf'
import { TOOL_NAMES, MIN_ZOOM, MAX_ZOOM, ZOOM_STEP } from '../../utils/constants'
import type { Tool, ExportRecord } from '../../types'

const TOOLS: Tool[] = ['pointer', 'highlight', 'rectangle', 'validation', 'comment', 'erase']

const TOOL_ICONS: Record<string, string> = {
  pointer: '↖️',
  highlight: '🖍️',
  rectangle: '▭',
  validation: '✓',
  comment: '💬',
  erase: '🧹',
}

export default function Toolbar() {
  const pdfMeta = useStore((s) => s.pdfMeta)
  const referencePdfMeta = useStore((s) => s.referencePdfMeta)
  const activeView = useStore((s) => s.activeView)
  const setActiveView = useStore((s) => s.setActiveView)
  const numPages = useStore((s) => s.numPages)
  const annotations = useStore((s) => s.annotations)
  const zoom = useStore((s) => s.zoom)
  const currentTool = useStore((s) => s.currentTool)
  const searchQuery = useStore((s) => s.searchQuery)
  const hasPast = useStore((s) => s.past.length > 0)
  const hasFuture = useStore((s) => s.future.length > 0)

  const setPdfMeta = useStore((s) => s.setPdfMeta)
  const setReferencePdfMeta = useStore((s) => s.setReferencePdfMeta)
  const setZoom = useStore((s) => s.setZoom)
  const setCurrentTool = useStore((s) => s.setCurrentTool)
  const addAnnotation = useStore((s) => s.addAnnotation)
  const replaceAnnotations = useStore((s) => s.replaceAnnotations)
  const setSearchQuery = useStore((s) => s.setSearchQuery)
  const setLoading = useStore((s) => s.setLoading)
  const setError = useStore((s) => s.setError)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const fitWidthFn = useStore((s) => s.fitWidthFn)
  const fitPageFn = useStore((s) => s.fitPageFn)
  const debugMode = useStore((s) => s.debugMode)
  const setDebugMode = useStore((s) => s.setDebugMode)
  const exportHistory = useStore((s) => s.exportHistory)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const navigate = useNavigate()

  const verdictCounts = () => {
    const counts = { verified: 0, partial: 0, unsupported: 0 }
    for (const a of annotations) {
      if (a.severity === 'success') counts.verified++
      else if (a.severity === 'warning') counts.partial++
      else if (a.severity === 'error') counts.unsupported++
      else counts.partial++
    }
    return counts
  }

  const saveToHistory = async (type: 'brochure' | 'reference', bytes: Uint8Array) => {
    try {
      const fileId = uuid()
      await saveExportFile(pdfBytesToDataUrl(bytes), fileId)
      const record: ExportRecord = {
        id: uuid(),
        type,
        brochureName: pdfMeta?.name ?? 'brochure.pdf',
        referenceName: referencePdfMeta?.name ?? 'reference.pdf',
        createdAt: new Date().toISOString(),
        pages: numPages,
        annotationCount: annotations.length,
        verdicts: verdictCounts(),
        sizeBytes: bytes.byteLength,
        fileId,
      }
      useStore.getState().addExportRecord(record)
      useStore.getState().logAudit(
        type === 'brochure' ? 'export_pdf' : 'export_reference_pdf',
        type === 'brochure'
          ? `Exported annotated brochure PDF (${annotations.length} annotations)`
          : `Exported annotated research paper (${annotations.length} evidence highlights)`,
        { filename: type === 'brochure' ? record.brochureName : record.referenceName, annotations: annotations.length },
        'success'
      )
    } catch {
      // History save is best-effort — the download already succeeded
    }
  }

  const handleExportPDF = async () => {
    setShowExportMenu(false)
    try {
      const bytes = await exportAnnotatedPDF(annotations)
      downloadPdfBytes(bytes, `annotated-${Date.now()}.pdf`)
      await saveToHistory('brochure', bytes)
    } catch (err) {
      setError('Failed to export PDF: ' + (err as Error).message)
    }
  }

  const handleExportReferencePDF = async () => {
    setShowExportMenu(false)
    try {
      const bytes = await exportAnnotatedReferencePDF(annotations)
      downloadPdfBytes(bytes, `annotated-reference-${Date.now()}.pdf`)
      await saveToHistory('reference', bytes)
    } catch (err) {
      setError('Failed to export research paper: ' + (err as Error).message)
    }
  }

  const importRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const referenceUploadRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const dataUrl = await readFileAsDataURL(file)
      await savePdfBinary(dataUrl, PDF_KEYS.brochure)
      useStore.getState().clearAll()
      setPdfMeta({ name: file.name, totalSize: file.size })
      useStore.getState().logAudit(
        'brochure_uploaded',
        `Uploaded brochure PDF "${file.name}"`,
        { name: file.name, size: file.size },
        'success'
      )
    } catch {
      setError('Failed to load PDF')
    } finally {
      setLoading(false)
    }
  }

  const handleReferenceUpload = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file for the reference')
      return
    }
    setError(null)
    try {
      const dataUrl = await readFileAsDataURL(file)
      await savePdfBinary(dataUrl, PDF_KEYS.reference)
      setReferencePdfMeta({ name: file.name, totalSize: file.size })
      useStore.getState().logAudit(
        'reference_uploaded',
        `Uploaded research paper "${file.name}"`,
        { name: file.name, size: file.size },
        'success'
      )
    } catch {
      setError('Failed to load reference PDF')
    }
  }

  const handleExport = () => exportAnnotations(annotations)

  const handleImport = () => {
    const file = importRef.current?.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = importAnnotations(reader.result as string)
        replaceAnnotations(parsed)
        useStore.getState().logAudit(
          'import_json',
          `Imported ${parsed.length} annotation(s) from JSON`,
          { count: parsed.length },
          'info'
        )
      } catch {
        setError('Invalid annotation file')
      }
    }
    reader.readAsText(file)
    importRef.current!.value = ''
  }

  const handleRunValidation = () => {
    if (!pdfMeta) return
    const refMeta = useStore.getState().referencePdfMeta
    if (!refMeta) {
      setError('Upload a reference/research paper PDF first to run claim verification')
      return
    }
    // Always open the AI dialog so the user can choose the provider/model
    // before running, instead of auto-starting with the pre-filled key.
    useStore.getState().setAiDialogOpen(true)
  }

  const hasRefHighlights = annotations.some(
    (a) =>
      a.referencePage &&
      a.referenceBounds &&
      a.referenceLocationStatus !== 'not_found'
  )

  return (
    <header className="flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-2 shadow-sm">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 mr-2 hover:opacity-80 transition-opacity" title="VeriClaim Home">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white text-sm font-bold">
          V
        </div>
        <span className="hidden text-sm font-semibold text-gray-800 sm:block">
          VeriClaim
        </span>
      </Link>

      <div className="h-6 w-px bg-gray-200" />

      {/* Upload */}
      <button
        className="btn-primary text-xs !py-1.5"
        onClick={() => uploadRef.current?.click()}
        title="Upload Brochure PDF"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <span className="hidden sm:inline">Brochure</span>
      </button>
      <input
        ref={uploadRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleUpload(file)
        }}
      />

      {/* Reference Upload */}
      {referencePdfMeta ? (
        <span className="flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1 text-[10px] text-amber-700 font-medium max-w-[140px] truncate" title={referencePdfMeta.name}>
          📄 {referencePdfMeta.name}
        </span>
      ) : (
        <button
          className="btn-ghost text-xs !py-1.5"
          onClick={() => referenceUploadRef.current?.click()}
          title="Upload Reference/Research Paper PDF"
        >
          📚 Reference
        </button>
      )}
      <input
        ref={referenceUploadRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleReferenceUpload(file)
        }}
      />

      {/* Brochure / Reference view toggle */}
      <div
        className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-0.5 shadow-card"
        title={referencePdfMeta ? 'Switch between brochure and reference paper' : 'Upload a reference PDF first'}
      >
        <button
          className={`text-[10px] font-medium px-2 py-1 rounded transition-colors ${
            activeView === 'brochure'
              ? 'bg-brand-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setActiveView('brochure')}
        >
          📘 Brochure
        </button>
        <button
          className={`text-[10px] font-medium px-2 py-1 rounded transition-colors ${
            activeView === 'reference'
              ? 'bg-brand-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setActiveView('reference')}
          disabled={!referencePdfMeta}
          style={!referencePdfMeta ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
        >
          📚 Reference
        </button>
      </div>

      {/* Undo / Redo */}
      <div className="toolbar-group">
        <button className="btn-icon" onClick={undo} disabled={!hasPast} title="Undo (Ctrl+Z)">
          ↩
        </button>
        <button className="btn-icon" onClick={redo} disabled={!hasFuture} title="Redo (Ctrl+Shift+Z)">
          ↪
        </button>
      </div>

      <div className="h-6 w-px bg-gray-200" />

      {/* Zoom */}
      <div className="toolbar-group">
        <button
          className="btn-icon text-xs"
          onClick={() => setZoom(zoom - ZOOM_STEP)}
          disabled={zoom <= MIN_ZOOM}
          title="Zoom Out"
        >
          −
        </button>
        <span className="w-12 text-center text-xs font-medium text-gray-600 select-none">
          {Math.round(zoom * 100)}%
        </span>
        <button
          className="btn-icon text-xs"
          onClick={() => setZoom(zoom + ZOOM_STEP)}
          disabled={zoom >= MAX_ZOOM}
          title="Zoom In"
        >
          +
        </button>
        <div className="h-4 w-px bg-gray-200 mx-0.5" />
        <button
          className="btn-icon text-xs"
          onClick={() => fitWidthFn?.()}
          disabled={!fitWidthFn}
          title="Fit Width"
        >
          ↕
        </button>
        <button
          className="btn-icon text-xs"
          onClick={() => fitPageFn?.()}
          disabled={!fitPageFn}
          title="Fit Page"
        >
          ⊞
        </button>
      </div>

      <div className="h-6 w-px bg-gray-200" />

      {/* Annotation Tools */}
      <div className="toolbar-group">
        {TOOLS.map((tool) => (
          <button
            key={tool}
            className={currentTool === tool ? 'btn-ghost-active' : 'btn-icon'}
            onClick={() => setCurrentTool(tool)}
            title={TOOL_NAMES[tool]}
          >
            <span className="text-sm">{TOOL_ICONS[tool]}</span>
          </button>
        ))}
      </div>

      <div className="flex-1" />

      {/* Search */}
      <div className="relative">
        <input
          className="w-40 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 pl-8 text-xs focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 transition-all duration-150"
          placeholder="Search annotations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <svg
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      </div>

      {/* Run Validation */}
      <button
        className="btn-primary text-xs !py-1.5"
        onClick={handleRunValidation}
        disabled={!pdfMeta}
        title={referencePdfMeta ? 'Run claim verification against reference' : 'Requires a reference PDF'}
      >
        🤖 Run Validation
      </button>

      <div className="h-6 w-px bg-gray-200" />

      {/* Export */}
      <div className="relative">
        <button
          className="btn-ghost text-xs !py-1.5"
          onClick={() => setShowExportMenu(!showExportMenu)}
          disabled={!pdfMeta}
          title="Export"
        >
          📥 Export
        </button>
        {showExportMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
            <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-xl border border-gray-200 bg-white py-1 shadow-card animate-fade-in">
              <button
                className="flex w-full items-center gap-2 px-4 py-2 text-xs text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  setShowExportMenu(false)
                  handleExport()
                }}
                disabled={annotations.length === 0}
              >
                <span>📋</span>
                <div className="text-left">
                  <p className="font-medium">Export JSON</p>
                  <p className="text-[10px] text-gray-400">Annotation data only</p>
                </div>
              </button>
              <button
                className="flex w-full items-center gap-2 px-4 py-2 text-xs text-gray-700 hover:bg-gray-50"
                onClick={handleExportPDF}
                disabled={annotations.length === 0}
              >
                <span>📄</span>
                <div className="text-left">
                  <p className="font-medium">Export PDF (Annotated)</p>
                  <p className="text-[10px] text-gray-400">Sticky-note popups with full details</p>
                </div>
              </button>
              <button
                className="flex w-full items-center gap-2 px-4 py-2 text-xs text-gray-700 hover:bg-gray-50"
                onClick={handleExportReferencePDF}
                disabled={!referencePdfMeta || !hasRefHighlights}
                title={
                  !referencePdfMeta
                    ? 'Upload a reference PDF first'
                    : !hasRefHighlights
                    ? 'Run validation and apply results to generate reference highlights'
                    : 'Download the research paper with evidence highlights'
                }
              >
                <span>📚</span>
                <div className="text-left">
                  <p className="font-medium">Download Annotated Research Paper</p>
                  <p className="text-[10px] text-gray-400">
                    {!referencePdfMeta
                      ? 'Requires an uploaded reference PDF'
                      : !hasRefHighlights
                      ? 'Run validation to generate evidence highlights'
                      : 'Evidence highlights + hover popups'}
                  </p>
                </div>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Import */}
      <button
        className="btn-ghost text-xs !py-1.5"
        onClick={() => importRef.current?.click()}
        title="Import annotations from JSON"
      >
        📤 Import
      </button>

      <button
        className={debugMode ? 'btn-ghost-active text-[10px]' : 'btn-icon text-[10px]'}
        onClick={() => setDebugMode(!debugMode)}
        title="Toggle Debug Mode"
      >
        🐛
      </button>

      <button
        className="btn-ghost text-xs !py-1.5"
        onClick={() => navigate('/brochure')}
        title="Generate a medical brochure from AI prompt"
      >
        🎨 Brochure Builder
      </button>

      {/* History / Audit log */}
      <button
        className="relative btn-ghost text-xs !py-1.5"
        onClick={() => navigate('/history')}
        title="View document history and audit log"
      >
        📜 History
        {exportHistory.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[9px] font-bold text-white">
            {exportHistory.length}
          </span>
        )}
      </button>

      <input
        ref={importRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImport}
      />
    </header>
  )
}
