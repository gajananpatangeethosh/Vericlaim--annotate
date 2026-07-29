import type { Bounds } from '../types'

export interface TextSpan {
  text: string
  rect: DOMRect
}

export function getPageTextSpans(pageElement: HTMLElement): TextSpan[] {
  const spans = pageElement.querySelectorAll('.textLayer span[role="presentation"]')
  const result: TextSpan[] = []
  spans.forEach((span) => {
    const text = span.textContent || ''
    if (!text.trim()) return
    const rect = span.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    result.push({ text, rect })
  })
  return result
}

export function findClaimBoundsFromSpans(
  spans: TextSpan[],
  claimText: string,
  wrapperRect: DOMRect
): Bounds[] | null {
  if (spans.length === 0 || !claimText.trim()) return null

  let fullText = ''
  const offsets: Array<{ spanIdx: number; charStart: number; charEnd: number }> = []
  let charCursor = 0

  for (let i = 0; i < spans.length; i++) {
    const t = spans[i].text
    offsets.push({ spanIdx: i, charStart: charCursor, charEnd: charCursor + t.length })
    fullText += t
    charCursor += t.length
  }

  // Try multiple matching strategies
  const searchText = claimText.replace(/\s+/g, ' ').trim()
  const normalizedFull = fullText.replace(/\s+/g, ' ')

  let idx = fullText.indexOf(searchText)
  let matchLen = searchText.length

  // Strategy 2: match against normalized full text
  if (idx < 0) {
    const nIdx = normalizedFull.indexOf(searchText)
    if (nIdx >= 0) {
      // Map back to original offsets by scanning
      idx = nIdx
      matchLen = searchText.length
    }
  }

  // Strategy 3: try first 40 chars (LLM may truncate or rephrase the tail)
  if (idx < 0 && searchText.length > 40) {
    const prefix = searchText.substring(0, 40).trim()
    idx = fullText.indexOf(prefix)
    matchLen = prefix.length
  }

  // Strategy 4: try last 40 chars
  if (idx < 0 && searchText.length > 40) {
    const suffix = searchText.substring(searchText.length - 40).trim()
    idx = fullText.indexOf(suffix)
    matchLen = suffix.length
  }

  // Strategy 5: try first significant word sequence (20+ chars)
  if (idx < 0) {
    const words = searchText.split(' ')
    for (let len = Math.min(words.length, 8); len >= 3; len--) {
      const fragment = words.slice(0, len).join(' ')
      if (fragment.length < 15) continue
      idx = fullText.indexOf(fragment)
      matchLen = fragment.length
      if (idx >= 0) break
    }
  }

  if (idx < 0) return null

  const endIdx = idx + matchLen

  const matchedSpans: Array<{ span: TextSpan; overlapStart: number; overlapEnd: number }> = []
  for (const off of offsets) {
    const spanEnd = off.charEnd
    const spanStart = off.charStart
    if (spanEnd > idx && spanStart < endIdx) {
      const overlapStart = Math.max(idx, spanStart) - spanStart
      const overlapEnd = Math.min(endIdx, spanEnd) - spanStart
      matchedSpans.push({ span: spans[off.spanIdx], overlapStart, overlapEnd })
    }
  }

  if (matchedSpans.length === 0) return null

  const lines: Array<Array<{ span: TextSpan; overlapStart: number; overlapEnd: number }>> = []
  let currentLine: Array<{ span: TextSpan; overlapStart: number; overlapEnd: number }> = [matchedSpans[0]]

  for (let i = 1; i < matchedSpans.length; i++) {
    const prev = matchedSpans[i - 1].span.rect
    const curr = matchedSpans[i].span.rect
    const verticalGap = Math.abs(curr.top - prev.bottom)
    const sameLine = verticalGap < prev.height * 0.5

    if (sameLine) {
      currentLine.push(matchedSpans[i])
    } else {
      lines.push(currentLine)
      currentLine = [matchedSpans[i]]
    }
  }
  lines.push(currentLine)

  const result: Bounds[] = []
  for (const line of lines) {
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity

    for (const { span } of line) {
      const r = span.rect
      minX = Math.min(minX, r.left)
      maxX = Math.max(maxX, r.right)
      minY = Math.min(minY, r.top)
      maxY = Math.max(maxY, r.bottom)
    }

    result.push({
      x: minX - wrapperRect.left,
      y: minY - wrapperRect.top,
      width: maxX - minX,
      height: maxY - minY,
    })
  }

  return result.length > 0 ? result : null
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
