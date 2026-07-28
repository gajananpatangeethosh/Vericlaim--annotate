import { useRef, useEffect } from 'react'
import { useStore } from '../../store/useStore'

export default function ChatPanel() {
  const chatOpen = useStore((s) => s.chatOpen)
  const chatSelectedText = useStore((s) => s.chatSelectedText)
  const chatPage = useStore((s) => s.chatPage)
  const chatMessages = useStore((s) => s.chatMessages)
  const chatLoading = useStore((s) => s.chatLoading)
  const chatSessionId = useStore((s) => s.chatSessionId)
  const closeChat = useStore((s) => s.closeChat)
  const sendChatMessage = useStore((s) => s.sendChatMessage)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  useEffect(() => {
    if (chatOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [chatOpen])

  const handleSend = () => {
    const text = inputRef.current?.value.trim()
    if (!text) return
    inputRef.current!.value = ''
    sendChatMessage(text)
  }

  if (!chatOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm">
      <div className="mx-4 flex h-[80vh] w-full max-w-2xl flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between rounded-t-2xl border-b border-gray-100 bg-gradient-to-r from-brand-600 to-brand-700 px-5 py-3 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm">
              🤖
            </div>
            <div>
              <h2 className="text-sm font-semibold">Verify Claim</h2>
              <p className="text-[10px] text-white/70">AI-assisted document analysis</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium">
              Page {chatPage}
            </span>
            <button
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-xs hover:bg-white/25 transition-colors"
              onClick={closeChat}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Selected text banner */}
        <div className="mx-4 mt-3 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-xs shrink-0">📎</span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider mb-0.5">
                Selected Text
              </p>
              <p className="text-xs text-blue-800 leading-relaxed line-clamp-3">
                {chatSelectedText}
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 scroll-thin">
          {chatMessages.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-gray-400">Ask a question about the selected text...</p>
            </div>
          )}
          <div className="flex flex-col gap-3">
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs">
                    🤖
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'rounded-br-md bg-brand-600 text-white'
                      : 'rounded-bl-md border border-gray-100 bg-gray-50 text-gray-700'
                  }`}
                >
                  {msg.role === 'assistant' && msg.content.startsWith('I\'ve analyzed') ? (
                    <div>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs text-white">
                    U
                  </div>
                )}
              </div>
            ))}
            {chatLoading && (
              <div className="flex items-center gap-2.5">
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs">
                  🤖
                </div>
                <div className="max-w-[80%] rounded-xl rounded-bl-md border border-gray-100 bg-gray-50 px-3.5 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: '0ms' }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="rounded-b-2xl border-t border-gray-100 bg-white px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              className="flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 placeholder-gray-400"
              rows={2}
              placeholder="Ask about this text, e.g. 'Is this claim accurate?'..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
            />
            <button
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 transition-colors"
              onClick={handleSend}
              disabled={chatLoading}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
