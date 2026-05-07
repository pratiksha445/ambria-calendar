import { useState, useEffect, useRef } from 'react'
import { toIsoDate } from '../lib/dates.js'
import { VENUES } from '../config/venues.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import EventCard from './EventCard.jsx'

export default function DayModal({ date, events, onClose, onAdd, onEdit, onDelete, onExport, user, reviewMap, onReview, onPayment }) {
  const { t } = useLanguage()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [dragY, setDragY] = useState(0)
  const dragRef = useRef({ startY: 0, tracking: false })
  const bodyRef = useRef(null)
  const [narrow, setNarrow] = useState(() => window.innerWidth < 380)

  // Reset state when date changes
  useEffect(() => {
    setSearch('')
    setCategory('')
    setExpandedId(null)
    setDragY(0)
    dragRef.current = { startY: 0, tracking: false }
  }, [date])

  // Detect narrow screens for compact labels
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 379px)')
    const handler = (e) => setNarrow(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

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
  const dayEvents = events.filter((e) => {
    if (e.date === iso) return true
    // Villa multi-day: include if this day falls within the stay
    if (e.venue_id === 'villa' && e.check_in_date && e.check_out_date
        && e.check_out_date >= e.check_in_date
        && iso >= e.check_in_date && iso < e.check_out_date) return true
    // TND multi-day: include if this day falls within the date range
    if (e.venue_id === 'tender' && e.date && e.end_date
        && e.end_date > e.date
        && iso >= e.date && iso <= e.end_date) return true
    return false
  })

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

  const toggle = (id) => {
    const next = expandedId === id ? null : id
    setExpandedId(next)
    // Auto-scroll expanded card into view after expansion animation starts
    if (next != null) {
      requestAnimationFrame(() => {
        const body = bodyRef.current
        if (!body) return
        const card = body.querySelector('.event-card.expanded')
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    }
  }

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
          <div className="day-modal-header-actions">
            <button className="icon-btn" onClick={() => onExport?.(date)} aria-label="Export">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
            <button className="icon-btn day-modal-close" onClick={onClose} aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="day-modal-filters">
          <button className="add-booking-pill" onClick={() => onAdd(date)}>
            {t('+ Add Booking')}
          </button>
          <div className="day-modal-filter-row">
            <input
              type="search"
              placeholder={t('Search bookings…')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">{narrow ? t('All') : t('All Categories')}</option>
              {VENUES.map((v) => (
                <option key={v.id} value={v.id}>{v.short} — {t(v.name)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="day-modal-body" ref={bodyRef}>
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
                user={user}
                reviewMap={reviewMap}
                onReview={onReview}
                onPayment={onPayment}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
