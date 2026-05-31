import { useState, useCallback, useMemo } from 'react'
import { toIsoDate } from '../lib/dates.js'
import { VENUES } from '../config/venues.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import EventCard from './EventCard.jsx'

const SEASON_COLORS = { "King's": '#D4A017', 'Perfect': '#2AAA8A' }

export default function DayView({ selectedDate, events, onEdit, onDelete, onAdd, user, reviewMap, onReview, onPayment, seasonData, getSeasonCategory }) {
  const [expandedId, setExpandedId] = useState(null)
  const { t, formatDayHeader } = useLanguage()
  const iso = toIsoDate(selectedDate)
  const OWN_VENUES_SET = new Set(['ap', 'am', 'ae', 'ar'])
  const dayEvents = useMemo(() => {
    const result = []
    for (const e of events) {
      if (e.date === iso) { result.push(e); continue }
      // Villa multi-day
      if (e.venue_id === 'villa' && e.check_in_date && e.check_out_date
          && e.check_out_date >= e.check_in_date
          && iso >= e.check_in_date && iso < e.check_out_date) { result.push(e); continue }
      // TND multi-day
      if (e.venue_id === 'tender' && e.date && e.end_date
          && e.end_date > e.date
          && iso >= e.date && iso <= e.end_date) { result.push(e); continue }
      // Setup / clearance pills (own venues only)
      if (OWN_VENUES_SET.has(e.venue_id)) {
        if (e.setup_date === iso && e.setup_date !== e.date) {
          result.push({ ...e, _scType: 'setup' })
          continue
        }
        if (e.clearance_date === iso && e.clearance_date !== e.date) {
          result.push({ ...e, _scType: 'clearance' })
          continue
        }
      }
    }
    return result
  }, [events, iso])

  const grouped = useMemo(() => VENUES
    .map((v) => ({ venue: v, list: dayEvents.filter((e) => e.venue_id === v.id) }))
    .filter((g) => g.list.length > 0),
    [dayEvents])

  const toggle = useCallback((id) => setExpandedId((prev) => (prev === id ? null : id)), [])

  return (
    <div className="day-view">
      <div className="day-header">
        {formatDayHeader(selectedDate)}
        {(() => { const s = getSeasonCategory ? getSeasonCategory(iso, seasonData) : null; const c = s ? SEASON_COLORS[s] : null; return c ? <span className="season-pill-tag" style={{ background: c }}>{s}</span> : null })()}
      </div>

      {onAdd && (
        <button className="add-booking-card" onClick={onAdd}>
          {t('+ Add Booking')}
        </button>
      )}

      {dayEvents.length === 0 ? (
        <div className="empty-state">{t('No bookings for this day')}</div>
      ) : (
        grouped.map(({ venue, list }) => (
          <section key={venue.id} className="day-group">
            <div className="day-group-title">
              <span className="filter-dot" style={{ background: venue.color }} />
              <span className="day-group-short">{venue.short}</span>
              <span className="day-group-count">{list.length}</span>
            </div>
            {list.map((ev) => (
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
            ))}
          </section>
        ))
      )}
    </div>
  )
}
