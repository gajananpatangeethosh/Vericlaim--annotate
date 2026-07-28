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
  color: string
  severity?: Severity
  category?: ValidationCategory
  author?: string
  comment?: string
  status?: 'open' | 'resolved' | 'rejected'
  createdAt: string
  updatedAt: string
}

export interface PdfMeta {
  name: string
  totalSize: number
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
