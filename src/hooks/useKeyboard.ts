import { useEffect, useCallback } from 'react'
import { useStore } from '../store/useStore'

export function useKeyboard() {
  const setCurrentTool = useStore((s) => s.setCurrentTool)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)

  const handler = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        redo()
        return
      }

      switch (e.key.toLowerCase()) {
        case 'v':
          setCurrentTool('pointer')
          break
        case 'h':
          setCurrentTool('highlight')
          break
        case 'r':
          setCurrentTool('rectangle')
          break
        case 'l':
          setCurrentTool('validation')
          break
        case 'c':
          setCurrentTool('comment')
          break
        case 'e':
          setCurrentTool('erase')
          break
      }
    },
    [setCurrentTool, undo, redo]
  )

  useEffect(() => {
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handler])
}
