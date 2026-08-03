import { PDFDocument, rgb, StandardFonts, PDFName, PDFString } from 'pdf-lib'
import type { PDFPage } from 'pdf-lib'
import type { Annotation, Verdict } from '../types'
import { loadPdfBinary, PDF_KEYS } from './idb'
import { SEVERITY_BORDERS, VERDICT_COLORS, VERDICT_LABELS, SEVERITY_LABELS, CATEGORY_LABELS } from './constants'

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16) / 255
  const g = parseInt(clean.substring(2, 4), 16) / 255
  const b = parseInt(clean.substring(4, 6), 16) / 255
  return rgb(r, g, b)
}

function toPdfY(pageH: number, y: number, h: number) {
  return pageH - y - h
}

function truncate(s: string, max: number) {
  return s.length > max ? s.substring(0, max) + '…' : s
}

/**
 * Parse a claim verification comment field of the form:
 *   "[VERIFIED] reason\n\nEvidence:\n evidence"
 * into its verdict, message and evidence parts.
 */
export function parseClaimComment(
  comment?: string
): { verdict?: string; message: string; evidence: string } {
  if (!comment) return { message: '', evidence: '' }
  const verdictMatch = comment.match(/^\[([A-Za-z]+)\]/)
  const evMatch = comment.match(/Evidence:\s*([\s\S]*)$/i)
  let message = comment
  if (evMatch) {
    message = comment
      .substring(0, evMatch.index ?? comment.length)
      .replace(/^\[\w+\]\s*/, '')
      .trim()
  }
  return {
    verdict: verdictMatch ? verdictMatch[1].toLowerCase() : undefined,
    message,
    evidence: evMatch ? evMatch[1].trim() : '',
  }
}

export function severityToVerdict(severity?: string): Verdict | null {
  if (severity === 'success') return 'verified'
  if (severity === 'warning') return 'partial'
  if (severity === 'error') return 'unsupported'
  return null
}

/**
 * pdf-lib's PDFString writes raw charCodeAt bytes (no Unicode mapping), so
 * non-ASCII characters like em-dashes / curly quotes would be corrupted.
 * Replace them with ASCII-safe equivalents before embedding in the PDF.
 */
function sanitizePdfString(s: string): string {
  return s
    .replace(/[\u2014\u2015]/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, '?')
}

/**
 * Add a native PDF Text annotation (sticky note icon) linked to a Popup
 * sub-annotation. When the user hovers the icon (Acrobat) or clicks it
 * (Chrome/Firefox), the popup opens with the full verification details.
 *
 * Includes a proper AP (appearance) stream so every PDF viewer renders
 * a small note icon instead of a raw coloured rectangle.
 */
function addNoteAnnotationWithPopup(
  pdfDoc: PDFDocument,
  page: PDFPage,
  iconPdfRect: { x: number; y: number; width: number; height: number },
  contents: string,
  title: string,
  accentHex: string
): void {
  if (!contents.trim()) return
  const ctx = pdfDoc.context
  const safeContents = sanitizePdfString(contents)
  const safeTitle = sanitizePdfString(title || 'VeriClaim')

  // Popup window rect: offset to the right of the icon
  const popupPdfRect = {
    x: iconPdfRect.x + iconPdfRect.width + 4,
    y: iconPdfRect.y - 60,
    width: 320,
    height: 100,
  }

  // ── Appearance stream (XObject Form) ──
  // Draws a small note-icon so viewers don't render a raw coloured rectangle.
  const w = iconPdfRect.width
  const h = iconPdfRect.height
  const hex = accentHex.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255

  // PDF operators as a byte string:
  //   Body: filled rectangle
  //   Corner fold: dark triangle
  //   Letter "N" centred in bold
  const op = [
    `1 1 1 rg`,                             // white fill
    `0 0 ${w} ${h} re f`,                   // draw background
    `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`, // accent fill
    `0 0 ${w} ${h * 0.7} re f`,             // accent body (bottom 70%)
    `0 0 0 rg`,                              // black
    `${w * 0.55} ${h * 0.7} m`,             // fold triangle start
    `${w} ${h * 0.7} l`,
    `${w} ${h} l`,
    `${w * 0.55} ${h * 0.7} l f`,           // filled triangle
    `1 1 1 rg`,                              // white fill
    `0 0 0 rg`,                              // black text
    `BT`,
    `/Helv 10 Tf`,
    `${w * 0.32} ${h * 0.18} Td`,
    `(N) Tj`,
    `ET`,
  ].join('\n')

  const apStream = ctx.stream(op, {
    Type: 'XObject',
    Subtype: 'Form',
    BBox: [0, 0, w, h],
  })
  const apStreamRef = ctx.register(apStream)

  // Normal appearance dict: /N → the XObject stream
  const apNormalDict = ctx.obj({ N: apStreamRef })
  const apNormalRef = ctx.register(apNormalDict)

  // ── Text annotation dict ──
  const textDict = ctx.obj({
    Type: 'Annot',
    Subtype: 'Text',
    Rect: [
      iconPdfRect.x,
      iconPdfRect.y,
      iconPdfRect.x + w,
      iconPdfRect.y + h,
    ],
    Contents: PDFString.of(safeContents),
    T: PDFString.of(safeTitle),
    Name: 'Note',
    Open: false,
    F: 4, // Print flag
    AP: apNormalRef,
  })
  const textRef = ctx.register(textDict)

  // ── Popup sub-annotation dict ──
  const popupDict = ctx.obj({
    Type: 'Annot',
    Subtype: 'Popup',
    Parent: textRef,
    Rect: [
      popupPdfRect.x,
      popupPdfRect.y,
      popupPdfRect.x + popupPdfRect.width,
      popupPdfRect.y + popupPdfRect.height,
    ],
    Open: false,
  })
  const popupRef = ctx.register(popupDict)

  // Link popup → text annotation (/Popup entry)
  textDict.set(PDFName.of('Popup'), popupRef)

  page.node.addAnnot(textRef)
  page.node.addAnnot(popupRef)
}

function buildPopupContent(ann: Annotation): { title: string; contents: string } | null {
  if (ann.type === 'highlight') {
    let v = severityToVerdict(ann.severity)
    if (!v) {
      const found = Object.entries(VERDICT_COLORS).find(([, c]) => c === ann.color)
      if (found) v = found[0] as Verdict
    }
    const verdict = v || 'unsupported'
    const { message, evidence } = parseClaimComment(ann.comment)
    const parts = [
      `[${verdict.toUpperCase()}] ${(ann.text || '').trim()}`,
    ]
    if (message.trim()) parts.push(`Reason: ${message.trim()}`)
    if (evidence.trim()) parts.push(`Evidence:\n${evidence.trim()}`)
    if (ann.referencePage) {
      parts.push(
        ann.referenceLocationStatus === 'not_found'
          ? `Reference: highlighted on ref page ${ann.referencePage} (quote not located)`
          : `Reference: cross-referenced on ref page ${ann.referencePage} (supporting quote highlighted there)`
      )
    }
    return {
      title: `VeriClaim — ${VERDICT_LABELS[verdict]}`,
      contents: parts.join('\n\n'),
    }
  }

  if (ann.type === 'validation') {
    const parts: string[] = []
    const severityLabel = ann.severity ? SEVERITY_LABELS[ann.severity] : ''
    const categoryLabel = ann.category ? CATEGORY_LABELS[ann.category] : ''
    if (severityLabel) parts.push(`Severity: ${severityLabel}`)
    if (categoryLabel) parts.push(`Category: ${categoryLabel}`)
    if (ann.message?.trim()) parts.push(ann.message.trim())
    if (ann.comment?.trim()) parts.push(ann.comment.trim())
    return {
      title: 'VeriClaim — Validation',
      contents: parts.join('\n'),
    }
  }

  if (ann.type === 'rectangle') {
    const text = ann.comment?.trim() || ann.text?.trim()
    if (!text) return null
    return { title: 'VeriClaim — Comment', contents: text }
  }

  return null
}

export async function exportAnnotatedPDF(
  annotations: Annotation[]
): Promise<void> {
  if (annotations.length === 0) throw new Error('No annotations to export')

  const pdfDataUrl = await loadPdfBinary()
  if (!pdfDataUrl) throw new Error('No PDF loaded')

  const arrayBuf = await fetch(pdfDataUrl).then((r) => r.arrayBuffer())
  const pdfDoc = await PDFDocument.load(arrayBuf)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Compute global annotation index (same order as web: page then createdAt)
  const sorted = [...annotations].sort(
    (a, b) => a.page - b.page || a.createdAt.localeCompare(b.createdAt)
  )
  const indexMap = new Map<string, number>()
  sorted.forEach((a, i) => indexMap.set(a.id, i + 1))

  const brandBlue = hexToRgb('#2563eb')
  const white = rgb(1, 1, 1)
  const circleR = 9 // badge radius in PDF points

  for (const ann of annotations) {
    const idx = ann.page - 1
    if (idx < 0 || idx >= pdfDoc.getPageCount()) continue
    const page = pdfDoc.getPage(idx)
    const { width: pageW, height: pageH } = page.getSize()

    const x = ann.bounds.x
    const y = toPdfY(pageH, ann.bounds.y, ann.bounds.height)
    const w = ann.bounds.width
    const h = ann.bounds.height

    /* ── Draw the annotation body ── */

    if (ann.type === 'highlight') {
      const c = hexToRgb(ann.color || '#fef08a')
      if (ann.lineBounds && ann.lineBounds.length > 1) {
        for (const lb of ann.lineBounds) {
          page.drawRectangle({
            x: lb.x, y: toPdfY(pageH, lb.y, lb.height),
            width: lb.width, height: lb.height,
            color: c, opacity: 0.4,
          })
        }
      } else {
        page.drawRectangle({
          x, y, width: w, height: h,
          color: c,
          opacity: 0.4,
        })
      }
    } else if (ann.type === 'rectangle') {
      const c = hexToRgb(ann.color || '#93c5fd')
      page.drawRectangle({
        x, y, width: w, height: h,
        borderColor: c,
        borderWidth: 2,
      })
      page.drawRectangle({
        x, y, width: w, height: h,
        color: c,
        opacity: 0.12,
      })

      // "💬" indicator if comment annotation
      if (ann.text === 'Comment') {
        const label = '💬'
        page.drawText(label, {
          x: x + w / 2 - 6,
          y: y + h / 2 - 7,
          size: 12,
          font,
          color: rgb(0.3, 0.3, 0.3),
        })
      }
    } else if (ann.type === 'validation') {
      // Check if this is a claim verification annotation (color matches verdict colors)
      const isClaimVerification = ann.color && Object.values(VERDICT_COLORS).includes(ann.color)
      const borderHex = ann.severity
        ? SEVERITY_BORDERS[ann.severity]
        : '#60a5fa'
      const c = hexToRgb(isClaimVerification ? ann.color : borderHex)

      // Colored border
      page.drawRectangle({
        x, y, width: w, height: h,
        borderColor: c,
        borderWidth: 2.5,
      })

      // Light fill
      page.drawRectangle({
        x, y, width: w, height: h,
        color: c,
        opacity: 0.1,
      })

      if (isClaimVerification) {
        // Verdict indicator square (top-right)
        const badgeSize = 16
        page.drawRectangle({
          x: x + w - badgeSize,
          y: y + h - badgeSize,
          width: badgeSize,
          height: badgeSize,
          color: c,
        })

        // Verdict symbol
        let symbol = '?'
        if (ann.color === VERDICT_COLORS.verified) symbol = '✓'
        else if (ann.color === VERDICT_COLORS.partial) symbol = '~'
        else if (ann.color === VERDICT_COLORS.unsupported) symbol = '✕'
        const symSize = 9
        page.drawText(symbol, {
          x: x + w - badgeSize / 2 - symSize / 3,
          y: y + h - badgeSize / 2 - symSize / 3,
          size: symSize,
          font: fontBold,
          color: white,
        })

        // Extract evidence from comment field
        const comment = ann.comment || ''
        const evidenceMatch = comment.match(/Evidence:\n([\s\S]*)$/)
        const evidence = evidenceMatch ? evidenceMatch[1].trim() : ''

        // Render evidence as a tooltip-style label below annotation
        if (evidence) {
          const evidLabel = truncate(evidence, 60)
          page.drawText(evidLabel, {
            x: x + 2,
            y: y - 11,
            size: 6,
            font,
            color: c,
          })
        }
      } else {
        // Legacy validation: severity indicator square (top-right corner)
        const badgeSize = 16
        page.drawRectangle({
          x: x + w - badgeSize,
          y: y + h - badgeSize,
          width: badgeSize,
          height: badgeSize,
          color: c,
        })

        // Severity symbol inside badge
        const symbol = ann.severity === 'error' ? '✕'
          : ann.severity === 'warning' ? '!'
          : ann.severity === 'success' ? '✓'
          : 'i'
        const symSize = 9
        page.drawText(symbol, {
          x: x + w - badgeSize / 2 - symSize / 3,
          y: y + h - badgeSize / 2 - symSize / 3,
          size: symSize,
          font: fontBold,
          color: white,
        })

        // Category label below annotation
        if (ann.category && ann.category !== 'custom') {
          page.drawText(truncate(ann.category.replace('-', ' '), 14), {
            x: x + 2,
            y: y - 11,
            size: 7,
            font,
            color: c,
          })
        }
      }
    }

    /* ── Numbered badge (top-left) ── */
    const rank = indexMap.get(ann.id)
    if (rank) {
      const badgeCx = x
      const badgeCy = y + h
      const badgeR = circleR

      // White background circle
      page.drawCircle({
        x: badgeCx,
        y: badgeCy,
        size: badgeR,
        color: brandBlue,
        opacity: 1,
      })

      // Number text
      const numStr = String(rank)
      const numSize = 9
      const numW = font.widthOfTextAtSize(numStr, numSize)
      page.drawText(numStr, {
        x: badgeCx - numW / 2,
        y: badgeCy - numSize / 2 - 1.5,
        size: numSize,
        font: fontBold,
        color: white,
      })
    }

    /* ── Native popup annotation (hover in Acrobat, click in pdf.js) ── */
    const popup = buildPopupContent(ann)
    const hasRealBounds = w >= 10 && h >= 10
    if (popup && hasRealBounds) {
      const iconSize = 20
      const iconY = toPdfY(pageH, ann.bounds.y, iconSize)
      addNoteAnnotationWithPopup(
        pdfDoc,
        page,
        { x, y: iconY, width: iconSize, height: iconSize },
        popup.contents,
        popup.title,
        ann.color || '#fef08a'
      )
    }
  }

  const modifiedBytes = await pdfDoc.save()
  const blob = new Blob([modifiedBytes as unknown as BlobPart], {
    type: 'application/pdf',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `annotated-${Date.now()}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Build the popup contents for a reference-paper evidence highlight.
 * Shown when the user hovers/clicks the sticky-note icon in the exported
 * annotated research paper.
 */
function buildReferencePopupContent(
  ann: Annotation,
  rank: number
): { title: string; contents: string } | null {
  if (ann.type !== 'highlight' || !ann.text) return null
  let v = severityToVerdict(ann.severity)
  if (!v) {
    const found = Object.entries(VERDICT_COLORS).find(([, c]) => c === ann.color)
    if (found) v = found[0] as Verdict
  }
  const verdict = v || 'unsupported'
  const { message, evidence } = parseClaimComment(ann.comment)
  const parts = [
    `This highlight is the supporting evidence for claim #${rank} on brochure page ${ann.page}.`,
    `Claim: "${(ann.text || '').trim()}"`,
  ]
  if (message.trim()) parts.push(`Reason: ${message.trim()}`)
  if (evidence.trim()) parts.push(`Evidence:\n${evidence.trim()}`)
  return {
    title: `VeriClaim — ${VERDICT_LABELS[verdict]} claim evidence`,
    contents: parts.join('\n\n'),
  }
}

/**
 * Download the reference/research paper PDF annotated with the evidence
 * highlights that back each validated claim. Highlights are drawn at the
 * exact evidence positions, numbered to match the brochure claim numbers,
 * and each carries a native sticky-note popup (hover in Acrobat, click in
 * Chrome/Firefox) with the full claim/verdict/evidence details.
 */
export async function exportAnnotatedReferencePDF(
  annotations: Annotation[]
): Promise<void> {
  const refAnns = annotations.filter(
    (a) =>
      a.referencePage &&
      a.referenceBounds &&
      a.referenceLocationStatus !== 'not_found' &&
      a.referenceBounds.width >= 1 &&
      a.referenceBounds.height >= 1
  )
  if (refAnns.length === 0) throw new Error('No reference highlights to export')

  const pdfDataUrl = await loadPdfBinary(PDF_KEYS.reference)
  if (!pdfDataUrl) throw new Error('No reference PDF loaded')

  const arrayBuf = await fetch(pdfDataUrl).then((r) => r.arrayBuffer())
  const pdfDoc = await PDFDocument.load(arrayBuf)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Same global numbering as the brochure claims (claim #N ↔ reference #N)
  const sorted = [...annotations].sort(
    (a, b) => a.page - b.page || a.createdAt.localeCompare(b.createdAt)
  )
  const indexMap = new Map<string, number>()
  sorted.forEach((a, i) => indexMap.set(a.id, i + 1))

  const brandBlue = hexToRgb('#2563eb')
  const white = rgb(1, 1, 1)
  const circleR = 9

  for (const ann of refAnns) {
    const idx = (ann.referencePage ?? 1) - 1
    if (idx < 0 || idx >= pdfDoc.getPageCount()) continue
    const page = pdfDoc.getPage(idx)
    const { height: pageH } = page.getSize()

    const x = ann.referenceBounds!.x
    const y = toPdfY(pageH, ann.referenceBounds!.y, ann.referenceBounds!.height)
    const w = ann.referenceBounds!.width
    const h = ann.referenceBounds!.height

    /* ── Draw the evidence highlight ── */
    const c = hexToRgb(ann.color || '#fef08a')
    if (ann.referenceLineBounds && ann.referenceLineBounds.length > 1) {
      for (const lb of ann.referenceLineBounds) {
        page.drawRectangle({
          x: lb.x,
          y: toPdfY(pageH, lb.y, lb.height),
          width: lb.width,
          height: lb.height,
          color: c,
          opacity: 0.4,
        })
      }
    } else {
      page.drawRectangle({ x, y, width: w, height: h, color: c, opacity: 0.4 })
    }

    /* ── Numbered badge (matches brochure claim number) ── */
    const rank = indexMap.get(ann.id)
    if (rank) {
      page.drawCircle({ x, y: y + h, size: circleR, color: brandBlue, opacity: 1 })
      const numStr = String(rank)
      const numSize = 9
      const numW = font.widthOfTextAtSize(numStr, numSize)
      page.drawText(numStr, {
        x: x - numW / 2,
        y: y + h - numSize / 2 - 1.5,
        size: numSize,
        font: fontBold,
        color: white,
      })
    }

    /* ── Native popup annotation (hover/click for details) ── */
    if (w >= 10 && h >= 10) {
      const popup = buildReferencePopupContent(ann, rank ?? 0)
      if (popup) {
        const iconSize = 20
        const iconY = toPdfY(pageH, ann.referenceBounds!.y, iconSize)
        addNoteAnnotationWithPopup(
          pdfDoc,
          page,
          { x, y: iconY, width: iconSize, height: iconSize },
          popup.contents,
          popup.title,
          ann.color || '#fef08a'
        )
      }
    }
  }

  const modifiedBytes = await pdfDoc.save()
  const blob = new Blob([modifiedBytes as unknown as BlobPart], {
    type: 'application/pdf',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `annotated-reference-${Date.now()}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
