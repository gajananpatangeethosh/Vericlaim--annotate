import { v4 as uuid } from 'uuid'
import type { Annotation, Bounds } from '../types'
import {
  VALIDATION_MESSAGES,
  SEVERITY_COLORS,
  ANNOTATION_COLORS,
} from './constants'
import { cssToScreen, screenToCss } from './coordinates'

export function normaliseBounds(
  bounds: Bounds,
  scale: number
): Bounds {
  return screenToCss(bounds, scale)
}

export function denormaliseBounds(
  bounds: Bounds,
  scale: number
): Bounds {
  return cssToScreen(bounds, scale)
}

export function generateFakeValidations(
  numPages: number,
  existingAnnotations: Annotation[]
): Annotation[] {
  const newAnnotations: Annotation[] = []
  const count = Math.min(5 + Math.floor(Math.random() * 6), VALIDATION_MESSAGES.length)

  const shuffled = [...VALIDATION_MESSAGES].sort(() => Math.random() - 0.5)
  const selected = shuffled.slice(0, count)

  for (const item of selected) {
    const page = Math.floor(Math.random() * numPages) + 1
    const pageHeight = 1123
    const pageWidth = 794

    const width = 140 + Math.random() * 100
    const height = 28 + Math.random() * 20
    const x = 40 + Math.random() * (pageWidth - width - 80)
    const y = 60 + Math.random() * (pageHeight - height - 80)

    const now = new Date().toISOString()
    newAnnotations.push({
      id: uuid(),
      page,
      type: 'validation',
      text: item.message,
      bounds: {
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height),
      },
      color: SEVERITY_COLORS[item.severity],
      severity: item.severity,
      category: item.category,
      message: item.message,
      comment: '',
      author: 'AI Validator',
      status: 'open',
      createdAt: now,
      updatedAt: now,
    })
  }

  return newAnnotations
}

export function exportAnnotations(annotations: Annotation[]): void {
  const data = JSON.stringify(annotations, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `annotations-${Date.now()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function importAnnotations(json: string): Annotation[] {
  try {
    const data = JSON.parse(json)
    if (!Array.isArray(data)) throw new Error('Invalid format')
    return data.map((item: Record<string, unknown>) => ({
      id: item.id as string,
      page: item.page as number,
      type: item.type as Annotation['type'],
      text: item.text as string | undefined,
      message: item.message as string | undefined,
      bounds: item.bounds as Bounds,
      color: item.color as string,
      severity: item.severity as Annotation['severity'],
      category: item.category as Annotation['category'],
      comment: item.comment as string | undefined,
      author: item.author as string | undefined,
      status: item.status as Annotation['status'],
      createdAt: item.createdAt as string,
      updatedAt: item.updatedAt as string,
    }))
  } catch {
    throw new Error('Invalid annotation file')
  }
}

export function getAnnotationColor(
  type: Annotation['type'],
  severity?: Annotation['severity']
): string {
  if (type === 'validation' && severity) {
    return SEVERITY_COLORS[severity]
  }
  return ANNOTATION_COLORS[type] || '#93c5fd'
}

export function isPointInBounds(
  px: number,
  py: number,
  bounds: Bounds
): boolean {
  return (
    px >= bounds.x &&
    px <= bounds.x + bounds.width &&
    py >= bounds.y &&
    py <= bounds.y + bounds.height
  )
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
