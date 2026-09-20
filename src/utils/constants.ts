import type { Severity, ValidationCategory, Verdict } from '../types'

export const TOOL_NAMES: Record<string, string> = {
  pointer: 'Pointer (V)',
  highlight: 'Text Highlight (H)',
  rectangle: 'Rectangle (R)',
  validation: 'Validation (V)',
  comment: 'Comment (C)',
  erase: 'Erase (E)',
}

export const SEVERITY_COLORS: Record<Severity, string> = {
  info: '#93c5fd',
  warning: '#fdba74',
  error: '#fca5a5',
  success: '#86efac',
}

export const SEVERITY_BORDERS: Record<Severity, string> = {
  info: '#60a5fa',
  warning: '#f97316',
  error: '#ef4444',
  success: '#22c55e',
}

export const SEVERITY_ICONS: Record<Severity, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  error: '❌',
  success: '✅',
}

export const SEVERITY_LABELS: Record<Severity, string> = {
  info: 'Info',
  warning: 'Warning',
  error: 'Error',
  success: 'Success',
}

export const HIGHLIGHT_COLORS = ['#fef08a', '#86efac', '#93c5fd', '#fca5a5']

export const ANNOTATION_COLORS: Record<string, string> = {
  highlight: '#fef08a',
  rectangle: '#93c5fd',
}

export const VALIDATION_MESSAGES: Array<{
  severity: Severity
  category: ValidationCategory
  message: string
}> = [
  { severity: 'error', category: 'financial', message: 'Invoice Number Missing' },
  { severity: 'error', category: 'financial', message: 'Invalid Date' },
  { severity: 'error', category: 'financial', message: 'Incorrect GST Number' },
  { severity: 'warning', category: 'missing-data', message: 'Address Missing' },
  { severity: 'error', category: 'personal-info', message: 'Wrong PAN' },
  { severity: 'error', category: 'financial', message: 'Incorrect Invoice Total' },
  { severity: 'info', category: 'legal', message: 'Missing Signature' },
  { severity: 'warning', category: 'compliance', message: 'Non-compliance Detected' },
  { severity: 'success', category: 'grammar', message: 'Grammar Verified' },
  { severity: 'error', category: 'personal-info', message: 'Sensitive Data Exposed' },
  { severity: 'warning', category: 'medical', message: 'Invalid Medical Code' },
  { severity: 'info', category: 'legal', message: 'Disclaimer Missing' },
  { severity: 'error', category: 'financial', message: 'Tax Calculation Error' },
  { severity: 'warning', category: 'missing-data', message: 'Contact Information Missing' },
  { severity: 'info', category: 'compliance', message: 'Regulatory Check Pending' },
]

export const CATEGORY_LABELS: Record<ValidationCategory, string> = {
  grammar: 'Grammar',
  financial: 'Financial',
  legal: 'Legal',
  'missing-data': 'Missing Data',
  compliance: 'Compliance',
  'personal-info': 'Personal Information',
  medical: 'Medical',
  custom: 'Custom',
}

export const CATEGORY_ICONS: Record<ValidationCategory, string> = {
  grammar: '📝',
  financial: '💰',
  legal: '⚖️',
  'missing-data': '📋',
  compliance: '✅',
  'personal-info': '🔒',
  medical: '🏥',
  custom: '🔧',
}

export const VERDICT_COLORS: Record<Verdict, string> = {
  verified: '#22c55e',
  partial: '#eab308',
  unsupported: '#ef4444',
}

export const VERDICT_LABELS: Record<Verdict, string> = {
  verified: 'Verified',
  partial: 'Partial',
  unsupported: 'Unsupported',
}

export const VERDICT_ICONS: Record<Verdict, string> = {
  verified: '✅',
  partial: '⚠️',
  unsupported: '❌',
}

// Model ids match puter.ai.txt2img() — bare provider names, NOT OpenRouter-style
// ("openai/gpt-image-2"), which Puter rejects with HTTP 400.
export const IMAGE_GEN_MODELS: Array<{ id: string; label: string; description?: string }> = [
  { id: '', label: 'Default (gpt-image-1-mini)' },
  { id: 'gpt-image-2', label: 'GPT Image 2' },
  { id: 'gpt-image-1.5', label: 'GPT Image 1.5' },
  { id: 'gpt-image-1', label: 'GPT Image 1' },
  { id: 'gpt-image-1-mini', label: 'GPT Image 1 Mini' },
  { id: 'gemini-3-pro-image', label: 'Gemini 3 Pro Image' },
  { id: 'gemini-2.5-flash-image-preview', label: 'Gemini 2.5 Flash Image' },
  { id: 'dall-e-3', label: 'DALL·E 3' },
]

// Model strings for Eden AI image generation. Sent to POST /v3/universal-ai as
// `model: "image/generation/{id}"`. Providers/models verified against
// https://www.edenai.co/docs/v3/expert-models/features/image/generation
export const EDEN_IMAGE_MODELS: Array<{ id: string; label: string; resolution?: string }> = [
  { id: 'openai/gpt-image-1-mini', label: 'GPT Image 1 Mini', resolution: '1024x1024' },
  { id: 'openai/gpt-image-1', label: 'GPT Image 1', resolution: '1024x1024' },
  { id: 'openai/gpt-image-1.5', label: 'GPT Image 1.5', resolution: '1024x1024' },
  { id: 'openai/gpt-image-2', label: 'GPT Image 2', resolution: '1024x1024' },
  { id: 'google/gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image', resolution: '1024x1024' },
  { id: 'google/gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image', resolution: '1024x1024' },
  { id: 'google/imagen-4.0-generate-001', label: 'Imagen 4.0', resolution: '1024x1024' },
  { id: 'bytedance/seedream-4-0-250828', label: 'Seedream 4.0', resolution: '1024x1024' },
  { id: 'stabilityai/stable-diffusion-xl-1024-v1-0', label: 'Stable Diffusion XL', resolution: '1024x1024' },
]

export const IMAGE_ENGINES: Array<{ id: 'puter' | 'eden'; label: string; description?: string }> = [
  { id: 'puter', label: 'Puter (Free)', description: 'Free, no key required' },
  { id: 'eden', label: 'Eden AI', description: 'Many providers, one key' },
]

/* ── Brochure Templates ────────────────────────────────────────── */
import type { BrochureTemplateId } from '../types'

export interface BrochureTemplate {
  id: BrochureTemplateId
  label: string
  description: string
  // preview swatches
  swatches: [string, string, string] // primary, secondary, accent
  accent: string // single accent for card border
  preview: string // emoji/icon for card
  palette: { primary: string; secondary: string; accent: string }
  layoutHint: string // short prompt fragment injected into LLM
}

export const BROCHURE_TEMPLATES: BrochureTemplate[] = [
  {
    id: 'modern-minimal',
    label: 'Modern Minimal',
    description: 'Clean, airy, editorial — generous whitespace, thin rules',
    swatches: ['#0f172a', '#64748b', '#e2e8f0'],
    accent: '#0f172a',
    preview: '◐',
    palette: { primary: '#0f172a', secondary: '#475569', accent: '#e2e8f0' },
    layoutHint: 'STYLE: Modern Minimal — ultra-clean editorial, generous whitespace, thin 1px rules, small caps headings, muted slate palette, subtle card shadows.',
  },
  {
    id: 'clinical-blue',
    label: 'Clinical Trust',
    description: 'Medical-grade, trustworthy — blue header, rounded cards',
    swatches: ['#2563eb', '#0ea5e9', '#dbeafe'],
    accent: '#2563eb',
    preview: '⬢',
    palette: { primary: '#1e40af', secondary: '#0ea5e9', accent: '#3b82f6' },
    layoutHint: 'STYLE: Clinical Trust — confident medical brand, deep blue header (#1e40af), sky secondary, soft blue cards, rounded corners, clear hierarchy.',
  },
  {
    id: 'vibrant-wellness',
    label: 'Vibrant Wellness',
    description: 'Energetic, human — gradients, warm accent, friendly',
    swatches: ['#059669', '#f59e0b', '#fef3c7'],
    accent: '#059669',
    preview: '✦',
    palette: { primary: '#047857', secondary: '#d97706', accent: '#f59e0b' },
    layoutHint: 'STYLE: Vibrant Wellness — energetic wellness, emerald primary (#047857), amber accent (#f59e0b), gradient header, rounded image frames, warm human tone.',
  },
  {
    id: 'elegant-corporate',
    label: 'Elegant Corporate',
    description: 'Premium, serif-accented — navy + gold, high contrast',
    swatches: ['#1e293b', '#b45309', '#fef9c3'],
    accent: '#b45309',
    preview: '⬣',
    palette: { primary: '#0f172a', secondary: '#92400e', accent: '#b45309' },
    layoutHint: 'STYLE: Elegant Corporate — premium executive, slate/navy primary, warm gold accent (#b45309), serif-inspired headings, high contrast, structured grid, thin gold rule.',
  },
  {
    id: 'tri-fold',
    label: 'Tri-Fold Compact',
    description: 'Dense, scannable — 3-column rhythm, icon bullets',
    swatches: ['#334155', '#06b6d4', '#ecfeff'],
    accent: '#06b6d4',
    preview: '▭',
    palette: { primary: '#334155', secondary: '#0891b2', accent: '#06b6d4' },
    layoutHint: 'STYLE: Tri-Fold Compact — dense, scannable tri-fold rhythm, slate primary, cyan accent (#06b6d4), icon bullets, compact spacing, grid alignment.',
  },
]

export const BROCHURE_PAGE_OPTIONS = [1, 2, 3, 4, 5, 6] as const

/* ── Canva-like palettes ─────────────────────────────────── */
export const FONT_FAMILIES: Array<{ id: string; label: string; stack: string }> = [
  { id: 'sans', label: 'Sans', stack: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial' },
  { id: 'serif', label: 'Serif', stack: 'ui-serif, Georgia, Cambria, Times New Roman, serif' },
  { id: 'display', label: 'Display', stack: '"Space Grotesk", ui-sans-serif, system-ui' },
  { id: 'mono', label: 'Mono', stack: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
  { id: 'hand', label: 'Hand', stack: '"Comic Sans MS", "Segoe Print", cursive' },
]

export const TEXT_COLORS = ['#0f172a', '#334155', '#475569', '#2563eb', '#059669', '#b45309', '#dc2626', '#ffffff'] as const
export const BG_COLORS = ['#ffffff', '#f8fafc', '#fef3c7', '#dbeafe', '#dcfce7', '#fef9c3', '#fee2e2', '#0f172a'] as const

/** Extended palettes for dark themes and accent colors used by brochure designs. */
export const DARK_BG_COLORS = ['#0f172a', '#000000', '#1a0a2e', '#111827', '#1e293b', '#334155'] as const
export const CARD_BG_COLORS = ['#1e293b', '#252f3f', '#334155', '#1a1a2e', '#0f172a'] as const
export const ACCENT_COLORS = ['#00e5ff', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'] as const

export const DEFAULT_ZOOM = 1.0
export const ZOOM_STEP = 0.25
export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 4.0
