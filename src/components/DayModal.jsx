import { useState, useEffect, useRef } from 'react'
import { toIsoDate } from '../lib/dates.js'
import { VENUES } from '../config/venues.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import EventCard from './EventCard.jsx'

export default function DayModal({ date, events, onClose, onAdd, onEdit, onDelete }) {
  const { t } = useLanguage()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [dragY, setDragY] = useState(0)
  const dragRef = useRef({ startY: 0, tracking: false })

  // Reset state when date changes
  useEffect(() => {
    setSearch('')
    setCategory('')
    setExpandedId(null)
    setDragY(0)
    dragRef.current = { startY: 0, tracking: false }
  }, [date])

  // Escape to close
  useEffect(() => {
    if (!date) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [date, onClose])

  // Lock body scroll
  useEffect(() => {
    if (!date) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [date])

  if (!date) return null

  const iso = toIsoDate(date)
  const dayEvents = events.filter((e) => e.date === iso)

  // Apply modal-local filters
  const filtered = dayEvents.filter((ev) => {
    if (category && ev.venue_id !== category) return false
    if (!search.trim()) return true
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const hay = [
      ev.guest_name, ev.tender_name, ev.title, ev.venue_name,
      ev.sales_person, ev.event_type, ev.sub_venue,
    ].filter(Boolean).join(' ').toLowerCase()
    return words.every((w) => hay.includes(w))
  })

  const toggle = (id) => setExpandedId((prev) => (prev === id ? null : id))

  // Localized header: "Thursday, 23 April"
  const fullDayName = t(`day_full_${date.getDay()}`)
  const dayNum = date.getDate()
  const monthName = t(`month_${date.getMonth()}`)
  const headerText = `${fullDayName}, ${dayNum} ${monthName}`

  // Drag-to-close
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
    dragRef.current.tracking = false
    if (dragY > 100) onClose?.()
    else setDragY(0)
  }

  const sheetStyle = dragY > 0 ? { transform: `translateY(${dragY}px)` } : undefined

  return (
    <div className="day-modal-root" role="dialog" aria-modal="true">
      <div className="day-modal-backdrop" onClick={onClose} />
      <div className="day-modal-sheet" style={sheetStyle}>
        <div
          className="day-modal-handle"
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
          aria-hidden="true"
        >
          <span className="modal-handle-bar" />
        </div>

        <div className="day-modal-header">
          <h2>{headerText}</h2>
          <button className="icon-btn day-modal-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="day-modal-filters">
          <input
            type="search"
            placeholder={t('Search bookings…')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">{t('All Categories')}</option>
            {VENUES.map((v) => (
              <option key={v.id} value={v.id}>{v.short} — {v.name}</option>
            ))}
          </select>
        </div>

        <div className="day-modal-body">
          <button className="add-booking-card" onClick={() => onAdd(date)}>
            {t('+ Add Booking')}
          </button>

          {filtered.length === 0 ? (
            <div className="empty-state">{t('No bookings')}</div>
          ) : (
            filtered.map((ev) => (
              <EventCard
                key={ev.id}
                event={ev}
                expanded={expandedId === ev.id}
                onToggle={() => toggle(ev.id)}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
