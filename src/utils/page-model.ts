import type { PageModelData } from '../types'
import { groupItemsIntoLines } from './coordinates'

interface RawTextItem {
  str: string
  x: number
  y: number
  width: number
  height: number
  fontSize?: number
  fontName?: string
  hasEOL?: boolean
  transform?: number[]
}

interface RawPageData {
  page: number
  items: RawTextItem[]
  pageHeight: number
}

export function createPageModel(page: RawPageData): PageModelData {
  let fullText = ''
  const wordOffsets: Array<{ start: number; end: number; itemIdx: number }> = []
  let cursor = 0

  for (let i = 0; i < page.items.length; i++) {
    const s = page.items[i].str
    // Insert a space separator between items so "500mg" + "Pure" → "500mg Pure"
    if (i > 0) {
      fullText += ' '
      cursor += 1
    }
    wordOffsets.push({ start: cursor, end: cursor + s.length, itemIdx: i })
    fullText += s
    cursor += s.length
  }

  const normalizedText = fullText.replace(/\s+/g, ' ').trim()
  const noPunctLowerText = fullText.replace(/[^\w\s]/g, '').toLowerCase()

  const pageWidth = page.items.length > 0
    ? Math.max(...page.items.map((it) => it.x + it.width))
    : 794

  return {
    page: page.page,
    items: page.items,
    fullText,
    normalizedText,
    noPunctLowerText,
    wordOffsets,
    pageHeight: page.pageHeight,
    pageWidth,
  }
}

export class PageModelCache {
  private cache = new Map<number, PageModelData>()
  private version = 0

  invalidate(): void {
    this.cache.clear()
    this.version++
  }

  getVersion(): number {
    return this.version
  }

  build(pages: RawPageData[]): void {
    this.cache.clear()
    this.version++
    for (const page of pages) {
      this.cache.set(page.page, createPageModel(page))
    }
  }

  get(pageNum: number): PageModelData | undefined {
    return this.cache.get(pageNum)
  }

  has(pageNum: number): boolean {
    return this.cache.has(pageNum)
  }

  setPage(pageNum: number, page: RawPageData): void {
    this.cache.set(pageNum, createPageModel(page))
  }
}

export const pageModelCache = new PageModelCache()

export function getPageModel(pageNum: number): PageModelData | undefined {
  return pageModelCache.get(pageNum)
}

// ---------------------------------------------------------------------------
// Structured text builder — Option B: coordinate-tagged per-line format
// Converts a page's pdf.js items into a spatial representation that lets the
// LLM understand visual hierarchy (headings, callout boxes, footnotes) rather
// than receiving a flat wall of text.
// ---------------------------------------------------------------------------

interface StructuredItem {
  str: string
  x: number
  y: number
  width: number
  height: number
  fontSize?: number
  fontName?: string
}

interface StructuredPageInput {
  page: number
  items: StructuredItem[]
  pageHeight: number
}

/**
 * Build a coordinate-tagged structured text string for one brochure page.
 *
 * Output format (one line per visual text row):
 *   BROCHURE PAGE 1 (595x842 points)
 *   LINE 1 (x:50.0, y:42.0, font:24.0pt, bold): "Product Name"
 *   LINE 2 (x:50.0, y:80.0, font:12.0pt): "Regular paragraph text..."
 *   LINE 3 (x:310.0, y:380.0, font:16.0pt, bold): "500mg Pure Ashwagandha"
 */
export function buildStructuredText(pageData: StructuredPageInput): string {
  const { page, items, pageHeight } = pageData

  // Compute pageWidth from items
  const pageWidth =
    items.length > 0
      ? Math.max(...items.map((it) => it.x + it.width))
      : 595

  // Group items into visual lines using the shared spatial grouping utility.
  // Cast back to StructuredItem[][] since the input items carry fontSize/fontName.
  const lines = groupItemsIntoLines(items, pageHeight) as StructuredItem[][]

  const lineEntries: string[] = []

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]

    // Combine text across items in the line
    const lineText = line
      .map((it) => it.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (!lineText) continue

    // Dominant font size = max across items in line (largest glyph sets the tone)
    const fontSize = Math.max(...line.map((it) => it.fontSize ?? 12))

    // CSS-space top of line (top-left origin)
    const minCssTop = Math.min(
      ...line.map((it) => pageHeight - it.y - it.height)
    )

    // Leftmost x in the line
    const minX = Math.min(...line.map((it) => it.x))

    // Font style inference from fontName
    const fontNames = line.map((it) => (it.fontName ?? '').toLowerCase())
    const isBold = fontNames.some((n) => n.includes('bold'))
    const isItalic = fontNames.some(
      (n) => n.includes('italic') || n.includes('oblique')
    )

    // Build style tag: ", bold", ", italic", ", bold, italic"
    const styleTag = [isBold ? 'bold' : '', isItalic ? 'italic' : '']
      .filter(Boolean)
      .join(', ')
    const styleStr = styleTag ? `, ${styleTag}` : ''

    lineEntries.push(
      `LINE ${idx + 1} (x:${minX.toFixed(1)}, y:${minCssTop.toFixed(1)}, font:${fontSize.toFixed(1)}pt${styleStr}): "${lineText}"`
    )
  }

  const header = `BROCHURE PAGE ${page} (${pageWidth.toFixed(0)}x${pageHeight.toFixed(0)} points)`
  const body = lineEntries.join('\n')
  const full = `${header}\n${body}`

  // Cap at 8000 chars to stay within LLM token budget
  if (full.length > 8000) {
    return full.substring(0, 7980) + '\n... [truncated]'
  }
  return full
}
