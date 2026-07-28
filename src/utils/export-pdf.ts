import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { Annotation } from '../types'
import { loadPdfBinary } from './idb'
import { SEVERITY_BORDERS } from './constants'

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
      page.drawRectangle({
        x, y, width: w, height: h,
        color: c,
        opacity: 0.4,
      })
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
      const borderHex = ann.severity
        ? SEVERITY_BORDERS[ann.severity]
        : '#60a5fa'
      const c = hexToRgb(borderHex)

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

      // Severity indicator square (top-right corner)
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
