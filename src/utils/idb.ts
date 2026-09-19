const DB_NAME = 'pdf-annotator-db'
const STORE_NAME = 'pdf-store'
const HISTORY_STORE_NAME = 'history-files'
const IMAGE_STORE_NAME = 'image-store'

export const PDF_KEYS = {
  brochure: 'brochure-pdf',
  reference: 'reference-pdf',
} as const

/** localStorage-friendly prefix for cached brochure images in IndexedDB. */
export const BROCHURE_IMAGE_KEY_PREFIX = 'brochure-image-'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 3)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME)
      }
      if (!req.result.objectStoreNames.contains(HISTORY_STORE_NAME)) {
        req.result.createObjectStore(HISTORY_STORE_NAME)
      }
      if (!req.result.objectStoreNames.contains(IMAGE_STORE_NAME)) {
        req.result.createObjectStore(IMAGE_STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function savePdfBinary(data: string, key: string = PDF_KEYS.brochure): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(data, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadPdfBinary(key: string = PDF_KEYS.brochure): Promise<string | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(key)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function deletePdfBinary(key: string = PDF_KEYS.brochure): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/* --- History file storage (annotated PDFs saved to the audit history) --- */

export async function saveExportFile(
  dataUrl: string,
  key: string
): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE_NAME, 'readwrite')
    tx.objectStore(HISTORY_STORE_NAME).put(dataUrl, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadExportFile(key: string): Promise<string | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE_NAME, 'readonly')
    const req = tx.objectStore(HISTORY_STORE_NAME).get(key)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function deleteExportFile(key: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE_NAME, 'readwrite')
    tx.objectStore(HISTORY_STORE_NAME).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/* --- Brochure generated-image cache ---
 * Generated images are stored here (data URLs) keyed by element id so they
 * survive page reloads without being written into localStorage (which would
 * quickly exceed its ~5 MB quota for large base64 PNGs). */

export async function saveBrochureImage(key: string, dataUrl: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE_NAME, 'readwrite')
    tx.objectStore(IMAGE_STORE_NAME).put(dataUrl, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadBrochureImage(key: string): Promise<string | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE_NAME, 'readonly')
    const req = tx.objectStore(IMAGE_STORE_NAME).get(key)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function deleteBrochureImage(key: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE_NAME, 'readwrite')
    tx.objectStore(IMAGE_STORE_NAME).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
