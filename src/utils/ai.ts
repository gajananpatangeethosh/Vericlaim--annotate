import * as pdfjsLib from 'pdfjs-dist'
import { v4 as uuid } from 'uuid'
import type { Annotation, Severity } from '../types'
import { SEVERITY_COLORS } from './constants'

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
      const response = await fetch(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': window.location.origin,
            'X-Title': 'PDF Annotation Studio',
          },
          body: JSON.stringify({
            model: 'openai/gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content:
                  'You are a precise document validator. Only respond with valid JSON matching the requested format exactly. Do not include any markdown or explanatory text.',
              },
              { role: 'user', content: prompt },
            ],
            temperature: 0.1,
            max_tokens: 2000,
          }),
        }
      )

      if (!response.ok) {
        const errText = await response.text().catch(() => 'Unknown error')
        console.warn(`OpenRouter API error (page ${page}):`, errText)
        continue
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ''

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
    // Estimate position based on character offset (rough approximation)
    const estimatedY =
      60 + (r.startOffset / 2000) * (pageHeight - 120)
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
