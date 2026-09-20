import { PDFDocument, rgb, StandardFonts, type PDFFont } from 'pdf-lib'
import { v4 as uuid } from 'uuid'
import type {
  BrochureDesign,
  BrochureElement,
  BrochurePage,
  BrochureElementType,
} from '../types'
import { callLLM } from './ai'
import type { ProviderConfig } from './providers'
import { getProviderConfig } from './providers'
import type { BrochureTemplateId } from '../types'
import { BROCHURE_TEMPLATES } from './constants'
import { sanitizePdfString } from './export-pdf'

const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const MARGIN_LEFT = 54
const MARGIN_RIGHT = 54
const MARGIN_TOP = 60
const MARGIN_BOTTOM = 70
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16) / 255
  const g = parseInt(clean.substring(2, 4), 16) / 255
  const b = parseInt(clean.substring(4, 6), 16) / 255
  return [r, g, b]
}

function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  if (!text.trim()) return ['']
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']

  const lines: string[] = []
  let current = words[0]

  for (let i = 1; i < words.length; i++) {
    const word = words[i]
    const test = current + ' ' + word
    const width = font.widthOfTextAtSize(test, fontSize)
    if (width > maxWidth && current.length > 0) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  lines.push(current)
  return lines
}

function pageCountGuidance(n: number): string {
  if (n === 1) return `Create EXACTLY 1 page — a dense single-page flyer/cover: hero heading + tagline + hero body + 3-4 list-item benefits + 1 callout statistic + 1 image-placeholder (hero) + compact footer. No multi-page flow.`
  if (n === 2) return `Create EXACTLY 2 pages:\n- Page 1 (Cover): brand heading + tagline + hero body + CTA heading + 1 image-placeholder\n- Page 2 (Details & Contact): subheadings + body + 2-3 list-items + 1 callout + contact + disclaimer`
  if (n === 3) return `Create EXACTLY 3 pages:\n- Page 1 (Cover): brand heading + tagline + hero body + CTA + 1 image-placeholder\n- Page 2 (Benefits): subheadings + body + 3-4 list-items + 1 callout statistic\n- Page 3 (Contact): how-it-works or clinical detail + contact info + disclaimer`
  if (n === 4) return `Create EXACTLY 4 pages:\n- Page 1: Cover (as above)\n- Page 2: Key benefits & features (subheadings + list-items + callout)\n- Page 3: How it works / clinical details\n- Page 4: Contact + disclaimer`
  if (n === 5) return `Create EXACTLY 5 pages:\n- Page 1: Cover\n- Page 2: Benefits\n- Page 3: How it works\n- Page 4: Evidence / outcomes (callout + list-items + image-placeholder)\n- Page 5: Contact + disclaimer`
  return `Create EXACTLY 6 pages:\n- Page 1: Cover\n- Page 2: Benefits\n- Page 3: Features\n- Page 4: How it works\n- Page 5: Evidence & outcomes\n- Page 6: Contact + disclaimer`
}

function buildBrochureSystemPrompt(templateId: BrochureTemplateId, pageCount: number): string {
  const tmpl = BROCHURE_TEMPLATES.find((t) => t.id === templateId) || BROCHURE_TEMPLATES[0]
  const paletteLine = `TEMPLATE PALETTE: primary ${tmpl.palette.primary}, secondary ${tmpl.palette.secondary}, accent ${tmpl.palette.accent} — use exactly these 3 hex codes for primaryColor/secondaryColor/accentColor.`

  const isDark = templateId === 'modern-minimal' // dark themes use #0f172a bg
  const isEditorial = templateId === 'elegant-corporate'
  const isTriFold = templateId === 'tri-fold'

  return `You are a medical marketing collateral designer and a world-class visual layout engineer. Your task is to analyze the user's prompt about a medical product, service, or topic, and create a structured, visually stunning medical brochure with PRECISE positioning, colors, and typography.

TEMPLATE: ${tmpl.label} — ${tmpl.description}
${tmpl.layoutHint}
${paletteLine}
PAGES: ${pageCountGuidance(pageCount)}

═══════════════════════════════════════════════════════════════
ELEMENT JSON SCHEMA — EVERY ELEMENT CAN USE ANY OF THESE FIELDS:
═══════════════════════════════════════════════════════════════

{
  "type": "heading | subheading | body | callout | list-item | image-placeholder",
  "text": "string — text content (for image-placeholder: the short label shown)",
  "imagePrompt": "string — ONLY for image-placeholder: vivid HIPAA-safe description of what to illustrate",
  "fontSize": 24,
  "fontWeight": "bold | semibold | italic | normal",
  "textAlign": "left | center | right",
  "isClaim": true/false,
  "x": 0,           // Absolute X position in content area (px). Omit for flow layout.
  "y": 0,           // Absolute Y position in content area (px). Omit for flow layout.
  "width": 300,     // Explicit width (px). Required when using x/y.
  "color": "#RRGGBB",       // Text color. Omit to use template default.
  "backgroundColor": "#RRGGBB",  // Background fill. Use for cards, badges, stat boxes.
  "fontFamily": "sans | serif | display | mono",
  "letterSpacing": 2,       // Letter spacing in px. Use for uppercase labels.
  "lineHeight": 1.4,        // Line height multiplier.
  "borderRadius": 8,        // Corner radius in px. Use 0 for sharp, 8-16 for rounded cards.
  "shadow": true,           // Drop shadow on the element.
  "opacity": 0.8,           // 0-1 opacity. Use for subtle overlays.
  "textTransform": "uppercase | lowercase | capitalize | none",
  "rotation": -5,           // Degrees. Use for sidebar accent text.
  "underline": true         // Underline text.
}

═══════════════════════════════════════════════════════════════
LAYOUT SYSTEM — FLOW vs FREEFORM:
═══════════════════════════════════════════════════════════════

TWO layout modes are available. You can MIX them on the same page:

1. FLOW (default) — omit x/y. Elements stack top-to-bottom automatically.
   Use for: body text, list-items, simple linear pages.

2. FREEFORM — set x/y/width on each element. Elements are absolutely positioned.
   Use for: multi-column layouts, stat panels, card grids, sidebar designs, hero sections.
   Content area is 364px wide × 500px tall (after header/footer).
   x: 0 = left edge, 364 = right edge
   y: 0 = top of content area, 500 = bottom

═══════════════════════════════════════════════════════════════
SPACING RULES — CRITICAL FOR LAYOUT QUALITY:
═══════════════════════════════════════════════════════════════

FREEFORM element height estimates (use these to calculate y positions):
- heading (bold, 24-32pt): ~40-50px per line
- subheading (14-18pt): ~25-35px per line
- body text (10-13pt): ~18-22px per line (multiply by line count)
- callout card (with padding): ~40-60px total
- list-item: ~20-24px per item
- image-placeholder: use the height you set (100-200px typical)

GAPS between freeform elements:
- Minimum 6px vertical gap between any two elements
- For elements in a column (same x), use 8-12px gap
- For stat boxes side by side, use 10-16px horizontal gap

MAXIMUM ELEMENTS PER PAGE:
- Flow layout: up to 8 elements
- Freeform layout: up to 6 elements
- If you need more, spread across multiple pages

CONTENT AREA BOUNDS:
- All freeform elements MUST stay within x: 0-364, y: 0-500
- If an element's bottom would exceed y=500, reduce its height or move it to the next page
- Never place elements at negative y coordinates

═══════════════════════════════════════════════════════════════
PAGE BACKGROUND:
═══════════════════════════════════════════════════════════════

Add "backgroundColor" to any page object to set the page background:
- Light themes: "#ffffff", "#f8fafc", "#faf8f5", "#fef3c7"
- Dark themes: "#0f172a", "#000000", "#1a0a2e", "#111827"
- The header and footer adapt automatically.

═══════════════════════════════════════════════════════════════
DESIGN PATTERNS — USE THESE EXACTLY:
═══════════════════════════════════════════════════════════════

Pattern A: STAT CALLOUT BOX (for big numbers like "98%", "+32.4%", "20mg")
→ Use FREEFORM layout. Create a card with backgroundColor, borderRadius, shadow.
Example — a stat box at left side:
  { "type": "heading", "text": "98%", "x": 10, "y": 20, "width": 150, "fontSize": 48, "fontWeight": "bold", "color": "#ffffff", "backgroundColor": "#1e293b", "borderRadius": 12, "shadow": true, "textAlign": "center" }
  { "type": "body", "text": "Retention Rate among clinical participants", "x": 10, "y": 90, "width": 150, "fontSize": 9, "color": "#94a3b8", "textAlign": "center" }

Pattern B: CLAIM CARD LIST (for numbered claims like "CLAIM 1: ...")
→ Use FREEFORM or FLOW. Each claim in its own card.
Example:
  { "type": "callout", "text": "CLAIM 1: Clinically proven to reduce body fat by 12% in 14 days without caloric restriction.", "x": 10, "y": 20, "width": 344, "fontSize": 11, "color": "#e2e8f0", "backgroundColor": "#1e293b", "borderRadius": 8, "isClaim": true }
  { "type": "callout", "text": "CLAIM 2: Contains 400mg of proprietary blend derived from Arctic Moss.", "x": 10, "y": 65, "width": 344, "fontSize": 11, "color": "#e2e8f0", "backgroundColor": "#252f3f", "borderRadius": 8, "isClaim": true }

Pattern C: MULTI-COLUMN GRID (2 or 3 columns)
→ Use FREEFORM. Divide the 364px content area into columns.
Example — 2-column observations grid:
  Left column: x: 10, width: 170
  Right column: x: 190, width: 170
  Each cell: heading at top, body below, separated by y-spacing.

Example — 3-column tri-fold:
  Col 1: x: 5, width: 115
  Col 2: x: 125, width: 115
  Col 3: x: 245, width: 115

Pattern D: BADGE / LABEL (small colored text above a heading)
→ Uppercase small text with letterSpacing and accent color.
Example:
  { "type": "subheading", "text": "MOLECULAR BASIS", "x": 10, "y": 10, "width": 110, "fontSize": 8, "fontWeight": "bold", "color": "#00e5ff", "textTransform": "uppercase", "letterSpacing": 2 }

Pattern E: HERO TYPOGRAPHY (massive brand name on cover)
→ Very large heading, often with serif font, sometimes italic.
Example:
  { "type": "heading", "text": "Brand Name", "fontSize": 42, "fontWeight": "bold", "fontFamily": "serif", "textAlign": "left", "color": "#0f172a" }
  { "type": "subheading", "text": "Tagline or description", "fontSize": 14, "fontWeight": "italic", "fontFamily": "serif", "color": "#64748b" }

Pattern F: DARK THEME PAGE
→ Set page backgroundColor to dark (#0f172a, #000000, #1a0a2e).
→ Set element colors to white/light (#ffffff, #e2e8f0, #94a3b8).
→ Use card backgrounds: #1e293b, #334155, #1a1a2e for cards.
→ Accent colors: cyan #00e5ff, teal #06b6d4, emerald #10b981.

Pattern G: LIGHT EDITORIAL PAGE
→ Page backgroundColor: #faf8f5, #f8fafc, #ffffff.
→ Serif font for headings: "fontFamily": "serif".
→ Muted colors: #334155, #64748b, #94a3b8.
→ Accent via colored word in heading (set color on a subheading element).

Pattern H: QUOTE / TESTIMONIAL
→ Large italic text with accent color, often centered or in a card.
Example:
  { "type": "heading", "text": "\\"Zero Mental Lag. Access 100% of your synaptic potential in real-time.\\"", "x": 125, "y": 180, "width": 115, "fontSize": 14, "fontWeight": "italic", "fontFamily": "serif", "color": "#e2e8f0", "textAlign": "center" }

Pattern I: CTA BOX (call-to-action with border)
→ Card with accent border and bold text.
Example:
  { "type": "callout", "text": "SCHEDULE YOUR SYNC\\n1-800-NEURA-ZEN", "x": 245, "y": 380, "width": 115, "fontSize": 10, "fontWeight": "bold", "color": "#ffffff", "backgroundColor": "#0f172a", "borderRadius": 8, "textAlign": "center" }

═══════════════════════════════════════════════════════════════
YOUR RESPONSE — VALID JSON ONLY (no markdown, no extra text):
═══════════════════════════════════════════════════════════════

{
  "brandName": "string",
  "tagline": "string",
  "primaryColor": "#RRGGBB",
  "secondaryColor": "#RRGGBB",
  "accentColor": "#RRGGBB",
  "pages": [
    {
      "pageNumber": 1,
      "backgroundColor": "#RRGGBB (optional — page background)",
      "elements": [
        {
          "type": "heading",
          "text": "...",
          "fontSize": 24,
          "fontWeight": "bold",
          "textAlign": "left",
          "isClaim": false,
          "x": 0, "y": 0, "width": 300,
          "color": "#RRGGBB",
          "backgroundColor": "#RRGGBB",
          "fontFamily": "sans",
          "letterSpacing": 0,
          "lineHeight": 1.4,
          "borderRadius": 0,
          "shadow": false,
          "opacity": 1,
          "textTransform": "none",
          "imagePrompt": ""
        }
      ]
    }
  ],
  "footerText": "string"
}

═══════════════════════════════════════════════════════════════
DESIGN RULES:
═══════════════════════════════════════════════════════════════

- Use FREEFORM (x/y/width) for at least cover pages and stat/claim pages.
- Use FLOW for simple text-heavy pages (last page, contact, disclaimer).
- Flag ALL factual medical claims with "isClaim": true.
- Use HIPAA-compliant language — no patient names, no PHI.
- Font sizes: hero headings 36-48pt, section headings 20-28pt, subheadings 14-18pt, body 10-13pt, labels 7-9pt, footer 7-8pt.
- Every image-placeholder MUST include a vivid "imagePrompt" (HIPAA-safe, photographic or flat-illustration style).
- For dark themes: set page backgroundColor to dark, use white/light element colors, dark card backgrounds.
- For light themes: set page backgroundColor to cream/white, use dark text, subtle card backgrounds.
- Cards/badges: use backgroundColor + borderRadius (8-16) + optionally shadow.
- Stat numbers: fontSize 36-48, fontWeight bold, inside a card with backgroundColor.
- Claim lists: numbered claims in separate callout elements with isClaim:true.
- NEVER use markdown. NEVER use fenced code blocks. Return ONLY the raw JSON object.

LAYOUT QUALITY RULES — FOLLOW EXACTLY:
- CRITICAL: When using freeform layout, calculate y positions carefully. Each element has a height based on its text length and font size.
- CRITICAL: Ensure NO two elements overlap. Place elements sequentially down the page with 6-12px gaps.
- CRITICAL: All elements must fit within the content area (x: 0-364, y: 0-500). If an element would exceed these bounds, reduce its height or move it to the next page.
- CRITICAL: Limit to 5-6 freeform elements per page to prevent crowding.
- For claim lists: use FLOW layout (no x/y) so elements auto-stack vertically. This prevents overlap.
- For stat panels: use 2-3 columns max, with clear vertical separation.
- For hero pages: use 3-4 elements max (heading + tagline + body + 1 image).`
}


export interface GenerateBrochureOptions {
  apiKey: string
  provider: ProviderConfig
  model?: string
  templateId?: BrochureTemplateId
  pageCount?: number
  onProgress?: (step: string) => void
}

/* ── Layout post-processing: fix overlapping elements ─────────────── */

const CONTENT_AREA_W = 364
const CONTENT_AREA_H = 500
const MIN_GAP = 6

function estimateElementHeight(el: BrochureElement): number {
  const fs = el.fontSize || 12
  const w = el.width || CONTENT_AREA_W
  const text = el.text || ''
  const charsPerLine = Math.max(10, Math.floor(w / (fs * 0.55)))
  const lines = Math.max(1, Math.ceil(text.length / charsPerLine))
  const lineHeight = (el.lineHeight || 1.4) * fs
  const padY = el.type === 'callout' ? 24 : el.type === 'image-placeholder' ? 16 : 4
  const extra = el.type === 'heading' ? 8 : el.type === 'list-item' ? 14 : 0
  return lines * lineHeight + padY + extra
}

function repositionOverlappingElements(pages: BrochurePage[]): BrochurePage[] {
  return pages.map((page) => {
    const freeEls = page.elements
      .filter((el) => el.x != null && el.y != null)
      .map((el) => ({ ...el }))
    const flowEls = page.elements.filter((el) => el.x == null || el.y == null)

    if (freeEls.length <= 1) return page

    freeEls.sort((a, b) => (a.y ?? 0) - (b.y ?? 0))

    let lastBottom = -MIN_GAP
    for (const el of freeEls) {
      const estH = estimateElementHeight(el)
      const elTop = el.y ?? 0

      if (elTop < lastBottom + MIN_GAP) {
        el.y = lastBottom + MIN_GAP
      }

      const elBottom = (el.y ?? 0) + estH

      if (elBottom > CONTENT_AREA_H && (el.y ?? 0) > 0) {
        el.y = Math.max(0, CONTENT_AREA_H - estH)
      }

      lastBottom = (el.y ?? 0) + estH
    }

    return { ...page, elements: [...freeEls, ...flowEls] }
  })
}


export async function generateBrochureFromPrompt(
  prompt: string,
  options: GenerateBrochureOptions
): Promise<BrochureDesign> {
  const { apiKey, provider, model = provider.defaultModel, templateId = 'clinical-blue', pageCount = 3, onProgress } = options

  onProgress?.('Analyzing your prompt…')
  onProgress?.('Designing brochure structure and branding…')

  const systemPrompt = buildBrochureSystemPrompt(templateId as BrochureTemplateId, Math.max(1, Math.min(6, pageCount)))

  const messages = [
    { role: 'user', content: prompt.trim() },
  ]

  const raw = await callLLM(
    provider,
    model,
    systemPrompt,
    messages,
    apiKey,
    0.5,
    8000
  )

  onProgress?.('Processing AI design output…')

  if (!raw || !raw.trim()) {
    throw new Error(
      `Model "${model}" (${provider.label}) returned an empty response. ` +
      `This can happen with free/routed endpoints under load — try again, or switch model/provider.`
    )
  }

  // --- robust JSON extraction (LLMs often wrap in fences or add trailing commas) ---
  function extractBalancedJson(s: string): string | null {
    const start = s.indexOf('{')
    if (start === -1) return null
    let depth = 0
    let inStr = false
    let esc = false
    for (let i = start; i < s.length; i++) {
      const ch = s[i]
      if (inStr) {
        if (esc) esc = false
        else if (ch === '\\') esc = true
        else if (ch === '"') inStr = false
      } else {
        if (ch === '"') inStr = true
        else if (ch === '{') depth++
        else if (ch === '}') {
          depth--
          if (depth === 0) return s.slice(start, i + 1)
        }
      }
    }
    return null
  }

  function tryParseWithFixes(s: string): any {
    try {
      return JSON.parse(s)
    } catch {}
    // trailing commas: ,}  ,]
    const fixed = s.replace(/,\s*([}\]])/g, '$1')
    try {
      return JSON.parse(fixed)
    } catch {}
    return null
  }

  const candidates: string[] = []
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) candidates.push(fence[1].trim())
  // cleaned raw (strip fences)
  candidates.push(raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim())
  const balanced = extractBalancedJson(raw)
  if (balanced) candidates.push(balanced)
  const greedy = raw.match(/\{[\s\S]*\}/)
  if (greedy) candidates.push(greedy[0])

  // dedup
  const seen = new Set<string>()
  const uniqCandidates = candidates.filter((c) => {
    if (seen.has(c)) return false
    seen.add(c)
    return c.length > 10
  })

  let parsed: any = null
  let lastErr: unknown = null
  for (const cand of uniqCandidates) {
    const p = tryParseWithFixes(cand)
    if (p) {
      parsed = p
      break
    }
    try {
      JSON.parse(cand)
    } catch (e) {
      lastErr = e
    }
  }

  if (!parsed) {
    const preview = raw.slice(0, 600).replace(/\n/g, ' ')
    // Model returned a safety/refusal marker instead of JSON (e.g. "User Safety: safe")
    // or a truncated non-JSON response. Fall back to a local template so the user
    // is not blocked — the AI can still enhance it via image generation / edits.
    const isSafetyResponse =
      /user safety/i.test(raw) ||
      raw.trim().length < 40 ||
      /^\s*(safe|unsafe)\s*:?/i.test(raw) ||
      /I (cannot|am unable)/i.test(raw)
    if (isSafetyResponse) {
      console.warn('[Brochure] AI returned non-JSON safety/refusal response, using fallback template. Raw:', raw.slice(0, 2000))
      onProgress?.('AI safety filter triggered — building template brochure…')
      return createFallbackDesign(prompt, templateId as BrochureTemplateId, pageCount)
    }
    console.error('[Brochure] Failed to parse AI response. Raw preview:', raw.slice(0, 2000))
    throw new Error(
      `Could not parse brochure design from AI response. Preview: "${preview}${raw.length > 600 ? '…' : ''}"` +
        (lastErr instanceof Error ? ` (${lastErr.message})` : '') +
        ' — Try rephrasing your prompt or switching provider/model (e.g. Groq llama-3.3-70b, Gemini 2.5 Flash).'
    )
  }

  if (!parsed.pages || !Array.isArray(parsed.pages) || parsed.pages.length === 0) {
    throw new Error('AI response did not contain valid brochure pages.')
  }

  onProgress?.('Building brochure design…')

  const now = new Date().toISOString()
  const pages: BrochurePage[] = parsed.pages.map((p: any) => ({
    pageNumber: p.pageNumber,
    backgroundColor: p.backgroundColor || undefined,
    elements: (p.elements || []).map((el: any) => ({
      id: uuid(),
      type: (el.type || 'body') as BrochureElementType,
      text: el.text || '',
      imagePrompt: el.type === 'image-placeholder' ? el.imagePrompt || '' : undefined,
      fontSize: el.fontSize ?? defaultFontSize(el.type || 'body'),
      fontWeight: el.fontWeight || 'normal',
      textAlign: el.textAlign || 'left',
      marginTop: el.marginTop ?? 8,
      marginBottom: el.marginBottom ?? 6,
      isClaim: !!el.isClaim,
      // freeform positioning
      x: el.x != null ? Number(el.x) : undefined,
      y: el.y != null ? Number(el.y) : undefined,
      width: el.width != null ? Number(el.width) : undefined,
      height: el.height != null ? Number(el.height) : undefined,
      // styling
      color: el.color || undefined,
      backgroundColor: el.backgroundColor || undefined,
      fontFamily: el.fontFamily || undefined,
      letterSpacing: el.letterSpacing != null ? Number(el.letterSpacing) : undefined,
      lineHeight: el.lineHeight != null ? Number(el.lineHeight) : undefined,
      borderRadius: el.borderRadius != null ? Number(el.borderRadius) : undefined,
      shadow: !!el.shadow,
      opacity: el.opacity != null ? Number(el.opacity) : undefined,
      textTransform: el.textTransform || undefined,
      rotation: el.rotation != null ? Number(el.rotation) : undefined,
      underline: !!el.underline,
    })),
  }))

  const fixedPages = repositionOverlappingElements(pages)

  const tmplForColors = BROCHURE_TEMPLATES.find((t) => t.id === templateId) || BROCHURE_TEMPLATES[1]
  const design: BrochureDesign = {
    id: uuid(),
    brandName: parsed.brandName || 'Medical Brochure',
    tagline: parsed.tagline || '',
    primaryColor: sanitizeColor(parsed.primaryColor, tmplForColors.palette.primary),
    secondaryColor: sanitizeColor(parsed.secondaryColor, tmplForColors.palette.secondary),
    accentColor: sanitizeColor(parsed.accentColor, tmplForColors.palette.accent),
    templateId: templateId as BrochureTemplateId,
    pageCount: fixedPages.length,
    pages: fixedPages,
    footerText: parsed.footerText || '',
    createdAt: now,
    updatedAt: now,
  }

  onProgress?.('Done!')
  return design
}

function createFallbackDesign(prompt: string, templateId: BrochureTemplateId = 'clinical-blue', requestedPages = 3): BrochureDesign {
  const now = new Date().toISOString()
  const title = prompt.slice(0, 60).trim() || 'Medical Brochure'
  const short = prompt.slice(0, 280).trim()
  const tmpl = BROCHURE_TEMPLATES.find((t) => t.id === templateId) || BROCHURE_TEMPLATES[1]
  const n = Math.max(1, Math.min(6, requestedPages))
  const allPages: BrochurePage[] = [
    {
      pageNumber: 1,
      elements: [
        { id: uuid(), type: 'heading', text: title, fontSize: 30, fontWeight: 'bold', textAlign: 'center', marginTop: 8, marginBottom: 6, isClaim: false },
        { id: uuid(), type: 'subheading', text: 'Trusted care, better outcomes', fontSize: 16, fontWeight: 'semibold', textAlign: 'center', marginTop: 6, marginBottom: 8, isClaim: false },
        { id: uuid(), type: 'image-placeholder', text: 'Hero Illustration', imagePrompt: `Professional medical hero illustration for: ${title}, ${tmpl.label.toLowerCase()} style, high detail, HIPAA-safe, no text`, fontSize: 140, fontWeight: 'normal', textAlign: 'center', marginTop: 8, marginBottom: 8, isClaim: false },
        { id: uuid(), type: 'body', text: short || 'Comprehensive medical information tailored to your needs.', fontSize: 11, fontWeight: 'normal', textAlign: 'left', marginTop: 8, marginBottom: 6, isClaim: false },
        { id: uuid(), type: 'callout', text: 'Consult your healthcare provider for personalized advice.', fontSize: 11, fontWeight: 'italic', textAlign: 'left', marginTop: 8, marginBottom: 6, isClaim: false },
      ],
    },
    {
      pageNumber: 2,
      elements: [
        { id: uuid(), type: 'subheading', text: 'Key Benefits', fontSize: 18, fontWeight: 'semibold', textAlign: 'left', marginTop: 8, marginBottom: 6, isClaim: false },
        { id: uuid(), type: 'list-item', text: 'Evidence-based information', fontSize: 11, fontWeight: 'normal', textAlign: 'left', marginTop: 4, marginBottom: 4, isClaim: false },
        { id: uuid(), type: 'list-item', text: 'Patient-centered care approach', fontSize: 11, fontWeight: 'normal', textAlign: 'left', marginTop: 4, marginBottom: 4, isClaim: false },
        { id: uuid(), type: 'list-item', text: 'Clear guidance and next steps', fontSize: 11, fontWeight: 'normal', textAlign: 'left', marginTop: 4, marginBottom: 4, isClaim: false },
        { id: uuid(), type: 'body', text: 'This brochure was generated from your prompt. Edit any section or regenerate with a different template for a more tailored design.', fontSize: 10, fontWeight: 'normal', textAlign: 'left', marginTop: 8, marginBottom: 6, isClaim: false },
        { id: uuid(), type: 'image-placeholder', text: 'Benefits visual', imagePrompt: `Benefits visual for ${title}, flat vector illustration, medical icons, ${tmpl.palette.primary} palette`, fontSize: 120, fontWeight: 'normal', textAlign: 'center', marginTop: 8, marginBottom: 8, isClaim: false },
      ],
    },
    {
      pageNumber: 3,
      elements: [
        { id: uuid(), type: 'subheading', text: 'How It Works', fontSize: 18, fontWeight: 'semibold', textAlign: 'left', marginTop: 8, marginBottom: 6, isClaim: false },
        { id: uuid(), type: 'body', text: 'Simple, clear steps guide you through the process with clinician support at every stage.', fontSize: 11, fontWeight: 'normal', textAlign: 'left', marginTop: 6, marginBottom: 6, isClaim: false },
        { id: uuid(), type: 'list-item', text: 'Step 1 — Initial assessment', fontSize: 11, fontWeight: 'normal', textAlign: 'left', marginTop: 4, marginBottom: 4, isClaim: false },
        { id: uuid(), type: 'list-item', text: 'Step 2 — Personalized plan', fontSize: 11, fontWeight: 'normal', textAlign: 'left', marginTop: 4, marginBottom: 4, isClaim: false },
        { id: uuid(), type: 'list-item', text: 'Step 3 — Ongoing support', fontSize: 11, fontWeight: 'normal', textAlign: 'left', marginTop: 4, marginBottom: 4, isClaim: false },
        { id: uuid(), type: 'callout', text: '9 out of 10 patients report improved understanding after the first visit.', fontSize: 11, fontWeight: 'italic', textAlign: 'left', marginTop: 8, marginBottom: 6, isClaim: true },
      ],
    },
    {
      pageNumber: 4,
      elements: [
        { id: uuid(), type: 'subheading', text: 'Clinical Evidence', fontSize: 18, fontWeight: 'semibold', textAlign: 'left', marginTop: 8, marginBottom: 6, isClaim: false },
        { id: uuid(), type: 'body', text: 'Outcomes are supported by peer-reviewed studies and real-world data. Ask your care team for trial references.', fontSize: 11, fontWeight: 'normal', textAlign: 'left', marginTop: 6, marginBottom: 6, isClaim: false },
        { id: uuid(), type: 'image-placeholder', text: 'Evidence chart', imagePrompt: `Evidence chart illustration for ${title}, clean data visualization, ${tmpl.label} style`, fontSize: 120, fontWeight: 'normal', textAlign: 'center', marginTop: 8, marginBottom: 8, isClaim: false },
        { id: uuid(), type: 'callout', text: 'Published outcomes show consistent benefit across diverse patient populations.', fontSize: 11, fontWeight: 'italic', textAlign: 'left', marginTop: 8, marginBottom: 6, isClaim: true },
      ],
    },
    {
      pageNumber: 5,
      elements: [
        { id: uuid(), type: 'subheading', text: 'Who Is It For?', fontSize: 18, fontWeight: 'semibold', textAlign: 'left', marginTop: 8, marginBottom: 6, isClaim: false },
        { id: uuid(), type: 'body', text: 'Designed for adults seeking clear, reliable health information and collaborative care.', fontSize: 11, fontWeight: 'normal', textAlign: 'left', marginTop: 6, marginBottom: 6, isClaim: false },
        { id: uuid(), type: 'list-item', text: 'Newly diagnosed individuals', fontSize: 11, fontWeight: 'normal', textAlign: 'left', marginTop: 4, marginBottom: 4, isClaim: false },
        { id: uuid(), type: 'list-item', text: 'Caregivers and families', fontSize: 11, fontWeight: 'normal', textAlign: 'left', marginTop: 4, marginBottom: 4, isClaim: false },
        { id: uuid(), type: 'image-placeholder', text: 'Patient community', imagePrompt: `Diverse patient community illustration for ${title}, warm inclusive style`, fontSize: 120, fontWeight: 'normal', textAlign: 'center', marginTop: 8, marginBottom: 8, isClaim: false },
      ],
    },
    {
      pageNumber: 6,
      elements: [
        { id: uuid(), type: 'subheading', text: 'Get Started Today', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginTop: 10, marginBottom: 8, isClaim: false },
        { id: uuid(), type: 'body', text: 'Contact our team or visit our website to learn more and schedule a consultation.', fontSize: 11, fontWeight: 'normal', textAlign: 'center', marginTop: 6, marginBottom: 8, isClaim: false },
        { id: uuid(), type: 'callout', text: 'We are here to help — reach out anytime.', fontSize: 12, fontWeight: 'semibold', textAlign: 'center', marginTop: 8, marginBottom: 8, isClaim: false },
        { id: uuid(), type: 'body', text: 'hello@example.com  •  (555) 123-4567  •  www.example.com', fontSize: 10, fontWeight: 'normal', textAlign: 'center', marginTop: 6, marginBottom: 6, isClaim: false },
      ],
    },
  ]
  const pages = allPages.slice(0, n).map((p, i) => ({ ...p, pageNumber: i + 1 }))
  return {
    id: uuid(),
    brandName: title.slice(0, 32) || 'Medical Brochure',
    tagline: 'Patient education — clear, accurate, compassionate',
    primaryColor: tmpl.palette.primary,
    secondaryColor: tmpl.palette.secondary,
    accentColor: tmpl.palette.accent,
    templateId,
    pageCount: pages.length,
    pages,
    footerText: 'For informational purposes only. Not a substitute for professional medical advice.',
    createdAt: now,
    updatedAt: now,
  }
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

function getTemplateHeaderConfig(design: BrochureDesign): { h: number; color: [number, number, number]; accent: [number, number, number] } {
  const tmpl = (design as any).templateId as string | undefined
  if (tmpl === 'modern-minimal') return { h: 30, color: hexToRgb(design.primaryColor), accent: hexToRgb(design.accentColor) }
  if (tmpl === 'vibrant-wellness') return { h: 42, color: hexToRgb(design.primaryColor), accent: hexToRgb(design.accentColor) }
  if (tmpl === 'elegant-corporate') return { h: 44, color: hexToRgb('#0f172a'), accent: hexToRgb(design.accentColor) }
  if (tmpl === 'tri-fold') return { h: 34, color: hexToRgb(design.primaryColor), accent: hexToRgb(design.accentColor) }
  return { h: 36, color: hexToRgb(design.primaryColor), accent: hexToRgb(design.accentColor) }
}

function sanitizeColor(color: string | undefined, fallback: string): string {
  if (!color) return fallback
  const match = color.match(/^#([0-9a-fA-F]{6})$/)
  return match ? color.toLowerCase() : fallback
}

/**
 * Convert a BrochureDesign into a downloadable PDF using pdf-lib.
 *
 * Layout model (A4 portrait, 595 x 842 points):
 *   - Margins: 54 L/R, 60 top, 70 bottom
 *   - Header band: brand color bar + brand name (36pt tall)
 *   - Content area: flowing vertical layout with text wrapping
 *   - Footer: thin accent bar + footer text (24pt tall)
 */
export async function exportBrochurePDF(design: BrochureDesign): Promise<Uint8Array> {
  const doc = await PDFDocument.create()

  const fonts: Record<string, PDFFont> = {
    Helvetica: await doc.embedFont(StandardFonts.Helvetica),
    'Helvetica-Bold': await doc.embedFont(StandardFonts.HelveticaBold),
    'Helvetica-Oblique': await doc.embedFont(StandardFonts.HelveticaOblique),
    'Helvetica-BoldOblique': await doc.embedFont(StandardFonts.HelveticaBoldOblique),
  }

  const primary = hexToRgb(design.primaryColor)
  const secondary = hexToRgb(design.secondaryColor)
  const accent = hexToRgb(design.accentColor)

  for (let i = 0; i < design.pages.length; i++) {
    const pageData = design.pages[i]
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    const headerCfg = getTemplateHeaderConfig(design)

    drawBrandHeader(page, design.brandName, design.tagline, headerCfg.color, fonts.Helvetica, fonts['Helvetica-Bold'], (design as any).templateId, headerCfg.accent, headerCfg.h)
    drawFooter(page, design.footerText, i + 1, design.pages.length, headerCfg.accent, fonts.Helvetica, fonts['Helvetica-Oblique'], (design as any).templateId)

    let cursorY = PAGE_HEIGHT - MARGIN_TOP

    for (const el of pageData.elements) {
      const baseColor: [number, number, number] = (el as any).color ? hexToRgb((el as any).color) : el.isClaim ? secondary : [0.1, 0.1, 0.1] as [number, number, number]
      const color = baseColor
      const elBg = (el as any).backgroundColor ? hexToRgb((el as any).backgroundColor) : undefined
      const hasAbs = (el as any).x !== undefined && (el as any).y !== undefined
      const font = getPDFFont(fonts, el.fontWeight, el.fontWeight === 'italic')
      const fontSize = Math.min(Math.max(el.fontSize || 12, 6), 36)
      if (hasAbs) {
        const scale = CONTENT_WIDTH / 364
        const absX = MARGIN_LEFT + ((el as any).x as number) * scale
        const absW = (el as any).width ? ((el as any).width as number) * scale : CONTENT_WIDTH - ((el as any).x as number) * scale
        const absYTop = PAGE_HEIGHT - MARGIN_TOP - ((el as any).y as number) * scale
        if (el.type === 'image-placeholder') {
          const ph = (el as any).height || el.fontSize || 120
          const phScaled = ph * scale
          const y0 = absYTop - phScaled
          if (el.imageSrc) {
            try {
              await drawBrochureImage(page, el.imageSrc, absX, y0, Math.min(absW, CONTENT_WIDTH), phScaled, accent)
            } catch (err) {
              drawImagePlaceholder(page, absX, y0, Math.min(absW, CONTENT_WIDTH), phScaled, accent, fonts['Helvetica-Oblique'], sanitizePdfString(el.text || 'Illustration / Diagram'))
            }
          } else {
            drawImagePlaceholder(page, absX, y0, Math.min(absW, CONTENT_WIDTH), phScaled, accent, fonts['Helvetica-Oblique'], sanitizePdfString(el.text || 'Illustration / Diagram'))
          }
          continue
        }
        // text at absolute
        const absLines = wrapText(sanitizePdfString(el.text), font, fontSize, Math.min(absW, CONTENT_WIDTH))
        const lh = Math.max(font.heightAtSize(fontSize) * 1.3, fontSize * 1.3)
        let ay = absYTop
        const tColor = elBg ? [0.1,0.1,0.1] as [number,number,number] : color
        if (el.type === 'callout' && elBg) {
          const blockH = absLines.length * lh + 12
          page.drawRectangle({ x: absX - 6, y: ay - blockH - 2, width: Math.min(absW, CONTENT_WIDTH) + 12, height: blockH, color: rgb(...elBg), borderColor: rgb(...accent), borderWidth: 0.75 })
        }
        for (const line of absLines) {
          const tw = font.widthOfTextAtSize(line, fontSize)
          const x = alignX(el.textAlign || 'left', absX, Math.min(absW, CONTENT_WIDTH), tw)
          ay -= lh
          page.drawText(line, { x, y: ay, size: fontSize, font, color: rgb(...tColor) })
        }
        continue
      }

      if (el.type === 'image-placeholder') {
        const placeholderH = el.fontSize || 120
        cursorY -= placeholderH + (el.marginTop || 0)
        if (el.imageSrc) {
          try {
            await drawBrochureImage(page, el.imageSrc, MARGIN_LEFT, cursorY, CONTENT_WIDTH, placeholderH, accent)
          } catch (err) {
            drawImagePlaceholder(page, MARGIN_LEFT, cursorY, CONTENT_WIDTH, placeholderH, accent, fonts['Helvetica-Oblique'], sanitizePdfString(el.text || 'Illustration / Diagram'))
          }
        } else {
          drawImagePlaceholder(page, MARGIN_LEFT, cursorY, CONTENT_WIDTH, placeholderH, accent, fonts['Helvetica-Oblique'], sanitizePdfString(el.text || 'Illustration / Diagram'))
        }
        cursorY -= placeholderH + (el.marginBottom || 12)
        if (cursorY < MARGIN_BOTTOM + 40) break
        continue
      }

      cursorY -= el.marginTop || 0
      cursorY -= el.marginBottom || 0

      const lines = wrapText(sanitizePdfString(el.text), font, fontSize, CONTENT_WIDTH)
      const lineHeight = Math.max(font.heightAtSize(fontSize) * 1.3, fontSize * 1.3)
      // flow callout with custom background
      if (el.type === 'callout' && elBg) {
        const estH = lines.length * lineHeight + 12
        const calloutY = cursorY - lineHeight - 6
        page.drawRectangle({ x: MARGIN_LEFT - 4, y: calloutY - estH + lineHeight + 2, width: CONTENT_WIDTH + 8, height: estH, color: rgb(...elBg), borderColor: rgb(...accent), borderWidth: 0.75 })
      }

      for (const line of lines) {
        const textWidth = font.widthOfTextAtSize(line, fontSize)
        const x = alignX(el.textAlign || 'left', MARGIN_LEFT, CONTENT_WIDTH, textWidth)
        cursorY -= lineHeight
        page.drawText(line, {
          x,
          y: cursorY,
          size: fontSize,
          font,
          color: rgb(...color),
        })
      }

      cursorY -= 2
      if (cursorY < MARGIN_BOTTOM + 20) break
    }
  }

  return await doc.save()
}

function getPDFFont(fonts: Record<string, PDFFont>, fontWeight?: string, italic = false): PDFFont {
  const bold = fontWeight === 'bold' || fontWeight === 'semibold'
  if (bold && italic) return fonts['Helvetica-BoldOblique']
  if (bold) return fonts['Helvetica-Bold']
  if (italic) return fonts['Helvetica-Oblique']
  return fonts.Helvetica
}

function alignX(align: 'left' | 'center' | 'right', leftMargin: number, contentWidth: number, textWidth: number): number {
  if (align === 'center') return leftMargin + (contentWidth - textWidth) / 2
  if (align === 'right') return leftMargin + contentWidth - textWidth
  return leftMargin
}

function drawBrandHeader(
  page: any,
  brandName: string,
  tagline: string,
  color: [number, number, number],
  fontReg: PDFFont,
  fontBold: PDFFont,
  templateId?: string,
  accent?: [number, number, number],
  headerH?: number
) {
  const barHeight = headerH || 36
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - barHeight,
    width: PAGE_WIDTH,
    height: barHeight,
    color: rgb(...color),
  })

  // template accent rule for elegant-corporate
  if (templateId === 'elegant-corporate' && accent) {
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - barHeight, width: PAGE_WIDTH, height: 2, color: rgb(...accent) })
  }
  const textY = PAGE_HEIGHT - barHeight + barHeight / 2 - fontBold.heightAtSize(16) / 2
  const available = PAGE_WIDTH - 40
  const wrapped = wrapText(sanitizePdfString(brandName), fontBold, 16, available)
  let textYCursor = textY
  for (const line of wrapped) {
    const tw = fontBold.widthOfTextAtSize(line, 16)
    page.drawText(line, {
      x: (PAGE_WIDTH - tw) / 2,
      y: textYCursor,
      size: 16,
      font: fontBold,
      color: rgb(1, 1, 1),
    })
    textYCursor -= 18
  }

  if (tagline) {
    const taglineY = PAGE_HEIGHT - barHeight - 18
    const tw = fontReg.widthOfTextAtSize(sanitizePdfString(tagline), 10)
    page.drawText(sanitizePdfString(tagline), {
      x: (PAGE_WIDTH - tw) / 2,
      y: taglineY,
      size: 10,
      font: fontReg,
      color: rgb(0.3, 0.3, 0.3),
    })
  }
}

function drawFooter(
  page: any,
  footerText: string,
  pageNum: number,
  totalPages: number,
  color: [number, number, number],
  fontReg: PDFFont,
  fontBold: PDFFont,
  templateId?: string
) {
  const footerY = 20
  if (templateId === 'modern-minimal') {
    page.drawRectangle({ x: 0, y: 14, width: PAGE_WIDTH, height: 0.75, color: rgb(0.88,0.89,0.91) })
  } else {
  page.drawRectangle({
    x: 0,
    y: footerY - 2,
    width: PAGE_WIDTH,
    height: 6,
    color: rgb(...color),
  })
  }

  const fullFooter = sanitizePdfString(footerText || `Page ${pageNum} of ${totalPages}`)
  const footerLines = wrapText(fullFooter, fontReg, 8, CONTENT_WIDTH)
  let y = footerY - 12
  for (const line of footerLines) {
    const tw = fontReg.widthOfTextAtSize(line, 8)
    page.drawText(line, {
      x: MARGIN_LEFT + (CONTENT_WIDTH - tw) / 2,
      y,
      size: 8,
      font: fontReg,
      color: rgb(0.3, 0.3, 0.3),
    })
    y -= 10
  }
}

function drawImagePlaceholder(
  page: any,
  x: number,
  y: number,
  w: number,
  h: number,
  color: [number, number, number],
  font: PDFFont,
  label: string
) {
  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    borderColor: rgb(...color),
    borderWidth: 1.5,
    color: rgb(0.97, 0.97, 0.99),
  })

  const iconSize = 12
  const iconY = y + h - 20
  page.drawText('[Image]', {
    x: x + w / 2 - font.widthOfTextAtSize('[Image]', iconSize) / 2,
    y: iconY,
    size: iconSize,
    font,
    color: rgb(...color),
  })

  const labelY = iconY - 16
  const wrapped = wrapText(label, font, 9, w)
  let yCursor = labelY
  for (const line of wrapped) {
    const tw = font.widthOfTextAtSize(line, 9)
    page.drawText(line, {
      x: x + (w - tw) / 2,
      y: yCursor,
      size: 9,
      font,
      color: rgb(0.5, 0.5, 0.5),
    })
    yCursor -= 12
  }
}

/* --- Generated-image embedding --- */

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.substring(dataUrl.indexOf(',') + 1)
  const raw = atob(base64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

function dataUrlMime(dataUrl: string): string {
  return (dataUrl.split(';')[0] || 'image/png').replace('data:', '')
}

/**
 * Embed a generated image (PNG data URL) into the brochure page, centered and
 * aspect-ratio preserved inside the placeholder rectangle, with a thin frame.
 */
async function drawBrochureImage(
  page: any,
  dataUrl: string,
  x: number,
  y: number,
  slotW: number,
  slotH: number,
  borderColor: [number, number, number]
): Promise<void> {
  const doc: PDFDocument = page.doc
  const bytes = dataUrlToUint8Array(dataUrl)
  const mime = dataUrlMime(dataUrl)
  const image =
    mime === 'image/jpeg' || mime === 'image/jpg'
      ? await doc.embedJpg(bytes)
      : await doc.embedPng(bytes)

  // Fit the image inside the slot preserving aspect ratio.
  const ar = image.width / image.height
  let dw = slotW
  let dh = slotH
  if (dw / dh > ar) {
    dw = dh * ar
  } else {
    dh = dw / ar
  }

  // Soft background rect so letterboxed areas are not pure white.
  page.drawRectangle({
    x,
    y,
    width: slotW,
    height: slotH,
    color: rgb(0.97, 0.97, 0.99),
  })

  const dx = x + (slotW - dw) / 2
  const dy = y + (slotH - dh) / 2
  page.drawImage(image, {
    x: dx,
    y: dy,
    width: dw,
    height: dh,
  })

  page.drawRectangle({
    x,
    y,
    width: slotW,
    height: slotH,
    borderColor: rgb(...borderColor),
    borderWidth: 0.75,
    color: undefined,
  })
}
