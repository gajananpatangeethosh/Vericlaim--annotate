export type Tool =
  | 'pointer'
  | 'highlight'
  | 'rectangle'
  | 'validation'
  | 'comment'
  | 'erase'

export type AnnotationType = 'highlight' | 'rectangle' | 'validation'

export type Severity = 'info' | 'warning' | 'error' | 'success'

export type ValidationCategory =
  | 'grammar'
  | 'financial'
  | 'legal'
  | 'missing-data'
  | 'compliance'
  | 'personal-info'
  | 'medical'
  | 'custom'

export type LocationStatus = 'found' | 'not_found'

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export interface Annotation {
  id: string
  page: number
  type: AnnotationType
  text?: string
  message?: string
  bounds: Bounds
  lineBounds?: Bounds[]
  color: string
  severity?: Severity
  category?: ValidationCategory
  author?: string
  comment?: string
  status?: 'open' | 'resolved' | 'rejected'
  locationStatus?: LocationStatus
  /** Reference paper page where the validating evidence was found */
  referencePage?: number
  /** Bounds of the evidence highlight in the reference page (CSS space) */
  referenceBounds?: Bounds
  /** Per-line bounds of the evidence highlight in the reference page */
  referenceLineBounds?: Bounds[]
  /** Whether the evidence quote was located in the reference paper */
  referenceLocationStatus?: LocationStatus
  createdAt: string
  updatedAt: string
}

export interface PdfMeta {
  name: string
  totalSize: number
}

export type Verdict = 'verified' | 'partial' | 'unsupported'

export interface ClaimResult {
  page: number
  text: string
  claim: string
  quoteStart?: string   // first 4-6 verbatim words — secondary match anchor
  verdict: Verdict
  evidence: string
  message: string
  /** Reference page number where the evidence quote appears (LLM hint) */
  referencePage?: number
  context?: {
    section: 'header' | 'body' | 'callout' | 'footnote'
    position: string
    fontEmphasis: string
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  /** Verdict structured into the message so the UI can render a verdict card
   *  instead of plain text. Only present on claim-verification responses. */
  verdict?: Verdict
  evidence?: string
  referencePage?: number
  isVerification?: boolean
}

/** A saved annotated document in the export history. */
export interface ExportRecord {
  id: string
  type: 'brochure' | 'reference'
  brochureName: string
  referenceName: string
  createdAt: string
  pages: number
  annotationCount: number
  verdicts: { verified: number; partial: number; unsupported: number }
  sizeBytes: number
  /** Key of the stored PDF binary in the IndexedDB history-files store */
  fileId: string
}

/** Audit log event types — high-level application actions. */
export type AuditAction =
  | 'app_open'
  | 'brochure_uploaded'
  | 'reference_uploaded'
  | 'validation_run'
  | 'validation_applied'
  | 'export_pdf'
  | 'export_reference_pdf'
  | 'claim_verified'
  | 'import_json'
  | 'export_deleted'
  | 'clear_all'
  | 'brochure_generated'
  | 'brochure_pdf_exported'

/** A single entry in the application audit log. */
export interface AuditEvent {
  id: string
  timestamp: string
  action: AuditAction
  label: string
  details?: Record<string, unknown>
  severity: 'info' | 'success' | 'warning' | 'error'
}

export interface ChatSession {
  id: string
  selectedText: string
  page: number
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

export interface MatchResult {
  confidence: number
  strategy: string
  matchedItemIndices: number[]
  score: number
}

export interface PageModelData {
  page: number
  items: Array<{ str: string; x: number; y: number; width: number; height: number; fontSize?: number; fontName?: string; hasEOL?: boolean; transform?: number[] }>
  fullText: string
  normalizedText: string
  noPunctLowerText: string
  wordOffsets: Array<{ start: number; end: number; itemIdx: number }>
  pageHeight: number
  pageWidth: number
}

export interface DebugInfo {
  strategy: string
  confidence: number
  itemCount: number
  matchStart: number
  matchEnd: number
}

export interface TextItemWithPos {
  str: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  fontName: string
  hasEOL: boolean
  transform: number[]
}

/* ────────────────────────────────────────────── */
/*  Medical Brochure Generator                    */
/* ────────────────────────────────────────────── */

export type BrochureElementType =
  | 'heading'
  | 'subheading'
  | 'body'
  | 'callout'
  | 'list-item'
  | 'footer'
  | 'image-placeholder'

/** Status of a generated image for an image-placeholder element. */
export type BrochureImageStatus = 'none' | 'loading' | 'ready' | 'error'

export interface BrochureElement {
  id: string
  type: BrochureElementType
  text: string
  fontSize?: number
  fontWeight?: 'normal' | 'bold' | 'semibold' | 'italic'
  textAlign?: 'left' | 'center' | 'right'
  marginTop?: number
  marginBottom?: number
  isClaim?: boolean
  /** Detailed description of the illustration to generate for this slot (set by the AI). */
  imagePrompt?: string
  /** PNG data URL of the generated image. In-memory only — NOT persisted to localStorage. */
  imageSrc?: string
  imageStatus?: BrochureImageStatus
  /** Model that produced `imageSrc`. */
  imageModel?: string
  // ── Canva-like freeform layout ──────────────────────────
  /** Absolute position inside content area (px, 0 = flow). When set, element is absolutely positioned. */
  x?: number
  y?: number
  /** Explicit size for freeform elements (px). Defaults to auto/content. */
  width?: number
  height?: number
  /** Text / element color (hex). Overrides template/claim color. */
  color?: string
  /** Background fill for callout / shape-like elements */
  backgroundColor?: string
  /** Font family key — see FONT_FAMILIES */
  fontFamily?: string
  /** Rotation in degrees */
  rotation?: number
  /** Opacity 0-1 */
  opacity?: number
  /** Letter spacing in px */
  letterSpacing?: number
  /** Line height multiplier */
  lineHeight?: number
  /** Border radius in px */
  borderRadius?: number
  /** Shadow */
  shadow?: boolean
  /** Text transform */
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
  /** Underline */
  underline?: boolean
}

export interface BrochurePage {
  pageNumber: number
  elements: BrochureElement[]
  /** Page background (hex or gradient token). Used by Canva-like editor. */
  backgroundColor?: string
}

export type BrochureTemplateId =
  | 'modern-minimal'
  | 'clinical-blue'
  | 'vibrant-wellness'
  | 'elegant-corporate'
  | 'tri-fold'

export interface BrochureDesign {
  id: string
  brandName: string
  tagline: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  /** Visual template used to generate and render this design */
  templateId: BrochureTemplateId
  /** User-requested page count (1-6) — actual pages.length should match */
  pageCount: number
  pages: BrochurePage[]
  footerText: string
  createdAt: string
  updatedAt: string
}
