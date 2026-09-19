import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router'
import { useStore } from '../../store/useStore'
import type { BrochureElement, BrochureElementType } from '../../types'
import { BrochurePagePreview } from './BrochurePagePreview'
import { PROVIDERS, PROVIDER_IDS } from '../../utils/providers'
import { IMAGE_GEN_MODELS, BROCHURE_TEMPLATES, BROCHURE_PAGE_OPTIONS, FONT_FAMILIES, TEXT_COLORS, BG_COLORS } from '../../utils/constants'
import type { BrochureTemplateId } from '../../types'

const EXAMPLE_PROMPTS = [
  'Create a one-page medical brochure for a diabetes management mobile app called GlucoTrack. Include key features: blood glucose tracking, medication reminders, carb counting, and integration with continuous glucose monitors. Mention clinical validation from a recent study showing 25% improvement in glycemic control. Include a medical disclaimer.',
  'Design a two-page medical brochure for a knee replacement surgery service. Cover the procedure overview, patient candidacy criteria, surgical technique, recovery timeline, and success rates from a recent clinical trial (96% patient satisfaction at 2-year follow-up). Use a professional blue and white color scheme.',
  'Create a medical brochure for a telehealth mental health platform called MindBridge. Include therapy session scheduling, licensed therapist directory, HIPAA compliance, crisis resources, and insurance coverage information. Use calming teal and gray colors.',
]

const ELEMENT_TYPE_LABELS: Record<BrochureElementType, string> = {
  heading: '📔 Heading',
  subheading: '🔤 Subheading',
  body: '📝 Body',
  callout: '💡 Callout',
  'list-item': '•  List Item',
  'image-placeholder': '🖼 Image Placeholder',
  footer: '🔖 Footer',
}

const ELEMENT_TYPES: BrochureElementType[] = [
  'heading',
  'subheading',
  'body',
  'callout',
  'list-item',
  'image-placeholder',
]

const FONT_WEIGHT_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'bold', label: 'Bold' },
  { value: 'semibold', label: 'Semibold' },
  { value: 'italic', label: 'Italic' },
]

const TEXT_ALIGN_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
]

export default function BrochureGenerator() {
  const brochurePrompt = useStore((s) => s.brochurePrompt)
  const brochureDesign = useStore((s) => s.brochureDesign)
  const brochureLoading = useStore((s) => s.brochureLoading)
  const brochureError = useStore((s) => s.brochureError)
  const setBrochurePrompt = useStore((s) => s.setBrochurePrompt)
  const generateBrochure = useStore((s) => s.generateBrochure)
  const resetBrochure = useStore((s) => s.resetBrochure)
  const exportBrochurePdf = useStore((s) => s.exportBrochurePdf)
  const updateBrochureElement = useStore((s) => s.updateBrochureElement)
  const deleteBrochureElement = useStore((s) => s.deleteBrochureElement)
  const addBrochureElement = useStore((s) => s.addBrochureElement)
  const apiKey = useStore((s) => s.apiKeys[s.aiProvider])
  const aiProvider = useStore((s) => s.aiProvider)
  const aiModel = useStore((s) => s.aiModel)
  const setApiKey = useStore((s) => s.setApiKey)
  const setAiProvider = useStore((s) => s.setAiProvider)
  const setAiModel = useStore((s) => s.setAiModel)
  const brochureTemplate = useStore((s) => s.brochureTemplate)
  const brochurePageCount = useStore((s) => s.brochurePageCount)
  const setBrochureTemplate = useStore((s) => s.setBrochureTemplate)
  const setBrochurePageCount = useStore((s) => s.setBrochurePageCount)
  const addBrochurePage = useStore((s) => s.addBrochurePage)
  const deleteBrochurePage = useStore((s) => s.deleteBrochurePage)
  const updateBrochureDesign = useStore((s) => s.updateBrochureDesign)
    const imageModel = useStore((s) => s.imageModel)
  const setImageModel = useStore((s) => s.setImageModel)
  const generateBrochureImages = useStore((s) => s.generateBrochureImages)
  const generateBrochureElementImage = useStore((s) => s.generateBrochureElementImage)
  const hydrateBrochureImages = useStore((s) => s.hydrateBrochureImages)
  const brochureImageLoading = useStore((s) => s.brochureImageLoading)
  const brochureImageProgress = useStore((s) => s.brochureImageProgress)
  const brochureImageError = useStore((s) => s.brochureImageError)

  const [promptText, setPromptText] = useState(brochurePrompt || '')
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [previewPage, setPreviewPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const promptRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setBrochurePrompt(promptText)
  }, [promptText, setBrochurePrompt])

  useEffect(() => {
    if (brochureDesign) {
      hydrateBrochureImages()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleGenerate = async () => {
    if (!promptText.trim()) {
      return
    }
    await generateBrochure(promptText)
  }

  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const { captureBrochurePdf } = await import('../../utils/brochure-capture')
      const savedBytes = await captureBrochurePdf(design)
      const bytes = new Uint8Array(savedBytes)
      // Download with deferred revokeObjectURL to avoid silent cancellation
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `brochure-${(design.brandName || 'export').replace(/[^a-zA-Z0-9]/g, '-')}.pdf`
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }, 1000)
    } catch (err) {
      useStore.setState({ brochureError: err instanceof Error ? err.message : 'Export failed' })
    } finally {
      setExporting(false)
    }
  }

  const handleRegenerate = () => {
    resetBrochure()
    setPromptText('')
    setSelectedElementId(null)
    setPreviewPage(1)
    setTimeout(() => promptRef.current?.focus(), 100)
  }

  const handleDeleteElement = (pageNum: number, elementId: string) => {
    if (window.confirm('Remove this element?')) {
      deleteBrochureElement(pageNum, elementId)
      setSelectedElementId(null)
    }
  }

  const handleAddElement = (pageNum: number, type: BrochureElementType, text: string) => {
    if (!text.trim()) return
    const id = addBrochureElement(pageNum, { type, text })
    if (id) setSelectedElementId(id)
  }

  const hasApiKey = !!apiKey?.trim()
  const apiError = brochureError?.toLowerCase().includes('api key')

  /* ─── No design / loading ─── */
  if (!brochureDesign) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="sticky top-0 z-20 border-b border-gray-200 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
                V
              </div>
              <span className="text-sm font-semibold">VeriClaim — Brochure Builder</span>
            </Link>
            <Link to="/app" className="btn-ghost text-xs">
              ← Back to Annotator
            </Link>
          </div>
        </nav>

        <main className="mx-auto max-w-3xl px-4 py-12">
          <div className="mb-8 text-center">
              <h1 className="text-3xl font-bold text-gray-900">VeroGen</h1>
              <p className="mt-2 text-sm font-medium text-gray-500">AI Medical Brochure Generator</p>
            <p className="mt-3 text-sm text-gray-600">
              Describe your medical product, service, or topic and the AI will design a
              professionally branded, multi-page medical brochure — complete with claims flagged
              for verification.
            </p>
          </div>

          {brochureLoading && (
            <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 text-center">
              <svg className="mx-auto h-8 w-8 animate-spin text-brand-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <p className="mt-3 text-sm text-gray-600">The AI is designing your medical brochure…</p>
            </div>
          )}

          {brochureError && !brochureLoading && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-700">{brochureError}</p>
            </div>
          )}

          {!brochureLoading && (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">
                  Describe your medical brochure
                </label>
                <textarea
                  ref={promptRef}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                  placeholder="E.g. Create a medical brochure for a new MRI scanning center..."
                  rows={4}
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                />
              </div>

              {/* Page count */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-700">Number of pages</label>
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700">{brochurePageCount} page{brochurePageCount > 1 ? "s" : ""}</span>
                </div>
                <div className="flex gap-1.5">
                  {BROCHURE_PAGE_OPTIONS.map((n) => (
                    <button
                      key={n}
                      onClick={() => setBrochurePageCount(n)}
                      className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-all ${brochurePageCount === n ? "border-brand-600 bg-brand-600 text-white shadow" : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300 hover:bg-white"}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[10px] leading-relaxed text-gray-400">
                  {brochurePageCount === 1 && "Single-page flyer — dense, scannable."}
                  {brochurePageCount === 2 && "Cover + details — concise 2-pager."}
                  {brochurePageCount === 3 && "Classic 3-page — cover, benefits, contact."}
                  {brochurePageCount === 4 && "Standard 4-page — cover, benefits, how it works, contact."}
                  {brochurePageCount === 5 && "Extended 5-page — adds evidence/outcomes."}
                  {brochurePageCount === 6 && "Comprehensive 6-page — full booklet."}
                </p>
              </div>

              {/* Template */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <label className="mb-2 block text-xs font-semibold text-gray-700">Design template</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {BROCHURE_TEMPLATES.map((tmpl) => {
                    const selected = brochureTemplate === tmpl.id
                    return (
                      <button
                        key={tmpl.id}
                        onClick={() => setBrochureTemplate(tmpl.id as BrochureTemplateId)}
                        className={`group relative overflow-hidden rounded-xl border-2 p-3 text-left transition-all ${selected ? "border-brand-600 bg-brand-50/50 shadow-md" : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"}`}
                      >
                        <div className="mb-2 flex gap-1">
                          {tmpl.swatches.map((c) => (
                            <span key={c} className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: c }} />
                          ))}
                        </div>
                        <div className="mb-0.5 flex items-center gap-1.5">
                          <span className="text-[10px]">{tmpl.preview}</span>
                          <span className={`text-xs font-semibold leading-tight ${selected ? "text-brand-700" : "text-gray-800"}`}>{tmpl.label}</span>
                        </div>
                        <p className="line-clamp-2 text-[10px] leading-snug text-gray-500">{tmpl.description}</p>
                        {selected && <span className="absolute right-2 top-2 text-[10px] text-brand-600">✓</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              {!hasApiKey && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="mb-2 text-xs font-medium text-amber-800">AI Settings required</p>
                  <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                    <div>
                      <label className="block text-[10px] font-medium text-gray-600 mb-1">Provider</label>
                      <select
                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
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
                      <label className="block text-[10px] font-medium text-gray-600 mb-1">Model</label>
                      <select
                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
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
                  <input
                    type="password"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                    placeholder={`${PROVIDERS[aiProvider].label} API Key`}
                    value={apiKey || ''}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
              )}

              <button
                className="btn-primary w-full py-2.5 text-sm"
                onClick={handleGenerate}
                disabled={!promptText.trim() || brochureLoading}
              >
                🎨 Generate Medical Brochure
              </button>

              <p className="text-center text-[10px] text-gray-400">
                Example prompts below — click to use one or write your own
              </p>
              <div className="flex flex-col gap-2">
                {EXAMPLE_PROMPTS.map((p, i) => (
                  <button
                    key={i}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left text-xs text-gray-600 hover:bg-gray-50 hover:border-brand-300 transition-colors"
                    onClick={() => setPromptText(p)}
                  >
                    {p.substring(0, 120)}
                    {p.length > 120 && '…'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    )
  }

  /* ─── Design ready — editor view ─── */
  const design = brochureDesign
  const currentPageData = design.pages.find((p) => p.pageNumber === previewPage) || design.pages[0]
  const currentPageElements = currentPageData?.elements || []
  const selectedElement = currentPageElements.find((e) => e.id === selectedElementId)
  const claimsCount = currentPageElements.filter((e) => e.isClaim).length
  const allPlaceholderCount = design.pages.reduce(
    (n, p) => n + p.elements.filter((e) => e.type === 'image-placeholder').length,
    0
  )
  const imagesReadyCount = design.pages.reduce(
    (n, p) =>
      n + p.elements.filter((e) => e.type === 'image-placeholder' && !!e.imageSrc).length,
    0
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/40">
      <nav className="sticky top-0 z-20 border-b border-gray-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
                V
              </div>
              <span className="text-sm font-semibold">VeriClaim — Brochure Builder</span>
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-semibold text-gray-800">{design.brandName}</span>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full border bg-white px-2 py-0.5 text-[10px] font-medium text-gray-600">
              {BROCHURE_TEMPLATES.find((x) => x.id === (design as any).templateId)?.preview} {BROCHURE_TEMPLATES.find((x) => x.id === (design as any).templateId)?.label}
            </span>
            {claimsCount > 0 && (
              <span className="badge bg-red-100 text-red-700">
                {claimsCount} claim{claimsCount > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Image Generation */}
          <div className="flex items-center gap-2">
            <select
              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[10px] text-gray-700 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
              value={imageModel}
              onChange={(e) => setImageModel(e.target.value)}
              title="Image generation model"
              disabled={brochureImageLoading}
            >
              {IMAGE_GEN_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <button
              className="btn-primary text-xs whitespace-nowrap"
              onClick={() => generateBrochureImages()}
              disabled={brochureImageLoading || allPlaceholderCount === 0}
              title="Generate images for all image placeholders"
            >
              {brochureImageLoading ? (
                <span className="inline-flex items-center gap-1.5">
                  <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  {brochureImageProgress.done}/{brochureImageProgress.total}
                </span>
              ) : (
                <>
                  ✨ Generate Images
                  {allPlaceholderCount > 0 && ` (${imagesReadyCount}/${allPlaceholderCount})`}
                </>
              )}
            </button>
            {brochureImageError && (
              <span
                className="max-w-[180px] truncate rounded bg-red-50 px-2 py-1 text-[9px] font-medium text-red-600"
                title={brochureImageError}
              >
                ⚠ {brochureImageError}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              className="btn-ghost text-xs"
              onClick={handleRegenerate}
              title="Back to prompt"
            >
              ← New Design
            </button>
            <button
              className="btn-ghost text-xs"
              onClick={() => {
                const input = document.createElement('input')
                input.type = 'color'
                input.value = design.primaryColor
                input.oninput = (e) => {
                  useStore.getState().updateBrochureDesign({ primaryColor: (e.target as HTMLInputElement).value })
                }
                input.click()
              }}
              title="Change primary color"
            >
              🎨
            </button>
            <button
              className="btn-primary text-xs"
              onClick={handleExport}
              disabled={exporting}
              title="Export brochure as PDF"
            >
              {exporting ? '⏳ Exporting…' : '📄 Export PDF'}
            </button>
          </div>
        </div>
      </nav>

      {brochureError && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-center text-xs font-medium text-red-700">
          {brochureError}
        </div>
      )}

      <main className="flex h-[calc(100vh-57px)] gap-4 p-4">
        {/* Left Panel — Editor */}
        <div className="flex w-80 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white/80 p-3 shadow-sm backdrop-blur">
          {/* Page Tabs */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5 border-b border-gray-200 pb-2">
            {design.pages.map((p) => (
              <span key={p.pageNumber} className="inline-flex items-center gap-1">
                <button
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                    previewPage === p.pageNumber
                      ? 'bg-brand-600 text-white shadow'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
                  onClick={() => {
                    setPreviewPage(p.pageNumber)
                    setSelectedElementId(null)
                  }}
                >
                  Page {p.pageNumber}
                </button>
                {design.pages.length > 1 && (
                  <button
                    className="rounded p-0.5 text-[10px] text-gray-400 hover:bg-red-50 hover:text-red-600"
                    title="Delete page"
                    onClick={() => {
                      if (window.confirm(`Delete page ${p.pageNumber}?`)) {
                        deleteBrochurePage(p.pageNumber)
                        setPreviewPage(1)
                        setSelectedElementId(null)
                      }
                    }}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
            {design.pages.length < 6 && (
              <button
                className="rounded-lg border border-dashed border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-500 hover:border-brand-300 hover:text-brand-600"
                onClick={() => {
                  addBrochurePage()
                  setTimeout(() => setPreviewPage(design.pages.length + 1), 50)
                }}
              >
                + Page
              </button>
            )}
          </div>

          {/* Canva-like Tools */}
          <div className="mb-3 grid grid-cols-3 gap-1.5">
            {([
              ['heading', 'H', 'Heading'],
              ['subheading', 'S', 'Subhead'],
              ['body', 'T', 'Text'],
              ['callout', '!', 'Callout'],
              ['list-item', '•', 'Bullet'],
              ['image-placeholder', '🖼', 'Image'],
            ] as const).map(([type, icon, label]) => (
              <button
                key={type}
                className="flex flex-col items-center gap-0.5 rounded-lg border border-gray-200 bg-white px-2 py-2 text-[10px] font-medium text-gray-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                onClick={() => {
                  const id = addBrochureElement(currentPageData.pageNumber, { type: type as any, text: type === 'image-placeholder' ? 'New Image' : 'New ' + label })
                  if (id) setSelectedElementId(id)
                }}
              >
                <span className="text-sm leading-none">{icon}</span>
                {label}
              </button>
            ))}
          </div>
          <label className="mb-3 flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:border-brand-300 hover:text-brand-600">
            <span>📤 Upload image</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                const reader = new FileReader()
                reader.onload = () => {
                  const dataUrl = reader.result as string
                  const id = addBrochureElement(currentPageData.pageNumber, { type: 'image-placeholder', text: f.name.replace(/\.[^.]+$/, '') })
                  if (id) {
                    // set imageSrc directly after creation
                    setTimeout(() => updateBrochureElement(currentPageData.pageNumber, id, { imageSrc: dataUrl, imageStatus: 'ready', imagePrompt: f.name } as any), 50)
                    setSelectedElementId(id)
                  }
                }
                reader.readAsDataURL(f)
                e.target.value = ''
              }}
            />
          </label>

          {/* Layers */}
          <div className="flex-1 overflow-y-auto scroll-thin rounded-lg border border-gray-200 bg-white">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-2.5 py-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Layers • Page {currentPageData.pageNumber}</span>
              <span className="text-[10px] text-gray-400">{currentPageElements.length}</span>
            </div>
            {currentPageElements.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-xs text-gray-400">No layers yet</p>
                <p className="mt-1 text-[10px] text-gray-300">Add text or image above</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {currentPageElements.map((el, idx) => (
                  <div
                    key={el.id}
                    onClick={() => setSelectedElementId(el.id)}
                    className={`group flex items-center gap-2 px-2.5 py-2 text-xs hover:bg-gray-50 ${selectedElementId === el.id ? 'bg-brand-50' : ''}`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gray-100 text-[10px] text-gray-500">
                      {el.type === 'heading' ? 'H' : el.type === 'subheading' ? 'S' : el.type === 'image-placeholder' ? '🖼' : el.type === 'callout' ? '!' : el.type === 'list-item' ? '•' : 'T'}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11px] text-gray-700">{el.text?.slice(0, 28) || el.type}</span>
                    <button
                      className="hidden rounded p-0.5 text-[10px] text-gray-400 hover:bg-white hover:text-gray-700 group-hover:block"
                      title="Move up"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (idx === 0) return
                        const newEls = [...currentPageElements]
                        const tmp = newEls[idx - 1]
                        newEls[idx - 1] = newEls[idx]
                        newEls[idx] = tmp
                        // update order via store: replace page elements
                        const design = useStore.getState().brochureDesign
                        if (!design) return
                        const pages = design.pages.map((pp) => (pp.pageNumber === currentPageData.pageNumber ? { ...pp, elements: newEls } : pp))
                        useStore.getState().updateBrochureDesign({} as any)
                        // direct set via store
                        useStore.setState({ brochureDesign: { ...design, pages, updatedAt: new Date().toISOString() } })
                      }}
                    >
                      ↑
                    </button>
                    <button
                      className="hidden rounded p-0.5 text-[10px] text-gray-400 hover:bg-white hover:text-gray-700 group-hover:block"
                      title="Move down"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (idx === currentPageElements.length - 1) return
                        const newEls = [...currentPageElements]
                        const tmp = newEls[idx + 1]
                        newEls[idx + 1] = newEls[idx]
                        newEls[idx] = tmp
                        const design = useStore.getState().brochureDesign
                        if (!design) return
                        const pages = design.pages.map((pp) => (pp.pageNumber === currentPageData.pageNumber ? { ...pp, elements: newEls } : pp))
                        useStore.setState({ brochureDesign: { ...design, pages, updatedAt: new Date().toISOString() } })
                      }}
                    >
                      ↓
                    </button>
                    <button
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteElement(currentPageData.pageNumber, el.id)
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel — Preview */}
        <div className="flex flex-1 flex-col overflow-auto scroll-thin rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex justify-center">
            {currentPageData && (
              <BrochurePagePreview
                page={currentPageData}
                design={design}
                selectedElementId={selectedElementId}
                onSelectElement={setSelectedElementId}
                onUpdateElement={(id, patch) => updateBrochureElement(currentPageData.pageNumber, id, patch)}
              />
            )}
          </div>
          <div className="mt-4 flex justify-center gap-4">
            <button
              className="btn-ghost text-xs"
              onClick={() => setPreviewPage(Math.max(1, previewPage - 1))}
              disabled={previewPage <= 1}
              title="Previous page"
            >
              ← Prev
            </button>
            <span className="text-xs text-gray-500">
              Page {previewPage} of {design.pages.length}
            </span>
            <button
              className="btn-ghost text-xs"
              onClick={() => setPreviewPage(Math.min(design.pages.length, previewPage + 1))}
              disabled={previewPage >= design.pages.length}
              title="Next page"
            >
              Next →
            </button>
          </div>

          {selectedElement ? (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">Selected: {ELEMENT_TYPE_LABELS[selectedElement.type] || selectedElement.type}</span>
                <button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => setSelectedElementId(null)}>×</button>
              </div>
              <textarea
                className="mb-2 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs focus:border-brand-400 focus:outline-none"
                rows={2}
                value={selectedElement.text}
                onChange={(e) => updateBrochureElement(currentPageData.pageNumber, selectedElement.id, { text: e.target.value })}
                placeholder="Text content"
              />
              <div className="mb-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[9px] font-medium text-gray-500">Font</label>
                  <select
                    className="w-full rounded border border-gray-200 bg-white px-1.5 py-1 text-xs"
                    value={selectedElement.fontFamily || 'sans'}
                    onChange={(e) => updateBrochureElement(currentPageData.pageNumber, selectedElement.id, { fontFamily: e.target.value })}
                  >
                    {FONT_FAMILIES.map((f) => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[9px] font-medium text-gray-500">Size</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="range"
                      min={8}
                      max={48}
                      value={selectedElement.fontSize || 12}
                      onChange={(e) => updateBrochureElement(currentPageData.pageNumber, selectedElement.id, { fontSize: parseInt(e.target.value) })}
                      className="w-full"
                    />
                    <span className="w-8 text-right text-[10px] text-gray-500">{selectedElement.fontSize || 12}</span>
                  </div>
                </div>
              </div>
              <div className="mb-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[9px] font-medium text-gray-500">Letter spacing</label>
                  <input type="range" min={-2} max={6} step={0.1} value={selectedElement.letterSpacing || 0} onChange={(e) => updateBrochureElement(currentPageData.pageNumber, selectedElement.id, { letterSpacing: parseFloat(e.target.value) })} className="w-full" />
                  <span className="text-[9px] text-gray-400">{selectedElement.letterSpacing || 0}px</span>
                </div>
                <div>
                  <label className="mb-1 block text-[9px] font-medium text-gray-500">Line height</label>
                  <input type="range" min={1} max={2.2} step={0.05} value={selectedElement.lineHeight || 1.4} onChange={(e) => updateBrochureElement(currentPageData.pageNumber, selectedElement.id, { lineHeight: parseFloat(e.target.value) })} className="w-full" />
                  <span className="text-[9px] text-gray-400">{(selectedElement.lineHeight || 1.4).toFixed(2)}</span>
                </div>
              </div>
              <div className="mb-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[9px] font-medium text-gray-500">Opacity</label>
                  <input type="range" min={0.1} max={1} step={0.05} value={selectedElement.opacity ?? 1} onChange={(e) => updateBrochureElement(currentPageData.pageNumber, selectedElement.id, { opacity: parseFloat(e.target.value) })} className="w-full" />
                  <span className="text-[9px] text-gray-400">{Math.round((selectedElement.opacity ?? 1)*100)}%</span>
                </div>
                <div>
                  <label className="mb-1 block text-[9px] font-medium text-gray-500">Radius</label>
                  <input type="range" min={0} max={20} value={selectedElement.borderRadius ?? (selectedElement.type==='image-placeholder'?10:0)} onChange={(e) => updateBrochureElement(currentPageData.pageNumber, selectedElement.id, { borderRadius: parseInt(e.target.value) })} className="w-full" />
                  <span className="text-[9px] text-gray-400">{selectedElement.borderRadius ?? 0}px</span>
                </div>
              </div>
              <div className="mb-2">
                <label className="mb-1 block text-[9px] font-medium text-gray-500">Text color</label>
                <div className="flex flex-wrap gap-1">
                  {TEXT_COLORS.map((c) => (
                    <button key={c} className={`h-6 w-6 rounded-full border-2 ${selectedElement.color === c ? 'border-brand-600' : 'border-white'} shadow-sm`} style={{ backgroundColor: c }} onClick={() => updateBrochureElement(currentPageData.pageNumber, selectedElement.id, { color: c })} />
                  ))}
                  <input type="color" value={selectedElement.color || '#0f172a'} onChange={(e) => updateBrochureElement(currentPageData.pageNumber, selectedElement.id, { color: e.target.value })} className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0" />
                </div>
              </div>
              <div className="mb-2">
                <label className="mb-1 block text-[9px] font-medium text-gray-500">Background</label>
                <div className="flex flex-wrap gap-1">
                  {BG_COLORS.map((c) => (
                    <button key={c} className={`h-6 w-6 rounded-full border-2 ${selectedElement.backgroundColor === c ? 'border-brand-600' : 'border-white'} shadow-sm`} style={{ backgroundColor: c }} onClick={() => updateBrochureElement(currentPageData.pageNumber, selectedElement.id, { backgroundColor: c })} />
                  ))}
                  <button className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[9px] text-gray-600" onClick={() => updateBrochureElement(currentPageData.pageNumber, selectedElement.id, { backgroundColor: undefined })}>Clear</button>
                </div>
              </div>
              <label className="mb-2 flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={!!selectedElement.shadow} onChange={(e) => updateBrochureElement(currentPageData.pageNumber, selectedElement.id, { shadow: e.target.checked })} /> Shadow
                <input type="checkbox" checked={!!selectedElement.underline} onChange={(e) => updateBrochureElement(currentPageData.pageNumber, selectedElement.id, { underline: e.target.checked })} className="ml-2" /> Underline
                <select value={selectedElement.textTransform || 'none'} onChange={(e) => updateBrochureElement(currentPageData.pageNumber, selectedElement.id, { textTransform: e.target.value as any })} className="ml-auto rounded border border-gray-200 bg-white px-1 py-0.5 text-[10px]">
                  <option value="none">Aa</option>
                  <option value="uppercase">AA</option>
                  <option value="lowercase">aa</option>
                  <option value="capitalize">Aa</option>
                </select>
              </label>
              <div className="mb-2 flex gap-1">
                {(['left', 'center', 'right'] as const).map((a) => (
                  <button key={a} className={`flex-1 rounded border px-2 py-1 text-xs ${selectedElement.textAlign === a ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-600'}`} onClick={() => updateBrochureElement(currentPageData.pageNumber, selectedElement.id, { textAlign: a })}>
                    {a === 'left' ? '⟵' : a === 'center' ? '≡' : '⟶'} {a}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                <button className={`flex-1 rounded border px-2 py-1 text-xs ${selectedElement.fontWeight === 'bold' ? 'border-brand-600 bg-brand-50' : 'border-gray-200 bg-white'}`} onClick={() => updateBrochureElement(currentPageData.pageNumber, selectedElement.id, { fontWeight: selectedElement.fontWeight === 'bold' ? 'normal' : 'bold' })}>B</button>
                <button className={`flex-1 rounded border px-2 py-1 text-xs italic ${selectedElement.fontWeight === 'italic' ? 'border-brand-600 bg-brand-50' : 'border-gray-200 bg-white'}`} onClick={() => updateBrochureElement(currentPageData.pageNumber, selectedElement.id, { fontWeight: selectedElement.fontWeight === 'italic' ? 'normal' : 'italic' })}>I</button>
                <button className="flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600" onClick={() => updateBrochureElement(currentPageData.pageNumber, selectedElement.id, { x: undefined, y: undefined, width: undefined, height: undefined })}>Free → Flow</button>
                <button className="flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs" onClick={() => {
                  const el = selectedElement
                  const id = addBrochureElement(currentPageData.pageNumber, { type: el.type, text: el.text })
                  if (id) {
                    updateBrochureElement(currentPageData.pageNumber, id, { ...el, id: undefined } as any)
                    setSelectedElementId(id)
                  }
                }}>Duplicate</button>
              </div>
              {selectedElement.x !== undefined && (
                <div className="mt-2 grid grid-cols-3 gap-1">
                  <div><label className="text-[9px] text-gray-500">X</label><input type="number" value={Math.round(selectedElement.x)} onChange={(e) => updateBrochureElement(currentPageData.pageNumber, selectedElement.id, { x: parseInt(e.target.value)||0 })} className="w-full rounded border border-gray-200 px-1 py-0.5 text-xs" /></div>
                  <div><label className="text-[9px] text-gray-500">Y</label><input type="number" value={Math.round(selectedElement.y||0)} onChange={(e) => updateBrochureElement(currentPageData.pageNumber, selectedElement.id, { y: parseInt(e.target.value)||0 })} className="w-full rounded border border-gray-200 px-1 py-0.5 text-xs" /></div>
                  <div><label className="text-[9px] text-gray-500">W</label><input type="number" value={Math.round(selectedElement.width||120)} onChange={(e) => updateBrochureElement(currentPageData.pageNumber, selectedElement.id, { width: parseInt(e.target.value)||120 })} className="w-full rounded border border-gray-200 px-1 py-0.5 text-xs" /></div>
                </div>
              )}
              <div className="mt-2 flex gap-1">
                <button className="flex-1 rounded bg-red-50 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100" onClick={() => handleDeleteElement(currentPageData.pageNumber, selectedElement.id)}>Delete</button>
                <button className="flex-1 rounded bg-white px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50" onClick={() => updateBrochureElement(currentPageData.pageNumber, selectedElement.id, { rotation: ((selectedElement.rotation || 0) + 15) % 360 })}>↻ Rotate</button>
              </div>
              {selectedElement.type === 'image-placeholder' && (
                <label className="mt-2 flex cursor-pointer items-center justify-center gap-1 rounded border border-dashed border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-600 hover:border-brand-300">
                  Replace image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      const r = new FileReader()
                      r.onload = () => updateBrochureElement(currentPageData.pageNumber, selectedElement.id, { imageSrc: r.result as string, imageStatus: 'ready' } as any)
                      r.readAsDataURL(f)
                    }}
                  />
                </label>
              )}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3">
              <p className="mb-2 text-xs font-semibold text-gray-700">Page design</p>
              <label className="mb-1 block text-[9px] font-medium text-gray-500">Template</label>
              <select
                className="mb-2 w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-xs"
                value={(design as any).templateId}
                onChange={(e) => updateBrochureDesign({ templateId: e.target.value as any })}
              >
                {BROCHURE_TEMPLATES.map((tm) => (
                  <option key={tm.id} value={tm.id}>{tm.label}</option>
                ))}
              </select>
              <label className="mb-1 block text-[9px] font-medium text-gray-500">Page background</label>
              <div className="mb-2 flex flex-wrap gap-1">
                {BG_COLORS.map((c) => (
                  <button key={c} className="h-6 w-6 rounded-full border border-white shadow-sm" style={{ backgroundColor: c }} onClick={() => {
                    const pages = design.pages.map((pp) => pp.pageNumber === currentPageData.pageNumber ? { ...pp, backgroundColor: c } : pp)
                    useStore.setState({ brochureDesign: { ...design, pages, updatedAt: new Date().toISOString() } })
                  }} />
                ))}
                <button className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[9px]" onClick={() => {
                  const pages = design.pages.map((pp) => pp.pageNumber === currentPageData.pageNumber ? { ...pp, backgroundColor: undefined } as any : pp)
                  useStore.setState({ brochureDesign: { ...design, pages, updatedAt: new Date().toISOString() } })
                }}>Clear</button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <label className="flex flex-col gap-1 text-[9px] text-gray-500">Primary<input type="color" value={design.primaryColor} onChange={(e) => updateBrochureDesign({ primaryColor: e.target.value })} className="h-8 w-full cursor-pointer rounded border-0 p-0" /></label>
                <label className="flex flex-col gap-1 text-[9px] text-gray-500">Secondary<input type="color" value={design.secondaryColor} onChange={(e) => updateBrochureDesign({ secondaryColor: e.target.value })} className="h-8 w-full cursor-pointer rounded border-0 p-0" /></label>
                <label className="flex flex-col gap-1 text-[9px] text-gray-500">Accent<input type="color" value={design.accentColor} onChange={(e) => updateBrochureDesign({ accentColor: e.target.value })} className="h-8 w-full cursor-pointer rounded border-0 p-0" /></label>
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-gray-400">Tip: drag any text or image on the canvas to reposition. Use corner handle to resize images. Select an element to style it.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

/* ─── Element Card ─── */

function BrochureElementCard({
  element,
  isSelected,
  onSelect,
  onDelete,
  onUpdate,
}: {
  element: BrochureElement
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
  onUpdate: (partial: Partial<BrochureElement>) => void
}) {
  const generateBrochureElementImage = useStore((s) => s.generateBrochureElementImage)
  const [localText, setLocalText] = useState(element.text || '')
  const [localPrompt, setLocalPrompt] = useState(element.imagePrompt || '')
  const [isDirty, setIsDirty] = useState(false)
  const [isPromptDirty, setIsPromptDirty] = useState(false)

  useEffect(() => {
    setLocalText(element.text || '')
    setIsDirty(false)
  }, [element.text])

  useEffect(() => {
    setLocalPrompt(element.imagePrompt || '')
    setIsPromptDirty(false)
  }, [element.imagePrompt])

  const handleTextBlur = () => {
    if (isDirty && localText !== element.text) {
      onUpdate({ text: localText })
    }
    setIsDirty(false)
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalText(e.target.value)
    setIsDirty(true)
  }

  const typeLabel = ELEMENT_TYPE_LABELS[element.type] || element.type

  return (
    <div
      className={`rounded-lg border p-2.5 text-xs cursor-pointer transition-all ${
        isSelected
          ? 'border-brand-400 bg-brand-50/50 shadow-sm'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
      }`}
      onClick={onSelect}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-gray-600">{typeLabel}</span>
        {element.isClaim && (
          <span className="badge bg-red-100 text-red-700">
            ⚠ Claim
          </span>
        )}
      </div>

      {element.type === 'image-placeholder' ? (
        <>
          {element.imageSrc && (
            <div className="mb-2 overflow-hidden rounded border border-gray-200 bg-gray-50">
              <img
                src={element.imageSrc}
                alt={element.imagePrompt || 'Generated image'}
                className="h-24 w-full object-cover"
                loading="lazy"
              />
            </div>
          )}
          <div className="mb-2 flex items-center gap-1.5">
            {element.imageStatus === 'loading' && (
              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-700">
                <svg className="h-2.5 w-2.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
                Generating…
              </span>
            )}
            {element.imageStatus === 'ready' && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700">✓ Ready</span>}
            {element.imageStatus === 'error' && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-medium text-red-700">⚠ Failed</span>}
            {!element.imageStatus || element.imageStatus === 'none' ? <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] text-gray-500">No image yet</span> : null}
            {element.imageModel && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[8px] text-gray-500">{element.imageModel}</span>}
          </div>
          <label className="block text-[9px] font-medium text-gray-500 mb-0.5">Image prompt</label>
          <textarea
            className="mb-2 w-full rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-900 resize-y-none focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
            rows={2}
            value={localPrompt}
            onChange={(e) => { setLocalPrompt(e.target.value); setIsPromptDirty(true) }}
            onBlur={() => {
              if (isPromptDirty && localPrompt !== element.imagePrompt) onUpdate({ imagePrompt: localPrompt })
              setIsPromptDirty(false)
            }}
            onClick={(e) => e.stopPropagation()}
            placeholder="Describe the illustration you want…"
          />
          <button
            className="mb-2 w-full rounded bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            disabled={element.imageStatus === 'loading'}
            onClick={(e) => {
              e.stopPropagation()
              const store = useStore.getState() as any
              const pg = (store.brochureDesign?.pages.find((pp: any) => pp.elements.some((el: any) => el.id === element.id))?.pageNumber) || 1
              if (isPromptDirty && localPrompt !== element.imagePrompt) onUpdate({ imagePrompt: localPrompt })
              generateBrochureElementImage(pg, element.id, localPrompt || undefined)
            }}
          >
            {element.imageStatus === 'loading' ? 'Generating…' : element.imageSrc ? '↻ Regenerate Image' : '✨ Generate Image'}
          </button>
          <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[9px] font-medium text-gray-500 mb-0.5">Size</label>
          <input
            type="number"
            min={6}
            max={36}
            className="w-full rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs focus:border-brand-400 focus:outline-none"
            value={element.fontSize || 12}
            onChange={(e) => onUpdate({ fontSize: parseInt(e.target.value) || 12 })}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div>
          <label className="block text-[9px] font-medium text-gray-500 mb-0.5">Weight</label>
          <select
            className="w-full rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs focus:border-brand-400 focus:outline-none"
            value={element.fontWeight || 'normal'}
            onChange={(e) => onUpdate({ fontWeight: e.target.value as any })}
            onClick={(e) => e.stopPropagation()}
          >
            {FONT_WEIGHT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[9px] font-medium text-gray-500 mb-0.5">Align</label>
          <select
            className="w-full rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs focus:border-brand-400 focus:outline-none"
            value={element.textAlign || 'left'}
            onChange={(e) => onUpdate({ textAlign: e.target.value as any })}
            onClick={(e) => e.stopPropagation()}
          >
            {TEXT_ALIGN_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-1 text-[9px] text-gray-500">
            <input
              type="checkbox"
              className="h-3 w-3"
              checked={!!element.isClaim}
              onChange={(e) => onUpdate({ isClaim: e.target.checked })}
              onClick={(e) => e.stopPropagation()}
            />
            Claim
          </label>
        </div>
      </div>
        </>
      ) : (
        <>
          <textarea
            className="w-full rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-900 resize-y-none focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
            rows={2}
            value={localText}
            onChange={handleTextChange}
            onBlur={handleTextBlur}
            onClick={(e) => e.stopPropagation()}
            placeholder="Element text..."
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[9px] font-medium text-gray-500 mb-0.5">Size</label>
              <input
                type="number"
                min={6}
                max={36}
                className="w-full rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs focus:border-brand-400 focus:outline-none"
                value={element.fontSize || 12}
                onChange={(e) => onUpdate({ fontSize: parseInt(e.target.value) || 12 })}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div>
              <label className="block text-[9px] font-medium text-gray-500 mb-0.5">Weight</label>
              <select
                className="w-full rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs focus:border-brand-400 focus:outline-none"
                value={element.fontWeight || 'normal'}
                onChange={(e) => onUpdate({ fontWeight: e.target.value as any })}
                onClick={(e) => e.stopPropagation()}
              >
                {FONT_WEIGHT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-medium text-gray-500 mb-0.5">Align</label>
              <select
                className="w-full rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs focus:border-brand-400 focus:outline-none"
                value={element.textAlign || 'left'}
                onChange={(e) => onUpdate({ textAlign: e.target.value as any })}
                onClick={(e) => e.stopPropagation()}
              >
                {TEXT_ALIGN_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-1 text-[9px] text-gray-500">
                <input
                  type="checkbox"
                  className="h-3 w-3"
                  checked={!!element.isClaim}
                  onChange={(e) => onUpdate({ isClaim: e.target.checked })}
                  onClick={(e) => e.stopPropagation()}
                />
                Claim
              </label>
            </div>
          </div>
        </>
      )}

      <div className="mt-2 flex justify-end">
        <button
          className="text-[10px] text-red-600 hover:text-red-700"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          title="Delete element"
        >
          🗑
        </button>
      </div>
    </div>
  )
}

/* ─── Add Element Form ─── */

function AddElementForm({
  pageNum,
  onAdd,
}: {
  pageNum: number
  onAdd: (pageNum: number, type: BrochureElementType, text: string) => void
}) {
  const [type, setType] = useState<BrochureElementType>('body')
  const [text, setText] = useState('')

  const handleSubmit = () => {
    if (!text.trim()) return
    onAdd(pageNum, type, text)
    setText('')
  }

  return (
    <div className="border-t border-gray-200 p-3">
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <select
            className="rounded border border-gray-200 bg-white px-2 py-1 text-xs focus:border-brand-400 focus:outline-none"
            value={type}
            onChange={(e) => setType(e.target.value as BrochureElementType)}
          >
            {ELEMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {ELEMENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <input
            className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs focus:border-brand-400 focus:outline-none"
            placeholder="Element text..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleSubmit()
              }
            }}
          />
        </div>
        <button
          className="btn-ghost w-full text-xs"
          onClick={handleSubmit}
          disabled={!text.trim()}
        >
          + Add Element
        </button>
      </div>
    </div>
  )
}
