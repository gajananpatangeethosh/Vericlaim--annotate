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
