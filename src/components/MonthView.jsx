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
                  return (
                    <div
                      key={`${ev.id}-${i}`}
                      className="day-pill"
                      style={{
                        background: venue?.color ?? '#ccc',
                        color: venue?.textColor ?? '#fff',
                      }}
                      title={buildPillTooltip(ev, eventTypes)}
                    >
                      {buildPillLabel(ev, eventTypes)}
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

// ── Shared helpers ──

const SHIFT_INITIALS = { Morning: 'M', Lunch: 'L', Sundowner: 'S', Dinner: 'D' }

function customAbbr(text) {
  if (!text) return ''
  const t = text.trim()
  if (!t) return ''
  const words = t.split(/\s+/)
  if (words.length === 1) return t.slice(0, 3).toUpperCase()
  return words.map(w => w[0]).join('').slice(0, 4).toUpperCase()
}

const VILLA_SV = { 'AP Kothi': 'APK', 'AM Kothi': 'AMK', 'AE Kothi': 'AEK', 'Sukoon': 'SUK' }

function villaSubVenueAbbr(sv) {
  return VILLA_SV[sv] || (sv ? sv.replace(/\s+/g, '').slice(0, 4).toUpperCase() : '')
}

function formatListLabel(items, abbrFn, max) {
  if (!items || items.length === 0) return ''
  const first = items.slice(0, max).map(abbrFn)
  const suffix = items.length > max ? '+' : ''
  return first.join('+') + suffix
}

// ── Pill label (per-category) ──

function buildPillLabel(ev, eventTypes) {
  const s = SHIFT_INITIALS[ev.shift] || ''
  const p = ev.pax ? String(ev.pax).trim() : ''

  switch (ev.venue_id) {
    case 'ap': case 'am': case 'ae': case 'ar':
    case 'add': case 'ac':
      return `${s}${p}${getEventTypeAbbr(ev.event_type, ev.event_type_other, eventTypes)}` || '—'

    case 'tender':
      return `${s}${p}${customAbbr(ev.event_type_text)}` || '—'

    case 'villa':
      return `${villaSubVenueAbbr(ev.sub_venue)}${p}` || '—'

    case 'aee': {
      if (ev.elements && ev.elements.length > 0) {
        return formatListLabel(ev.elements, customAbbr, 2)
      }
      return getEventTypeAbbr(ev.event_type, ev.event_type_other, eventTypes) || '—'
    }

    case 'ws': {
      const types = ev.service_type
      if (!types || types.length === 0) return '—'
      const expanded = types.map(t => t === 'Others' && ev.service_type_other ? ev.service_type_other : t)
      return formatListLabel(expanded, customAbbr, 2) || '—'
    }

    default:
      return '—'
  }
}

// ── Tooltip (per-category) ──

function buildPillTooltip(ev, eventTypes) {
  switch (ev.venue_id) {
    case 'ap': case 'am': case 'ae': case 'ar':
    case 'add': case 'ac': {
      const parts = []
      if (ev.shift) parts.push(ev.shift)
      if (ev.pax) parts.push(`${ev.pax} pax`)
      const ft = ev.event_type === 'Other' ? (ev.event_type_other || 'Other') : (ev.event_type || '')
      if (ft) parts.push(ft)
      return parts.join(' · ')
    }

    case 'tender': {
      const parts = []
      if (ev.shift) parts.push(ev.shift)
      if (ev.pax) parts.push(`${ev.pax} pax`)
      if (ev.event_type_text) parts.push(ev.event_type_text)
      return parts.join(' · ')
    }

    case 'villa': {
      const parts = []
      if (ev.sub_venue) parts.push(ev.sub_venue)
      if (ev.pax) parts.push(`${ev.pax} pax`)
      return parts.join(' · ')
    }

    case 'aee':
      return (ev.elements && ev.elements.length > 0)
        ? ev.elements.join(', ')
        : (ev.event_type || '')

    case 'ws': {
      if (!ev.service_type || ev.service_type.length === 0) return ''
      return ev.service_type
        .map(t => t === 'Others' && ev.service_type_other ? ev.service_type_other : t)
        .join(', ')
    }

    default:
      return ''
  }
}
