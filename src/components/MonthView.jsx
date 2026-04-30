import { buildMonthGrid, isSameDay, toIsoDate } from '../lib/dates.js'
import { VENUE_BY_ID } from '../config/venues.js'
import { getEventTypeAbbr } from '../lib/eventTypes.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'

const MAX_PILLS = 3
const MAX_PILLS_DESKTOP = 5

export default function MonthView({ currentDate, selectedDate, onSelectDate, events, eventTypes = [] }) {
  const { dowHeaders } = useLanguage()
  const today = new Date()
  const days = buildMonthGrid(currentDate)
  const monthIndex = currentDate.getMonth()
  const eventsByDay = groupByDate(events)
  const wide = window.innerWidth >= 768

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
          const limit = wide ? MAX_PILLS_DESKTOP : MAX_PILLS
          const visible = dayEvents.slice(0, limit)
          const extra = dayEvents.length - visible.length
          const isToday = isSameDay(d, today)
          const classes = [
            'day-cell',
            d.getMonth() !== monthIndex ? 'outside' : '',
            isToday ? 'today' : '',
            isSameDay(d, selectedDate) ? 'selected' : '',
          ].filter(Boolean).join(' ')

          return (
            <button
              key={iso}
              className={classes}
              onClick={() => onSelectDate(d)}
              aria-label={`${iso}, ${dayEvents.length} bookings`}
            >
              <span className={`day-num${isToday ? ' today-circle' : ''}`}>
                {d.getDate()}
              </span>
              <div className="day-pills">
                {visible.map((ev, i) => {
                  const venue = VENUE_BY_ID[ev.venue_id]
                  const abbr = getEventTypeAbbr(ev.event_type, ev.event_type_other, eventTypes)
                  const fullType = ev.event_type === 'Other' ? (ev.event_type_other || 'Other') : (ev.event_type || '')
                  return (
                    <div
                      key={`${ev.id}-${i}`}
                      className="day-pill"
                      style={{
                        background: venue?.color ?? '#ccc',
                        color: venue?.textColor ?? '#fff',
                      }}
                      title={fullType}
                    >
                      {pillText(ev, abbr)}
                    </div>
                  )
                })}
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

/** Build short pill label: "(L) WD Sharma" or "7P WD Gupta" */
function pillText(ev, abbr) {
  const name = ev.guest_name || ev.tender_name || ''
  const first = name.split(/\s+/)[0] || ''
  const tag = abbr ? `${abbr} ` : ''

  if (ev.shift) {
    return `(${ev.shift[0]}) ${tag}${first}`
  }
  if (ev.time) {
    const h = parseInt(ev.time.split(':')[0], 10)
    const suffix = h >= 12 ? 'P' : 'A'
    const hr = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${hr}${suffix} ${tag}${first}`
  }
  return `${tag}${first}` || ev.venue_name || '—'
}
