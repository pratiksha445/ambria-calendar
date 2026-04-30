import { useMemo } from 'react'
import { addDays, buildMonthGrid, isSameDay, toIsoDate } from '../lib/dates.js'
import { VENUE_BY_ID } from '../config/venues.js'
import { getEventTypeAbbr } from '../lib/eventTypes.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'

const MAX_PILLS = 3
const MAX_PILLS_DESKTOP = 5

export default function MonthView({ currentDate, selectedDate, onSelectDate, onEventClick, events, eventTypes = [], skeleton = false }) {
  const { dowHeaders } = useLanguage()
  const today = new Date()
  const days = buildMonthGrid(currentDate)
  const monthIndex = currentDate.getMonth()
  const eventsByDay = useMemo(() => groupByDate(events), [events])
  const wide = window.innerWidth >= 768

  // Villa multi-day spans: build a map of isoDate → [{ event, isStart, isEnd, showLabel }]
  // and a Set of event IDs that participate in spans (to exclude from normal pills)
  const { villaSpanMap, villaSpanIds } = useMemo(
    () => buildVillaSpanMap(events, days),
    [events, days],
  )

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
          const allDayEvents = eventsByDay[iso] ?? []
          // Separate villa span events from normal events
          const regularEvents = villaSpanIds.size > 0
            ? allDayEvents.filter((ev) => !villaSpanIds.has(ev.id))
            : allDayEvents
          const villaSegs = villaSpanMap[iso] ?? []

          const limit = wide ? MAX_PILLS_DESKTOP : MAX_PILLS
          // Villa spans take priority slots, then regular pills fill remaining
          const spanCount = Math.min(villaSegs.length, limit)
          const regularLimit = Math.max(0, limit - spanCount)
          const visibleRegular = regularEvents.slice(0, regularLimit)
          const totalOnDay = villaSegs.length + regularEvents.length
          const visibleTotal = spanCount + visibleRegular.length
          const extra = totalOnDay - visibleTotal

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
              aria-label={`${iso}, ${totalOnDay} bookings`}
            >
              <span className={`day-num${isToday ? ' today-circle' : ''}`}>
                {d.getDate()}
              </span>
              <div className="day-pills">
                {/* Skeleton shimmer when month data hasn't loaded */}
                {skeleton && totalOnDay === 0 && d.getMonth() === monthIndex && (
                  <>
                    <div className="pill-skeleton" />
                    <div className="pill-skeleton pill-skeleton-short" />
                  </>
                )}
                {/* Villa spanning segments first */}
                {villaSegs.slice(0, spanCount).map((seg) => {
                  const venue = VENUE_BY_ID['villa']
                  const posClass = seg.isStart && seg.isEnd ? 'villa-seg-single'
                    : seg.isStart ? 'villa-seg-start'
                    : seg.isEnd ? 'villa-seg-end'
                    : 'villa-seg-mid'
                  return (
                    <div
                      key={`vs-${seg.event.id}`}
                      className={`day-pill villa-seg ${posClass}`}
                      style={{
                        background: venue?.color ?? '#9A6BBE',
                        color: venue?.textColor ?? '#fff',
                      }}
                      title={buildPillTooltip(seg.event, eventTypes)}
                    >
                      {villaSpanLabel(seg.event)}
                    </div>
                  )
                })}
                {/* Regular pills */}
                {visibleRegular.map((ev) => {
                  const venue = VENUE_BY_ID[ev.venue_id]
                  return (
                    <div
                      key={`${ev.id}-${ev.updated_at}`}
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

// ── Villa spanning helpers ──

function buildVillaSpanMap(events, gridDays) {
  const villaSpanMap = {} // { [isoDate]: [{ event, isStart, isEnd, showLabel }] }
  const villaSpanIds = new Set()
  const gridIsos = gridDays.map(toIsoDate)
  const gridSet = new Set(gridIsos)
  const firstGridIso = gridIsos[0]
  const lastGridIso = gridIsos[gridIsos.length - 1]

  // Collect valid Villa spans
  const spans = []
  for (const ev of events) {
    if (ev.venue_id !== 'villa') continue
    const cin = ev.check_in_date || ev.date
    const cout = ev.check_out_date
    if (!cin || !cout || cout <= cin) continue
    spans.push(ev)
    villaSpanIds.add(ev.id)
  }

  // Sort by check-in date for consistent rendering order
  spans.sort((a, b) => (a.check_in_date || a.date).localeCompare(b.check_in_date || b.date))

  for (const ev of spans) {
    const cin = ev.check_in_date || ev.date
    const cout = ev.check_out_date
    // Clamp iteration to visible grid range
    const iterStart = cin < firstGridIso ? firstGridIso : cin
    const iterEnd = cout > lastGridIso ? lastGridIso : cout

    let d = new Date(iterStart + 'T00:00:00')
    const end = new Date(iterEnd + 'T00:00:00')
    while (d <= end) {
      const iso = toIsoDate(d)
      if (gridSet.has(iso)) {
        if (!villaSpanMap[iso]) villaSpanMap[iso] = []
        villaSpanMap[iso].push({
          event: ev,
          isStart: iso === cin,
          isEnd: iso === cout,
        })
      }
      d = addDays(d, 1)
    }
  }

  return { villaSpanMap, villaSpanIds }
}

function villaSpanLabel(ev) {
  const sv = VILLA_SV[ev.sub_venue] || (ev.sub_venue ? ev.sub_venue.replace(/\s+/g, '').slice(0, 3).toUpperCase() : '')
  const p = ev.pax ? ` · ${ev.pax}` : ''
  return `${sv}${p}` || '—'
}

// ── Normal event helpers ──

function groupByDate(events) {
  return events.reduce((acc, ev) => {
    (acc[ev.date] = acc[ev.date] || []).push(ev)
    return acc
  }, {})
}

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
      if (ev.check_in_date && ev.check_out_date) {
        parts.push(`${ev.check_in_date} → ${ev.check_out_date}`)
      }
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
