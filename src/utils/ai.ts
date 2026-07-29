import * as pdfjsLib from 'pdfjs-dist'
import { v4 as uuid } from 'uuid'
import type { Annotation, Severity, Verdict, ClaimResult, Bounds } from '../types'
import { SEVERITY_COLORS, VERDICT_COLORS } from './constants'
import { API_KEY } from '../key'
import type { TextSpan } from './text-positions'
import { findClaimBoundsFromSpans, computeUnionBounds } from './text-positions'
import { normaliseBounds } from './pdf'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

export interface AIResult {
  page: number
  text: string
  message: string
  severity: Severity
  category: string
  startOffset: number
  endOffset: number
}

async function callOpenRouter(
  systemPrompt: string,
  messages: { role: string; content: string }[],
  apiKey: string,
  temperature = 0.1,
  maxTokens = 2000
): Promise<string> {
  const key = apiKey || API_KEY
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'VeriClaim',
    },
    body: JSON.stringify({
      model: 'openrouter/free',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Unknown error')
    let msg = `OpenRouter API error: ${response.status}`
    try {
      const err = JSON.parse(errText)
      if (err.error?.message) msg += ` — ${err.error.message}`
    } catch {}
    throw new Error(msg)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

export async function extractTextFromPDF(
  dataUrl: string
): Promise<Array<{ page: number; text: string }>> {
  const pdf = await pdfjsLib.getDocument(dataUrl).promise
  const pages: Array<{ page: number; text: string }> = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items
      .map((item: any) => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    pages.push({ page: i, text })
  }

  return pages
}

export interface TextItemWithPos {
  str: string
  x: number
  y: number
  width: number
  height: number
}

export interface PageWithItems {
  page: number
  text: string
  items: TextItemWithPos[]
  pageHeight: number
}

export async function extractTextItemsFromPDF(
  dataUrl: string
): Promise<PageWithItems[]> {
  const pdf = await pdfjsLib.getDocument(dataUrl).promise
  const pages: PageWithItems[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()

    const items: TextItemWithPos[] = content.items.map((item: any) => ({
      str: item.str,
      x: item.transform[4],
      y: item.transform[5],
      width: item.width,
      height: item.height || 12,
    }))

    const text = items.map((t) => t.str).join(' ').replace(/\s+/g, ' ').trim()

    pages.push({ page: i, text, items, pageHeight: viewport.height })
  }

  return pages
}

function findClaimBounds(
  items: TextItemWithPos[],
  claimText: string,
  pageHeight: number
): Bounds | null {
  const result = findClaimBoundsPerLine(items, claimText, pageHeight)
  if (!result || result.length === 0) return null
  return result.length === 1 ? result[0] : computeUnionBounds(result)
}

function normalizeWord(w: string): string {
  return w.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function findClaimBoundsPerLine(
  items: TextItemWithPos[],
  claimText: string,
  pageHeight: number
): Bounds[] | null {
  if (items.length === 0 || !claimText.trim()) return null

  const claimWords = claimText.split(/\s+/).map(normalizeWord).filter(Boolean)
  if (claimWords.length === 0) return null

  // Build word→items index: each pdf.js item becomes one or more words
  const itemWords: Array<{ word: string; itemIdx: number }> = []
  for (let i = 0; i < items.length; i++) {
    const words = items[i].str.split(/\s+/).filter(Boolean)
    for (const w of words) {
      itemWords.push({ word: normalizeWord(w), itemIdx: i })
    }
  }

  if (itemWords.length === 0) return null

  // Sliding window: find the window of consecutive item-words that best matches the claim words
  let bestScore = 0
  let bestStart = 0
  let bestLen = 0

  // Try windows of varying sizes around the claim word count
  for (let winSize = Math.max(1, claimWords.length - 3); winSize <= claimWords.length + 5; winSize++) {
    for (let start = 0; start <= itemWords.length - winSize; start++) {
      let score = 0
      const end = Math.min(start + winSize, itemWords.length)
      const actualWinSize = end - start

      // Score: how many claim words appear in this window (in order)
      let ci = 0
      for (let ii = start; ii < end && ci < claimWords.length; ii++) {
        if (itemWords[ii].word === claimWords[ci]) {
          score++
          ci++
        }
      }

      // Normalize by claim word count
      const normalizedScore = score / claimWords.length
      // Prefer windows close to the claim word count
      const sizePenalty = Math.abs(actualWinSize - claimWords.length) / claimWords.length
      const adjustedScore = normalizedScore - sizePenalty * 0.3

      if (adjustedScore > bestScore) {
        bestScore = adjustedScore
        bestStart = start
        bestLen = actualWinSize
      }
    }
  }

  if (bestScore < 0.3) return null

  // Collect the unique pdf.js items covered by the best window
  const matchedItemIndices = new Set<number>()
  for (let i = bestStart; i < bestStart + bestLen && i < itemWords.length; i++) {
    matchedItemIndices.add(itemWords[i].itemIdx)
  }

  const matchedItems = Array.from(matchedItemIndices).sort((a, b) => a - b).map((idx) => items[idx])

  if (matchedItems.length === 0) return null

  // Group items into lines based on vertical position
  const lines: TextItemWithPos[][] = []
  let currentLine: TextItemWithPos[] = [matchedItems[0]]

  for (let i = 1; i < matchedItems.length; i++) {
    const prev = matchedItems[i - 1]
    const curr = matchedItems[i]
    const prevCssTop = pageHeight - prev.y - prev.height
    const currCssTop = pageHeight - curr.y - curr.height
    const verticalGap = Math.abs(currCssTop - (prevCssTop + prev.height))
    const sameLine = verticalGap < prev.height * 0.8

    if (sameLine) {
      currentLine.push(matchedItems[i])
    } else {
      lines.push(currentLine)
      currentLine = [matchedItems[i]]
    }
  }
  lines.push(currentLine)

  // Compute bounds for each line
  const result: Bounds[] = []
  for (const line of lines) {
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity

    for (const item of line) {
      const cssTop = pageHeight - item.y - item.height
      minX = Math.min(minX, item.x)
      maxX = Math.max(maxX, item.x + item.width)
      minY = Math.min(minY, cssTop)
      maxY = Math.max(maxY, cssTop + item.height)
    }

    result.push({
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    })
  }

  return result.length > 0 ? result : null
}

function estimateClaimBounds(
  r: ClaimResult,
  pageWidth: number,
  pageHeight: number
): Bounds {
  const estimatedY = 60 + (r.text.length > 0 ? (r.text.length % 50) * 20 : 0)
  const estimatedX = 40
  const width = Math.min(Math.max((r.claim.length || 80) * 5, 80), pageWidth - 80)
  const height = 30
  return {
    x: Math.min(estimatedX, pageWidth - width - 20),
    y: Math.min(estimatedY + (r.page - 1) * 20, pageHeight - height - 20),
    width: Math.round(width),
    height,
  }
}

export async function analyzeWithOpenRouter(
  pages: Array<{ page: number; text: string }>,
  apiKey: string,
  onProgress?: (page: number, total: number) => void
): Promise<AIResult[]> {
  const results: AIResult[] = []
  const total = pages.length

  for (let i = 0; i < total; i++) {
    const { page, text } = pages[i]
    onProgress?.(i + 1, total)

    if (!text.trim()) continue

    const prompt = `You are a document validation expert. Analyze the following text from page ${page} of a PDF document.

Find ALL issues including:
- Grammar and spelling mistakes
- Financial errors (wrong amounts, missing invoice numbers, GST/PAN errors)
- Legal issues (missing signatures, disclaimers)
- Missing or incorrect data
- Compliance problems
- Personal information exposure
- Medical code issues

For each issue found, respond in this exact JSON format (no markdown, no other text):
{
  "issues": [
    {
      "severity": "error|warning|info|success",
      "category": "grammar|financial|legal|missing-data|compliance|personal-info|medical|custom",
      "message": "Clear description of the issue",
      "context": "The exact text snippet containing the error"
    }
  ]
}

If no issues found, respond with: {"issues": []}

Text to analyze:
---
${text.substring(0, 8000)}
---`

    try {
      const content = await callOpenRouter(
        'You are a precise document validator. Only respond with valid JSON matching the requested format exactly. Do not include any markdown or explanatory text.',
        [{ role: 'user', content: prompt }],
        apiKey,
        0.1,
        2000
      )

      let parsed: { issues: any[] }
      try {
        const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*$/g, '').trim()
        parsed = JSON.parse(cleaned)
      } catch {
        const match = content.match(/\{[\s\S]*\}/)
        if (match) {
          try {
            parsed = JSON.parse(match[0])
          } catch {
            continue
          }
        } else {
          continue
        }
      }

      if (parsed.issues && Array.isArray(parsed.issues)) {
        for (const issue of parsed.issues) {
          const ctx = issue.context || ''
          const idx = text.indexOf(ctx)
          results.push({
            page,
            text: ctx,
            message: issue.message,
            severity: issue.severity || 'warning',
            category: issue.category || 'custom',
            startOffset: idx >= 0 ? idx : 0,
            endOffset: idx >= 0 ? idx + ctx.length : Math.min(ctx.length, text.length),
          })
        }
      }
    } catch (err) {
      console.warn(`Failed to analyze page ${page}:`, err)
    }
  }

  return results
}

export function resultsToAnnotations(
  results: AIResult[],
  pageWidth: number,
  pageHeight: number
): Annotation[] {
  const annotations: Annotation[] = []
  const now = new Date().toISOString()

  for (const r of results) {
    const estimatedY = 60 + (r.startOffset / 2000) * (pageHeight - 120)
    const estimatedX = 40 + (r.startOffset % 3) * 30
    const width = Math.min(Math.max(r.text.length * 6, 80), pageWidth - 80)
    const height = 30

    annotations.push({
      id: uuid(),
      page: r.page,
      type: 'validation',
      text: r.text,
      message: r.message,
      bounds: {
        x: Math.min(estimatedX, pageWidth - width - 20),
        y: Math.min(estimatedY, pageHeight - height - 20),
        width: Math.round(width),
        height,
      },
      color: SEVERITY_COLORS[r.severity],
      severity: r.severity,
      category: (r.category as any) || 'custom',
      comment: r.message,
      author: 'AI Validator',
      status: 'open',
      createdAt: now,
      updatedAt: now,
    })
  }

  return annotations
}

export async function verifyClaimsWithReference(
  brochurePages: Array<{ page: number; text: string }>,
  referencePages: Array<{ page: number; text: string }>,
  apiKey: string,
  onProgress?: (page: number, total: number) => void
): Promise<ClaimResult[]> {
  const results: ClaimResult[] = []
  const errors: string[] = []
  const total = brochurePages.length

  const referenceText = referencePages
    .map((p) => `[Page ${p.page}]:\n${p.text}`)
    .join('\n\n')

  for (let i = 0; i < total; i++) {
    const { page, text } = brochurePages[i]
    onProgress?.(i + 1, total)

    if (!text.trim()) continue

    const prompt = `You are a claim verification expert. You have been given a REFERENCE DOCUMENT and a BROCHURE PAGE. Your task is to:

1. Identify ALL factual claims made in the brochure text below
2. For EACH claim, compare it against the reference document
3. Classify each claim as one of:
   - "verified" — the claim is clearly supported by the reference
   - "partial" — the claim is partially supported or ambiguous
   - "unsupported" — the claim is not found in or contradicted by the reference
4. Provide specific evidence from the reference that supports your classification

Respond in this exact JSON format (no markdown, no other text):
{
  "claims": [
    {
      "claim": "The exact claim made in the brochure",
      "verdict": "verified|partial|unsupported",
      "evidence": "Specific text from the reference that supports or contradicts this claim",
      "message": "Clear explanation of why this claim matches its verdict"
    }
  ]
}

If no claims are found, respond with: {"claims": []}

BROCHURE TEXT (Page ${page}):
---
${text.substring(0, 6000)}
---

REFERENCE DOCUMENT (full text):
---
${referenceText.substring(0, 12000)}
---`

    try {
      const content = await callOpenRouter(
        'You are a precise claim verification expert. Only respond with valid JSON matching the requested format exactly. Do not include any markdown or explanatory text.',
        [{ role: 'user', content: prompt }],
        apiKey,
        0.1,
        4000
      )

      let parsed: { claims: any[] }
      try {
        const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*$/g, '').trim()
        parsed = JSON.parse(cleaned)
      } catch {
        const match = content.match(/\{[\s\S]*\}/)
        if (match) {
          try {
            parsed = JSON.parse(match[0])
          } catch {
            continue
          }
        } else {
          continue
        }
      }

      if (parsed.claims && Array.isArray(parsed.claims)) {
        for (const claim of parsed.claims) {
          results.push({
            page,
            text,
            claim: claim.claim || '',
            verdict: (claim.verdict as Verdict) || 'unsupported',
            evidence: claim.evidence || '',
            message: claim.message || '',
          })
        }
      }
    } catch (err) {
      errors.push(`Page ${page}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  if (results.length === 0 && errors.length > 0) {
    throw new Error(errors.join('; '))
  }

  return results
}

export function claimResultsToAnnotations(
  results: ClaimResult[],
  pageWidth: number,
  pageHeight: number,
  zoom: number,
  pageItems?: PageWithItems[],
  domPositions?: Map<number, { spans: TextSpan[]; wrapperRect: DOMRect }>
): Annotation[] {
  const annotations: Annotation[] = []
  const now = new Date().toISOString()

  for (const r of results) {
    let bounds: Bounds | null = null
    let lineBounds: Bounds[] | undefined

    // Priority 1: pdf.js text items (most reliable — uses PDF's own coordinate system)
    const pageData = pageItems?.find((p) => p.page === r.page)
    if (pageData) {
      const perLine = findClaimBoundsPerLine(pageData.items, r.claim, pageData.pageHeight)
      if (perLine) {
        lineBounds = perLine
        bounds = perLine.length === 1 ? perLine[0] : computeUnionBounds(perLine)
      }
    }

    // Priority 2: DOM-based positions (fallback)
    if (!lineBounds) {
      const domData = domPositions?.get(r.page)
      if (domData) {
        const domResult = findClaimBoundsFromSpans(domData.spans, r.claim, domData.wrapperRect)
        if (domResult) {
          lineBounds = domResult.map((b) => normaliseBounds(b, zoom))
          bounds = lineBounds.length === 1 ? lineBounds[0] : computeUnionBounds(lineBounds)
        }
      }
    }

    // Fallback: estimated bounds (least accurate)
    if (!bounds) {
      bounds = estimateClaimBounds(r, pageWidth, pageHeight)
    }

    annotations.push({
      id: uuid(),
      page: r.page,
      type: 'highlight',
      text: r.claim,
      message: r.message,
      bounds,
      lineBounds,
      color: VERDICT_COLORS[r.verdict],
      severity: r.verdict === 'verified' ? 'success' : r.verdict === 'partial' ? 'warning' : 'error',
      category: 'compliance',
      comment: `[${r.verdict.toUpperCase()}] ${r.message}\n\nEvidence:\n${r.evidence}`,
      author: 'AI Validator',
      status: 'open',
      createdAt: now,
      updatedAt: now,
    })
  }

  return annotations
}
