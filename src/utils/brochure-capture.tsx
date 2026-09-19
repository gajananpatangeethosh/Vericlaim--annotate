import React from 'react'
import { createRoot } from 'react-dom/client'
import { toPng } from 'html-to-image'
import { PDFDocument } from 'pdf-lib'
import type { BrochureDesign } from '../types'
import { BrochurePagePreview } from '../components/BrochureGenerator/BrochurePagePreview'

/**
 * Renders all brochure pages into a hidden container, captures each as a
 * high-resolution PNG via html-to-image, and assembles a pixel-perfect PDF.
 *
 * This guarantees the downloaded PDF looks exactly like the on-screen preview
 * — including CSS gradients, rounded corners, shadows, images, and custom fonts.
 */
export async function captureBrochurePdf(design: BrochureDesign): Promise<Uint8Array> {
  // Hidden off-screen container — must have the same width as the preview
  // so element sizing matches exactly.
  const container = document.createElement('div')
  container.style.cssText =
    'position:fixed;left:-9999px;top:0;width:420px;opacity:0;pointer-events:none;z-index:-1'
  document.body.appendChild(container)

  let root: ReturnType<typeof createRoot> | null = null

  try {
    root = createRoot(container)
    root.render(
      <div>
        {design.pages.map((page) => (
          <BrochurePagePreview
            key={page.pageNumber}
            page={page}
            design={design}
            selectedElementId={null}
            onSelectElement={() => {}}
          />
        ))}
      </div>,
    )

    // Wait for React to commit + all <img> data-URLs to decode
    await waitForImages(container)
    // Extra settle time for CSS paint (gradients, shadows, foreignObject)
    await new Promise((r) => setTimeout(r, 300))

    // Capture each page
    const pdfDoc = await PDFDocument.create()
    const pageEls = container.querySelectorAll<HTMLElement>('[data-export-page]')

    for (const el of Array.from(pageEls)) {
      const dataUrl = await toPng(el, {
        pixelRatio: 3,            // 3× for crisp print-quality output
        backgroundColor: '#ffffff',
        cacheBust: true,
        skipAutoScale: true,
        style: {
          // Remove the preview box-shadow so the PDF page is flush
          boxShadow: 'none',
          border: 'none',
        },
      })

      const imgBytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (c) =>
        c.charCodeAt(0),
      )
      const img = await pdfDoc.embedPng(imgBytes)

      // A4 at 72 pt/in
      const pdfPage = pdfDoc.addPage([595, 842])
      pdfPage.drawImage(img, { x: 0, y: 0, width: 595, height: 842 })
    }

    return pdfDoc.save()
  } finally {
    root?.unmount()
    document.body.removeChild(container)
  }
}

/** Wait for every <img> inside `root` to finish decoding. */
function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'))
  if (imgs.length === 0) return Promise.resolve()
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) return resolve()
          img.onload = () => resolve()
          img.onerror = () => resolve() // don't block on failed images
        }),
    ),
  ).then()
}
