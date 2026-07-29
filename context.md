# VeriClaim — Project Context

> A document claim verification tool: upload a brochure PDF + reference paper, AI verifies every factual claim against the reference, and highlights each claim at its exact position in the brochure.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript + Vite 6 |
| Styling | Tailwind CSS 3 (custom `brand-*` palette) |
| State | Zustand 5 with `persist` middleware |
| PDF Render | react-pdf 9 (pdfjs-dist under the hood) |
| PDF Manipulation | pdf-lib (export annotated PDF) |
| AI | OpenRouter API (`openrouter/free` model) |
| Storage | IndexedDB (PDF binaries) + localStorage (app state) |
| IDs | uuid v4 |

---

## Project Structure

```
src/
├── main.tsx                          # Entry: React root + QueryClientProvider
├── App.tsx                           # Root layout: Toolbar + PDFViewer + Sidebar + overlays
├── index.css                         # Tailwind directives + custom component classes
├── key.ts                            # Hardcoded OpenRouter API key
│
├── types/
│   └── index.ts                      # All TypeScript types
│
├── store/
│   └── useStore.ts                   # Zustand store (single flat state)
│
├── hooks/
│   └── useKeyboard.ts                # Global keyboard shortcuts
│
├── utils/
│   ├── ai.ts                         # AI verification + PDF text extraction
│   ├── constants.ts                  # Colors, icons, labels, zoom defaults
│   ├── export-pdf.ts                 # Annotated PDF export via pdf-lib
│   ├── idb.ts                        # IndexedDB CRUD for PDF binaries
│   ├── pdf.ts                        # Bounds normalization, import/export JSON
│   └── text-positions.ts             # DOM text span querying + position matching
│
└── components/
    ├── Upload/
    │   └── UploadZone.tsx            # Dual drop zones (brochure + reference)
    ├── Toolbar/
    │   └── Toolbar.tsx               # Top bar: tools, zoom, validation, export
    ├── PDFViewer/
    │   ├── PDFViewer.tsx             # Document container + page rendering
    │   ├── PDFPage.tsx               # Per-page: react-pdf + annotation overlay + drawing
    │   └── AnnotationLayer.tsx       # Renders all annotations with positioning + tooltips
    ├── Sidebar/
    │   └── Sidebar.tsx               # Annotations list + Chat History tabs
    ├── AnnotationCard/
    │   └── AnnotationCard.tsx        # Per-annotation: edit, color, severity, delete
    ├── ValidationTooltip/
    │   ├── ValidationTooltip.tsx     # Hover tooltip for validation annotations
    │   └── ClaimTooltip.tsx          # Hover tooltip for claim highlight annotations
    ├── AIDialog/
    │   └── AIDialog.tsx              # AI verification modal: loading, results, apply/discard
    └── ChatPanel/
        ├── SelectionPopup.tsx        # "Verify Claim" button on text selection
        └── ChatPanel.tsx             # Chat overlay for claim Q&A
```

---

## Types

```typescript
type Tool = 'pointer' | 'highlight' | 'rectangle' | 'validation' | 'comment' | 'erase'
type AnnotationType = 'highlight' | 'rectangle' | 'validation'
type Severity = 'info' | 'warning' | 'error' | 'success'
type Verdict = 'verified' | 'partial' | 'unsupported'
type ValidationCategory = 'grammar' | 'financial' | 'legal' | 'missing-data' |
                          'compliance' | 'personal-info' | 'medical' | 'custom'

interface Bounds { x: number; y: number; width: number; height: number }

interface Annotation {
  id: string
  page: number
  type: AnnotationType
  text?: string                    // claim text (highlights) or label (validations)
  message?: string                 // AI verification message
  bounds: Bounds                   // position at zoom=1 (PDF points)
  lineBounds?: Bounds[]            // per-line bounds for multi-line highlights
  color: string                    // hex color
  severity?: Severity
  category?: ValidationCategory
  author?: string
  comment?: string                 // stores "[VERIFIED] reason\n\nEvidence:\n..."
  status?: 'open' | 'resolved' | 'rejected'
  createdAt: string
  updatedAt: string
}

interface ClaimResult {
  page: number
  text: string                     // full page text
  claim: string                    // the specific claim extracted by AI
  verdict: Verdict
  evidence: string                 // supporting/contradicting text from reference
  message: string                  // explanation
}

interface PageWithItems {
  page: number
  text: string                     // full page text
  items: TextItemWithPos[]         // pdf.js text items with coordinates
  pageHeight: number               // page height at scale 1 (PDF points)
}

interface TextItemWithPos {
  str: string
  x: number                        // PDF transform[4]
  y: number                        // PDF transform[5] (baseline, from bottom)
  width: number
  height: number
}
```

---

## Zustand Store

### State

| Category | Fields |
|----------|--------|
| PDF | `pdfMeta`, `referencePdfMeta`, `numPages`, `pageWidth`, `pageHeight`, `loading`, `error` |
| Annotations | `annotations[]`, `past[][]` (undo), `future[][]` (redo) |
| UI | `zoom`, `currentTool`, `selectedAnnotationId`, `hoveredAnnotationId`, `scrollToPage`, `searchQuery` |
| Drawing | `drawing` |
| Fit | `fitWidthFn`, `fitPageFn` |
| AI | `aiDialogOpen`, `aiLoading`, `aiProgress`, `aiResult`, `aiError`, `apiKey`, `brochureItems` |
| Chat | `chatOpen`, `chatSelectedText`, `chatPage`, `chatMessages`, `chatLoading`, `chatSessionId`, `chatSessions[]` |

### Key Actions

| Action | Description |
|--------|-------------|
| `addAnnotation(ann)` | Adds annotation + pushes undo snapshot |
| `updateAnnotation(id, partial)` | Updates annotation + pushes undo snapshot |
| `deleteAnnotation(id)` | Deletes annotation + pushes undo snapshot |
| `undo()` / `redo()` | Restores from `past`/`future` stacks |
| `runAiValidation()` | Full AI verification pipeline (see below) |
| `applyAiResults()` | Moves `aiResult` into `annotations[]` |
| `sendChatMessage(msg)` | Sends chat message via OpenRouter |
| `clearAll()` | Resets everything, deletes reference PDF from IndexedDB |

### Persistence

- localStorage key: `pdf-annotator-store`
- Persisted: `pdfMeta`, `referencePdfMeta`, `numPages`, `pageWidth`, `pageHeight`, `annotations`, `past`, `future`, `zoom`, `currentTool`, `searchQuery`, `chatSessions`, `apiKey`
- NOT persisted: `brochureItems` (too large, re-extracted on demand)
- Custom merge: ensures code-level API key overrides stale localStorage values

---

## Coordinate Systems

Three coordinate spaces are used throughout the codebase:

### 1. PDF Point Space (bottom-left origin)
- pdf.js text items: `transform[4]` = x, `transform[5]` = y (from bottom)
- Page dimensions at scale 1 (e.g., 595 × 842 for A4)
- **Conversion to CSS:** `cssX = pdfX`, `cssY = pageHeight - pdfY - itemHeight`

### 2. CSS Space (top-left origin, zoom=1)
- Annotation `bounds` are stored in this space
- All coordinates are in PDF points (not pixels)
- `normaliseBounds(screenBounds, zoom)` converts from screen → this space

### 3. Screen Space (top-left origin, zoomed)
- What's rendered in the browser
- `ann.bounds.x * zoom` = CSS `left`, `ann.bounds.y * zoom` = CSS `top`
- `getBoundingClientRect()` returns coordinates in this space

---

## Text Positioning Pipeline

When AI produces a `ClaimResult` with `claim` text, the system finds where that text appears on the PDF page:

### Priority 1: PDF.js Text Items (most reliable)

1. `extractTextItemsFromPDF()` extracts every text item with its transform coordinates
2. `findClaimBoundsPerLine()` joins all items into a single string, then tries 5 matching strategies:
   - **Exact substring** — `fullText.indexOf(searchText)`
   - **Normalized whitespace** — collapse `\s+` → single space
   - **Prefix match (50 chars)** — first portion of claim
   - **Prefix match (30 chars)** — shorter prefix
   - **Word subsequence** — scan normalized words in order, requires ≥50% match
3. Matched items are grouped into lines by vertical proximity (gap < 80% of line height)
4. Each line's bounding box computed in CSS coordinates

### Priority 2: DOM Text Spans (fallback, used in AnnotationLayer)

1. `getPageTextSpans()` queries `.textLayer span[role="presentation"]` elements
2. `findClaimBoundsFromSpans()` performs similar 5-strategy matching against DOM span text
3. Returns bounds relative to the wrapper element
4. Normalized by zoom via `normaliseBounds(b, zoom)`

### Priority 3: Estimated Bounds (last resort)

`estimateClaimBounds()` uses text length and page position to generate a rough bounding box. Used only when both higher-priority methods fail.

### AnnotationLayer Dynamic Repositioning

The `AnnotationLayer` runs a `useEffect` that re-evaluates all highlight annotations on every render (when text spans, pdf items, or zoom changes). For each highlight annotation:
1. Try DOM text spans first (with wrapper rect subtraction + zoom normalization)
2. Fall back to pdf.js items
3. If both fail, keep existing bounds

---

## AI Verification Pipeline

### OpenRouter API

- **Endpoint:** `https://openrouter.ai/api/v1/chat/completions`
- **Model:** `openrouter/free`
- **Headers:** `Authorization: Bearer {key}`, `HTTP-Referer`, `X-Title: VeriClaim`
- **Helper:** `callOpenRouter(systemPrompt, messages, apiKey, temperature=0.1, maxTokens=2000)`

### `runAiValidation()` Flow

```
1. Validate inputs (both PDFs + API key required)
2. Load PDF binaries from IndexedDB
3. Extract text from both PDFs:
   - extractTextFromPDF(brochure)  → brochurePages[{page, text}]
   - extractTextFromPDF(reference) → referencePages[{page, text}]
   - extractTextItemsFromPDF(brochure) → brochureItems[{page, text, items[], pageHeight}]
4. For each brochure page:
   a. Build prompt with brochure page text (≤6000 chars) + full reference (≤12000 chars)
   b. LLM classifies each claim as verified/partial/unsupported
   c. LLM returns JSON: { claims: [{ claim, verdict, evidence, message }] }
5. Convert ClaimResult[] → Annotation[] via claimResultsToAnnotations()
   - Find exact text position using pdf.js items
   - Color-code by verdict (green/yellow/red)
   - Store in aiResult
6. Show results in AIDialog
7. User clicks "Apply" → annotations added to main annotations[]
```

### LLM Prompt (Claim Verification)

```
You are a claim verification expert. You have been given a REFERENCE DOCUMENT
and a BROCHURE PAGE. Your task is to:

1. Identify ALL factual claims made in the brochure text
2. For EACH claim, compare it against the reference document
3. Classify each claim as: "verified" | "partial" | "unsupported"
4. Provide specific evidence from the reference

Respond in JSON: { "claims": [{ "claim", "verdict", "evidence", "message" }] }
```

### Chat AI

- System prompt includes selected text + page number as context
- Sends full conversation history + new message
- Temperature: 0.3, max_tokens: 1024
- Conversations saved as `ChatSession` objects in store

---

## Component Architecture

### PDF Rendering Chain

```
PDFViewer
  └─ <Document file={pdfData}>       (react-pdf)
       └─ <PDFPage pageNumber={N}>    (per page)
            ├─ <Page scale={zoom} renderTextLayer={true}>
            │    └─ .textLayer span[role="presentation"]   (invisible, selectable text)
            └─ Annotation overlay (absolute inset-0)
                 ├─ AnnotationLayer
                 │    ├─ useEffect: recompute positions from DOM spans / pdf.js items
                 │    └─ Per annotation: div with bounds, tooltips, handles, badges
                 └─ Drawing preview (dashed rect during draw)
```

### Annotation Rendering

| Type | Visual | Features |
|------|--------|----------|
| Highlight | Semi-transparent fill + left accent bar | Per-line sub-rects for multi-line, ClaimTooltip on hover |
| Validation | Translucent fill + left accent stripe | Severity badge, category icon, ValidationTooltip on hover |
| Rectangle | Border via box-shadow | Resize handles, drag |
| Comment | Blue rectangle + chat icon | Click to place |

All annotations get:
- **Numbered badge** (top-left, global rank by page+creation time)
- **Resize handles** (4 corners + 4 edges) when selected
- **Selection glow** (colored box-shadow)
- **Hover scale** (1.02x transform)

### Toolbar

| Section | Controls |
|---------|----------|
| Logo | VeriClaim branding |
| Upload | Brochure file input, Reference file input + badge |
| History | Undo, Redo buttons |
| Zoom | Fit Width, Zoom In/Out, Fit Page, percentage display |
| Tools | Pointer, Highlight, Rectangle, Validation, Comment, Erase (with keyboard shortcuts) |
| Search | Text search input |
| AI | Run Validation button |
| Export | Export JSON, Export Annotated PDF, Import JSON |

### Sidebar

| Tab | Content |
|-----|---------|
| Annotations | Filtered/sorted list of AnnotationCards. Click to scroll to annotation on PDF. Edit text, comment, color, severity, category, status. Delete. |
| Chat History | List of past ChatSession cards. Reopen or delete. |

### AIDialog States

```
No Reference PDF → informational message
API Key Missing  → password input field
Loading          → spinner + progress bar (page X of Y)
Results          → verdict-colored cards + Apply/Discard buttons
Error            → red error card with retry
```

---

## IndexedDB Storage

- **Database:** object store `pdf-store`
- **Keys:** `PDF_KEYS.brochure = 'brochure-pdf'`, `PDF_KEYS.reference = 'reference-pdf'`
- **Values:** Data URL strings (base64-encoded PDF binary)
- **Operations:** `savePdfBinary(data, key)`, `loadPdfBinary(key)`, `deletePdfBinary(key)`

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `V` | Pointer tool |
| `H` | Highlight tool |
| `R` | Rectangle tool |
| `L` | Validation tool |
| `C` | Comment tool |
| `E` | Erase tool |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo |

---

## Export

### JSON Export
- Downloads `annotations-{timestamp}.json`
- Contains full `Annotation[]` array
- Can be re-imported via Import button

### Annotated PDF Export
Uses `pdf-lib` to:
1. Load original brochure PDF from IndexedDB
2. Embed Helvetica font
3. For each annotation, draw on the PDF page:
   - **Highlights:** Semi-transparent colored rectangle
   - **Validations:** Border rectangle + severity/verdict badge + label text
   - **Rectangles:** Border rectangle with subtle fill
   - **Numbered badges:** Blue circles with white numbers
4. Downloads as `annotated-{timestamp}.pdf`

---

## User Workflow

```
1. Upload Brochure PDF  →  PDF renders in viewer
2. Upload Reference PDF  →  Stored in IndexedDB
3. (Optional) Manual Annotation  →  Highlight, draw, comment
4. Click "Run Validation"  →  AI verifies claims against reference
5. Review Results in Dialog  →  See verdicts, evidence
6. Click "Apply"  →  Color-coded highlights appear on PDF at exact positions
7. Hover Highlights  →  Tooltip shows claim, verdict, reason, evidence
8. Edit in Sidebar  →  Adjust severity, status, comments
9. Export  →  JSON or annotated PDF
```
