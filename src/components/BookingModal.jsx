import { useEffect, useRef, useState } from 'react'
import BookingForm from './BookingForm.jsx'

// Bottom-sheet modal with drag-down-to-close on mobile, centered card on desktop.
// The form lives inside; this component just owns the shell and close behavior.

export default function BookingModal({ open, initial, onClose, onSaved, onDeleted }) {
  const sheetRef = useRef(null)
  const [dragY, setDragY] = useState(0)
  const dragRef = useRef({ startY: 0, tracking: false })

  // Escape to close
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // Reset drag offset whenever we open/close
  useEffect(() => {
    setDragY(0)
    dragRef.current = { startY: 0, tracking: false }
  }, [open])

  if (!open) return null

  const onHandleTouchStart = (e) => {
    dragRef.current = { startY: e.touches[0].clientY, tracking: true }
  }
  const onHandleTouchMove = (e) => {
    if (!dragRef.current.tracking) return
    const dy = e.touches[0].clientY - dragRef.current.startY
    setDragY(Math.max(0, dy))
  }
  const onHandleTouchEnd = () => {
    if (!dragRef.current.tracking) return
    const dy = dragY
    dragRef.current.tracking = false
    if (dy > 100) {
      onClose?.()
    } else {
      setDragY(0)
    }
  }

  const sheetStyle = dragY > 0 ? { transform: `translateY(${dragY}px)` } : undefined

  return (
    <div className="modal-root" role="dialog" aria-modal="true">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-sheet" ref={sheetRef} style={sheetStyle}>
        <div
          className="modal-handle"
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
          aria-hidden="true"
        >
          <span className="modal-handle-bar" />
        </div>
        <BookingForm
          initial={initial}
          onClose={onClose}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      </div>
    </div>
  )
}
