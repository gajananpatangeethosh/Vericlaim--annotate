import { useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useStore } from '../../store/useStore'
import type { BrochureElement, BrochureElementType } from '../../types'
import { BrochurePagePreview } from './BrochurePagePreview'
import { PROVIDERS } from '../../utils/providers'
import type { AIProvider } from '../../utils/providers'
import { IMAGE_GEN_MODELS, EDEN_IMAGE_MODELS, IMAGE_ENGINES, BROCHURE_TEMPLATES, BROCHURE_PAGE_OPTIONS, FONT_FAMILIES, TEXT_COLORS, BG_COLORS } from '../../utils/constants'
import type { BrochureTemplateId } from '../../types'

const EXAMPLE_PROMPTS = [
  'Create a one-page medical brochure for a diabetes management mobile app called GlucoTrack. Include key features: blood glucose tracking, medication reminders, carb counting, and integration with continuous glucose monitors. Mention clinical validation from a recent study showing 25% improvement in glycemic control. Include a medical disclaimer.',
  'Design a two-page medical brochure for a knee replacement surgery service. Cover the procedure overview, patient candidacy criteria, surgical technique, recovery timeline, and success rates from a recent clinical trial (96% patient satisfaction at 2-year follow-up). Use a professional blue and white color scheme.',
  'Create a medical brochure for a telehealth mental health platform called MindBridge. Include therapy session scheduling, licensed therapist directory, HIPAA compliance, crisis resources, and insurance coverage information. Use calming teal and gray colors.',
]

const BROCHURE_PROVIDERS: AIProvider[] = ['openrouter', 'vertex']

const ELEMENT_TYPE_LABELS: Record<BrochureElementType, string> = {
  heading: 'Heading',
  subheading: 'Subheading',
  body: 'Body',
  callout: 'Callout',
  'list-item': 'List Item',
  'image-placeholder': 'Image',
  footer: 'Footer',
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

/* ─── Small UI atoms ─────────────────────────────────────────── */

function Logomark({ className = 'h-8 w-8 text-sm' }: { className?: string }) {
  return (
    <div
      className={`flex ${className} items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 via-brand-600 to-indigo-600 font-black text-white shadow-lg shadow-brand-600/30`}
    >
      V
    </div>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between px-0.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
        {children}
      </span>
    </div>
  )
}

function PropRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      {children}
    </div>
  )
}

function SubSectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 mt-1 border-t border-slate-100 pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 first:border-t-0 first:pt-0 first:mt-0">
      {children}
    </div>
  )
}

export default function BrochureGenerator() {
  const brochurePrompt = useStore((s) => s.brochurePrompt)
  const brochureDesign = useStore((s) => s.brochureDesign)
  const brochureLoading = useStore((s) => s.brochureLoading)
  const brochureError = useStore((s) => s.brochureError)
  const setBrochurePrompt = useStore((s) => s.setBrochurePrompt)
  const generateBrochure = useStore((s) => s.generateBrochure)
  const resetBrochure = useStore((s) => s.resetBrochure)
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
  const imageEngine = useStore((s) => s.imageEngine)
  const edenImageApiKey = useStore((s) => s.edenImageApiKey)
  const setImageEngine = useStore((s) => s.setImageEngine)
  const setImageModel = useStore((s) => s.setImageModel)
  const setEdenImageApiKey = useStore((s) => s.setEdenImageApiKey)
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

  const hasApiKey = !!apiKey?.trim()
  const apiError = brochureError?.toLowerCase().includes('api key')

  /* ─── No design / loading ─── */
  if (!brochureDesign) {
    return (
      <div className="relative min-h-screen overflow-x-hidden bg-[#f6f7fb]">
        {/* Ambient decorative blobs */}
        <div className="pointer-events-none absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-brand-200/50 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 top-1/4 h-[26rem] w-[26rem] rounded-full bg-indigo-200/50 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 left-1/3 h-[24rem] w-[24rem] rounded-full bg-sky-100/60 blur-3xl" />

        <nav className="sticky top-0 z-20 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
            <Link to="/" className="flex items-center gap-2.5">
              <Logomark />
              <span className="text-sm font-bold tracking-tight text-slate-900">
                VeroGen
              </span>
              <span className="mt-0.5 hidden rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-600 sm:inline">
                Brochure Builder
              </span>
            </Link>
            <Link to="/app" className="btn-ghost text-xs">
              ← Back to Annotator
            </Link>
          </div>
        </nav>

        <main className="relative mx-auto max-w-3xl px-4 py-12">
          {/* Hero */}
          <div className="mb-10 text-center">
            <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-brand-100 bg-gradient-to-r from-brand-50 to-indigo-50 px-3.5 py-1.5 text-[11px] font-semibold text-brand-700 shadow-sm">
              ✨ AI-powered medical design studio
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
              Brochures that{' '}
              <span className="bg-gradient-to-r from-brand-600 to-indigo-500 bg-clip-text text-transparent">
                build trust
              </span>
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-500">
              Describe your medical product, service, or topic and VeroGen will design a
              professionally branded, multi-page brochure — complete with claims flagged
              for verification.
            </p>
          </div>

          {brochureLoading && (
            <div className="mb-6 rounded-2xl border border-slate-200/70 bg-white/80 p-8 text-center shadow-xl shadow-slate-900/5 backdrop-blur-xl">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-500 shadow-lg shadow-brand-600/30">
                <svg className="h-7 w-7 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-700">The AI is designing your medical brochure…</p>
              <p className="mt-1.5 text-xs text-slate-400">Writing structure, claims, and layout for you</p>
            </div>
          )}

          {brochureError && !brochureLoading && (
            <div
              className={`mb-6 flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm ${
                apiError
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              <span className="mt-0.5">{apiError ? '🔑' : '⚠️'}</span>
              <p className="leading-relaxed">{brochureError}</p>
            </div>
          )}

          {!brochureLoading && (
            <div className="space-y-6">
              {/* Prompt card */}
              <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-xl shadow-slate-900/5">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    💡 Describe your medical brochure
                  </label>
                  <span className="text-[10px] text-slate-400">{promptText.trim().length} chars</span>
                </div>
                <textarea
                  ref={promptRef}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition-all focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
                  placeholder="E.g. Create a medical brochure for a new MRI scanning center..."
                  rows={4}
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                />
                <p className="mt-2 text-[11px] text-slate-400">
                  Be specific: name, product, audience, tone, and any clinical evidence to highlight.
                </p>
              </div>

              {/* Page count */}
              <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-xl shadow-slate-900/5">
                <div className="mb-3 flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500">📄 Number of pages</label>
                  <span className="rounded-full bg-gradient-to-r from-brand-500 to-indigo-500 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                    {brochurePageCount} page{brochurePageCount > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
                  {BROCHURE_PAGE_OPTIONS.map((n) => (
                    <button
                      key={n}
                      onClick={() => setBrochurePageCount(n)}
                      className={`flex-1 rounded-lg py-2 text-sm font-bold transition-all ${
                        brochurePageCount === n
                          ? 'bg-white text-brand-600 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="mt-2.5 text-[11px] leading-relaxed text-slate-400">
                  {brochurePageCount === 1 && 'Single-page flyer — dense, scannable.'}
                  {brochurePageCount === 2 && 'Cover + details — concise 2-pager.'}
                  {brochurePageCount === 3 && 'Classic 3-page — cover, benefits, contact.'}
                  {brochurePageCount === 4 && 'Standard 4-page — cover, benefits, how it works, contact.'}
                  {brochurePageCount === 5 && 'Extended 5-page — adds evidence/outcomes.'}
                  {brochurePageCount === 6 && 'Comprehensive 6-page — full booklet.'}
                </p>
              </div>

              {/* Template */}
              <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-xl shadow-slate-900/5">
                <label className="mb-3 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  🎨 Design template
                </label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {BROCHURE_TEMPLATES.map((tmpl) => {
                    const selected = brochureTemplate === tmpl.id
                    return (
                      <button
                        key={tmpl.id}
                        onClick={() => setBrochureTemplate(tmpl.id as BrochureTemplateId)}
                        className={`group relative overflow-hidden rounded-2xl border-2 p-3 text-left transition-all ${
                          selected
                            ? 'border-brand-500 bg-brand-50/50 shadow-lg shadow-brand-600/10'
                            : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg hover:shadow-slate-900/5'
                        }`}
                      >
                        {/* Mini palette preview */}
                        <div className="mb-3 flex h-12 overflow-hidden rounded-lg border border-slate-100">
                          <div className="flex-1" style={{ backgroundColor: tmpl.palette.primary }} />
                          <div className="flex-1" style={{ backgroundColor: tmpl.palette.secondary }} />
                          <div className="flex-1" style={{ backgroundColor: tmpl.palette.accent }} />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px]">{tmpl.preview}</span>
                          <span className={`text-xs font-bold leading-tight ${selected ? 'text-brand-700' : 'text-slate-800'}`}>
                            {tmpl.label}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-slate-500">
                          {tmpl.description}
                        </p>
                        <div className="absolute right-2 top-2 flex gap-1">
                          <span
                            className="h-4 w-4 rounded-full border-2 border-white shadow-sm"
                            style={{ backgroundColor: tmpl.accent }}
                          />
                          {selected && (
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-indigo-500 text-[9px] font-black text-white shadow">
                              ✓
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
                <p className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-700">
                  <span className="flex items-center gap-1.5">🤖 Generation model</span>
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-brand-600">
                    {PROVIDERS[aiProvider].label}
                  </span>
                </p>
                <div className="mb-3 grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold text-slate-600">Provider</label>
                    <select
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/10"
                      value={aiProvider}
                      onChange={(e) => setAiProvider(e.target.value as AIProvider)}
                    >
                      {BROCHURE_PROVIDERS.map((id) => (
                        <option key={id} value={id}>
                          {PROVIDERS[id].label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold text-slate-600">Model</label>
                    <select
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/10"
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
                {!hasApiKey && (
                  <input
                    type="password"
                    className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-xs shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/10"
                    placeholder={`${PROVIDERS[aiProvider].label} API Key`}
                    value={apiKey || ''}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                )}
              </div>

              <button
                className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-brand-600 via-brand-500 to-indigo-500 px-6 py-4 text-sm font-black uppercase tracking-wider text-white shadow-xl shadow-brand-600/30 transition-all hover:shadow-2xl hover:shadow-brand-600/40 hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                onClick={handleGenerate}
                disabled={!promptText.trim() || brochureLoading}
              >
                <span className="relative z-10">🎨 Generate Medical Brochure</span>
              </button>

              <div className="pt-2">
                <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Example prompts — click to use one or write your own
                </p>
                <div className="flex flex-col gap-2.5">
                  {EXAMPLE_PROMPTS.map((p, i) => (
                    <button
                      key={i}
                      className="group rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-left text-xs leading-relaxed text-slate-500 shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:bg-white hover:text-slate-800 hover:shadow-lg hover:shadow-slate-900/5"
                      onClick={() => setPromptText(p)}
                    >
                      <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 group-hover:bg-brand-100 group-hover:text-brand-600">
                        {i + 1}
                      </span>
                      {p.substring(0, 120)}
                      {p.length > 120 && <span className="text-slate-300">…</span>}
                    </button>
                  ))}
                </div>
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
    <div className="flex h-screen flex-col overflow-hidden bg-[#f2f4f9]">
      {/* ─── Top Navigation ─── */}
      <nav className="z-30 flex items-center justify-between gap-3 border-b border-slate-200/60 bg-white/85 px-4 py-2 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <Logomark className="h-7 w-7 text-xs" />
            <span className="text-sm font-bold tracking-tight text-slate-900">VeroGen</span>
          </Link>
          <span className="hidden text-slate-300 md:inline">/</span>
          <span className="hidden min-w-0 items-center gap-2 md:flex">
            <span className="max-w-[180px] truncate text-sm font-semibold text-slate-700">
              {design.brandName}
            </span>
            <span className="hidden shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500 lg:inline-flex">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: design.accentColor }}
              />
              {BROCHURE_TEMPLATES.find((x) => x.id === (design as any).templateId)?.label}
            </span>
            {claimsCount > 0 && (
              <span className="shrink-0 badge bg-red-100 text-red-700">⚠ {claimsCount} claim{claimsCount > 1 ? 's' : ''}</span>
            )}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Image generation */}
          <div className="hidden items-center gap-1.5 xl:flex">
            <select
              className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] text-slate-600 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/10"
              value={imageEngine}
              onChange={(e) => setImageEngine(e.target.value as 'puter' | 'eden')}
              title="Image generation service"
              disabled={brochureImageLoading}
            >
              {IMAGE_ENGINES.map((eng) => (
                <option key={eng.id} value={eng.id}>
                  {eng.label}
                </option>
              ))}
            </select>
            <select
              className="w-40 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] text-slate-600 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/10"
              value={
                imageEngine === 'eden'
                  ? EDEN_IMAGE_MODELS.some((m) => m.id === imageModel)
                    ? imageModel
                    : EDEN_IMAGE_MODELS[0].id
                  : IMAGE_GEN_MODELS.some((m) => m.id === imageModel)
                    ? imageModel
                    : ''
              }
              onChange={(e) => setImageModel(e.target.value)}
              title="Image generation model"
              disabled={brochureImageLoading}
            >
              {(imageEngine === 'eden' ? EDEN_IMAGE_MODELS : IMAGE_GEN_MODELS).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            {imageEngine === 'eden' && (
              <input
                type="password"
                className="w-44 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] text-slate-600 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/10"
                placeholder="Eden AI API key"
                title="Eden AI API key (app.edenai.run/settings/api-keys)"
                value={edenImageApiKey}
                onChange={(e) => setEdenImageApiKey(e.target.value)}
              />
            )}
          </div>
          <button
            className="btn-ghost whitespace-nowrap rounded-lg border border-slate-200 bg-white text-xs shadow-sm"
            onClick={() => generateBrochureImages()}
            disabled={brochureImageLoading || allPlaceholderCount === 0}
            title="Generate images for all image placeholders"
          >
            {brochureImageLoading ? (
              <span className="inline-flex items-center gap-1.5">
                <svg className="h-3 w-3 animate-spin text-brand-500" viewBox="0 0 24 24" fill="none">
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
              className="hidden max-w-[180px] truncate rounded bg-red-50 px-2 py-1 text-[9px] font-medium text-red-600 lg:block"
              title={brochureImageError}
            >
              ⚠ {brochureImageError}
            </span>
          )}

          <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />

          <button
            className="btn-ghost hidden whitespace-nowrap text-xs sm:inline-flex"
            onClick={handleRegenerate}
            title="Back to prompt"
          >
            ← New Design
          </button>
          <button
            className="btn-ghost h-9 w-9 rounded-lg border border-slate-200 bg-white text-sm shadow-sm"
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
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-600 to-indigo-500 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-brand-600/30 transition-all hover:shadow-xl hover:shadow-brand-600/40 hover:brightness-105 active:scale-95 disabled:opacity-50 disabled:shadow-none"
            onClick={handleExport}
            disabled={exporting}
            title="Export brochure as PDF"
          >
            {exporting ? (
              <>
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Exporting…
              </>
            ) : (
              <>📄 Export PDF</>
            )}
          </button>
        </div>
      </nav>

      {brochureError && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-center text-xs font-medium text-red-700">
          {brochureError}
        </div>
      )}

      {/* ─── Main editor ─── */}
      <main className="flex min-h-0 flex-1 gap-4 p-4">
        {/* Left Panel — Editor */}
        <div className="flex w-[290px] shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 shadow-card backdrop-blur-xl">
          {/* Page Tabs */}
          <div className="border-b border-slate-100 bg-gradient-to-b from-white to-slate-50/60 px-3 pb-3 pt-3">
            <SectionLabel>Pages</SectionLabel>
            <div className="flex flex-wrap items-center gap-1.5">
              {design.pages.map((p) => (
                <span key={p.pageNumber} className="inline-flex items-center gap-0.5">
                  <button
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                      previewPage === p.pageNumber
                        ? 'bg-gradient-to-r from-brand-600 to-indigo-500 text-white shadow-md shadow-brand-600/30'
                        : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:text-slate-800 hover:ring-brand-200'
                    }`}
                    onClick={() => {
                      setPreviewPage(p.pageNumber)
                      setSelectedElementId(null)
                    }}
                  >
                    {p.pageNumber}
                  </button>
                  {design.pages.length > 1 && (
                    <button
                      className="rounded p-0.5 text-[10px] text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
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
                  className="rounded-lg border border-dashed border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-400 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600"
                  onClick={() => {
                    addBrochurePage()
                    setTimeout(() => setPreviewPage(design.pages.length + 1), 50)
                  }}
                >
                  + Add
                </button>
              )}
            </div>
          </div>

          {/* Properties / Page design panel */}
          <div className="min-h-0 flex-1 overflow-y-auto scroll-thin p-3">
            {selectedElement ? (
              <ElementProperties
                element={selectedElement}
                pageNum={currentPageData.pageNumber}
                onClose={() => setSelectedElementId(null)}
                onUpdate={(patch) => updateBrochureElement(currentPageData.pageNumber, selectedElement.id, patch)}
                onDelete={() => handleDeleteElement(currentPageData.pageNumber, selectedElement.id)}
                onDuplicate={() => {
                  const el = selectedElement
                  const id = addBrochureElement(currentPageData.pageNumber, { type: el.type, text: el.text })
                  if (id) {
                    updateBrochureElement(currentPageData.pageNumber, id, { ...el, id: undefined } as any)
                    setSelectedElementId(id)
                  }
                }}
                onGenerateImage={(prompt) => generateBrochureElementImage(currentPageData.pageNumber, selectedElement.id, prompt)}
              />
            ) : (
              <PageDesignPanel
                design={design}
                pageNum={currentPageData.pageNumber}
                setDesign={(d) => {
                  const pages = design.pages.map((pp) => (pp.pageNumber === currentPageData.pageNumber ? { ...pp, ...d } : pp))
                  useStore.setState({ brochureDesign: { ...design, pages, updatedAt: new Date().toISOString() } })
                }}
                setGlobal={(patch) => updateBrochureDesign(patch)}
              />
            )}
          </div>
        </div>

        {/* Right Panel — Preview + Properties */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* Preview canvas */}
          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto scroll-thin rounded-2xl border border-slate-200/70 bg-white/70 p-6 shadow-card backdrop-blur-xl [background-image:radial-gradient(circle,rgba(148,163,184,0.18)_1px,transparent_1px)] [background-size:16px_16px]">
            <div className="my-auto flex shrink-0 flex-col items-center gap-4">
              {currentPageData && (
                <BrochurePagePreview
                  page={currentPageData}
                  design={design}
                  selectedElementId={selectedElementId}
                  onSelectElement={setSelectedElementId}
                  onUpdateElement={(id, patch) => updateBrochureElement(currentPageData.pageNumber, id, patch)}
                />
              )}

              {/* Page navigation */}
              <div className="flex items-center gap-3 rounded-full border border-slate-200/70 bg-white/90 py-1.5 pl-1.5 pr-4 shadow-lg shadow-slate-900/5 backdrop-blur-xl">
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-slate-500 transition-all hover:bg-brand-100 hover:text-brand-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500"
                  onClick={() => setPreviewPage(Math.max(1, previewPage - 1))}
                  disabled={previewPage <= 1}
                  title="Previous page"
                >
                  ←
                </button>
                <div className="flex items-center gap-1.5">
                  {design.pages.map((p) => (
                    <button
                      key={p.pageNumber}
                      onClick={() => setPreviewPage(p.pageNumber)}
                      title={`Page ${p.pageNumber}`}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        p.pageNumber === previewPage
                          ? 'w-5 bg-gradient-to-r from-brand-500 to-indigo-500'
                          : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                      }`}
                    />
                  ))}
                </div>
                <span className="whitespace-nowrap text-[11px] font-semibold text-slate-400">
                  Page <span className="text-slate-700">{previewPage}</span> / {design.pages.length}
                </span>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-slate-500 transition-all hover:bg-brand-100 hover:text-brand-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500"
                  onClick={() => setPreviewPage(Math.min(design.pages.length, previewPage + 1))}
                  disabled={previewPage >= design.pages.length}
                  title="Next page"
                >
                  →
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

/* ═══ Element Properties Panel ═════════════════════════════════ */

function ElementProperties({
  element,
  pageNum,
  onClose,
  onUpdate,
  onDelete,
  onDuplicate,
  onGenerateImage,
}: {
  element: BrochureElement
  pageNum: number
  onClose: () => void
  onUpdate: (patch: Partial<BrochureElement>) => void
  onDelete: () => void
  onDuplicate: () => void
  onGenerateImage: (prompt: string | undefined) => void
}) {
  const isClaim = !!element.isClaim

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-indigo-500 text-[11px] font-black text-white shadow-md shadow-brand-600/20">
            {element.type === 'heading' ? 'H' : element.type === 'subheading' ? 'S' : element.type === 'body' ? 'T' : element.type === 'callout' ? '!' : element.type === 'list-item' ? '•' : element.type === 'image-placeholder' ? '🖼' : 'T'}
          </span>
          <span>
            <span className="block text-sm font-bold text-slate-800">
              {ELEMENT_TYPE_LABELS[element.type] || element.type}
            </span>
            <span className="block text-[10px] font-medium text-slate-400">Page {pageNum}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isClaim && (
            <span className="badge bg-red-100 text-red-700">
              <span className="mr-0.5">⚠</span> Claim
            </span>
          )}
          <button
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            onClick={onClose}
            title="Close"
          >
            ×
          </button>
        </div>
      </div>

      {/* Image section */}
      {element.type === 'image-placeholder' && (
        <div className="mb-4 overflow-hidden rounded-xl border border-slate-200/70">
          {element.imageSrc ? (
            <div className="relative h-32 overflow-hidden bg-slate-100">
              <img
                src={element.imageSrc}
                alt={element.imagePrompt || 'Generated image'}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="flex h-24 items-center justify-center bg-slate-50 text-[11px] font-medium text-slate-400">
              {element.imageStatus === 'loading' ? 'Generating…' : 'No image yet — generate or upload below'}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5 p-2">
            {element.imageStatus === 'loading' && (
              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-700">
                <svg className="h-2.5 w-2.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
                Generating…
              </span>
            )}
            {element.imageStatus === 'ready' && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700">✓ Ready</span>}
            {element.imageStatus === 'error' && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-medium text-red-700">⚠ Failed</span>}
            {!element.imageStatus || element.imageStatus === 'none' ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500">No image yet</span> : null}
            {element.imageModel && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[8px] text-slate-500">{element.imageModel}</span>}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="grid gap-3">
        <PropRow label="Content">
          {element.type === 'image-placeholder' ? (
            <textarea
              rows={2}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-800 focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/10"
              value={element.imagePrompt || ''}
              onChange={(e) => onUpdate({ imagePrompt: e.target.value } as any)}
              placeholder="Describe the illustration you want…"
            />
          ) : (
            <textarea
              rows={2}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-800 focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/10"
              value={element.text || ''}
              onChange={(e) => onUpdate({ text: e.target.value })}
              placeholder="Element text..."
            />
          )}
        </PropRow>

        {element.type === 'image-placeholder' && (
          <button
            className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-indigo-500 px-3 py-2 text-xs font-bold text-white shadow-md shadow-brand-600/20 transition-all hover:shadow-lg hover:shadow-brand-600/30 hover:brightness-105 active:scale-[0.99] disabled:opacity-50 disabled:shadow-none"
            disabled={element.imageStatus === 'loading'}
            onClick={() => onGenerateImage(element.imagePrompt || undefined)}
          >
            {element.imageStatus === 'loading' ? 'Generating…' : element.imageSrc ? '↻ Regenerate Image' : '✨ Generate Image'}
          </button>
        )}

        {/* Typography */}
        <div>
          <SubSectionTitle>Typography</SubSectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <PropRow label="Font">
              <select
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs shadow-sm focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/10"
                value={element.fontFamily || 'sans'}
                onChange={(e) => onUpdate({ fontFamily: e.target.value })}
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </PropRow>
            <PropRow label="Size">
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={8}
                  max={48}
                  value={element.fontSize || 12}
                  onChange={(e) => onUpdate({ fontSize: parseInt(e.target.value) })}
                  className="w-full accent-brand-600"
                />
                <span className="w-7 shrink-0 rounded bg-slate-100 py-0.5 text-center text-[10px] font-bold text-slate-600">
                  {element.fontSize || 12}
                </span>
              </div>
            </PropRow>
            <PropRow label="Line height">
              <div className="flex items-center gap-2">
                <input type="range" min={1} max={2.2} step={0.05} value={element.lineHeight || 1.4} onChange={(e) => onUpdate({ lineHeight: parseFloat(e.target.value) })} className="w-full accent-brand-600" />
                <span className="w-9 shrink-0 rounded bg-slate-100 py-0.5 text-center text-[10px] font-bold text-slate-600">{(element.lineHeight || 1.4).toFixed(2)}</span>
              </div>
            </PropRow>
            <PropRow label="Letter spacing">
              <div className="flex items-center gap-2">
                <input type="range" min={-2} max={6} step={0.1} value={element.letterSpacing || 0} onChange={(e) => onUpdate({ letterSpacing: parseFloat(e.target.value) })} className="w-full accent-brand-600" />
                <span className="w-9 shrink-0 rounded bg-slate-100 py-0.5 text-center text-[10px] font-bold text-slate-600">{element.letterSpacing || 0}</span>
              </div>
            </PropRow>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <PropRow label="Weight">
              <div className="flex gap-1">
                <button
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-bold transition-all ${element.fontWeight === 'bold' ? 'border-brand-400 bg-brand-50 text-brand-700 shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
                  onClick={() => onUpdate({ fontWeight: element.fontWeight === 'bold' ? 'normal' : 'bold' })}
                  title="Bold"
                >
                  B
                </button>
                <button
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs italic transition-all ${element.fontWeight === 'italic' ? 'border-brand-400 bg-brand-50 text-brand-700 shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
                  onClick={() => onUpdate({ fontWeight: element.fontWeight === 'italic' ? 'normal' : 'italic' })}
                  title="Italic"
                >
                  I
                </button>
              </div>
            </PropRow>
            <PropRow label="Align">
              <div className="flex gap-1">
                {TEXT_ALIGN_OPTIONS.map((a) => (
                  <button
                    key={a.value}
                    className={`flex-1 rounded-lg border px-1 py-1.5 text-[11px] transition-all ${element.textAlign === a.value ? 'border-brand-400 bg-brand-50 text-brand-700 shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
                    onClick={() => onUpdate({ textAlign: a.value as any })}
                  >
                    {a.value === 'left' ? '⟵' : a.value === 'center' ? '≡' : '⟶'}
                  </button>
                ))}
              </div>
            </PropRow>
            <PropRow label="Transform">
              <select
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs shadow-sm focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/10"
                value={element.textTransform || 'none'}
                onChange={(e) => onUpdate({ textTransform: e.target.value as any })}
              >
                <option value="none">Aa — None</option>
                <option value="uppercase">AA — Uppercase</option>
                <option value="lowercase">aa — Lowercase</option>
                <option value="capitalize">Aa — Capitalize</option>
              </select>
            </PropRow>
            <PropRow label="Underline">
              <button
                className={`w-full rounded-lg border px-2 py-1.5 text-xs font-semibold transition-all ${element.underline ? 'border-brand-400 bg-brand-50 text-brand-700 shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
                onClick={() => onUpdate({ underline: !element.underline })}
              >
                {element.underline ? '✓ Underlined' : 'Not underlined'}
              </button>
            </PropRow>
          </div>
        </div>

        {/* Style */}
        <div>
          <SubSectionTitle>Style</SubSectionTitle>
          <div className="grid gap-3">
            <PropRow label="Text color">
              <div className="flex flex-wrap items-center gap-1.5">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`h-6 w-6 rounded-full border-2 shadow-sm transition-transform hover:scale-110 ${element.color === c ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-white'} ${c === '#ffffff' ? 'ring-1 ring-slate-200' : ''}`}
                    style={{ backgroundColor: c }}
                    onClick={() => onUpdate({ color: c })}
                  />
                ))}
                <label className="relative ml-1 h-6 w-6 cursor-pointer overflow-hidden rounded-full bg-gradient-to-br from-pink-400 via-purple-400 to-indigo-400 shadow-sm transition-transform hover:scale-110" title="Custom color">
                  <input type="color" value={element.color || '#0f172a'} onChange={(e) => onUpdate({ color: e.target.value })} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                </label>
              </div>
            </PropRow>
            <PropRow label="Background">
              <div className="flex flex-wrap items-center gap-1.5">
                {BG_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`h-6 w-6 rounded-full border-2 shadow-sm transition-transform hover:scale-110 ${element.backgroundColor === c ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-white'} ${c === '#ffffff' ? 'ring-1 ring-slate-200' : ''}`}
                    style={{ backgroundColor: c }}
                    onClick={() => onUpdate({ backgroundColor: c })}
                  />
                ))}
                <button
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
                  onClick={() => onUpdate({ backgroundColor: undefined })}
                >
                  Clear
                </button>
              </div>
            </PropRow>
            <div className="grid grid-cols-2 gap-3">
              <PropRow label="Opacity">
                <div className="flex items-center gap-2">
                  <input type="range" min={0.1} max={1} step={0.05} value={element.opacity ?? 1} onChange={(e) => onUpdate({ opacity: parseFloat(e.target.value) })} className="w-full accent-brand-600" />
                  <span className="w-9 shrink-0 rounded bg-slate-100 py-0.5 text-center text-[10px] font-bold text-slate-600">{Math.round((element.opacity ?? 1) * 100)}%</span>
                </div>
              </PropRow>
              <PropRow label="Radius">
                <div className="flex items-center gap-2">
                  <input type="range" min={0} max={20} value={element.borderRadius ?? (element.type === 'image-placeholder' ? 10 : 0)} onChange={(e) => onUpdate({ borderRadius: parseInt(e.target.value) })} className="w-full accent-brand-600" />
                  <span className="w-9 shrink-0 rounded bg-slate-100 py-0.5 text-center text-[10px] font-bold text-slate-600">{element.borderRadius ?? (element.type === 'image-placeholder' ? 10 : 0)}</span>
                </div>
              </PropRow>
            </div>
            <button
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${element.shadow ? 'border-brand-400 bg-brand-50 text-brand-700 shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
              onClick={() => onUpdate({ shadow: !element.shadow })}
            >
              {element.shadow ? '✓ Drop shadow — on' : 'Drop shadow — off'}
            </button>
          </div>
        </div>

        {/* Layout */}
        <div>
          <SubSectionTitle>Layout</SubSectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {element.x !== undefined && (
              <>
                <PropRow label="X">
                  <input
                    type="number"
                    value={Math.round(element.x)}
                    onChange={(e) => onUpdate({ x: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs shadow-sm focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/10"
                  />
                </PropRow>
                <PropRow label="Y">
                  <input
                    type="number"
                    value={Math.round(element.y || 0)}
                    onChange={(e) => onUpdate({ y: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs shadow-sm focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/10"
                  />
                </PropRow>
                <PropRow label="Width">
                  <input
                    type="number"
                    value={Math.round(element.width || 120)}
                    onChange={(e) => onUpdate({ width: parseInt(e.target.value) || 120 })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs shadow-sm focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/10"
                  />
                </PropRow>
              </>
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-600 transition-all hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
              onClick={() => onUpdate({ x: undefined, y: undefined, width: undefined, height: undefined })}
            >
              ↦ Free → Flow
            </button>
            <button
              className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-600 transition-all hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
              onClick={onDuplicate}
            >
              ⧉ Duplicate
            </button>
            <button
              className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-600 transition-all hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
              onClick={() => onUpdate({ rotation: ((element.rotation || 0) + 15) % 360 })}
            >
              ↻ Rotate {element.rotation ? `${element.rotation}°` : ''}
            </button>
            <button
              className="rounded-xl border border-red-200 bg-red-50 px-2 py-2 text-xs font-bold text-red-600 transition-all hover:bg-red-100 hover:shadow-sm"
              onClick={onDelete}
            >
              🗑 Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══ Page Design Panel ═══════════════════════════════════════ */

function PageDesignPanel({
  design,
  pageNum,
  setDesign,
  setGlobal,
}: {
  design: any
  pageNum: number
  setDesign: (partial: Record<string, any>) => void
  setGlobal: (patch: Record<string, string>) => void
}) {
  const glowingTemplates = BROCHURE_TEMPLATES.find((t) => t.id === design.templateId)
  return (
    <div className="animate-fade-in">
      <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-slate-600 to-slate-800 text-[11px] font-black text-white shadow-md">
            ◈
          </span>
          <span className="block text-sm font-bold text-slate-800">Page design</span>
        </div>
        <span className="badge bg-slate-100 text-slate-500">Page {pageNum}</span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-1 space-y-3">
          <PropRow label="Template">
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs shadow-sm focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/10"
              value={design.templateId}
              onChange={(e) => setGlobal({ templateId: e.target.value })}
            >
              {BROCHURE_TEMPLATES.map((tm) => (
                <option key={tm.id} value={tm.id}>{tm.label}</option>
              ))}
            </select>
          </PropRow>
          <PropRow label="Page background">
            <div className="flex flex-wrap items-center gap-1.5">
              {BG_COLORS.map((c) => (
                <button
                  key={c}
                  className={`h-6 w-6 rounded-full border-2 shadow-sm transition-transform hover:scale-110 ${design.pages?.find?.((p: any) => p.pageNumber === pageNum)?.backgroundColor === c ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-white'} ${c === '#ffffff' ? 'ring-1 ring-slate-200' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setDesign({ backgroundColor: c })}
                />
              ))}
              <button
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
                onClick={() => setDesign({ backgroundColor: undefined })}
              >
                Clear
              </button>
            </div>
          </PropRow>
        </div>

        <div className="col-span-2">
          <PropRow label="Brand palette">
            <div className="grid grid-cols-3 gap-2">
              {[
                ['Primary', design.primaryColor, (v: string) => setGlobal({ primaryColor: v })],
                ['Secondary', design.secondaryColor, (v: string) => setGlobal({ secondaryColor: v })],
                ['Accent', design.accentColor, (v: string) => setGlobal({ accentColor: v })],
              ].map(([label, value, onChange]) => (
                <label
                  key={label as string}
                  className="group cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:border-brand-300 hover:shadow-md"
                >
                  <input
                    type="color"
                    value={value as string}
                    onChange={(e) => (onChange as (v: string) => void)(e.target.value)}
                    className="block h-9 w-full cursor-pointer border-0 bg-transparent p-0"
                  />
                  <span className="block border-t border-slate-100 px-2 py-1 text-center text-[9px] font-bold uppercase tracking-wide text-slate-500 group-hover:text-brand-600">
                    {label as string}
                  </span>
                </label>
              ))}
            </div>
          </PropRow>
          {glowingTemplates && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200/60 bg-slate-50/70 px-3 py-2">
              <span className="text-sm">{glowingTemplates.preview}</span>
              <div className="flex gap-1">
                {glowingTemplates.swatches.map((c) => (
                  <span key={c} className="h-3 w-3 rounded-full border border-white shadow-sm" style={{ backgroundColor: c }} />
                ))}
              </div>
              <span className="text-[10px] text-slate-500">{glowingTemplates.label} — {glowingTemplates.description}</span>
            </div>
          )}
        </div>
      </div>

      <p className="mt-3 rounded-xl bg-gradient-to-r from-brand-50/80 to-indigo-50/60 px-3 py-2 text-[10px] leading-relaxed text-slate-500">
        💡 Tip: drag any text or image on the canvas to reposition. Use the corner handle to resize
        images. Select an element below to style it.
      </p>
    </div>
  )
}