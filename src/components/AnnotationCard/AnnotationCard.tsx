import { useState } from 'react'
import type { Annotation, Severity, ValidationCategory } from '../../types'
import { useStore } from '../../store/useStore'
import { CATEGORY_ICONS, CATEGORY_LABELS, SEVERITY_COLORS, HIGHLIGHT_COLORS } from '../../utils/constants'

interface Props {
  annotation: Annotation
}

const TYPE_ICONS: Record<string, string> = {
  highlight: '🖍️',
  rectangle: '▭',
  validation: '✓',
}

const STATUS_BADGES: Record<string, string> = {
  open: 'badge-info',
  resolved: 'badge-success',
  rejected: 'badge-warning',
}

export default function AnnotationCard({ annotation }: Props) {
  const updateAnnotation = useStore((s) => s.updateAnnotation)
  const deleteAnnotation = useStore((s) => s.deleteAnnotation)
  const setSelectedAnnotationId = useStore((s) => s.setSelectedAnnotationId)
  const setScrollToPage = useStore((s) => s.setScrollToPage)
  const selectedAnnotationId = useStore((s) => s.selectedAnnotationId)
  const [editing, setEditing] = useState(false)
  const [editingText, setEditingText] = useState(false)
  const [commentDraft, setCommentDraft] = useState(annotation.comment || '')
  const [textDraft, setTextDraft] = useState(annotation.text || '')
  const [showColorPicker, setShowColorPicker] = useState(false)

  const isSelected = selectedAnnotationId === annotation.id
  const createdAt = new Date(annotation.createdAt)

  const handleSelect = () => {
    setSelectedAnnotationId(annotation.id)
    setScrollToPage(annotation.page)
  }

  const handleSaveComment = () => {
    updateAnnotation(annotation.id, { comment: commentDraft })
    setEditing(false)
  }

  return (
    <div
      className={`card cursor-pointer p-3 transition-all duration-100 ${
        isSelected ? 'ring-2 ring-brand-400 border-brand-300' : 'card-hover'
      }`}
      onClick={handleSelect}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0">{TYPE_ICONS[annotation.type] || '📄'}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-gray-500 uppercase">
                {annotation.type}
              </span>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs text-gray-500">Pg {annotation.page}</span>
              {annotation.type === 'highlight' && annotation.referencePage && (
                <>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs text-amber-600 font-medium">
                    Ref p.{annotation.referencePage}
                    {annotation.referenceLocationStatus === 'not_found' && (
                      <span className="text-gray-400 font-normal"> (not located)</span>
                    )}
                  </span>
                </>
              )}
            </div>
            {annotation.type === 'validation' && annotation.severity && (
              <span
                className={`badge mt-0.5 ${
                  annotation.severity === 'info'
                    ? 'badge-info'
                    : annotation.severity === 'warning'
                    ? 'badge-warning'
                    : annotation.severity === 'error'
                    ? 'badge-error'
                    : 'badge-success'
                }`}
              >
                {annotation.severity}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {annotation.status && (
            <span
              className={`badge text-[10px] ${
                STATUS_BADGES[annotation.status] || 'badge-info'
              }`}
            >
              {annotation.status}
            </span>
          )}
        </div>
      </div>

      {/* Text / Message */}
      {annotation.type === 'validation' ? (
        <div className="mt-1.5">
          {editingText ? (
            <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
              <input
                className="w-full rounded border border-gray-200 bg-gray-50 px-2 py-1 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                value={textDraft}
                onChange={(e) => setTextDraft(e.target.value)}
                autoFocus
              />
              <div className="flex gap-1">
                <button
                  className="btn-primary text-xs !py-0.5"
                  onClick={() => {
                    updateAnnotation(annotation.id, { text: textDraft })
                    setEditingText(false)
                  }}
                >
                  Save
                </button>
                <button
                  className="btn-ghost text-xs !py-0.5"
                  onClick={() => {
                    setTextDraft(annotation.text || '')
                    setEditingText(false)
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {annotation.message && (
                <p className="text-sm font-semibold text-gray-800">{annotation.message}</p>
              )}
              <div className="flex items-center gap-1">
                <p className="flex-1 text-sm font-medium text-gray-700 truncate">
                  {annotation.message
                    ? annotation.text || 'No snippet'
                    : annotation.text || 'No message'}
                </p>
                <button
                  className="btn-icon !p-0.5 text-xs shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingText(true)
                    setTextDraft(annotation.text || '')
                  }}
                  title="Edit text"
                >
                  ✏️
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        annotation.text && (
          <p className="mt-1.5 text-sm font-medium text-gray-700 truncate">
            {annotation.text}
          </p>
        )
      )}

      {/* Category */}
      {annotation.category && (
        <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
          <span>{CATEGORY_ICONS[annotation.category]}</span>
          <span>{CATEGORY_LABELS[annotation.category]}</span>
        </div>
      )}

      {/* Comment */}
      <div className="mt-2">
        {editing ? (
          <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
            <textarea
              className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
              rows={2}
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              autoFocus
            />
            <div className="flex gap-1.5">
              <button className="btn-primary text-xs !py-1" onClick={handleSaveComment}>
                Save
              </button>
              <button
                className="btn-ghost text-xs !py-1"
                onClick={() => {
                  setCommentDraft(annotation.comment || '')
                  setEditing(false)
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            {annotation.comment ? (
              <p className="flex-1 text-xs text-gray-600 truncate">
                💬 {annotation.comment}
              </p>
            ) : (
              <span className="text-xs text-gray-400 italic">No comment</span>
            )}
            <button
              className="btn-icon !p-0.5 text-xs"
              onClick={(e) => {
                e.stopPropagation()
                setEditing(true)
                setCommentDraft(annotation.comment || '')
              }}
              title="Edit comment"
            >
              ✏️
            </button>
          </div>
        )}
      </div>

      {/* Meta + Actions */}
      <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
        <span className="text-[10px] text-gray-400" title={createdAt.toLocaleString()}>
          {createdAt.toLocaleDateString()} {createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          {/* Color picker for highlights */}
          {annotation.type === 'highlight' && (
            <div className="relative">
              <button
                className="btn-icon !p-1"
                onClick={() => setShowColorPicker(!showColorPicker)}
                title="Change color"
              >
                🎨
              </button>
              {showColorPicker && (
                <div className="absolute bottom-full right-0 mb-1 flex gap-1 rounded-lg border border-gray-200 bg-white p-1.5 shadow-card">
                  {HIGHLIGHT_COLORS.map((c) => (
                    <button
                      key={c}
                      className={`h-5 w-5 rounded-full border-2 ${
                        annotation.color === c ? 'border-brand-500' : 'border-gray-200'
                      }`}
                      style={{ backgroundColor: c }}
                      onClick={() => {
                        updateAnnotation(annotation.id, { color: c })
                        setShowColorPicker(false)
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          {/* Severity changer for validation */}
          {annotation.type === 'validation' && (
            <select
              className="text-xs rounded border border-gray-200 bg-white px-1 py-0.5 focus:outline-none focus:border-brand-400"
              value={annotation.severity || 'info'}
              onChange={(e) => {
                const sv = e.target.value as Severity
                updateAnnotation(annotation.id, {
                  severity: sv,
                  color: SEVERITY_COLORS[sv],
                })
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="success">Success</option>
            </select>
          )}
          {/* Category changer for validation */}
          {annotation.type === 'validation' && (
            <select
              className="text-xs rounded border border-gray-200 bg-white px-1 py-0.5 focus:outline-none focus:border-brand-400"
              value={annotation.category || 'custom'}
              onChange={(e) => {
                updateAnnotation(annotation.id, { category: e.target.value as ValidationCategory })
              }}
              onClick={(e) => e.stopPropagation()}
              title="Category"
            >
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          )}
          {/* Status toggle for validation */}
          {annotation.type === 'validation' && (
            <select
              className="text-xs rounded border border-gray-200 bg-white px-1 py-0.5 focus:outline-none focus:border-brand-400"
              value={annotation.status || 'open'}
              onChange={(e) => {
                updateAnnotation(annotation.id, { status: e.target.value as 'open' | 'resolved' | 'rejected' })
              }}
              onClick={(e) => e.stopPropagation()}
              title="Status"
            >
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="rejected">Rejected</option>
            </select>
          )}
          {/* Jump to evidence in reference paper */}
          {annotation.type === 'highlight' &&
            annotation.referencePage &&
            annotation.referenceLocationStatus === 'found' && (
              <button
                className="btn-icon !p-1 text-[11px]"
                onClick={(e) => {
                  e.stopPropagation()
                  useStore
                    .getState()
                    .gotoReferencePage(annotation.referencePage!, annotation.id)
                }}
                title={`View evidence on reference page ${annotation.referencePage}`}
              >
                📚
              </button>
            )}
          <button
            className="btn-icon !p-1 text-red-500 hover:bg-red-50 hover:text-red-600"
            onClick={(e) => {
              e.stopPropagation()
              deleteAnnotation(annotation.id)
            }}
            title="Delete"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  )
}
