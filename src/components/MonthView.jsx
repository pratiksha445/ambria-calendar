import { useState } from 'react'
import { buildMonthGrid, isSameDay, toIsoDate } from '../lib/dates.js'
import { VENUE_BY_ID } from '../config/venues.js'
import EventCard from './EventCard.jsx'

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function MonthView({ currentDate, selectedDate, onSelectDate, events, onEdit, onDelete }) {
  const [expandedId, setExpandedId] = useState(null)
  const today = new Date()
  const days = buildMonthGrid(currentDate)
  const monthIndex = currentDate.getMonth()
  const eventsByDay = groupByDate(events)
  const selIso = toIsoDate(selectedDate)
  const selectedEvents = eventsByDay[selIso] ?? []

  const toggle = (id) => setExpandedId((prev) => (prev === id ? null : id))

  return (
    <div className="month-view">
      <div className="dow-row">
        {DOW.map((d, i) => (
          <div key={i} className="dow-cell">{d}</div>
        ))}
      </div>
      <div className="month-grid">
        {days.map((d) => {
          const iso = toIsoDate(d)
          const dayEvents = eventsByDay[iso] ?? []
          const dots = dayEvents.slice(0, 4)
          const extra = dayEvents.length - dots.length
          const classes = [
            'day-cell',
            d.getMonth() !== monthIndex ? 'outside' : '',
            isSameDay(d, today) ? 'today' : '',
            isSameDay(d, selectedDate) ? 'selected' : '',
          ].filter(Boolean).join(' ')

          return (
            <button
              key={iso}
              className={classes}
              onClick={() => onSelectDate(d)}
              aria-label={`${iso}, ${dayEvents.length} bookings`}
            >
              <span className="day-num">{d.getDate()}</span>
              <div className="day-dots">
                {dots.map((ev, i) => (
                  <span
                    key={`${ev.id}-${i}`}
                    className="day-dot"
                    style={{ background: VENUE_BY_ID[ev.venue_id]?.color ?? '#ccc' }}
                  />
                ))}
                {extra > 0 && <span className="day-extra">+{extra}</span>}
              </div>
            </button>
          )
        })}
      </div>

      <div className="event-list">
        <div className="event-list-header">
          {selectedEvents.length} {selectedEvents.length === 1 ? 'booking' : 'bookings'}
        </div>
        {selectedEvents.length === 0 ? (
          <div className="empty-state">No bookings</div>
        ) : (
          selectedEvents.map((ev) => (
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
  )
}

function groupByDate(events) {
  return events.reduce((acc, ev) => {
    (acc[ev.date] = acc[ev.date] || []).push(ev)
    return acc
  }, {})
}
