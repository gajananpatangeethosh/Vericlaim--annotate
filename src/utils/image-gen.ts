import { puter } from '@heyputer/puter.js'
import type { BrochureDesign, BrochureElement } from '../types'

export interface GenerateImageOptions {
  model?: string
  quality?: 'high' | 'medium' | 'low'
  ratio?: { w: number; h: number }
  onProgress?: (step: string) => void
}

export interface GeneratedImage {
  dataUrl: string
  width: number
  height: number
  model: string
  mime: string
}

const DEFAULT_QUALITY: GenerateImageOptions['quality'] = 'low'

/**
 * Rasterize the HTMLImageElement returned by puter.ai.txt2img() into a PNG
 * data URL. The library guarantees the element's src is a data URL, so the
 * canvas is never tainted and toDataURL() is safe to call.
 */
export async function imageElementToPngDataUrl(img: HTMLImageElement): Promise<string> {
  try {
    if (typeof img.decode === 'function') {
      await img.decode()
    }
  } catch {
    // fall through — a still-decoding image draws fine as long as naturalWidth is set
  }

  const w = img.naturalWidth || 1024
  const h = img.naturalHeight || 1024
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available in this browser')
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/png')
}

/**
 * Generate an image with Puter.js (free, no API key — users authenticate with
 * their own Puter account on first use). Returns the image as a PNG data URL
 * so it can be embedded into the exported PDF via pdf-lib.
 */
export async function generateImage(
  prompt: string,
  options: GenerateImageOptions = {}
): Promise<GeneratedImage> {
  const { model = '', quality = DEFAULT_QUALITY, ratio, onProgress } = options
  if (!prompt.trim()) throw new Error('Image prompt is empty')

  onProgress?.('Generating image with Puter…')
  const opts: Record<string, unknown> = { quality }
  if (model) opts.model = model
  if (ratio) opts.ratio = ratio

  const img = await puter.ai.txt2img(prompt.trim(), opts as any)
  onProgress?.('Rasterizing image…')

  const dataUrl = await imageElementToPngDataUrl(img)
  return {
    dataUrl,
    width: img.naturalWidth || 1024,
    height: img.naturalHeight || 1024,
    model,
    mime: dataUrl.split(';')[0].replace('data:', '') || 'image/png',
  }
}

function imageKey(elementId: string): string {
  return `brochure-image-${elementId}`
}

export { imageKey }

/**
 * Build a sensible default image prompt for an image-placeholder that the AI
 * forgot to annotate with `imagePrompt`. Keeps the prompt medical-safe and
 * tone-consistent with the brochure's brand colors.
 */
export function buildDefaultImagePrompt(
  el: BrochureElement,
  design: BrochureDesign | null | undefined
): string {
  const topic = el.text?.trim() ? el.text.trim() : 'medical illustration'
  const brand = design?.brandName?.trim() ? `${design.brandName} — ` : ''
  const primary = design?.primaryColor || '#2563eb'
  return `${brand}${topic}. Professional medical brochure illustration, clean modern minimal style, soft ${primary} tones, high quality, no text, no people's faces.`
}

/**
 * Return a deep copy of the design with every generated image stripped.
 * Used when persisting to localStorage so large base64 images never blow the
 * ~5 MB quota. Live images live in memory + IndexedDB.
 */
export function stripGeneratedImages(design: BrochureDesign): BrochureDesign {
  return {
    ...design,
    pages: design.pages.map((p) => ({
      ...p,
      elements: p.elements.map((el) => {
        if (el.type !== 'image-placeholder') return el
        const { imageSrc: _src, ...rest } = el
        return { ...rest, imageStatus: 'none' as const }
      }),
    })),
  }
}