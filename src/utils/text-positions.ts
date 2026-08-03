export interface TextSpan {
  text: string
  rect: DOMRect
}

const textLayerObservers = new Map<HTMLElement, MutationObserver>()
const textLayerCache = new WeakMap<HTMLElement, TextSpan[]>()

export function observeTextLayer(
  pageElement: HTMLElement,
  callback: (spans: TextSpan[]) => void
): () => void {
  const existing = textLayerObservers.get(pageElement)
  if (existing) existing.disconnect()

  const checkAndNotify = () => {
    const textLayer = pageElement.querySelector('.textLayer')
    if (!textLayer) return false
    const spans = textLayer.querySelectorAll('span[role="presentation"]')
    if (spans.length === 0) return false

    const result: TextSpan[] = []
    spans.forEach((span) => {
      const text = span.textContent || ''
      if (!text.trim()) return
      const rect = span.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      result.push({ text, rect })
    })

    if (result.length > 0) {
      textLayerCache.set(pageElement, result)
      callback(result)
      return true
    }
    return false
  }

  if (checkAndNotify()) {
    return () => {}
  }

  const observer = new MutationObserver(() => {
    if (checkAndNotify()) {
      observer.disconnect()
      textLayerObservers.delete(pageElement)
    }
  })

  observer.observe(pageElement, {
    childList: true,
    subtree: true,
  })

  textLayerObservers.set(pageElement, observer)

  return () => {
    observer.disconnect()
    textLayerObservers.delete(pageElement)
  }
}

export function getCachedTextSpans(pageElement: HTMLElement): TextSpan[] {
  return textLayerCache.get(pageElement) || []
}

export function clearTextSpanCache(pageElement: HTMLElement): void {
  textLayerCache.delete(pageElement)
}

export function waitForTextLayer(
  pageElement: HTMLElement,
  timeoutMs = 5000
): Promise<TextSpan[]> {
  return new Promise((resolve) => {
    const cached = textLayerCache.get(pageElement)
    if (cached && cached.length > 0) {
      resolve(cached)
      return
    }

    const textLayer = pageElement.querySelector('.textLayer')
    if (textLayer) {
      const spans = textLayer.querySelectorAll('span[role="presentation"]')
      if (spans.length > 0) {
        const result: TextSpan[] = []
        spans.forEach((span) => {
          const text = span.textContent || ''
          if (!text.trim()) return
          const rect = span.getBoundingClientRect()
          if (rect.width === 0 || rect.height === 0) return
          result.push({ text, rect })
        })
        if (result.length > 0) {
          textLayerCache.set(pageElement, result)
          resolve(result)
          return
        }
      }
    }

    const observer = new MutationObserver(() => {
      const textLayer = pageElement.querySelector('.textLayer')
      if (!textLayer) return
      const spans = textLayer.querySelectorAll('span[role="presentation"]')
      if (spans.length === 0) return

      const result: TextSpan[] = []
      spans.forEach((span) => {
        const text = span.textContent || ''
        if (!text.trim()) return
        const rect = span.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) return
        result.push({ text, rect })
      })

      if (result.length > 0) {
        observer.disconnect()
        textLayerCache.set(pageElement, result)
        resolve(result)
      }
    })

    observer.observe(pageElement, { childList: true, subtree: true })

    setTimeout(() => {
      observer.disconnect()
      resolve(textLayerCache.get(pageElement) || [])
    }, timeoutMs)
  })
}
