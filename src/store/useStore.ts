import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuid } from 'uuid'
import type { Annotation, Tool, Severity, ValidationCategory, PdfMeta, ChatSession, ChatMessage, AuditEvent, ExportRecord, AuditAction, BrochureDesign, BrochureElement, BrochureElementType } from '../types'
import { extractTextFromPDF, verifyClaimsWithReference, claimResultsToAnnotations, extractTextItemsFromPDF, findRelevantReferenceChunks } from '../utils/ai'
import { verifyClaimAgainstReference } from '../utils/verify-claim'
import type { PageWithItems } from '../utils/ai'
import type { AIProvider } from '../utils/providers'
import { getProviderConfig, PROVIDER_IDS } from '../utils/providers'
import { generateBrochureFromPrompt, exportBrochurePDF } from '../utils/brochure-ai'
import { downloadPdfBytes, pdfBytesToDataUrl } from '../utils/export-pdf'
import {
  API_KEY,
  GROQ_API_KEY,
  GEMINI_API_KEY,
  NVIDIA_API_KEY,
  CEREBRAS_API_KEY,
  MISTRAL_API_KEY,
  TOGETHER_API_KEY,
} from '../key'

const CODE_KEYS: Record<AIProvider, string> = {
  openrouter: API_KEY,
  groq: GROQ_API_KEY,
  gemini: GEMINI_API_KEY,
  nvidia: NVIDIA_API_KEY,
  cerebras: CEREBRAS_API_KEY,
  mistral: MISTRAL_API_KEY,
  together: TOGETHER_API_KEY,
}

function defaultFontSize(type: BrochureElementType): number {
  switch (type) {
    case 'heading': return 28
    case 'subheading': return 18
    case 'callout': return 11
    case 'list-item': return 11
    case 'footer': return 8
    case 'image-placeholder': return 120
    case 'body': return 12
    default: return 12
  }
}

/** Strips live image data URLs from a design so localStorage never stores
 *  large base64 blobs (images are cached in IndexedDB instead). */
function stripBrochureImages(design: BrochureDesign): BrochureDesign {
  return {
    ...design,
    pages: design.pages.map((p) => ({
      ...p,
      elements: p.elements.map((el) => {
        if (el.type !== 'image-placeholder') return el
        const { imageSrc: _src, ...rest } = el
        return { ...rest, imageStatus: 'none' as const }
      }),
    })),
  }
}

interface PendingValidation {
  message: string
  severity: Severity
  category: ValidationCategory
}

interface DrawingState {
  isDrawing: boolean
  startX: number
  startY: number
  currentX: number
  currentY: number
}

interface AppState {
  /* --- PDF --- */
  pdfMeta: PdfMeta | null
  referencePdfMeta: PdfMeta | null
  numPages: number
  pageWidth: number
  pageHeight: number
  loading: boolean
  error: string | null

  /* --- Annotations --- */
  annotations: Annotation[]
  past: Annotation[][]
  future: Annotation[][]

  /* --- UI --- */
  zoom: number
  currentTool: Tool
  selectedAnnotationId: string | null
  hoveredAnnotationId: string | null
  scrollToPage: number | null
  searchQuery: string
  debugMode: boolean

  /* --- Reference viewer --- */
  activeView: 'brochure' | 'reference'
  scrollToReferencePage: number | null
  flashRefAnnotationId: string | null

  /* --- Dialogs --- */
  pendingValidation: PendingValidation | null
  showValidationDialog: boolean

  /* --- Drawing --- */
  drawing: DrawingState | null

  /* --- Actions PDF --- */
  setPdfMeta: (meta: PdfMeta | null) => void
  setReferencePdfMeta: (meta: PdfMeta | null) => void
  setNumPages: (n: number) => void
  setPageDimensions: (w: number, h: number) => void
  setLoading: (l: boolean) => void
  setError: (e: string | null) => void

  /* --- Actions Annotations --- */
  addAnnotation: (ann: Annotation) => void
  updateAnnotation: (id: string, partial: Partial<Annotation>) => void
  deleteAnnotation: (id: string) => void
  replaceAnnotations: (anns: Annotation[]) => void
  undo: () => void
  redo: () => void

  /* --- Actions UI --- */
  setZoom: (zoom: number) => void
  setCurrentTool: (tool: Tool) => void
  setSelectedAnnotationId: (id: string | null) => void
  setHoveredAnnotationId: (id: string | null) => void
  setScrollToPage: (n: number | null) => void
  setSearchQuery: (q: string) => void
  setDebugMode: (v: boolean) => void

  /* --- Actions Reference viewer --- */
  setActiveView: (v: 'brochure' | 'reference') => void
  setScrollToReferencePage: (n: number | null) => void
  setFlashRefAnnotationId: (id: string | null) => void
  gotoReferencePage: (page: number, annotationId?: string | null) => void

  /* --- Actions Dialogs --- */
  setPendingValidation: (v: PendingValidation | null) => void
  setShowValidationDialog: (v: boolean) => void

  /* --- Actions Drawing --- */
  setDrawing: (d: DrawingState | null) => void

  /* --- Fit (set by PDFViewer) --- */
  fitWidthFn: (() => void) | null
  fitPageFn: (() => void) | null
  setFitWidthFn: (fn: (() => void) | null) => void
  setFitPageFn: (fn: (() => void) | null) => void

  /* --- AI State --- */
  aiDialogOpen: boolean
  aiLoading: boolean
  aiProgress: { current: number; total: number }
  aiResult: Annotation[] | null
  aiError: string | null
  apiKeys: Record<AIProvider, string>
  aiProvider: AIProvider
  aiModel: string
  brochureItems: PageWithItems[] | null
  referenceItems: PageWithItems[] | null
  setAiDialogOpen: (v: boolean) => void
  setAiLoading: (v: boolean) => void
  setAiProgress: (p: { current: number; total: number }) => void
  setAiResult: (r: Annotation[] | null) => void
  setAiError: (e: string | null) => void
  setApiKey: (k: string) => void
  setAiProvider: (p: AIProvider) => void
  setAiModel: (m: string) => void
  runAiValidation: () => Promise<void>
  applyAiResults: () => void
  discardAiResults: () => void

  /* --- Actions General --- */
  clearAll: () => void

  /* --- Chat / Verify Claim --- */
  chatOpen: boolean
  chatSelectedText: string
  chatPage: number | null
  chatMessages: ChatMessage[]
  chatLoading: boolean
  chatSessionId: string | null
  chatVerifying: boolean
  referencePages: Array<{ page: number; text: string }> | null
  openChat: (text: string, page: number, sessionId?: string) => void
  closeChat: () => void
  sendChatMessage: (message: string) => Promise<void>
  verifySelectedClaim: () => Promise<void>
  setReferencePages: (pages: Array<{ page: number; text: string }> | null) => void

  /* --- Chat History --- */
  chatSessions: ChatSession[]
  deleteChatSession: (id: string) => void
  clearChatHistory: () => void

  /* --- Brochure Generator --- */
  brochurePrompt: string
  brochureDesign: BrochureDesign | null
  brochureLoading: boolean
  brochureError: string | null
  brochureTemplate: import('../types').BrochureTemplateId
  brochurePageCount: number
  setBrochurePrompt: (p: string) => void
  setBrochureTemplate: (t: import('../types').BrochureTemplateId) => void
  setBrochurePageCount: (n: number) => void
  generateBrochure: (prompt?: string) => Promise<void>
  updateBrochureElement: (pageNum: number, elementId: string, partial: Partial<BrochureElement>) => void
  deleteBrochureElement: (pageNum: number, elementId: string) => void
  addBrochureElement: (pageNum: number, element: Pick<BrochureElement, 'type' | 'text'>) => string | undefined
  addBrochurePage: () => void
  deleteBrochurePage: (pageNum: number) => void
  updateBrochureDesign: (partial: Partial<Pick<BrochureDesign, 'brandName' | 'tagline' | 'primaryColor' | 'secondaryColor' | 'accentColor' | 'footerText' | 'templateId'>>) => void
  exportBrochurePdf: () => Promise<void>
  resetBrochure: () => void

  /* --- Brochure image generation (Puter.js) --- */
  imageModel: string
  brochureImageLoading: boolean
  brochureImageProgress: { done: number; total: number }
  brochureImageError: string | null
  setImageModel: (m: string) => void
  generateBrochureImages: () => Promise<void>
  generateBrochureElementImage: (pageNum: number, elementId: string, promptOverride?: string) => Promise<void>
  hydrateBrochureImages: () => Promise<void>

  /* --- History / Audit log --- */
  auditLog: AuditEvent[]
  exportHistory: ExportRecord[]
  logAudit: (
    action: AuditAction,
    label: string,
    details?: Record<string, unknown>,
    severity?: AuditEvent['severity']
  ) => void
  addExportRecord: (record: ExportRecord) => void
  deleteExport: (id: string) => Promise<void>
  clearAuditLog: () => void
  clearExportHistory: () => Promise<void>
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      /* --- PDF --- */
      pdfMeta: null,
      referencePdfMeta: null,
      numPages: 0,
      pageWidth: 794,
      pageHeight: 1123,
      loading: false,
      error: null,

      /* --- Annotations --- */
      annotations: [],
      past: [],
      future: [],

      /* --- UI --- */
      zoom: 1.0,
      currentTool: 'pointer',
      selectedAnnotationId: null,
      hoveredAnnotationId: null,
      scrollToPage: null,
      searchQuery: '',
      debugMode: false,

      /* --- Reference viewer --- */
      activeView: 'brochure',
      scrollToReferencePage: null,
      flashRefAnnotationId: null,

      /* --- Dialogs --- */
      pendingValidation: null,
      showValidationDialog: false,

      /* --- Drawing --- */
      drawing: null,

      /* --- Fit --- */
      fitWidthFn: null,
      fitPageFn: null,

      /* --- AI --- */
      aiDialogOpen: false,
      aiLoading: false,
      aiProgress: { current: 0, total: 0 },
      aiResult: null,
      aiError: null,
      apiKeys: { ...CODE_KEYS },
      aiProvider: 'groq',
      aiModel: getProviderConfig('groq').defaultModel,
      brochureItems: null,
      referenceItems: null,

      /* --- Chat --- */
      chatOpen: false,
      chatSelectedText: '',
      chatPage: null,
      chatMessages: [],
      chatLoading: false,
      chatSessionId: null,
      chatVerifying: false,
      referencePages: null,
      chatSessions: [],

      /* --- Brochure Generator --- */
      brochurePrompt: '',
      brochureDesign: null,
      brochureLoading: false,
      brochureError: null,
      brochureTemplate: 'clinical-blue' as import('../types').BrochureTemplateId,
      brochurePageCount: 3,

      /* --- Brochure image generation (Puter.js) --- */
      imageModel: '',
      brochureImageLoading: false,
      brochureImageProgress: { done: 0, total: 0 },
      brochureImageError: null,

      /* --- History / Audit log --- */
      auditLog: [],
      exportHistory: [],

      /* --- PDF Actions --- */
      setPdfMeta: (meta) => set({ pdfMeta: meta, error: null }),
      setReferencePdfMeta: (meta) => set({ referencePdfMeta: meta, referencePages: null, error: null }),
      setNumPages: (n) => set({ numPages: n }),
      setPageDimensions: (w, h) => set({ pageWidth: w, pageHeight: h }),
      setLoading: (l) => set({ loading: l }),
      setError: (e) => set({ error: e }),

      /* --- Annotation Actions --- */
      addAnnotation: (ann) => {
        const state = get()
        set({
          past: [...state.past.slice(-50), state.annotations],
          future: [],
          annotations: [...state.annotations, ann],
          drawing: null,
        })
      },

      updateAnnotation: (id, partial) => {
        const state = get()
        const idx = state.annotations.findIndex((a) => a.id === id)
        if (idx === -1) return
        const updated = {
          ...state.annotations[idx],
          ...partial,
          updatedAt: new Date().toISOString(),
        }
        const next = [...state.annotations]
        next[idx] = updated
        set({
          past: [...state.past.slice(-50), state.annotations],
          future: [],
          annotations: next,
        })
      },

      deleteAnnotation: (id) => {
        const state = get()
        set({
          past: [...state.past.slice(-50), state.annotations],
          future: [],
          annotations: state.annotations.filter((a) => a.id !== id),
          selectedAnnotationId:
            state.selectedAnnotationId === id
              ? null
              : state.selectedAnnotationId,
        })
      },

      replaceAnnotations: (anns) => {
        const state = get()
        set({
          past: [...state.past.slice(-50), state.annotations],
          future: [],
          annotations: anns,
        })
      },

      undo: () => {
        const state = get()
        if (state.past.length === 0) return
        const prev = state.past[state.past.length - 1]
        set({
          past: state.past.slice(0, -1),
          future: [state.annotations, ...state.future],
          annotations: prev,
        })
      },

      redo: () => {
        const state = get()
        if (state.future.length === 0) return
        const next = state.future[0]
        set({
          past: [...state.past, state.annotations],
          future: state.future.slice(1),
          annotations: next,
        })
      },

      /* --- UI Actions --- */
      setDebugMode: (v) => set({ debugMode: v }),
      setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(4, zoom)) }),
      setCurrentTool: (tool) => {
        const state = get()
        set({
          currentTool: tool,
          selectedAnnotationId:
            tool === 'erase' ? state.selectedAnnotationId : null,
          drawing: null,
        })
      },
      setSelectedAnnotationId: (id) => set({ selectedAnnotationId: id }),
      setHoveredAnnotationId: (id) => set({ hoveredAnnotationId: id }),
      setScrollToPage: (n) => set({ scrollToPage: n }),
      setSearchQuery: (q) => set({ searchQuery: q }),

      /* --- Reference Viewer Actions --- */
      setActiveView: (v) => set({ activeView: v }),
      setScrollToReferencePage: (n) => set({ scrollToReferencePage: n }),
      setFlashRefAnnotationId: (id) => set({ flashRefAnnotationId: id }),
      gotoReferencePage: (page, annotationId) => {
        set({
          activeView: 'reference',
          scrollToReferencePage: page,
          flashRefAnnotationId: annotationId ?? null,
        })
      },

      /* --- Dialog Actions --- */
      setPendingValidation: (v) => set({ pendingValidation: v }),
      setShowValidationDialog: (v) => set({ showValidationDialog: v }),

      /* --- Drawing Actions --- */
      setDrawing: (d) => set({ drawing: d }),

      /* --- Fit Actions --- */
      setFitWidthFn: (fn) => set({ fitWidthFn: fn }),
      setFitPageFn: (fn) => set({ fitPageFn: fn }),

      /* --- AI Actions --- */
      setAiDialogOpen: (v) => set({ aiDialogOpen: v }),
      setAiLoading: (v) => set({ aiLoading: v }),
      setAiProgress: (p) => set({ aiProgress: p }),
      setAiResult: (r) => set({ aiResult: r }),
      setAiError: (e) => set({ aiError: e }),
      setApiKey: (k) => set((s) => ({ apiKeys: { ...s.apiKeys, [s.aiProvider]: k } })),
      setAiProvider: (p) => {
        const cfg = getProviderConfig(p)
        set({ aiProvider: p, aiModel: cfg.defaultModel })
      },
      setAiModel: (m) => set({ aiModel: m }),

      runAiValidation: async () => {
        const state = get()
        const meta = state.pdfMeta
        const refMeta = state.referencePdfMeta
        if (!meta) return

        // Claim verification requires both PDFs
        if (!refMeta) {
          set({
            aiDialogOpen: true,
            aiLoading: false,
            aiResult: [],
            aiError: 'Upload a reference/research paper PDF first to run claim verification',
            aiProgress: { current: 0, total: 0 },
          })
          return
        }

        const currentKey = get().apiKeys[get().aiProvider]
        if (!currentKey?.trim()) {
          set({
            aiDialogOpen: true,
            aiLoading: false,
            aiResult: [],
            aiError: `Enter your ${getProviderConfig(get().aiProvider).label} API key to run claim verification`,
            aiProgress: { current: 0, total: 0 },
          })
          return
        }

        set({
          aiLoading: true,
          aiDialogOpen: true,
          aiResult: null,
          aiError: null,
          aiProgress: { current: 0, total: 0 },
        })

        try {
          const { loadPdfBinary, PDF_KEYS } = await import('../utils/idb')
          const [brochureData, referenceData] = await Promise.all([
            loadPdfBinary(PDF_KEYS.brochure),
            loadPdfBinary(PDF_KEYS.reference),
          ])

          if (!brochureData || !referenceData) {
            set({
              aiLoading: false,
              aiResult: [],
              aiDialogOpen: false,
            })
            return
          }

          // Extract text from both PDFs
          const [brochurePages, referencePages, brochureItems, referenceItems] = await Promise.all([
            extractTextFromPDF(brochureData),
            extractTextFromPDF(referenceData),
            extractTextItemsFromPDF(brochureData),
            extractTextItemsFromPDF(referenceData),
          ])

          set({ aiProgress: { current: 0, total: brochurePages.length } })

          // Verify claims in brochure against reference
          const apiKeyToUse = get().apiKeys[get().aiProvider]
          const provider = getProviderConfig(get().aiProvider)
          const model = get().aiModel
          console.log('[VeriClaim] provider:', provider.label, '| model:', model, '| apiKey length:', apiKeyToUse?.length, '| empty:', !apiKeyToUse)
          const results = await verifyClaimsWithReference(
            brochurePages,
            referencePages,
            apiKeyToUse,
            provider,
            model,
            (current, total) => {
              set({ aiProgress: { current, total } })
            },
            brochureItems
          )

          // Convert to annotations with exact text positions
          const { pageWidth, pageHeight, zoom } = get()
          const annotations = claimResultsToAnnotations(results, pageWidth, pageHeight, zoom, brochureItems, referenceItems)

          set({
            aiResult: annotations,
            brochureItems,
            referenceItems,
            aiLoading: false,
            aiProgress: { current: 0, total: 0 },
          })
          get().logAudit(
            'validation_run',
            `Ran AI claim verification across ${brochurePages.length} page(s)`,
            { pages: brochurePages.length, claimsFound: results.length },
            'success'
          )
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Verification failed'
          set({
            aiLoading: false,
            aiResult: [],
            aiError: msg,
            aiProgress: { current: 0, total: 0 },
          })
        }
      },

      applyAiResults: () => {
        const state = get()
        const results = state.aiResult
        if (!results || results.length === 0) return
        const now = new Date().toISOString()
        const enriched = results.map((a) => ({
          ...a,
          createdAt: now,
          updatedAt: now,
        }))
        set({
          past: [...state.past.slice(-50), state.annotations],
          future: [],
          annotations: [...state.annotations, ...enriched],
          aiResult: null,
          aiDialogOpen: false,
        })
        get().logAudit(
          'validation_applied',
          `Applied ${results.length} validated claim(s) to the brochure`,
          { count: results.length },
          'success'
        )
      },

      discardAiResults: () => {
        set({ aiResult: null, aiError: null, aiDialogOpen: false })
      },

      /* --- Chat Actions --- */
      openChat: (text, page, sessionId) => {
        if (sessionId) {
          const session = get().chatSessions.find((s) => s.id === sessionId)
          if (session) {
            set({
              chatOpen: true,
              chatSelectedText: session.selectedText,
              chatPage: session.page,
              chatMessages: session.messages,
              chatSessionId: session.id,
              chatLoading: false,
              chatVerifying: false,
            })
            return
          }
        }
        set({
          chatOpen: true,
          chatSelectedText: text,
          chatPage: page,
          chatMessages: [],
          chatSessionId: null,
          chatLoading: false,
          chatVerifying: true,
        })
        // Auto-verify the selected claim against the research paper
        setTimeout(() => {
          get().verifySelectedClaim()
        }, 0)
      },

      setReferencePages: (pages) => set({ referencePages: pages }),

      verifySelectedClaim: async () => {
        const claim = get().chatSelectedText
        const setNotice = (notice: string) => {
          set((s) => ({
            chatVerifying: false,
            chatMessages: [
              ...s.chatMessages,
              { role: 'assistant' as const, content: notice },
            ],
          }))
        }

        if (!claim || !claim.trim()) {
          set({ chatVerifying: false })
          return
        }

        // Ensure the reference paper text is loaded and cached
        let refPages = get().referencePages
        if (!refPages) {
          if (!get().referencePdfMeta) {
            setNotice(
              'Verification needs a research paper to check against. Upload one from the toolbar (📚 Reference) and select the claim again.'
            )
            return
          }
          const { loadPdfBinary, PDF_KEYS } = await import('../utils/idb')
          const dataUrl = await loadPdfBinary(PDF_KEYS.reference)
          if (!dataUrl) {
            setNotice('The research paper could not be loaded. Please re-upload it and try again.')
            return
          }
          try {
            refPages = await extractTextFromPDF(dataUrl)
            set({ referencePages: refPages })
          } catch {
            setNotice('The research paper could not be read. Please re-upload it and try again.')
            return
          }
        }

        const key = get().apiKeys[get().aiProvider]
        if (!key || !key.trim()) {
          setNotice(
            `Enter your ${getProviderConfig(get().aiProvider).label} API key (in the AI settings) to verify claims.`
          )
          return
        }

        const provider = getProviderConfig(get().aiProvider)
        const model = get().aiModel
        set({ chatVerifying: true })

        try {
          const result = await verifyClaimAgainstReference(
            claim,
            refPages,
            provider,
            model,
            key,
            get().chatPage || 1
          )
          set((s) => ({
            chatVerifying: false,
            chatMessages: [
              ...s.chatMessages,
              {
                role: 'assistant',
                content: result.reason,
                verdict: result.verdict,
                evidence: result.evidence,
                referencePage: result.referencePage,
                isVerification: true,
              },
            ],
          }))
          get().logAudit(
            'claim_verified',
            `Verified a claim via chat: ${result.verdict}`,
            {
              verdict: result.verdict,
              claim: claim.substring(0, 120),
            },
            result.verdict === 'verified' ? 'success' : result.verdict === 'partial' ? 'warning' : 'error'
          )
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error'
          setNotice(`Verification failed: ${msg}`)
        }
      },

      closeChat: () => {
        const state = get()
        if (state.chatMessages.length > 1) {
          const now = new Date().toISOString()
          const existing = state.chatSessionId
            ? state.chatSessions.find((s) => s.id === state.chatSessionId)
            : undefined

          if (existing) {
            // Update existing session
            const updated = state.chatSessions.map((s) =>
              s.id === state.chatSessionId
                ? { ...s, messages: state.chatMessages, updatedAt: now }
                : s
            )
            set({
              chatSessions: updated,
              chatOpen: false,
              chatSelectedText: '',
              chatPage: null,
              chatMessages: [],
              chatSessionId: null,
              chatLoading: false,
            })
          } else {
            // New session
            const newSession: ChatSession = {
              id: uuid(),
              selectedText: state.chatSelectedText,
              page: state.chatPage || 1,
              messages: state.chatMessages,
              createdAt: now,
              updatedAt: now,
            }
            set({
              chatSessions: [newSession, ...state.chatSessions],
              chatOpen: false,
              chatSelectedText: '',
              chatPage: null,
              chatMessages: [],
              chatSessionId: null,
              chatLoading: false,
            })
          }
        } else {
          set({
            chatOpen: false,
            chatSelectedText: '',
            chatPage: null,
            chatMessages: [],
            chatSessionId: null,
            chatLoading: false,
          })
        }
      },

      sendChatMessage: async (message) => {
        const state = get()
        if (!message.trim() || !state.chatSelectedText) return

        const userMsg = { role: 'user' as const, content: message }
        set({
          chatMessages: [...state.chatMessages, userMsg],
          chatLoading: true,
        })

        try {
          const provider = getProviderConfig(get().aiProvider)
          const model = get().aiModel
          const response = await fetch(
            provider.baseUrl,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${state.apiKeys[get().aiProvider] || API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': window.location.origin,
                'X-Title': 'VeriClaim',
              },
              body: JSON.stringify({
                model,
                messages: [
                  {
                    role: 'system',
                    content: `You are a document verification assistant. The user has selected the following text from page ${state.chatPage} of a PDF document. Use it as context to answer their questions. Be concise, factual, and helpful.\n\nSelected text:\n"""\n${state.chatSelectedText}\n"""`,
                  },
                  ...get().chatMessages.map((m) => ({
                    role: m.role,
                    content: m.content,
                  })),
                  { role: 'user', content: message },
                ],
                temperature: 0.3,
                max_tokens: 1024,
              }),
            }
          )

          if (!response.ok) {
            throw new Error(`API error: ${response.status}`)
          }

          const data = await response.json()
          const reply = data.choices?.[0]?.message?.content || 'No response'

          set((s) => ({
            chatMessages: [...s.chatMessages, { role: 'assistant', content: reply }],
            chatLoading: false,
          }))
        } catch (err) {
          set((s) => ({
            chatMessages: [
              ...s.chatMessages,
              { role: 'assistant', content: 'Sorry, I encountered an error. Please check your API key and try again.' },
            ],
            chatLoading: false,
          }))
        }
      },

      /* --- Chat History Actions --- */
      deleteChatSession: (id) => {
        set((s) => ({
          chatSessions: s.chatSessions.filter((sess) => sess.id !== id),
        }))
      },

      clearChatHistory: () => {
        set({ chatSessions: [] })
      },

      /* --- Brochure Generator Actions --- */
      setBrochurePrompt: (p) => set({ brochurePrompt: p }),
      setBrochureTemplate: (t) => set({ brochureTemplate: t }),
      setBrochurePageCount: (n) => set({ brochurePageCount: Math.max(1, Math.min(6, n)) }),

      generateBrochure: async (prompt) => {
        const text = (prompt ?? '').trim() || get().brochurePrompt.trim()
        if (!text) {
          set({ brochureError: 'Please enter a prompt describing the brochure you want to create.' })
          return
        }

        const currentKey = get().apiKeys[get().aiProvider]
        if (!currentKey?.trim()) {
          set({
            brochureError: `Enter your ${getProviderConfig(get().aiProvider).label} API key to generate a brochure.`,
          })
          return
        }

        const provider = getProviderConfig(get().aiProvider)
        const model = get().aiModel

        // Free cached images for the current design before replacing it.
        const prevDesign = get().brochureDesign
        if (prevDesign) {
          import('../utils/idb').then(({ deleteBrochureImage, BROCHURE_IMAGE_KEY_PREFIX }) => {
            for (const page of prevDesign.pages) {
              for (const el of page.elements) {
                if (el.type === 'image-placeholder') {
                  deleteBrochureImage(BROCHURE_IMAGE_KEY_PREFIX + el.id).catch(() => {})
                }
              }
            }
          })
        }

        set({
          brochureLoading: true,
          brochureError: null,
          brochureDesign: null,
        })

        try {
          const design = await generateBrochureFromPrompt(text, {
            apiKey: currentKey,
            provider,
            model,
            templateId: get().brochureTemplate,
            pageCount: get().brochurePageCount,
            onProgress: (step) => {
              set({ brochurePrompt: text })
            },
          })

          set({
            brochureDesign: design,
            brochureLoading: false,
          })
          get().logAudit(
            'brochure_generated',
            `Generated a ${design.pages.length}-page brochure design from prompt`,
            { pages: design.pages.length, brandName: design.brandName },
            'success'
          )
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Failed to generate brochure'
          set({
            brochureError: msg,
            brochureLoading: false,
          })
        }
      },

      updateBrochureElement: (pageNum, elementId, partial) => {
        const state = get()
        const design = state.brochureDesign
        if (!design) return
        const pageIdx = design.pages.findIndex((p) => p.pageNumber === pageNum)
        if (pageIdx === -1) return
        const elementIdx = design.pages[pageIdx].elements.findIndex((e) => e.id === elementId)
        if (elementIdx === -1) return
        const newPages = [...design.pages]
        newPages[pageIdx] = {
          ...newPages[pageIdx],
          elements: [...newPages[pageIdx].elements],
        }
        newPages[pageIdx].elements[elementIdx] = {
          ...newPages[pageIdx].elements[elementIdx],
          ...partial,
        }
        set({
          brochureDesign: { ...design, pages: newPages, updatedAt: new Date().toISOString() },
        })
      },

      deleteBrochureElement: (pageNum, elementId) => {
        const state = get()
        const design = state.brochureDesign
        if (!design) return
        const pageIdx = design.pages.findIndex((p) => p.pageNumber === pageNum)
        if (pageIdx === -1) return
        const newPages = [...design.pages]
        newPages[pageIdx] = {
          ...newPages[pageIdx],
          elements: newPages[pageIdx].elements.filter((e) => e.id !== elementId),
        }
        set({
          brochureDesign: { ...design, pages: newPages, updatedAt: new Date().toISOString() },
        })
      },

      addBrochureElement: (pageNum, element) => {
        const state = get()
        const design = state.brochureDesign
        if (!design) return
        const newElement: BrochureElement = {
          id: uuid(),
          type: element.type,
          text: element.text,
          fontSize: defaultFontSize(element.type),
          fontWeight: 'normal',
          textAlign: 'left',
          marginTop: 8,
          marginBottom: 6,
          isClaim: false,
        }
        const pageIdx = design.pages.findIndex((p) => p.pageNumber === pageNum)
        if (pageIdx === -1) return
        const newPages = [...design.pages]
        newPages[pageIdx] = {
          ...newPages[pageIdx],
          elements: [...newPages[pageIdx].elements, newElement],
        }
        set({
          brochureDesign: { ...design, pages: newPages, updatedAt: new Date().toISOString() },
        })
        return newElement.id
      },

      addBrochurePage: () => {
        const design = get().brochureDesign
        if (!design || design.pages.length >= 6) return
        const nextNum = design.pages.length + 1
        const newPage = { pageNumber: nextNum, elements: [] as BrochureElement[] }
        set({
          brochureDesign: { ...design, pages: [...design.pages, newPage], pageCount: nextNum, updatedAt: new Date().toISOString() },
        })
      },

      deleteBrochurePage: (pageNum) => {
        const design = get().brochureDesign
        if (!design || design.pages.length <= 1) return
        const filtered = design.pages.filter((p) => p.pageNumber !== pageNum).map((p, i) => ({ ...p, pageNumber: i + 1 }))
        set({
          brochureDesign: { ...design, pages: filtered, pageCount: filtered.length, updatedAt: new Date().toISOString() },
        })
      },

      updateBrochureDesign: (partial) => {
        const state = get()
        const design = state.brochureDesign
        if (!design) return
        set({
          brochureDesign: { ...design, ...partial, updatedAt: new Date().toISOString() },
        })
      },

      exportBrochurePdf: async () => {
        const design = get().brochureDesign
        if (!design) return
        try {
          const bytes = await exportBrochurePDF(design)
          downloadPdfBytes(bytes, `medical-brochure-${design.brandName.replace(/\s+/g, '-')}-${Date.now()}.pdf`)
          get().logAudit(
            'brochure_pdf_exported',
            `Exported brochure PDF "${design.brandName}" (${design.pages.length} pages)`,
            { brandName: design.brandName, pages: design.pages.length, bytes: bytes.byteLength },
            'success'
          )
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Failed to export PDF'
          set({ brochureError: msg })
        }
      },

      resetBrochure: () => {
        const design = get().brochureDesign
        if (design) {
          // Free cached images in IndexedDB so orphaned blobs don't pile up.
          import('../utils/idb').then(({ deleteBrochureImage, BROCHURE_IMAGE_KEY_PREFIX }) => {
            for (const page of design.pages) {
              for (const el of page.elements) {
                if (el.type === 'image-placeholder') {
                  deleteBrochureImage(BROCHURE_IMAGE_KEY_PREFIX + el.id).catch(() => {})
                }
              }
            }
          })
        }
        set({
          brochurePrompt: '',
          brochureDesign: null,
          brochureLoading: false,
          brochureError: null,
          brochureImageLoading: false,
          brochureImageProgress: { done: 0, total: 0 },
          brochureImageError: null,
        })
      },

      /* --- Brochure image generation (Puter.js, free — users auth with their own Puter account) --- */

      setImageModel: (m) => set({ imageModel: m }),

      hydrateBrochureImages: async () => {
        const design = get().brochureDesign
        if (!design) return
        const { loadBrochureImage, BROCHURE_IMAGE_KEY_PREFIX } = await import('../utils/idb')
        for (const page of design.pages) {
          for (const el of page.elements) {
            if (el.type !== 'image-placeholder' || el.imageSrc) continue
            const cached = await loadBrochureImage(BROCHURE_IMAGE_KEY_PREFIX + el.id).catch(() => null)
            if (cached) {
              get().updateBrochureElement(page.pageNumber, el.id, {
                imageSrc: cached,
                imageStatus: 'ready',
              })
            }
          }
        }
      },

      generateBrochureElementImage: async (pageNum, elementId, promptOverride) => {
        const design = get().brochureDesign
        if (!design) return
        const page = design.pages.find((p) => p.pageNumber === pageNum)
        const el = page?.elements.find((e) => e.id === elementId)
        if (!el) return

        if (get().brochureImageLoading) return

        const { BROCHURE_IMAGE_KEY_PREFIX } = await import('../utils/idb')
        set({ brochureImageError: null })
        get().updateBrochureElement(pageNum, elementId, { imageStatus: 'loading' })

        try {
          const { generateImage, buildDefaultImagePrompt } = await import('../utils/image-gen')
          const prompt = promptOverride?.trim() || el.imagePrompt?.trim() || buildDefaultImagePrompt(el, design)
          const result = await generateImage(prompt, {
            model: get().imageModel,
            quality: 'low',
          })
          const { saveBrochureImage } = await import('../utils/idb')
          await saveBrochureImage(BROCHURE_IMAGE_KEY_PREFIX + elementId, result.dataUrl)
          get().updateBrochureElement(pageNum, elementId, {
            imageSrc: result.dataUrl,
            imageStatus: 'ready',
            imageModel: result.model,
          })
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Image generation failed'
          get().updateBrochureElement(pageNum, elementId, { imageStatus: 'error' })
          set({ brochureImageError: msg })
        }
      },

      generateBrochureImages: async () => {
        const design = get().brochureDesign
        if (!design) return
        const placeholders = design.pages
          .flatMap((p) => p.elements.map((e) => ({ page: p, el: e })))
          .filter(({ el }) => el.type === 'image-placeholder' && !el.imageSrc)
        if (placeholders.length === 0) return
        if (get().brochureImageLoading) return

        set({
          brochureImageLoading: true,
          brochureImageError: null,
          brochureImageProgress: { done: 0, total: placeholders.length },
        })

        const { generateImage, buildDefaultImagePrompt } = await import('../utils/image-gen')
        const { saveBrochureImage, BROCHURE_IMAGE_KEY_PREFIX } = await import('../utils/idb')
        const imageModel = get().imageModel

        try {
          for (let i = 0; i < placeholders.length; i++) {
            const { page, el } = placeholders[i]
            get().updateBrochureElement(page.pageNumber, el.id, { imageStatus: 'loading' })
            try {
              const prompt = el.imagePrompt?.trim() || buildDefaultImagePrompt(el, design)
              const result = await generateImage(prompt, { model: imageModel, quality: 'low' })
              await saveBrochureImage(BROCHURE_IMAGE_KEY_PREFIX + el.id, result.dataUrl)
              get().updateBrochureElement(page.pageNumber, el.id, {
                imageSrc: result.dataUrl,
                imageStatus: 'ready',
                imageModel: result.model,
              })
            } catch (err) {
              console.warn(`[Brochure] Image generation failed for element ${el.id}:`, err)
              get().updateBrochureElement(page.pageNumber, el.id, { imageStatus: 'error' })
              set({ brochureImageError: `Image ${i + 1} of ${placeholders.length} failed. Click its card to retry.` })
            }
            set({ brochureImageProgress: { done: i + 1, total: placeholders.length } })
          }
        } finally {
          set({ brochureImageLoading: false })
        }
      },

      /* --- History / Audit log Actions --- */
      logAudit: (action, label, details, severity = 'info') => {
        const event: AuditEvent = {
          id: uuid(),
          timestamp: new Date().toISOString(),
          action,
          label,
          details,
          severity,
        }
        set((s) => ({
          auditLog: [event, ...s.auditLog].slice(0, 300),
        }))
      },

      addExportRecord: (record) => {
        set((s) => ({
          exportHistory: [record, ...s.exportHistory].slice(0, 100),
        }))
      },

      deleteExport: async (id) => {
        const state = get()
        const record = state.exportHistory.find((r) => r.id === id)
        if (record) {
          try {
            const { deleteExportFile } = await import('../utils/idb')
            await deleteExportFile(record.fileId)
          } catch {}
        }
        set((s) => ({
          exportHistory: s.exportHistory.filter((r) => r.id !== id),
        }))
        get().logAudit('export_deleted', 'Deleted an exported document from history', { id }, 'warning')
      },

      clearAuditLog: () => {
        set({ auditLog: [] })
      },

      clearExportHistory: async () => {
        const state = get()
        try {
          const { deleteExportFile } = await import('../utils/idb')
          for (const r of state.exportHistory) {
            await deleteExportFile(r.fileId).catch(() => {})
          }
        } catch {}
        set({ exportHistory: [] })
      },

      /* --- General --- */
      clearAll: () => {
        // Clean up reference PDF from IndexedDB
        import('../utils/idb').then(({ deletePdfBinary, PDF_KEYS }) => {
          deletePdfBinary(PDF_KEYS.reference)
        })
        // Clean up cached generated brochure images
        const prevDesign = get().brochureDesign
        if (prevDesign) {
          import('../utils/idb').then(({ deleteBrochureImage, BROCHURE_IMAGE_KEY_PREFIX }) => {
            for (const page of prevDesign.pages) {
              for (const el of page.elements) {
                if (el.type === 'image-placeholder') {
                  deleteBrochureImage(BROCHURE_IMAGE_KEY_PREFIX + el.id).catch(() => {})
                }
              }
            }
          })
        }
        set({
          pdfMeta: null,
          referencePdfMeta: null,
          numPages: 0,
          pageWidth: 794,
          pageHeight: 1123,
          annotations: [],
          past: [],
          future: [],
          zoom: 1.0,
          currentTool: 'pointer',
          selectedAnnotationId: null,
          hoveredAnnotationId: null,
          scrollToPage: null,
      searchQuery: '',
      debugMode: false,
          pendingValidation: null,
          showValidationDialog: false,
          drawing: null,
          error: null,
          aiResult: null,
          aiError: null,
          aiDialogOpen: false,
          aiLoading: false,
          aiProgress: { current: 0, total: 0 },
          brochureItems: null,
          referenceItems: null,
          activeView: 'brochure',
          scrollToReferencePage: null,
          flashRefAnnotationId: null,
          chatOpen: false,
          chatSelectedText: '',
          chatPage: null,
          chatMessages: [],
          chatLoading: false,
          chatSessionId: null,
          chatSessions: [],
          brochurePrompt: '',
          brochureDesign: null,
          brochureLoading: false,
          brochureError: null,
          brochureImageLoading: false,
          brochureImageProgress: { done: 0, total: 0 },
          brochureImageError: null,
        })
        get().logAudit('clear_all', 'Cleared the entire document and annotations', {}, 'warning')
        },
    }),
    {
      name: 'pdf-annotator-store',
      partialize: (state) => ({
        pdfMeta: state.pdfMeta,
        referencePdfMeta: state.referencePdfMeta,
        numPages: state.numPages,
        pageWidth: state.pageWidth,
        pageHeight: state.pageHeight,
        annotations: state.annotations,
        past: state.past,
        future: state.future,
        zoom: state.zoom,
        currentTool: state.currentTool,
        searchQuery: state.searchQuery,
        chatSessions: state.chatSessions,
        brochureDesign: state.brochureDesign ? stripBrochureImages(state.brochureDesign) : null,
        brochureTemplate: state.brochureTemplate,
        brochurePageCount: state.brochurePageCount,
        imageModel: state.imageModel,
        apiKeys: state.apiKeys,
        aiProvider: state.aiProvider,
        aiModel: state.aiModel,
        auditLog: state.auditLog,
        exportHistory: state.exportHistory,
      }),
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<AppState>) }
        // Guard against stale/invalid persisted provider or model values
        const provider = merged.aiProvider as AIProvider
        if (!provider || !getProviderConfig(provider)) {
          merged.aiProvider = 'openrouter'
        }
        const cfg = getProviderConfig(merged.aiProvider as AIProvider)
        if (!merged.aiModel || !cfg.models.includes(merged.aiModel)) {
          merged.aiModel = cfg.defaultModel
        }
        // Per-provider API keys: always use the code-level keys as the base,
        // but keep any user-entered keys the user may have typed in-session.
        merged.apiKeys = { ...CODE_KEYS, ...(merged.apiKeys ?? {}) }
        for (const p of PROVIDER_IDS) {
          const k = merged.apiKeys[p]
          if (!k || k.length < 20) {
            merged.apiKeys[p] = CODE_KEYS[p]
          }
        }
        // Brochure template/pageCount guards
        const validTemplates = new Set(['modern-minimal','clinical-blue','vibrant-wellness','elegant-corporate','tri-fold'])
        if (!validTemplates.has(merged.brochureTemplate as string)) merged.brochureTemplate = 'clinical-blue' as any
        if (typeof merged.brochurePageCount !== 'number' || merged.brochurePageCount < 1 || merged.brochurePageCount > 6) merged.brochurePageCount = 3
        return merged
      },
    }
  )
)
