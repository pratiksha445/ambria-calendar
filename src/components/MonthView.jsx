import { buildMonthGrid, isSameDay, toIsoDate } from '../lib/dates.js'
import { VENUE_BY_ID } from '../config/venues.js'
import { getEventTypeAbbr } from '../lib/eventTypes.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'

const MAX_PILLS = 3
const MAX_PILLS_DESKTOP = 5
const OWN_VENUES = new Set(['ap', 'am', 'ae', 'ar'])

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
                  const isOwn = OWN_VENUES.has(ev.venue_id)
                  const label = isOwn ? buildOwnPill(ev, eventTypes) : pillText(ev)
                  const tip = isOwn ? buildOwnTooltip(ev, eventTypes) : (ev.guest_name || ev.tender_name || ev.venue_name || '')
                  return (
                    <div
                      key={`${ev.id}-${i}`}
                      className="day-pill"
                      style={{
                        background: venue?.color ?? '#ccc',
                        color: venue?.textColor ?? '#fff',
                      }}
                      title={tip}
                    >
                      {label}
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

const SHIFT_INITIALS = { Morning: 'M', Lunch: 'L', Sundowner: 'S', Dinner: 'D' }

/** Compact pill for AP/AM/AE/AR: "D500WD", "S250CKT", "MMEH" */
function buildOwnPill(ev, eventTypes) {
  const s = SHIFT_INITIALS[ev.shift] || ''
  const p = ev.pax ? String(ev.pax).trim() : ''
  const a = getEventTypeAbbr(ev.event_type, ev.event_type_other, eventTypes)
  return `${s}${p}${a}` || '—'
}

/** Tooltip for AP/AM/AE/AR: "Dinner · 500 pax · Wedding" */
function buildOwnTooltip(ev, eventTypes) {
  const parts = []
  if (ev.shift) parts.push(ev.shift)
  if (ev.pax) parts.push(`${ev.pax} pax`)
  const fullType = ev.event_type === 'Other' ? (ev.event_type_other || 'Other') : (ev.event_type || '')
  if (fullType) parts.push(fullType)
  return parts.join(' · ')
}

/** Pill label for non-own-venue categories: "(L) Sharma" or "7P Gupta" */
function pillText(ev) {
  const name = ev.guest_name || ev.tender_name || ''
  const first = name.split(/\s+/)[0] || ''

  if (ev.shift) {
    return `(${ev.shift[0]}) ${first}`
  }
  if (ev.time) {
    const h = parseInt(ev.time.split(':')[0], 10)
    const suffix = h >= 12 ? 'P' : 'A'
    const hr = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${hr}${suffix} ${first}`
  }
  return first || ev.venue_name || '—'
}
