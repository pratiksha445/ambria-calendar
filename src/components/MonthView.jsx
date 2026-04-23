import { buildMonthGrid, isSameDay, toIsoDate } from '../lib/dates.js'
import { VENUE_BY_ID } from '../config/venues.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'

export default function MonthView({ currentDate, selectedDate, onSelectDate, events }) {
  const { dowHeaders } = useLanguage()
  const today = new Date()
  const days = buildMonthGrid(currentDate)
  const monthIndex = currentDate.getMonth()
  const eventsByDay = groupByDate(events)

  return (
    <div className="month-view">
      <div className="dow-row">
        {dowHeaders.map((d, i) => (
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
    </div>
  )
}

function groupByDate(events) {
  return events.reduce((acc, ev) => {
    (acc[ev.date] = acc[ev.date] || []).push(ev)
    return acc
  }, {})
}
