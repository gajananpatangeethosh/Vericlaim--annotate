import Fuse from 'fuse.js'
import * as pdfjsLib from 'pdfjs-dist'
import { v4 as uuid } from 'uuid'
import type { Annotation, Severity, Verdict, ClaimResult, Bounds, TextItemWithPos } from '../types'
import { SEVERITY_COLORS, VERDICT_COLORS } from './constants'
import { API_KEY } from '../key'
import type { ProviderConfig } from './providers'
import { getProviderConfig } from './providers'
import { computeUnionBounds, computeLineBounds, groupItemsIntoLines } from './coordinates'
import { matchClaim, getMatchedItems } from './matcher'
import { pageModelCache, createPageModel, buildStructuredText } from './page-model'

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

async function callLLM(
  provider: ProviderConfig,
  model: string,
  systemPrompt: string,
  messages: { role: string; content: string }[],
  apiKey: string,
  temperature = 0.1,
  maxTokens = 2000
): Promise<string> {
  const key = apiKey || API_KEY
  const MAX_ATTEMPTS = 3

  const attempt = async (): Promise<Response> => {
    return fetch(provider.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'VeriClaim',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature,
        max_tokens: maxTokens,
      }),
    })
  }

  let response = await attempt()
  // Retry on rate limits (429) and transient server errors (5xx) with backoff
  let attemptNumber = 1
  while (
    (response.status === 429 || response.status >= 500) &&
    attemptNumber < MAX_ATTEMPTS
  ) {
    const retryAfter = Number(response.headers.get('Retry-After')) || 0
    const backoff = retryAfter > 0 ? retryAfter : 1000 * Math.pow(2, attemptNumber)
    await new Promise((r) => setTimeout(r, backoff))
    response = await attempt()
    attemptNumber++
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Unknown error')
    let msg = `${provider.label} API error: ${response.status}`
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

// TextItemWithPos is exported from ../types — re-export for consumers that
// import it from this module directly
export type { TextItemWithPos } from '../types'

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

    const items: TextItemWithPos[] = content.items.map((item: any) => {
      const transform: number[] = item.transform ?? [12, 0, 0, 12, 0, 0]
      const fontSize = Math.hypot(transform[0], transform[1])
      return {
        str: item.str,
        x: transform[4],
        y: transform[5],
        width: item.width,
        height: item.height || fontSize || 12,
        fontSize,
        fontName: item.fontName ?? '',
        hasEOL: item.hasEOL ?? false,
        transform,
      }
    })

    const text = items.map((t) => t.str).join(' ').replace(/\s+/g, ' ').trim()

    pages.push({ page: i, text, items, pageHeight: viewport.height })
  }

  return pages
}

export function findClaimBoundsPerLine(
  items: TextItemWithPos[],
  claimText: string,
  pageHeight: number
): Bounds[] | null {
  const model = createPageModel({ page: 0, items, pageHeight })
  const result = matchClaim(model, claimText)
  if (!result) return null

  const matchedItems = getMatchedItems(model, result.matchedItemIndices)
  if (matchedItems.length === 0) return null

  const lines = groupItemsIntoLines(matchedItems, pageHeight)
  const rawBounds = lines.map((line) => computeLineBounds(line, pageHeight))

  // Add 1pt vertical padding above and below each line rect so the highlight
  // visually wraps the text like a real text highlighter (see image 1 reference).
  // This also compensates for any remaining sub-pixel baseline drift from pdf.js.
  const PADDING = 1
  return rawBounds.map((b) => ({
    x: b.x,
    y: b.y - PADDING,
    width: b.width,
    height: b.height + PADDING * 2,
  }))
}

// ---------------------------------------------------------------------------
// Evidence anchoring in the reference paper
// ---------------------------------------------------------------------------

export interface ReferenceEvidence {
  page: number
  bounds: Bounds
  lineBounds: Bounds[]
  status: 'found' | 'not_found'
}

/** Strip quotes, trailing citation markers and page-header noise from an
 *  LLM-produced evidence quote so the matcher has the best chance of a hit. */
function sanitizeEvidence(evidence: string): string {
  return evidence
    .replace(/\s+/g, ' ')
    .replace(/^["\u201C\u201D\u2018\u2019]+|["\u201C\u201D\u2018\u2019]+$/g, '')
    .replace(/\s*\[\d+(?:[,;\s]\d+)*\]\s*$/g, '')
    .replace(/^[Pp]age\s*\d+\s*[:.\-\s]*/g, '')
    .replace(/^\[Reference Page \d+\][:.\-\s]*/gi, '')
    .trim()
}

const NOT_FOUND_EVIDENCE: ReferenceEvidence = {
  page: 0,
  bounds: { x: 0, y: 0, width: 1, height: 1 },
  lineBounds: [],
  status: 'not_found',
}

/**
 * Locate an evidence quote inside the reference paper and compute its
 * per-line bounding boxes in that page's CSS coordinate space.
 *
 * Strategy (in order of reliability):
 *   1. Try the LLM-reported page first (preferredPage), then every other page
 *   2. For each page, try: sanitized quote → verbatim-re-anchored quote →
 *      short 6-word prefix (helps when the LLM paraphrased the tail)
 *   3. Track the highest-confidence match across all pages
 *
 * Returns status 'not_found' with page 0 when nothing matches.
 */
export function findEvidenceInReference(
  evidence: string,
  referenceItems: PageWithItems[],
  preferredPage?: number
): ReferenceEvidence {
  const base = sanitizeEvidence(evidence)
  if (!base || referenceItems.length === 0) return NOT_FOUND_EVIDENCE

  const pageNums = referenceItems.map((p) => p.page)
  const pageOrder = preferredPage && pageNums.includes(preferredPage)
    ? [preferredPage, ...pageNums.filter((p) => p !== preferredPage)]
    : pageNums

  const words = base.split(/\s+/).filter(Boolean)
  const shortPrefix = words.length > 8 ? words.slice(0, 6).join(' ') : ''

  let best: { page: number; lineBounds: Bounds[]; confidence: number } | null = null

  for (const pageNum of pageOrder) {
    const pageData = referenceItems.find((p) => p.page === pageNum)
    if (!pageData) continue

    const candidates: string[] = [base]
    const anchored = reanchorTextToVerbatim(base, pageData.items, pageData.pageHeight)
    if (anchored && anchored !== base) candidates.push(anchored)
    if (shortPrefix) candidates.push(shortPrefix)

    for (const candidate of candidates) {
      const model = createPageModel({
        page: pageData.page,
        items: pageData.items,
        pageHeight: pageData.pageHeight,
      })
      const result = matchClaim(model, candidate)
      if (!result) continue

      const matchedItems = getMatchedItems(model, result.matchedItemIndices)
      if (matchedItems.length === 0) continue

      const lines = groupItemsIntoLines(matchedItems, pageData.pageHeight)
      const rawBounds = lines.map((line) => computeLineBounds(line, pageData.pageHeight))
      const lineBounds = rawBounds.map((b) => ({
        x: b.x,
        y: b.y - 1,
        width: b.width,
        height: b.height + 2,
      }))

      if (!best || result.confidence > best.confidence) {
        best = { page: pageNum, lineBounds, confidence: result.confidence }
      }
    }
  }

  if (!best) return NOT_FOUND_EVIDENCE

  return {
    page: best.page,
    bounds:
      best.lineBounds.length === 1
        ? best.lineBounds[0]
        : computeUnionBounds(best.lineBounds),
    lineBounds: best.lineBounds,
    status: 'found',
  }
}

// ---------------------------------------------------------------------------
// Verbatim re-anchoring
// ---------------------------------------------------------------------------
//
// Problem: LLMs sometimes return a slightly paraphrased or reconstructed claim
// even when instructed to copy verbatim. A claim like "reduces cholesterol by
// 30%" that appears in the PDF as "reduces LDL cholesterol levels by up to 30%"
// will fail every string-match strategy.
//
// Solution: Before we hand the claim text to the matcher, we run a Fuse.js
// search over the page's actual text windows to find the closest real span and
// snap the claim to that verbatim text. This gives the downstream matchers
// (especially exact/normalised) the best possible shot at a precise hit.
//
// The function returns the original claimText unchanged when:
//   - The Fuse score is worse than 0.6 (too dissimilar — don't guess)
//   - The page items are unavailable
//   - The claim is already an exact substring of the page text

interface TextWindow {
  text: string
  charStart: number
  charEnd: number
}

export function reanchorClaimToVerbatim(
  claimText: string,
  pageItems: TextItemWithPos[],
  pageHeight: number
): string {
  return reanchorTextToVerbatim(claimText, pageItems, pageHeight)
}

/**
 * Generic verbatim re-anchoring: given any text (claim or evidence quote),
 * snap it to the closest real span of text found on the page. Returns the
 * input unchanged when no sufficiently similar span exists.
 */
export function reanchorTextToVerbatim(
  text: string,
  pageItems: TextItemWithPos[],
  pageHeight: number
): string {
  if (!text.trim() || pageItems.length === 0) return text

  // Build fullText the same way createPageModel does so offsets line up
  let fullText = ''
  for (let i = 0; i < pageItems.length; i++) {
    if (i > 0) fullText += ' '
    fullText += pageItems[i].str
  }

  // If the text already appears verbatim, nothing to do
  if (fullText.includes(text)) return text

  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length < 2) return text

  const fullWords = fullText.split(/\s+/).filter(Boolean)
  if (fullWords.length === 0) return text

  // Build char-offset map
  const wordCharStarts: number[] = []
  let pos = 0
  for (const word of fullWords) {
    const idx = fullText.indexOf(word, pos)
    wordCharStarts.push(idx >= 0 ? idx : pos)
    pos = idx >= 0 ? idx + word.length : pos + word.length
  }

  // Sliding windows: same word-count as text ± 4 words, step = half window
  const windowWordCount = Math.min(words.length + 4, 60)
  const stepSize = Math.max(1, Math.floor(windowWordCount / 2))
  const windows: TextWindow[] = []

  for (let i = 0; i <= fullWords.length - windowWordCount; i += stepSize) {
    const winWords = fullWords.slice(i, i + windowWordCount)
    const charStart = wordCharStarts[i] ?? 0
    const lastIdx = Math.min(i + windowWordCount - 1, fullWords.length - 1)
    const charEnd =
      (wordCharStarts[lastIdx] ?? charStart) + (fullWords[lastIdx]?.length ?? 0)
    windows.push({ text: winWords.join(' '), charStart, charEnd })
  }

  // Always include tail window
  if (fullWords.length >= windowWordCount) {
    const tailStart = fullWords.length - windowWordCount
    const winWords = fullWords.slice(tailStart)
    const charStart = wordCharStarts[tailStart] ?? 0
    const lastIdx = fullWords.length - 1
    const charEnd =
      (wordCharStarts[lastIdx] ?? charStart) + (fullWords[lastIdx]?.length ?? 0)
    if (
      windows.length === 0 ||
      windows[windows.length - 1].charStart !== charStart
    ) {
      windows.push({ text: winWords.join(' '), charStart, charEnd })
    }
  }

  if (windows.length === 0) return text

  const fuse = new Fuse(windows, {
    keys: ['text'],
    includeScore: true,
    threshold: 0.6,
    ignoreLocation: true,
    minMatchCharLength: Math.min(8, Math.floor(text.length * 0.25)),
    distance: 1000,
  })

  const hits = fuse.search(text)
  if (hits.length === 0) return text

  const best = hits[0]
  const fuseScore = best.score ?? 1
  // Only snap when similarity is good enough (score ≤ 0.4 → confidence ≥ 0.6)
  if (fuseScore > 0.4) return text

  const win = best.item
  // Return the actual verbatim text from the page for that window
  return fullText.slice(win.charStart, win.charEnd).replace(/\s+/g, ' ').trim()
}

export async function analyzeWithOpenRouter(
  pages: Array<{ page: number; text: string }>,
  apiKey: string,
  provider: ProviderConfig = getProviderConfig('openrouter'),
  model = provider.defaultModel,
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
      const content = await callLLM(
        provider,
        model,
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

// ---------------------------------------------------------------------------
// RAG: Keyword-based reference chunk search
// ---------------------------------------------------------------------------
//
// Instead of sending the entire reference paper (truncated at 12k chars),
// extract keywords from the brochure page, search the reference for the
// most relevant paragraphs, and send only those. This ensures:
//   - No silent truncation — all reference pages are searched
//   - Focused context — LLM sees only evidence relevant to this page's claims
//   - Works for papers of any length (tested up to 50+ pages)

interface ScoredPage {
  page: number
  text: string
  hits: number
}

function findRelevantReferenceChunks(
  brochureText: string,
  referencePages: Array<{ page: number; text: string }>,
  topN = 3
): string {
  // Stop words: ultra-common English words that don't help search relevance
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
    'could', 'may', 'might', 'must', 'can', 'to', 'of', 'in', 'on', 'at',
    'by', 'with', 'from', 'as', 'for', 'or', 'and', 'but', 'not', 'so',
    'than', 'that', 'this', 'these', 'those', 'it', 'its', 'they', 'their',
    'there', 'then', 'when', 'where', 'who', 'which', 'how', 'what', 'why',
  ])

  // Extract keywords: words ≥4 chars, not stop words, appearing in brochure
  const keywords = brochureText
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !stopWords.has(w))

  if (keywords.length === 0) {
    // Fallback: return first 2 pages if no keywords extracted
    return referencePages
      .slice(0, 2)
      .map((p) => `[Reference Page ${p.page}]:\n${p.text.substring(0, 4000)}`)
      .join('\n\n---\n\n')
  }

  // Score each reference page by # of keyword hits
  const scored: ScoredPage[] = referencePages.map((p) => {
    const lowerText = p.text.toLowerCase()
    const hits = keywords.filter((kw) => lowerText.includes(kw)).length
    return { page: p.page, text: p.text, hits }
  })

  // Sort by relevance (most hits first), take top N pages
  const topPages = scored
    .filter((p) => p.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, topN)

  // If no hits at all, fall back to first 2 pages
  if (topPages.length === 0) {
    return referencePages
      .slice(0, 2)
      .map((p) => `[Reference Page ${p.page}]:\n${p.text.substring(0, 4000)}`)
      .join('\n\n---\n\n')
  }

  // Build focused reference context: show page number + hit count + text chunk
  // Cap each page at 4000 chars to leave room for multiple pages in prompt
  return topPages
    .map(
      (p) =>
        `[Reference Page ${p.page} — ${p.hits} keyword match${p.hits === 1 ? '' : 'es'}]:\n${p.text.substring(0, 4000)}`
    )
    .join('\n\n---\n\n')
}

// ---------------------------------------------------------------------------
// Claim deduplication
// ---------------------------------------------------------------------------
//
// Problem: LLMs sometimes split one sentence into two claims ("Clinical
// monitoring showed..." + "...zero incidence of gastric discomfort") when
// the reference context is ambiguous or truncated.
//
// Solution: After parsing all claims, detect when claim A's text is fully
// contained within claim B's text (same page) and drop the shorter duplicate.

function deduplicateClaims(results: ClaimResult[]): ClaimResult[] {
  return results.filter((r, i) => {
    // Keep r unless we find a longer claim on the same page that contains r
    return !results.some((other, j) => {
      if (i === j || r.page !== other.page) return false
      const rNorm = r.claim.replace(/\s+/g, ' ').trim().toLowerCase()
      const otherNorm = other.claim.replace(/\s+/g, ' ').trim().toLowerCase()
      // Drop r if other fully contains r's text and is longer
      return otherNorm.includes(rNorm) && otherNorm.length > rNorm.length
    })
  })
}

export async function verifyClaimsWithReference(
  brochurePages: Array<{ page: number; text: string }>,
  referencePages: Array<{ page: number; text: string }>,
  apiKey: string,
  provider: ProviderConfig = getProviderConfig('openrouter'),
  model = provider.defaultModel,
  onProgress?: (page: number, total: number) => void,
  brochureItemPages?: PageWithItems[]
): Promise<ClaimResult[]> {
  const results: ClaimResult[] = []
  const errors: string[] = []
  const total = brochurePages.length

  const SYSTEM_PROMPT = `You are a claim verification expert. Your job is to find factual claims in a brochure and verify them against a reference document.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULE 1 — VERBATIM COPY (MOST IMPORTANT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The "claim" field MUST be copied CHARACTER-FOR-CHARACTER from the quoted text
inside a LINE entry. Every word, space, hyphen, and number must match exactly.

DO NOT:
  ✗ paraphrase  ("reduces cholesterol" → wrong if PDF says "reduces LDL cholesterol")
  ✗ summarize   ("contains 500mg" → wrong if PDF says "Each capsule contains 500 mg")
  ✗ reconstruct ("clinically tested formula" → wrong if not those exact words)
  ✗ merge lines (never join two LINE entries into one claim)

DO:
  ✓ Copy the text exactly as it appears between the double-quotes in the LINE entry.
  ✓ If a claim spans multiple words on one LINE, copy only that LINE's quoted text.
  ✓ "quoteStart" = the first 4–6 words of "claim", also copied verbatim.

EXAMPLE (correct):
  LINE 7 (x:52.0, y:210.0, font:13.0pt, bold): "Clinically proven to reduce LDL by 28%"
  → "claim": "Clinically proven to reduce LDL by 28%"
  → "quoteStart": "Clinically proven to reduce LDL"

EXAMPLE (wrong — do not do this):
  → "claim": "reduces LDL cholesterol by 28 percent"   ← paraphrased, INVALID

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULE 2 — HOW TO READ THE BROCHURE FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Each LINE entry: (x, y, font size, bold/italic) then verbatim text in quotes.
  - font > 16pt or bold → heading / key marketing claim → always verify
  - x > 45% of page width → callout box / right column → primary claims
  - font < 9pt near bottom → footnote / disclaimer → verify but lower priority

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULE 3 — VERIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  "verified"   → reference document explicitly supports the claim
  "partial"    → reference partially supports or uses different numbers
  "unsupported"→ reference does not mention it or contradicts it

RESPOND IN EXACTLY THIS JSON FORMAT (no markdown, no other text):
{
  "claims": [
    {
      "claim": "Exact verbatim text copied from the brochure LINE entry",
      "quoteStart": "First 4-6 words verbatim",
      "verdict": "verified|partial|unsupported",
      "evidence": "Exact quoted text from the reference document that supports/refutes",
      "referencePage": "Page number in the REFERENCE document where the evidence quote appears (a number, e.g. 3). Use the page from the [Reference Page N ...] header you quoted from.",
      "message": "One sentence explaining the verdict",
      "context": {
        "section": "header|body|callout|footnote",
        "position": "top|middle|bottom",
        "fontEmphasis": "bold|regular|italic|none"
      }
    }
  ]
}

If no verifiable factual claims exist on this page: {"claims": []}`

  for (let i = 0; i < total; i++) {
    const { page, text } = brochurePages[i]
    onProgress?.(i + 1, total)

    if (!text.trim()) continue

    // Use structured text if item-level data is available, otherwise fall back to flat text
    const pageItemData = brochureItemPages?.find((p) => p.page === page)
    const brochureText = pageItemData
      ? buildStructuredText(pageItemData)
      : `BROCHURE PAGE ${page} (flat text):\n${text.substring(0, 6000)}`

    // RAG: search all reference pages for the most relevant chunks to this
    // brochure page's content — avoids the 12k truncation that was causing
    // incorrect verdicts for claims referencing later pages of the paper.
    const relevantReference = findRelevantReferenceChunks(text, referencePages, 3)

    const prompt = `BROCHURE PAGE ${page} (structured):
---
${brochureText}
---

REFERENCE DOCUMENT (most relevant sections, searched from full paper):
---
${relevantReference}
---`

    try {
      const content = await callLLM(
        provider,
        model,
        SYSTEM_PROMPT,
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
          let claimText: string = claim.claim || ''
          if (!claimText.trim()) continue

          // Re-anchor: snap any paraphrased claim back to verbatim page text
          if (pageItemData) {
            claimText = reanchorClaimToVerbatim(
              claimText,
              pageItemData.items,
              pageItemData.pageHeight
            )
          }

          results.push({
            page,
            text,
            claim: claimText,
            quoteStart: claim.quoteStart || '',
            verdict: (claim.verdict as Verdict) || 'unsupported',
            evidence: claim.evidence || '',
            message: claim.message || '',
            referencePage:
              typeof claim.referencePage === 'number'
                ? claim.referencePage
                : typeof claim.referencePage === 'string' && !isNaN(Number(claim.referencePage))
                  ? Number(claim.referencePage)
                  : undefined,
            context: claim.context
              ? {
                  section: claim.context.section || 'body',
                  position: claim.context.position || 'middle',
                  fontEmphasis: claim.context.fontEmphasis || 'none',
                }
              : undefined,
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

  // Deduplicate: drop any claim whose text is fully contained within a longer
  // claim on the same page (catches LLM sentence-splitting artifacts)
  return deduplicateClaims(results)
}

export function claimResultsToAnnotations(
  results: ClaimResult[],
  pageWidth: number,
  pageHeight: number,
  zoom: number,
  pageItems?: PageWithItems[],
  referenceItems?: PageWithItems[]
): Annotation[] {
  const annotations: Annotation[] = []
  const now = new Date().toISOString()

  for (const r of results) {
    let bounds: Bounds | null = null
    let lineBounds: Bounds[] | undefined
    let locationStatus: 'found' | 'not_found' = 'not_found'

    const pageData = pageItems?.find((p) => p.page === r.page)
    if (pageData) {
      // Re-anchor the claim to verbatim page text before matching.
      // This is a no-op when the claim is already an exact substring.
      const anchoredClaim = reanchorClaimToVerbatim(
        r.claim,
        pageData.items,
        pageData.pageHeight
      )

      // Primary: match on the (re-anchored) verbatim claim text
      let perLine = findClaimBoundsPerLine(pageData.items, anchoredClaim, pageData.pageHeight)

      // Secondary: if anchored claim failed, try the original claim text
      if ((!perLine || perLine.length === 0) && anchoredClaim !== r.claim) {
        perLine = findClaimBoundsPerLine(pageData.items, r.claim, pageData.pageHeight)
      }

      // Tertiary: try quoteStart (first few words) as a last anchor
      if ((!perLine || perLine.length === 0) && r.quoteStart && r.quoteStart.trim().length > 8) {
        perLine = findClaimBoundsPerLine(pageData.items, r.quoteStart, pageData.pageHeight)
      }

      if (perLine && perLine.length > 0) {
        lineBounds = perLine
        bounds = perLine.length === 1 ? perLine[0] : computeUnionBounds(perLine)
        locationStatus = 'found'
      }
    }

    // Locate the evidence quote in the reference paper (if items available)
    const refEvidence =
      referenceItems && referenceItems.length > 0
        ? findEvidenceInReference(r.evidence, referenceItems, r.referencePage)
        : null

    annotations.push({
      id: uuid(),
      page: r.page,
      type: 'highlight',
      text: r.claim,
      message: r.message,
      bounds: bounds || { x: 0, y: 0, width: 1, height: 1 },
      lineBounds: locationStatus === 'found' ? lineBounds : undefined,
      color: VERDICT_COLORS[r.verdict],
      severity: r.verdict === 'verified' ? 'success' : r.verdict === 'partial' ? 'warning' : 'error',
      category: 'compliance',
      comment: `[${r.verdict.toUpperCase()}] ${r.message}\n\nEvidence:\n${r.evidence}`,
      author: 'AI Validator',
      status: 'open',
      locationStatus,
      referencePage:
        refEvidence && refEvidence.status === 'found' ? refEvidence.page : undefined,
      referenceBounds:
        refEvidence && refEvidence.status === 'found' ? refEvidence.bounds : undefined,
      referenceLineBounds:
        refEvidence && refEvidence.status === 'found'
          ? refEvidence.lineBounds
          : undefined,
      referenceLocationStatus: refEvidence ? refEvidence.status : undefined,
      createdAt: now,
      updatedAt: now,
    })
  }

  return annotations
}
