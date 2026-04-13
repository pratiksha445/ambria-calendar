import { startOfWeek, addDays, isSameDay, toIsoDate, dayLabel } from '../lib/dates.js'
import EventCard from './EventCard.jsx'

export default function WeekView({ currentDate, selectedDate, onSelectDate, events }) {
  const weekStart = startOfWeek(currentDate)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const eventsByDay = events.reduce((acc, ev) => {
    (acc[ev.date] = acc[ev.date] || []).push(ev)
    return acc
  }, {})
  const selIso = toIsoDate(selectedDate)
  const selectedEvents = eventsByDay[selIso] ?? []

  return (
    <div className="week-view">
      <div className="week-strip">
        {days.map((d) => {
          const iso = toIsoDate(d)
          const count = (eventsByDay[iso] ?? []).length
          const isSelected = isSameDay(d, selectedDate)
          return (
            <button
              key={iso}
              className={`week-chip ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectDate(d)}
            >
              <span className="week-chip-day">{dayLabel(d)}</span>
              <span className="week-chip-date">{d.getDate()}</span>
              {count > 0 && <span className="week-chip-count">{count}</span>}
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
          selectedEvents.map((ev) => <EventCard key={ev.id} event={ev} />)
        )}
      </div>
    </div>
  )
}
