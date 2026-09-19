import type { Verdict } from '../types'
import type { ProviderConfig } from './providers'
import { callLLM, findRelevantReferenceChunks } from './ai'

export interface ClaimVerdictResult {
  verdict: Verdict
  reason: string
  evidence: string
  referencePage?: number
}

const VALID_VERDICTS: Verdict[] = ['verified', 'partial', 'unsupported']

/**
 * Verify a single user-selected claim against the research paper.
 *
 * The reference paper is never sent in full — `findRelevantReferenceChunks`
 * (keyword RAG) selects only the most relevant sections, so the model judges
 * strictly from the actual paper content instead of its own training data.
 *
 * Returns a structured verdict: 'verified' (supported), 'partial', or
 * 'unsupported', with a verbatim evidence quote + page number.
 */
export async function verifyClaimAgainstReference(
  claim: string,
  referencePages: Array<{ page: number; text: string }>,
  provider: ProviderConfig,
  model: string,
  apiKey: string,
  brochurePage = 1
): Promise<ClaimVerdictResult> {
  const claimText = claim.replace(/\s+/g, ' ').trim().substring(0, 800)

  if (!claimText) {
    return { verdict: 'unsupported', reason: 'No claim text was provided.', evidence: '' }
  }

  if (referencePages.length === 0) {
    return {
      verdict: 'unsupported',
      reason: 'No reference document is available to check this claim against.',
      evidence: '',
    }
  }

  const relevant = findRelevantReferenceChunks(claimText, referencePages, 3)

  const SYSTEM_PROMPT = `You are a claim verification expert. The user selected a factual claim from page ${brochurePage} of a brochure and wants it checked against a REFERENCE DOCUMENT (the research paper).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULES (MOST IMPORTANT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Base your verdict ONLY on the REFERENCE DOCUMENT sections provided below. Never use outside knowledge, prior beliefs, or general facts.
2. "evidence" MUST be a verbatim quote copied exactly from the provided reference text, and it MUST mention its [Reference Page N] number.
3. Verdict definitions:
   - "verified"    → the reference explicitly states or directly supports the claim
   - "partial"     → the reference mentions it but with different numbers, wording, scope, or conditions
   - "unsupported" → the reference does NOT mention the claim, or contradicts it
4. "reason" must be exactly ONE short sentence (max ~20 words).
5. Respond ONLY with valid JSON, no markdown, no commentary, in EXACTLY this shape:
{"verdict":"verified|partial|unsupported","reason":"...","evidence":"verbatim quote","referencePage":N}`

  const userPrompt = `CLAIM TO VERIFY:
"""
${claimText}
"""

REFERENCE DOCUMENT (most relevant sections from the research paper):
---
${relevant}
---`

  let content = ''
  try {
    content = await callLLM(
      provider,
      model,
      SYSTEM_PROMPT,
      [{ role: 'user', content: userPrompt }],
      apiKey,
      0.1,
      800
    )
  } catch {
    return {
      verdict: 'unsupported',
      reason: 'The verification request failed. Check your API key and try again.',
      evidence: '',
    }
  }

  let parsed: Record<string, unknown> | null = null
  try {
    const cleaned = content
      .replace(/```json\s*/gi, '')
      .replace(/```\s*$/g, '')
      .trim()
    parsed = JSON.parse(cleaned)
  } catch {
    const match = content.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        parsed = JSON.parse(match[0])
      } catch {
        parsed = null
      }
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      verdict: 'unsupported',
      reason: `Could not understand the verification result. Raw response: ${content.slice(0, 300)}`,
      evidence: '',
    }
  }

  const verdict = VALID_VERDICTS.includes(parsed.verdict as Verdict)
    ? (parsed.verdict as Verdict)
    : 'unsupported'
  const reason =
    typeof parsed.reason === 'string' && parsed.reason.trim()
      ? parsed.reason.trim().replace(/\s+/g, ' ').substring(0, 300)
      : 'No explanation provided.'
  const evidence =
    typeof parsed.evidence === 'string' ? parsed.evidence.trim() : ''

  let referencePage: number | undefined
  if (typeof parsed.referencePage === 'number') {
    referencePage = parsed.referencePage
  } else if (
    typeof parsed.referencePage === 'string' &&
    !isNaN(Number(parsed.referencePage))
  ) {
    referencePage = Number(parsed.referencePage)
  }

  return { verdict, reason, evidence, referencePage }
}
