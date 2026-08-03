import Fuse from 'fuse.js'
import type { MatchResult, PageModelData } from '../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function areItemsConsecutive(indices: number[]): boolean {
  if (indices.length <= 1) return true
  for (let i = 1; i < indices.length; i++) {
    // Allow gaps up to 4 — pdf.js can insert invisible glyphs, decorative
    // elements, or zero-width spaces between real content items on busy pages.
    if (indices[i] - indices[i - 1] > 4) return false
  }
  return true
}

function findItemIndices(
  model: PageModelData,
  charStart: number,
  charEnd: number
): number[] {
  const indices: number[] = []
  for (const off of model.wordOffsets) {
    if (off.end > charStart && off.start < charEnd) {
      indices.push(off.itemIdx)
    }
  }
  return indices
}

interface StrategyResult {
  start: number
  end: number
  score: number
}

// ---------------------------------------------------------------------------
// Strategy 1: Exact match
// ---------------------------------------------------------------------------
function exactMatch(model: PageModelData, claimText: string): StrategyResult | null {
  const idx = model.fullText.indexOf(claimText)
  if (idx < 0) return null
  return { start: idx, end: idx + claimText.length, score: 1.0 }
}

// ---------------------------------------------------------------------------
// Strategy 2: Normalized whitespace
// ---------------------------------------------------------------------------
function normalizedMatch(model: PageModelData, claimText: string): StrategyResult | null {
  const searchText = claimText.replace(/\s+/g, ' ').trim()
  const idx = model.normalizedText.indexOf(searchText)
  if (idx < 0) return null

  // Walk fullText to find the character position that corresponds to
  // normalizedText[idx]. We collapse every whitespace group in fullText
  // to a single space in normalizedText.
  let origPos = 0
  let normPos = 0

  // Advance to the normalized position
  while (normPos < idx && origPos < model.fullText.length) {
    if (/\s/.test(model.fullText[origPos])) {
      // Skip the entire whitespace group
      while (origPos < model.fullText.length && /\s/.test(model.fullText[origPos]))
        origPos++
      normPos++ // one group = one space in normalizedText
    } else {
      origPos++
      normPos++
    }
  }
  const start = origPos

  // Count forward through fullText from start, consuming exactly the same
  // number of non-whitespace characters as the searchText has.
  let end = start
  let remaining = searchText.replace(/\s+/g, '').length
  while (remaining > 0 && end < model.fullText.length) {
    if (!/\s/.test(model.fullText[end])) remaining--
    end++
  }

  return { start, end, score: 0.95 }
}

// ---------------------------------------------------------------------------
// Strategy 3: Strip punctuation + case-fold
// ---------------------------------------------------------------------------
function noPunctuationMatch(model: PageModelData, claimText: string): StrategyResult | null {
  const searchClean = claimText
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
  if (!searchClean) return null
  const idx = model.noPunctLowerText.indexOf(searchClean)
  if (idx < 0) return null

  let origPos = 0
  let cleanPos = 0
  while (cleanPos < idx && origPos < model.fullText.length) {
    const ch = model.fullText[origPos]
    if (!/[^\w\s]/.test(ch)) cleanPos++
    origPos++
  }
  const start = origPos

  let end = origPos
  let remaining = searchClean.length
  while (remaining > 0 && end < model.fullText.length) {
    const ch = model.fullText[end]
    if (!/[^\w\s]/.test(ch)) remaining--
    end++
  }

  return { start, end, score: 0.9 }
}

// ---------------------------------------------------------------------------
// Strategy 4: Case-insensitive normalized
// ---------------------------------------------------------------------------
function caseInsensitiveMatch(model: PageModelData, claimText: string): StrategyResult | null {
  const searchText = claimText.replace(/\s+/g, ' ').trim().toLowerCase()
  const fullNormLower = model.fullText.replace(/\s+/g, ' ').toLowerCase()
  const idx = fullNormLower.indexOf(searchText)
  if (idx < 0) return null
  return { start: idx, end: idx + searchText.length, score: 0.85 }
}

// ---------------------------------------------------------------------------
// Strategy 5: Prefix match (catches truncated or trailing-paraphrase claims)
// ---------------------------------------------------------------------------
function prefixMatch(model: PageModelData, claimText: string): StrategyResult | null {
  const searchText = claimText.replace(/\s+/g, ' ').trim()
  for (const len of [60, 50, 40, 30, 20]) {
    if (searchText.length > len) {
      const prefix = searchText.substring(0, len).trim()
      let idx = model.fullText.indexOf(prefix)
      if (idx >= 0) {
        const score = Math.min(0.8, len / Math.max(searchText.length, 1))
        return { start: idx, end: idx + prefix.length, score }
      }
      idx = model.fullText.toLowerCase().indexOf(prefix.toLowerCase())
      if (idx >= 0) {
        const score = Math.min(0.75, len / Math.max(searchText.length, 1))
        return { start: idx, end: idx + prefix.length, score }
      }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Strategy 6: Fuse.js sliding-window fuzzy match
//
// How it works:
//   - Split the page fullText into overlapping windows of roughly the same
//     word-count as the claim, with 50 % step.
//   - Build a Fuse index over those windows.
//   - Search for the claim; take the highest-scoring hit whose Fuse score
//     (0 = perfect, 1 = no match) converts to a confidence ≥ 0.45.
//   - Map the winning window back to character offsets in fullText.
//
// This replaces both the old tokenOverlapMatch and slidingWindowMatch with a
// single, well-tested library that uses the Bitap algorithm (character-level
// similarity, handles insertions/deletions/substitutions).
// ---------------------------------------------------------------------------

interface FuseWindow {
  text: string
  charStart: number   // inclusive start in model.fullText
  charEnd: number     // exclusive end in model.fullText
}

function fuseWindowMatch(model: PageModelData, claimText: string): StrategyResult | null {
  const claimWords = claimText.trim().split(/\s+/).filter(Boolean)
  if (claimWords.length < 3) return null

  const fullWords = model.fullText.split(/\s+/).filter(Boolean)
  if (fullWords.length < claimWords.length) return null

  const windowWordCount = Math.min(claimWords.length + 6, claimWords.length * 2, 60)
  const stepSize = Math.max(1, Math.floor(windowWordCount / 2))

  // Build char-offset map: for each word index in fullWords, find its start
  // position in model.fullText.
  const wordCharStarts: number[] = []
  let pos = 0
  for (const word of fullWords) {
    const idx = model.fullText.indexOf(word, pos)
    wordCharStarts.push(idx >= 0 ? idx : pos)
    pos = idx >= 0 ? idx + word.length : pos + word.length
  }

  const windows: FuseWindow[] = []
  for (let i = 0; i <= fullWords.length - windowWordCount; i += stepSize) {
    const winWords = fullWords.slice(i, i + windowWordCount)
    const charStart = wordCharStarts[i] ?? 0
    const lastWordIdx = Math.min(i + windowWordCount - 1, fullWords.length - 1)
    const charEnd =
      (wordCharStarts[lastWordIdx] ?? charStart) +
      (fullWords[lastWordIdx]?.length ?? 0)
    windows.push({ text: winWords.join(' '), charStart, charEnd })
  }

  // Handle tail that doesn't form a full window
  if (fullWords.length > 0) {
    const tailStart = Math.max(0, fullWords.length - windowWordCount)
    if (
      windows.length === 0 ||
      windows[windows.length - 1].charStart < (wordCharStarts[tailStart] ?? 0)
    ) {
      const winWords = fullWords.slice(tailStart)
      const charStart = wordCharStarts[tailStart] ?? 0
      const lastIdx = fullWords.length - 1
      const charEnd =
        (wordCharStarts[lastIdx] ?? charStart) + (fullWords[lastIdx]?.length ?? 0)
      windows.push({ text: winWords.join(' '), charStart, charEnd })
    }
  }

  if (windows.length === 0) return null

  const fuse = new Fuse(windows, {
    keys: ['text'],
    includeScore: true,
    threshold: 0.55,      // 0 = exact, 1 = match anything; 0.55 is permissive enough
    ignoreLocation: true, // don't penalise matches far from string start
    minMatchCharLength: Math.min(10, Math.floor(claimText.length * 0.3)),
    distance: 1000,       // large distance so ignoreLocation has full effect
  })

  const hits = fuse.search(claimText)
  if (hits.length === 0) return null

  // Fuse score: 0 = perfect match, 1 = no match — invert for our confidence
  const best = hits[0]
  const fuseScore = best.score ?? 1
  const confidence = 1 - fuseScore

  // Require at least 45 % character-level similarity
  if (confidence < 0.45) return null

  const win = best.item
  return {
    start: win.charStart,
    end: win.charEnd,
    score: confidence,
  }
}

// ---------------------------------------------------------------------------
// Strategy pipeline
// ---------------------------------------------------------------------------

const STRATEGIES: Array<{
  name: string
  fn: (model: PageModelData, claimText: string) => StrategyResult | null
  minConfidence: number
}> = [
  { name: 'exact',               fn: exactMatch,          minConfidence: 1.0  },
  { name: 'normalized-whitespace', fn: normalizedMatch,   minConfidence: 0.95 },
  { name: 'no-punctuation',      fn: noPunctuationMatch,  minConfidence: 0.9  },
  { name: 'case-insensitive',    fn: caseInsensitiveMatch, minConfidence: 0.85 },
  { name: 'prefix',              fn: prefixMatch,          minConfidence: 0.7  },
  { name: 'fuse-window',         fn: fuseWindowMatch,      minConfidence: 0.45 },
]

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function matchClaim(
  model: PageModelData,
  claimText: string
): MatchResult | null {
  if (!claimText.trim() || model.items.length === 0) return null

  for (const strategy of STRATEGIES) {
    const result = strategy.fn(model, claimText)
    if (!result) continue

    const itemIndices = findItemIndices(model, result.start, result.end)
    if (itemIndices.length === 0) continue

    if (!areItemsConsecutive(itemIndices)) continue

    const confidence = Math.min(result.score, strategy.minConfidence)
    if (confidence < 0.3) continue

    return {
      confidence,
      strategy: strategy.name,
      matchedItemIndices: itemIndices,
      score: result.score,
    }
  }

  return null
}

export function getMatchedItems(
  model: PageModelData,
  indices: number[]
): Array<{ str: string; x: number; y: number; width: number; height: number }> {
  return indices.map((i) => model.items[i]).filter(Boolean)
}
