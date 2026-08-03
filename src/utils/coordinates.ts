import type { Bounds } from '../types'

export interface TextItemLike {
  str: string
  x: number
  y: number
  width: number
  height: number
}

export function cssToScreen(cssBounds: Bounds, zoom: number): Bounds {
  return {
    x: cssBounds.x * zoom,
    y: cssBounds.y * zoom,
    width: cssBounds.width * zoom,
    height: cssBounds.height * zoom,
  }
}

export function screenToCss(screenBounds: Bounds, zoom: number): Bounds {
  return {
    x: screenBounds.x / zoom,
    y: screenBounds.y / zoom,
    width: screenBounds.width / zoom,
    height: screenBounds.height / zoom,
  }
}

export function pdfItemToCss(
  item: TextItemLike,
  pageHeight: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: item.x,
    y: pageHeight - item.y - item.height,
    width: item.width,
    height: item.height,
  }
}

export function cssToPdfItem(
  cssBounds: Bounds,
  pageHeight: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: cssBounds.x,
    y: pageHeight - cssBounds.y - cssBounds.height,
    width: cssBounds.width,
    height: cssBounds.height,
  }
}

export function computeUnionBounds(lineBounds: Bounds[]): Bounds {
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity

  for (const b of lineBounds) {
    minX = Math.min(minX, b.x)
    maxX = Math.max(maxX, b.x + b.width)
    minY = Math.min(minY, b.y)
    maxY = Math.max(maxY, b.y + b.height)
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function groupItemsIntoLines(
  items: TextItemLike[],
  pageHeight: number
): TextItemLike[][] {
  if (items.length === 0) return []

  // Sort items top-to-bottom (ascending cssTop), then left-to-right within
  // the same row. This prevents multi-column layouts from producing false
  // line groupings when items arrive in non-visual order from pdf.js.
  const sorted = [...items].sort((a, b) => {
    const aCssTop = pageHeight - a.y - a.height
    const bCssTop = pageHeight - b.y - b.height
    const diff = aCssTop - bCssTop
    // Treat items within 2pt of each other as the same row → sort by x
    if (Math.abs(diff) < 2) return a.x - b.x
    return diff
  })

  const lines: TextItemLike[][] = []
  let currentLine: TextItemLike[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const curr = sorted[i]
    const prevCssTop = pageHeight - prev.y - prev.height
    const currCssTop = pageHeight - curr.y - curr.height
    const verticalGap = Math.abs(currCssTop - (prevCssTop + prev.height))

    // Use an effective height for the threshold — pdf.js can return height=0
    // for some items (e.g. decorative glyphs). Fall back to a minimum of 4pt
    // so the threshold isn't zero and every item ends up on its own "line".
    const effectiveH = Math.max(prev.height, 4)

    // Items within 0.6 × effective line height are considered the same row.
    // This is looser than the 0.5 we had previously, which was too tight for
    // items where height comes back slightly mis-reported by pdf.js.
    const sameLine = verticalGap < effectiveH * 0.6

    if (sameLine) {
      currentLine.push(sorted[i])
    } else {
      lines.push(currentLine)
      currentLine = [sorted[i]]
    }
  }
  lines.push(currentLine)
  return lines
}

export function computeLineBounds(
  line: TextItemLike[],
  pageHeight: number
): Bounds {
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity

  for (const item of line) {
    const cssTop = pageHeight - item.y - item.height

    // pdf.js sometimes returns height = 0 (e.g. for decorative or transformed
    // glyphs). Fall back to fontSize when available (carried as an optional
    // field on TextItemWithPos / StructuredItem), then to a safe minimum of 10pt.
    const effectiveH = item.height > 1
      ? item.height
      : ((item as any).fontSize ?? 0) > 1
        ? (item as any).fontSize as number
        : 10

    minX = Math.min(minX, item.x)
    maxX = Math.max(maxX, item.x + item.width)
    minY = Math.min(minY, cssTop)
    maxY = Math.max(maxY, cssTop + effectiveH)
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}
