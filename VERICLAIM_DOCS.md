# VeriClaim — Claim Verification & PDF Annotation Studio

> **Version:** 1.0.0  
> **Stack:** React 19 + TypeScript + Vite + Tailwind CSS  
> **AI Provider:** OpenRouter (model: `openrouter/free`)  
> **PDF Engine:** `react-pdf` (viewer) + `pdfjs-dist` (text extraction) + `pdf-lib` (export)  
> **State:** Zustand with `persist` middleware  
> **Storage:** IndexedDB (PDF binaries) + localStorage (app state)

---

## Table of Contents

1. [Concept Overview](#1-concept-overview)
2. [Core Workflows](#2-core-workflows)
3. [Architecture & File Map](#3-architecture--file-map)
4. [Data Types](#4-data-types)
5. [State Management](#5-state-management)
6. [Component Breakdown](#6-component-breakdown)
7. [Utility Modules](#7-utility-modules)
8. [Configuration & Styling](#8-configuration--styling)
9. [Feature Walkthroughs](#9-feature-walkthroughs)
10. [Dependencies](#10-dependencies)

---

## 1. Concept Overview

VeriClaim is a **document verification tool** that lets users:

- **Upload two PDFs** — a *brochure* (containing claims) and a *reference/research paper* (the ground truth)
- **Run AI-powered claim verification** — the app sends both PDFs to an LLM (via OpenRouter), which identifies each claim in the brochure and classifies it as `verified`, `partial`, or `unsupported` against the reference
- **See claims highlighted at exact positions** — each claim is highlighted directly over its text in the brochure using the pdf.js text-layer coordinates (green = verified, yellow = partial, red = unsupported)
- **Annotate freely** — manual highlights, rectangles, validation markers, and comments can be added, dragged, resized, and edited
- **Chat with an AI about selected text** — select any text on a PDF page and open an AI chat panel to ask questions, verify claims, or get explanations
- **Export** — annotated PDF with verdict badges, JSON annotation data, import/annotations

---

## 2. Core Workflows

### 2a. Upload + Claim Verification

```
 Brochure PDF           Reference PDF
     │                       │
     ▼                       ▼
 IndexedDB (brochure)    IndexedDB (reference)
     │                       │
     └───────────┬───────────┘
                 ▼
         extractTextFromPDF()     extractTextItemsFromPDF()
         (plain text per page)    (text + per-character positions)
                 │                       │
                 └───────────┬───────────┘
                             ▼
                  verifyClaimsWithReference()
                     (OpenRouter LLM call)
                             │
                             ▼
                    ClaimResult[]  ←  { page, claim, verdict, evidence, message }
                             │
                             ▼
                claimResultsToAnnotations()
                  (finds exact text bounds in pdf.js items)
                             │
                             ▼
                    Annotation[]  (type: 'highlight', color-coded by verdict)
                             │
                             ▼
                   AIDialog preview → Apply → annotations[] in store
```

### 2b. Text Selection → AI Chat

```
 User selects text on PDF page
           │
           ▼
 SelectionPopup appears ("🤖 Verify Claim")
           │
           ▼
 openChat(selectedText, pageNumber)
           │
           ▼
 ChatPanel overlay opens with welcome message
           │
           ▼
 User types question → sendChatMessage()
           │
           ▼
 OpenRouter chat completion
 (system prompt includes selected text + page context)
           │
           ▼
 Response shown in chat
           │
           ▼
 On close → saved as ChatSession[] (persisted)
```

### 2c. Manual Annotation

```
 Tool selected: highlight / rectangle / validation / comment
           │
           ▼
 Mouse interaction on PDFPage
   - Text selection (highlight) → DOM Range → normalisedBounds
   - Drag (rectangle/validation) → mousedown/move/up → normalisedBounds
   - Click (comment) → fixed-size box at click point
           │
           ▼
 addAnnotation() → store update (undo-able)
           │
           ▼
 AnnotationLayer re-renders
   - Bounds × zoom for screen position
   - Color, opacity, accent bar, severity badge, handles
```

---

## 3. Architecture & File Map

```
src/
├── main.tsx                          # Entry point: React Query provider
├── App.tsx                           # Layout: Toolbar + PDFViewer + Sidebar + overlays
├── index.css                         # Tailwind base + custom component classes
├── key.ts                            # API_KEY export (gitignored)
│
├── types/
│   └── index.ts                      # All TypeScript interfaces & type aliases
│
├── store/
│   └── useStore.ts                   # Zustand store with persist
│
├── hooks/
│   └── useKeyboard.ts                # Keyboard shortcuts (V/H/R/L/C/E, Ctrl+Z/Y)
│
├── utils/
│   ├── ai.ts                         # PDF text extraction + OpenRouter calls + claim verification
│   ├── constants.ts                  # Severity/verdict colors, icons, labels, zoom defaults
│   ├── idb.ts                        # IndexedDB wrapper (save/load/delete PDF binaries)
│   ├── pdf.ts                        # Bounds normalization, fake validations, export/import JSON
│   └── export-pdf.ts                 # pdf-lib based annotated PDF export
│
├── components/
│   ├── Upload/
│   │   └── UploadZone.tsx            # Dual drop-zone (brochure + reference)
│   ├── Toolbar/
│   │   └── Toolbar.tsx               # Top bar: upload, tools, zoom, search, run, export
│   ├── PDFViewer/
│   │   ├── PDFViewer.tsx             # Document container, page refs, fit functions
│   │   ├── PDFPage.tsx               # Single page: text-selection, drawing, overlay
│   │   └── AnnotationLayer.tsx       # Annotation rendering: highlights, badges, drag/resize
│   ├── Sidebar/
│   │   └── Sidebar.tsx               # Tabbed sidebar: list + chat history
│   ├── AnnotationCard/
│   │   └── AnnotationCard.tsx        # Individual annotation editor card
│   ├── ValidationTooltip/
│   │   └── ValidationTooltip.tsx     # Hover tooltip for validation annotations
│   ├── AIDialog/
│   │   └── AIDialog.tsx              # AI results modal with verdict cards + evidence
│   ├── ChatPanel/
│   │   ├── SelectionPopup.tsx        # Floating "Verify Claim" button on text selection
│   │   └── ChatPanel.tsx             # AI chat overlay with session management
│   └── ... (no pages/ directory)
│
└── vite-env.d.ts                     # Vite client types
```

---

## 4. Data Types

**All types are defined in `src/types/index.ts`.**

```typescript
// ── Tools ──
type Tool = 'pointer' | 'highlight' | 'rectangle' | 'validation' | 'comment' | 'erase'
type AnnotationType = 'highlight' | 'rectangle' | 'validation'

// ── Severity & Category (used for manual validation annotations) ──
type Severity = 'info' | 'warning' | 'error' | 'success'
type ValidationCategory =
  | 'grammar' | 'financial' | 'legal' | 'missing-data'
  | 'compliance' | 'personal-info' | 'medical' | 'custom'

// ── Bounding Box ──
interface Bounds {
  x: number       // CSS top-left origin, normalized at zoom=1
  y: number
  width: number
  height: number
}

// ── Central Data Entity ──
interface Annotation {
  id: string
  page: number
  type: AnnotationType
  text?: string
  message?: string
  bounds: Bounds
  color: string          // hex (e.g. '#22c55e')
  severity?: Severity
  category?: ValidationCategory
  author?: string
  comment?: string
  status?: 'open' | 'resolved' | 'rejected'
  createdAt: string      // ISO
  updatedAt: string      // ISO
}

// ── Claim Verification ──
type Verdict = 'verified' | 'partial' | 'unsupported'

interface ClaimResult {
  page: number
  text: string           // full page text (for position estimation)
  claim: string          // the claim text (searched in pdf.js items)
  verdict: Verdict
  evidence: string       // supporting text from reference PDF
  message: string        // LLM explanation
}

// ── Chat System ──
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatSession {
  id: string
  selectedText: string
  page: number
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

// ── PDF Metadata ──
interface PdfMeta {
  name: string
  totalSize: number
}
```

---

## 5. State Management

**File:** `src/store/useStore.ts`

Uses **Zustand** with the `persist` middleware. The store holds all application state and actions in a single flat object.

### Persisted Fields (`partialize`)

| Field | Type | Description |
|---|---|---|
| `pdfMeta` | `PdfMeta \| null` | Brochure PDF metadata |
| `referencePdfMeta` | `PdfMeta \| null` | Reference PDF metadata |
| `numPages` | `number` | Total brochure pages |
| `pageWidth` / `pageHeight` | `number` | Natural PDF dimensions (used for text-position scaling) |
| `annotations` | `Annotation[]` | All annotations (manual + AI-applied) |
| `past` / `future` | `Annotation[][]` | Undo/redo stacks (max 50) |
| `zoom` | `number` | Current zoom level |
| `currentTool` | `Tool` | Active annotation tool |
| `searchQuery` | `string` | Sidebar filter text |
| `chatSessions` | `ChatSession[]` | Persisted chat history |
| `apiKey` | `string` | OpenRouter API key (with merge guard against stale localStorage) |

### Key Actions

| Action | Description |
|---|---|
| `runAiValidation()` | Loads both PDFs from IndexedDB, extracts text + positions, calls `verifyClaimsWithReference`, converts to annotations via `claimResultsToAnnotations`. Updates `aiLoading`, `aiProgress`, `aiResult`, `aiError` |
| `applyAiResults()` | Moves `aiResult` annotations into main `annotations` array (with undo snapshot) |
| `discardAiResults()` | Clears AI result preview |
| `addAnnotation(ann)` | Adds annotation (with undo snapshot) |
| `updateAnnotation(id, partial)` | Updates fields (with undo) |
| `deleteAnnotation(id)` | Removes annotation (with undo) |
| `undo()` / `redo()` | Traverses `past`/`future` stacks |
| `openChat(text, page, sessionId?)` | Opens chat panel, optionally restoring a session |
| `closeChat()` | Saves current chat to `chatSessions` if there were messages |
| `sendChatMessage(message)` | Calls OpenRouter chat API, appends response |
| `deleteChatSession(id)` / `clearChatHistory()` | Manages chat history |
| `clearAll()` | Resets all state + deletes reference PDF from IndexedDB |

### Merge Guard

The `merge` function in `persist` prevents a stale/invalid persisted `apiKey` (e.g. `< 20 chars` from a previous truncated save) from overriding the real key imported from `src/key.ts`:

```typescript
merge: (persisted, current) => {
  const merged = { ...current, ...(persisted as Partial<AppState>) }
  if (!merged.apiKey || merged.apiKey.length < 20) {
    merged.apiKey = (current as AppState).apiKey
  }
  return merged
}
```

---

## 6. Component Breakdown

### App (`App.tsx`)
Root layout: `Toolbar` (top) → `PDFViewer` + `Sidebar` (flex row) → `SelectionPopup` / `ChatPanel` / `AIDialog` (modals, rendered at the end).

### UploadZone (`components/Upload/UploadZone.tsx`)
Two visually separated drop zones — one for brochure, one for reference. Each accepts `.pdf` files via file dialog or drag-and-drop. On upload:
- Reads file as data URL via `FileReader`
- Saves to IndexedDB with `savePdfBinary(data, PDF_KEYS.brochure)` or `PDF_KEYS.reference`
- Sets `pdfMeta` / `referencePdfMeta` in store
- Brochure upload triggers `clearAll()`

### Toolbar (`components/Toolbar/Toolbar.tsx`)
- **Upload Brochure** button + hidden `<input type="file">`
- **Reference** upload button (shows filename badge once uploaded)
- **Undo/Redo** with disabled state
- **Zoom** controls (-/+/Fit Width/Fit Page)
- **Tool selector**: pointer | highlight | rectangle | validation | comment | erase
- **Search** input (filters sidebar annotations)
- **Run Validation** button (requires reference PDF + API key)
- **Export** dropdown: JSON annotations / Annotated PDF
- **Import** button: loads JSON annotations file

### PDFViewer (`components/PDFViewer/PDFViewer.tsx`)
- Loads brochure PDF from IndexedDB on mount
- Uses `react-pdf`'s `<Document>` with one `<PDFPage>` per page
- Exposes `fitWidthFn` / `fitPageFn` for Toolbar zoom buttons
- Scrolls to annotation page on `scrollToPage` change
- Shows `UploadZone` when no PDF loaded; loading spinner; error state

### PDFPage (`components/PDFViewer/PDFPage.tsx`)
- Renders a single page with `react-pdf`'s `<Page>` (text layer enabled, annotation layer disabled)
- Overlays an absolutely-positioned `div` for annotations + drawing
- **Highlight mode**: Listens for `mouseup` on `document`, captures DOM `Selection` rect, normalises to PDF space, creates `type: 'highlight'` annotation
- **Rectangle/Validation mode**: Tracks mousedown → mousemove → mouseup to create drawn annotations with normalised bounds
- **Comment mode**: Single click places a 24×24 rectangle box
- **Erase mode**: Click on an annotation deletes it

### AnnotationLayer (`components/PDFViewer/AnnotationLayer.tsx`)
Renders all annotations for a single page as absolutely-positioned `div` elements:

- **Highlight**: semi-transparent fill (`color + '66'`) + left accent bar + rounded corners
- **Validation**: translucent fill (`color + '18'`), left accent stripe, severity badge (top-right), category icon watermark, hover tooltip, bottom message label on hover
- **Rectangle**: transparent fill, subtle border via box-shadow
- **Comment**: blue rectangle with 💬 icon centered
- **All types**: numbered badge (top-left with global rank), drag behavior, resize handles (8-direction), selected/hover states with glow effects

### Sidebar (`components/Sidebar/Sidebar.tsx`)
Two tabs:
- **Annotations**: Filtered/sorted list of `AnnotationCard` components
- **Chat History**: List of saved `ChatSession` cards with reopen/delete

### AnnotationCard (`components/AnnotationCard/AnnotationCard.tsx`)
Editable card showing:
- Type icon, page number, severity badge, status badge
- Editable text/message (inline edit)
- Category display with icon
- Editable comment (inline textarea)
- Color picker (for highlights), severity changer, category changer, status toggle, delete button
- Clicking scrolls to the annotation on the PDF

### ValidationTooltip (`components/ValidationTooltip/ValidationTooltip.tsx`)
Hover tooltip for validation annotations:
- Colored header bar
- Severity icon + label + category
- Message text
- Optional text snippet
- Arrow pointing down to the annotation

### AIDialog (`components/AIDialog/AIDialog.tsx`)
Modal with states:
- **No reference**: informative message
- **Error**: red error card with API key hint
- **API key input**: password field + "Verify Claims" button (shown when no key set)
- **Loading**: spinner + progress bar (page X of Y)
- **Results**: list of verdict-colored cards — verdict dot + badge (✅ Verified / ⚠️ Partial / ❌ Unsupported), quoted claim text, message, and collapsible `<details>` evidence block
- **Actions**: "Discard" or "Apply (N)" to add annotations to the page

### SelectionPopup (`components/ChatPanel/SelectionPopup.tsx`)
Floating "🤖 Verify Claim" button that appears when user selects ≥3 characters of text on a PDF page. Disappears on click-outside or dismiss. Determines the page number by walking up the DOM to find `[data-page-number]`.

### ChatPanel (`components/ChatPanel/ChatPanel.tsx`)
Full-screen modal overlay with:
- Header (brand gradient) showing "Verify Claim" + page number + close button
- Selected text banner (light blue)
- Messages area: user messages (right-aligned, brand-600 bubble) + assistant messages (left-aligned, gray bubble with 🤖 avatar)
- Loading animation (bouncing dots)
- Auto-scroll to bottom on new messages
- Auto-focus on textarea on open
- Textarea (2 rows, Enter to send, Shift+Enter for newline) + send button

---

## 7. Utility Modules

### `utils/ai.ts` — Core AI & PDF Text Logic

| Export | Description |
|---|---|
| `AIResult` | Interface for per-page analysis results |
| `callOpenRouter(systemPrompt, messages, apiKey, temperature, maxTokens)` | Internal: POST to OpenRouter `/v1/chat/completions` with Bearer auth |
| `extractTextFromPDF(dataUrl)` | Loads PDF via pdfjs, returns `{ page, text }[]` (plain text per page) |
| `TextItemWithPos` | Interface: `{ str, x, y, width, height }` |
| `PageWithItems` | Interface: `{ page, text, items, pageHeight }` |
| `extractTextItemsFromPDF(dataUrl)` | Same as above but preserves each text item's `transform[4]` (x), `transform[5]` (y from baseline), `width`, `height`, and `pageHeight` for coordinate conversion |
| `analyzeWithOpenRouter(pages, apiKey, onProgress)` | Per-page issue detection (grammar, financial, legal, etc.) |
| `resultsToAnnotations(results, pageWidth, pageHeight)` | Converts AI analysis to annotations with estimated bounds |
| `verifyClaimsWithReference(brochurePages, referencePages, apiKey, onProgress)` | Sends each brochure page + full reference text to OpenRouter; classifies claims as `verified`/`partial`/`unsupported` |
| `claimResultsToAnnotations(results, pageWidth, pageHeight, pageItems?)` | Converts `ClaimResult[]` to `Annotation[]`. When `pageItems` is provided, searches each claim text within pdf.js items to compute exact bounding box via `findClaimBounds()`. Falls back to estimated bounds if text not found |

#### Coordinate Space

```
pdf.js space:                 CSS space (annotation system):
 origin = bottom-left          origin = top-left
 y-up                         y-down

Conversion (in findClaimBounds):
  cssX = pdfX
  cssY = pageHeight - pdfY - itemHeight
```

Text items are joined with spaces for searching. The character offset mapping accounts for these separators.

### `utils/idb.ts` — IndexedDB Storage

Stores PDF binaries as data URLs under separate keys:

```typescript
PDF_KEYS = { brochure: 'brochure-pdf', reference: 'reference-pdf' }
```

Functions: `savePdfBinary(data, key)`, `loadPdfBinary(key)`, `deletePdfBinary(key)` — all return Promises.

### `utils/pdf.ts` — Bounds, Validation, Import/Export

- `normaliseBounds(bounds, scale)` / `denormaliseBounds(bounds, scale)` — Convert between screen and PDF-native coordinates
- `generateFakeValidations(numPages, existing)` — Generates random validation annotations (used for demo/testing)
- `exportAnnotations(annotations)` — Downloads annotations as JSON file
- `importAnnotations(json)` — Parses JSON string into `Annotation[]`
- `getAnnotationColor(type, severity)` — Returns appropriate hex color
- `isPointInBounds(px, py, bounds)` — Hit-test for mouse interactions
- `readFileAsDataURL(file)` — Promise-based FileReader

### `utils/export-pdf.ts` — Annotated PDF Export

Uses `pdf-lib` to render annotations onto the original brochure PDF:
- Loads the original PDF from IndexedDB
- Embeds Helvetica (regular + bold) fonts
- Draws **highlight** as semi-transparent filled rectangles (40% opacity)
- Draws **rectangle** as bordered rectangles with subtle fill
- Draws **validation** as bordered rectangles with:
  - Claim verification annotations: verdict-colored badge (✓/~/) + evidence text label
  - Standard validation: severity badge (✕/!/✓/i) + category label
- Numbered badge (blue circle with white number) at top-left of every annotation
- All annotations sorted by page then `createdAt` for global numbering

### `utils/constants.ts` — Visual Constants

| Map | Purpose |
|---|---|
| `SEVERITY_COLORS` | `info`→`#93c5fd`, `warning`→`#fdba74`, `error`→`#fca5a5`, `success`→`#86efac` |
| `SEVERITY_BORDERS` | Darker variants for borders |
| `SEVERITY_ICONS` | ℹ️ ⚠️ ❌ ✅ |
| `VERDICT_COLORS` | `verified`→`#22c55e`, `partial`→`#eab308`, `unsupported`→`#ef4444` |
| `VERDICT_LABELS` | "Verified", "Partial", "Unsupported" |
| `VERDICT_ICONS` | ✅ ⚠️ ❌ |
| `CATEGORY_LABELS` / `CATEGORY_ICONS` | Maps for validation categories |
| `VALIDATION_MESSAGES` | 15 preset messages with severity + category |
| `HIGHLIGHT_COLORS` | 4 preset highlight colors |
| Zoom constants | `DEFAULT_ZOOM=1.0`, `ZOOM_STEP=0.25`, range `[0.25, 4.0]` |

### `hooks/useKeyboard.ts`

Binds keyboard shortcuts:
| Key | Action |
|---|---|
| `V` | Pointer tool |
| `H` | Highlight tool |
| `R` | Rectangle tool |
| `L` | Validation tool |
| `C` | Comment tool |
| `E` | Erase tool |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo |

Skips shortcuts when focus is in input/textarea.

---

## 8. Configuration & Styling

### API Key (`src/key.ts`)

```typescript
export const API_KEY = 'sk-or-v1-...'
```

This file is **gitignored** and not tracked in version control. The key is imported directly in the store and AI utilities. A custom `merge` in Zustand's `persist` ensures the code-level key always takes precedence over stale localStorage data.

### Tailwind CSS (`src/index.css`)

Custom component classes:
- `.btn` / `.btn-primary` / `.btn-ghost` / `.btn-ghost-active` / `.btn-icon` — Button variants
- `.toolbar-group` — Segmented control container (border + shadow)
- `.card` / `.card-hover` — Card containers
- `.badge` / `.badge-info` / `.badge-warning` / `.badge-error` / `.badge-success` — Badge variants
- `.scroll-thin` — Thin custom scrollbar (WebKit only)

### Tailwind Config

Expected config (inferred from usage): brand color (`brand-50`–`brand-800`), custom shadows (`card`, `cardhover`), `animate-fade-in` keyframe.

### Dependencies

| Package | Purpose |
|---|---|
| `react` / `react-dom` ^19 | UI framework |
| `zustand` ^5 | State management with persist |
| `react-pdf` ^9 | PDF page rendering with text layer |
| `pdfjs-dist` | Low-level PDF text extraction (worker) |
| `pdf-lib` | PDF modification for annotated export |
| `@tanstack/react-query` ^5 | API query caching (currently used as provider in `main.tsx`) |
| `uuid` ^11 | Annotation/chat session ID generation |
| `tailwindcss` ^3 | Utility-first CSS |
| `vite` ^6 | Build tool and dev server |
| `typescript` ^5 | Type checking |

---

## 9. Feature Walkthroughs

### Claim Verification Flow

1. **Upload** brochure PDF via UploadZone or Toolbar
2. **Upload** reference/research paper PDF via the "Reference" button or the secondary drop zone
3. Click **"🤖 Run Validation"** in the toolbar
4. If no API key is stored, a dialog prompts for an OpenRouter API key
5. The AIDialog opens showing a progress bar as each brochure page is processed
6. For each brochure page, the LLM receives:
   - The page text (up to 6,000 chars)
   - The full reference text (up to 12,000 chars)
   - Instructions to extract claims and classify them
7. Results appear as verdict-colored cards:
   - ✅ **Verified** (green `#22c55e`)
   - ⚠️ **Partial** (yellow `#eab308`)
   - ❌ **Unsupported** (red `#ef4444`)
8. Each card shows the quoted claim, explanation, and collapsible evidence
9. Click **"Apply (N)"** to add all claims as **highlight annotations** at exact text positions on the brochure PDF, or **"Discard"** to dismiss

### Chat with AI

1. Select any text (≥3 chars) on a brochure page
2. A floating "🤖 Verify Claim" button appears near the selection
3. Click it to open the ChatPanel overlay
4. The panel shows the selected text in a banner and a welcome message
5. Type questions about the text — the AI has the full selected text as context
6. On closing, if messages exist, the conversation is saved to **Chat History** (viewable in the sidebar)
7. Reopen past chats from the Chat History tab — they restore the original selection text and all messages

### Manual Annotation

- Switch tools via keyboard (`H`, `R`, `L`, `C`) or toolbar buttons
- **Highlight**: Select text with mouse → released → highlight appears
- **Rectangle/Validation**: Click-drag to draw shape
- **Comment**: Single-click places a 💬 marker
- **Erase**: Click on any annotation to delete it
- **Move**: Drag existing annotations
- **Resize**: Drag corner/edge handles (appear on selection)
- **Edit**: Click annotation in sidebar to edit text, comment, color, severity, category, status

### Export

- **Export JSON**: Downloads all annotations as a portable JSON file
- **Import JSON**: Replaces all annotations from a previously exported JSON
- **Export PDF (Annotated)**: Renders annotations onto the brochure PDF file with numbered badges, verdict badges, and evidence labels

---

## 10. Dependencies (package.json)

```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.62.0",
    "pdf-lib": "^1.17.1",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-pdf": "^9.2.1",
    "uuid": "^11.0.3",
    "zustand": "^5.0.2"
  },
  "devDependencies": {
    "@types/react": "^19.0.1",
    "@types/react-dom": "^19.0.2",
    "@types/uuid": "^10.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.2",
    "vite": "^6.0.3"
  }
}
```
