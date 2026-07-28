import { useEffect, useState, useRef } from 'react'
import { useStore } from '../../store/useStore'

export default function SelectionPopup() {
  const openChat = useStore((s) => s.openChat)
  const currentTool = useStore((s) => s.currentTool)

  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [selectedText, setSelectedText] = useState('')
  const [pageNum, setPageNum] = useState(0)
  const popupRef = useRef<HTMLDivElement>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      // Clear any pending hide
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }

      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setVisible(false)
        return
      }

      const text = sel.toString().trim()
      if (text.length < 3) {
        setVisible(false)
        return
      }

      // Try to determine which page the selection is on
      const range = sel.getRangeAt(0)
      let el = range.startContainer
      while (el && el !== document.body) {
        if ((el as HTMLElement).getAttribute?.('data-page-number')) {
          const pn = parseInt((el as HTMLElement).getAttribute('data-page-number')!)
          if (!isNaN(pn)) setPageNum(pn)
          break
        }
        if ((el as HTMLElement).closest) {
          const pageEl = (el as HTMLElement).closest('[data-page-number]')
          if (pageEl) {
            const pn = parseInt(pageEl.getAttribute('data-page-number')!)
            if (!isNaN(pn)) setPageNum(pn)
            break
          }
        }
        el = el.parentElement!
      }

      // Get selection bounding rect
      let rect: DOMRect | null = null
      try {
        rect = range.getBoundingClientRect()
      } catch {
        return
      }
      if (!rect) return

      setSelectedText(text)
      setPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 12,
      })
      setVisible(true)
    }

    const handleMouseDown = (e: MouseEvent) => {
      // Hide if clicking outside the popup
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        // Delay hide slightly to allow click inside popup
        hideTimerRef.current = setTimeout(() => {
          const sel = window.getSelection()
          if (!sel || sel.isCollapsed) {
            setVisible(false)
          }
        }, 200)
      }
    }

    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('mousedown', handleMouseDown)

    return () => {
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('mousedown', handleMouseDown)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [])

  const handleVerifyClaim = () => {
    setVisible(false)
    window.getSelection()?.removeAllRanges()
    openChat(selectedText, pageNum || 1)
  }

  if (!visible) return null

  const popupStyle: React.CSSProperties = {
    position: 'fixed',
    left: position.x,
    top: position.y,
    transform: 'translate(-50%, -100%)',
    zIndex: 9999,
  }

  return (
    <div ref={popupRef} style={popupStyle}>
      <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-2 py-1.5 shadow-xl animate-fade-in">
        <button
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-600 to-brand-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:shadow-md transition-all hover:scale-105 active:scale-95"
          onClick={handleVerifyClaim}
        >
          <span>🤖</span>
          <span>Verify Claim</span>
        </button>
        <button
          className="rounded-lg px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          onClick={() => {
            setVisible(false)
            window.getSelection()?.removeAllRanges()
          }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
