import { useState } from 'react'
import { toIsoDate } from '../lib/dates.js'
import { VENUES } from '../config/venues.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import EventCard from './EventCard.jsx'

export default function DayView({ selectedDate, events, onEdit, onDelete }) {
  const [expandedId, setExpandedId] = useState(null)
  const { t, formatDayHeader } = useLanguage()
  const iso = toIsoDate(selectedDate)
  const dayEvents = events.filter((e) => e.date === iso)

  const grouped = VENUES
    .map((v) => ({ venue: v, list: dayEvents.filter((e) => e.venue_id === v.id) }))
    .filter((g) => g.list.length > 0)

  const toggle = (id) => setExpandedId((prev) => (prev === id ? null : id))

  return (
    <div className="day-view">
      <div className="day-header">{formatDayHeader(selectedDate)}</div>

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
              />
            ))}
          </section>
        ))
      )}
    </div>
  )
}
