import { useMemo, useState } from 'react'
import { useStore } from '../../store/useStore'
import AnnotationCard from '../AnnotationCard/AnnotationCard'
import type { ChatSession } from '../../types'

type Tab = 'annotations' | 'chat-history'

export default function Sidebar() {
  const annotations = useStore((s) => s.annotations)
  const searchQuery = useStore((s) => s.searchQuery)
  const pdfMeta = useStore((s) => s.pdfMeta)
  const chatSessions = useStore((s) => s.chatSessions)
  const openChat = useStore((s) => s.openChat)
  const deleteChatSession = useStore((s) => s.deleteChatSession)
  const clearChatHistory = useStore((s) => s.clearChatHistory)

  const [tab, setTab] = useState<Tab>('annotations')

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return annotations
    const q = searchQuery.toLowerCase()
    return annotations.filter((a) => {
      return (
        a.text?.toLowerCase().includes(q) ||
        a.comment?.toLowerCase().includes(q) ||
        a.type.toLowerCase().includes(q) ||
        a.severity?.toLowerCase().includes(q) ||
        a.category?.toLowerCase().includes(q) ||
        a.author?.toLowerCase().includes(q)
      )
    })
  }, [annotations, searchQuery])

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => a.page - b.page || a.createdAt.localeCompare(b.createdAt)),
    [filtered]
  )

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-gray-200 bg-white">
      {/* Tab header */}
      <div className="flex border-b border-gray-100">
        <button
          className={`flex-1 px-4 py-2.5 text-xs font-semibold transition-colors ${
            tab === 'annotations'
              ? 'border-b-2 border-brand-500 text-brand-600 bg-brand-50/50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
          onClick={() => setTab('annotations')}
        >
          Annotations
          {annotations.length > 0 && (
            <span className="ml-1.5 font-normal text-gray-400">{annotations.length}</span>
          )}
        </button>
        <button
          className={`flex-1 px-4 py-2.5 text-xs font-semibold transition-colors ${
            tab === 'chat-history'
              ? 'border-b-2 border-brand-500 text-brand-600 bg-brand-50/50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
          onClick={() => setTab('chat-history')}
        >
          Chat History
          {chatSessions.length > 0 && (
            <span className="ml-1.5 font-normal text-gray-400">{chatSessions.length}</span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scroll-thin px-3 py-3">
        {tab === 'annotations' && (
          <>
            {!pdfMeta ? (
              <div className="mt-8 text-center text-sm text-gray-400">
                Upload a PDF to get started
              </div>
            ) : sorted.length === 0 ? (
              <div className="mt-8 text-center text-sm text-gray-400">
                {searchQuery ? 'No matching annotations' : 'No annotations yet'}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {sorted.map((ann) => (
                  <AnnotationCard key={ann.id} annotation={ann} />
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'chat-history' && (
          <>
            {chatSessions.length === 0 ? (
              <div className="mt-8 text-center text-sm text-gray-400">
                <p className="mb-1 text-lg">💬</p>
                <p>No chat history yet</p>
                <p className="mt-1 text-[10px] text-gray-300">
                  Select text on the PDF and click "Verify Claim" to start a chat
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {chatSessions.map((session) => (
                  <ChatHistoryCard
                    key={session.id}
                    session={session}
                    onOpen={() => openChat('', session.page, session.id)}
                    onDelete={() => deleteChatSession(session.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  )
}

/* ─── Chat History Card ─── */

function ChatHistoryCard({
  session,
  onOpen,
  onDelete,
}: {
  session: ChatSession
  onOpen: () => void
  onDelete: () => void
}) {
  const created = new Date(session.createdAt)
  const msgCount = session.messages.filter((m) => m.role === 'user').length
  const preview = session.selectedText.substring(0, 80)

  return (
    <div
      className="card card-hover cursor-pointer p-3 transition-all duration-100"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs text-white shadow-sm">
            🤖
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-gray-700">Verify Claim</span>
              <span className="text-[10px] text-gray-400">·</span>
              <span className="text-[10px] text-gray-500">Pg {session.page}</span>
            </div>
            <p className="mt-0.5 text-[10px] text-gray-400">
              {msgCount} question{msgCount !== 1 ? 's' : ''} · {created.toLocaleDateString()}
            </p>
          </div>
        </div>
        <button
          className="btn-icon !p-0.5 shrink-0 text-gray-300 hover:text-red-500"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          title="Delete"
        >
          🗑️
        </button>
      </div>

      <div className="mt-2 rounded-md bg-gray-50 border border-gray-100 px-2 py-1.5">
        <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-0.5">
          Selected Text
        </p>
        <p className="text-[11px] text-gray-600 leading-relaxed line-clamp-2">
          {preview}{session.selectedText.length > 80 ? '...' : ''}
        </p>
      </div>

      {/* Last message preview */}
      {session.messages.length > 1 && (
        <p className="mt-1.5 text-[10px] text-gray-400 truncate">
          💬 {session.messages[session.messages.length - 1].content.substring(0, 60)}...
        </p>
      )}
    </div>
  )
}
