import { useRef, useState } from 'react'
import { useStore } from '../../store/useStore'
import { exportAnnotations, importAnnotations, generateFakeValidations } from '../../utils/pdf'
import { exportAnnotatedPDF } from '../../utils/export-pdf'
import { savePdfBinary } from '../../utils/idb'
import { readFileAsDataURL } from '../../utils/pdf'
import { TOOL_NAMES, MIN_ZOOM, MAX_ZOOM, ZOOM_STEP } from '../../utils/constants'
import type { Tool } from '../../types'

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
  const numPages = useStore((s) => s.numPages)
  const annotations = useStore((s) => s.annotations)
  const zoom = useStore((s) => s.zoom)
  const currentTool = useStore((s) => s.currentTool)
  const searchQuery = useStore((s) => s.searchQuery)
  const hasPast = useStore((s) => s.past.length > 0)
  const hasFuture = useStore((s) => s.future.length > 0)

  const setPdfMeta = useStore((s) => s.setPdfMeta)
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
  const [showExportMenu, setShowExportMenu] = useState(false)

  const handleExportPDF = async () => {
    setShowExportMenu(false)
    try {
      await exportAnnotatedPDF(annotations)
    } catch (err) {
      setError('Failed to export PDF: ' + (err as Error).message)
    }
  }

  const importRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const dataUrl = await readFileAsDataURL(file)
      await savePdfBinary(dataUrl)
      useStore.getState().clearAll()
      setPdfMeta({ name: file.name, totalSize: file.size })
    } catch {
      setError('Failed to load PDF')
    } finally {
      setLoading(false)
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
      } catch {
        setError('Invalid annotation file')
      }
    }
    reader.readAsText(file)
    importRef.current!.value = ''
  }

  const handleRunValidation = () => {
    if (!pdfMeta) return
    const apiKey = useStore.getState().apiKey
    if (apiKey) {
      useStore.getState().runAiValidation()
    } else {
      useStore.getState().setAiDialogOpen(true)
    }
  }

  return (
    <header className="flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-2 shadow-sm">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white text-sm font-bold">
          A
        </div>
        <span className="hidden text-sm font-semibold text-gray-800 sm:block">
          Annotate
        </span>
      </div>

      <div className="h-6 w-px bg-gray-200" />

      {/* Upload */}
      <button
        className="btn-primary text-xs !py-1.5"
        onClick={() => uploadRef.current?.click()}
        title="Upload PDF"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <span className="hidden sm:inline">Upload</span>
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
        title="Run AI validation simulation"
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
                  <p className="text-[10px] text-gray-400">Renders annotations onto the PDF</p>
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
