import { puter } from '@heyputer/puter.js'
import type { BrochureDesign, BrochureElement } from '../types'

export type ImageEngine = 'puter' | 'eden'

export interface GenerateImageOptions {
  model?: string
  quality?: 'high' | 'medium' | 'low'
  ratio?: { w: number; h: number }
  onProgress?: (step: string) => void
}

export interface EdenGenerateImageOptions {
  model: string
  resolution?: string
  apiKey: string
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
  // Only GPT-Image models accept a "high/medium/low" quality tier. Sending
  // `quality` to Gemini or DALL·E models makes Puter reject the request with
  // HTTP 400, so omit it for anything that isn't a gpt-image-* model (an empty
  // model means the GPT default `gpt-image-1-mini`).
  const usesOpenAiQuality = !model || /^gpt-image/.test(model)
  const opts: Record<string, unknown> = {}
  if (model) opts.model = model
  if (ratio) opts.ratio = ratio
  if (usesOpenAiQuality) opts.quality = quality

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

const EDEN_ENDPOINT = 'https://api.edenai.run/v3/universal-ai'

async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download generated image (${res.status})`)
  const blob = await res.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read generated image'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Generate an image through Eden AI (https://www.edenai.co/docs). A single API
 * key unlocks many providers — pass the provider/model id (without the
 * "image/generation/" prefix), e.g. "openai/gpt-image-1-mini".
 *
 * Response shape: { status, output: { items: [{ image: <base64>, image_resource_url }] } }
 */
export async function edenGenerateImage(
  prompt: string,
  options: EdenGenerateImageOptions
): Promise<GeneratedImage> {
  const { model, apiKey, onProgress } = options
  if (!prompt.trim()) throw new Error('Image prompt is empty')
  if (!apiKey.trim()) throw new Error('Eden AI API key is missing — add one in the toolbar')

  const modelString = model.startsWith('image/generation/') ? model : `image/generation/${model}`
  const resolution = options.resolution || '1024x1024'

  onProgress?.('Generating image with Eden AI…')
  const response = await fetch(EDEN_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelString,
      input: { text: prompt.trim(), num_images: 1, resolution },
    }),
  })

  if (!response.ok) {
    let msg = `Eden AI error: ${response.status}`
    try {
      const err = await response.json()
      if (err.error?.message) msg += ` — ${err.error.message}`
      else if (err.message) msg += ` — ${err.message}`
    } catch {}
    throw new Error(msg)
  }

  const data = await response.json()
  if (data.status && data.status !== 'success') {
    throw new Error(data.error?.message || data.message || 'Eden AI image generation failed')
  }
  const item = data.output?.items?.[0]
  if (!item) throw new Error('Eden AI returned no image')

  onProgress?.('Downloading image…')
  let dataUrl: string
  if (item.image) {
    dataUrl = item.image.startsWith('data:')
      ? item.image
      : `data:image/png;base64,${item.image}`
  } else if (item.image_resource_url) {
    dataUrl = await urlToDataUrl(item.image_resource_url)
  } else {
    throw new Error('Eden AI response contained no image data')
  }

  return {
    dataUrl,
    width: 1024,
    height: 1024,
    model,
    mime: 'image/png',
  }
}

/**
 * Unified entry point used by the brochure generator. Dispatches to either the
 * free Puter backend or Eden AI based on the selected engine.
 */
export async function generateImageWithEngine(
  engine: ImageEngine,
  prompt: string,
  options: {
    model: string
    quality?: GenerateImageOptions['quality']
    resolution?: string
    apiKey?: string
    onProgress?: (step: string) => void
  }
): Promise<GeneratedImage> {
  if (engine === 'eden') {
    if (!options.apiKey?.trim()) throw new Error('Eden AI API key is missing — add one in the toolbar')
    return edenGenerateImage(prompt, {
      model: options.model,
      resolution: options.resolution,
      apiKey: options.apiKey,
      onProgress: options.onProgress,
    })
  }
  return generateImage(prompt, {
    model: options.model,
    quality: options.quality,
    onProgress: options.onProgress,
  })
}

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