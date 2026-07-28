import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuid } from 'uuid'
import type { Annotation, Tool, Severity, ValidationCategory, PdfMeta, ChatSession } from '../types'
import { extractTextFromPDF, analyzeWithOpenRouter, resultsToAnnotations } from '../utils/ai'

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

  /* --- Dialogs --- */
  pendingValidation: PendingValidation | null
  showValidationDialog: boolean

  /* --- Drawing --- */
  drawing: DrawingState | null

  /* --- Actions PDF --- */
  setPdfMeta: (meta: PdfMeta | null) => void
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
  apiKey: string
  setAiDialogOpen: (v: boolean) => void
  setAiLoading: (v: boolean) => void
  setAiProgress: (p: { current: number; total: number }) => void
  setAiResult: (r: Annotation[] | null) => void
  setApiKey: (k: string) => void
  runAiValidation: () => Promise<void>
  applyAiResults: () => void
  discardAiResults: () => void

  /* --- Actions General --- */
  clearAll: () => void

  /* --- Chat / Verify Claim --- */
  chatOpen: boolean
  chatSelectedText: string
  chatPage: number | null
  chatMessages: Array<{ role: 'user' | 'assistant'; content: string }>
  chatLoading: boolean
  chatSessionId: string | null
  openChat: (text: string, page: number, sessionId?: string) => void
  closeChat: () => void
  sendChatMessage: (message: string) => Promise<void>

  /* --- Chat History --- */
  chatSessions: ChatSession[]
  deleteChatSession: (id: string) => void
  clearChatHistory: () => void
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      /* --- PDF --- */
      pdfMeta: null,
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
      apiKey: import.meta.env.VITE_OPENROUTER_API_KEY || '',

      /* --- Chat --- */
      chatOpen: false,
      chatSelectedText: '',
      chatPage: null,
      chatMessages: [],
      chatLoading: false,
      chatSessionId: null,
      chatSessions: [],

      /* --- PDF Actions --- */
      setPdfMeta: (meta) => set({ pdfMeta: meta, error: null }),
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
      setApiKey: (k) => set({ apiKey: k }),

      runAiValidation: async () => {
        const state = get()
        const meta = state.pdfMeta
        if (!meta) return

        set({
          aiLoading: true,
          aiDialogOpen: true,
          aiResult: null,
          aiProgress: { current: 0, total: 0 },
        })

        try {
          // Get PDF data URL from IndexedDB
          const { loadPdfBinary } = await import('../utils/idb')
          const pdfData = await loadPdfBinary()
          if (!pdfData) {
            set({ aiLoading: false, aiDialogOpen: false })
            return
          }

          // Extract text from all pages
          const pages = await extractTextFromPDF(pdfData)

          set({ aiProgress: { current: 0, total: pages.length } })

          // Analyze with OpenRouter
          const results = await analyzeWithOpenRouter(
            pages,
            get().apiKey,
            (current, total) => {
              set({ aiProgress: { current, total } })
            }
          )

          // Convert to annotations
          const { pageWidth, pageHeight } = get()
          const annotations = resultsToAnnotations(results, pageWidth, pageHeight)

          set({
            aiResult: annotations,
            aiLoading: false,
            aiProgress: { current: 0, total: 0 },
          })
        } catch (err) {
          console.error('AI validation failed:', err)
          set({
            aiLoading: false,
            aiResult: [],
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
      },

      discardAiResults: () => {
        set({ aiResult: null, aiDialogOpen: false })
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
            })
            return
          }
        }
        const now = new Date().toISOString()
        const welcomeMsg = {
          role: 'assistant' as const,
          content: `I've analyzed the selected text from page ${page}. Ask me anything about this content — I can help verify claims, explain terms, check for errors, or provide more context.\n\n> "${text.substring(0, 200)}${text.length > 200 ? '...' : ''}"`,
        }
        set({
          chatOpen: true,
          chatSelectedText: text,
          chatPage: page,
          chatMessages: [welcomeMsg],
          chatSessionId: null,
          chatLoading: false,
        })
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
          const response = await fetch(
            'https://openrouter.ai/api/v1/chat/completions',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${state.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': window.location.origin,
                'X-Title': 'PDF Annotation Studio - Verify Claim',
              },
              body: JSON.stringify({
                model: 'openai/gpt-4o-mini',
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

      /* --- General --- */
      clearAll: () =>
        set({
          pdfMeta: null,
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
          pendingValidation: null,
          showValidationDialog: false,
          drawing: null,
          error: null,
          aiResult: null,
          aiDialogOpen: false,
          aiLoading: false,
          aiProgress: { current: 0, total: 0 },
          chatOpen: false,
          chatSelectedText: '',
          chatPage: null,
          chatMessages: [],
          chatLoading: false,
          chatSessionId: null,
          chatSessions: [],
        }),
    }),
    {
      name: 'pdf-annotator-store',
      partialize: (state) => ({
        pdfMeta: state.pdfMeta,
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
      }),
    }
  )
)
