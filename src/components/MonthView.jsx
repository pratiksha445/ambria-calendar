import { useMemo } from 'react'
import { addDays, buildMonthGrid, isSameDay, toIsoDate } from '../lib/dates.js'
import { VENUE_BY_ID, getAeSubVenueStyle } from '../config/venues.js'
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

  // Multi-day spans (Villa + TND): isoDate → [{ event, isStart, isEnd }]
  // and a Set of event IDs that participate in spans (to exclude from normal pills)
  const { spanMap, spanIds } = useMemo(
    () => buildSpanMap(events, days),
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
        {days.map((d, i) => {
          const iso = toIsoDate(d)
          const allDayEvents = eventsByDay[iso] ?? []
          // Separate span events from normal events
          const regularEvents = spanIds.size > 0
            ? allDayEvents.filter((ev) => !spanIds.has(ev.id))
            : allDayEvents
          const spanSegs = spanMap[iso] ?? []

          const limit = wide ? MAX_PILLS_DESKTOP : MAX_PILLS
          // Spans take priority slots, then regular pills fill remaining
          const spanCount = Math.min(spanSegs.length, limit)
          const regularLimit = Math.max(0, limit - spanCount)
          const visibleRegular = regularEvents.slice(0, regularLimit)
          const totalOnDay = spanSegs.length + regularEvents.length
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
              key={i}
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
                {/* Multi-day spanning segments first (Villa + TND) */}
                {spanSegs.slice(0, spanCount).map((seg) => {
                  const venue = VENUE_BY_ID[seg.event.venue_id]
                  const posClass = seg.isStart && seg.isEnd ? 'villa-seg-single'
                    : seg.isStart ? 'villa-seg-start'
                    : seg.isEnd ? 'villa-seg-end'
                    : 'villa-seg-mid'
                  const statusClass = seg.event.status === 'Cancelled' ? ' pill-cancelled' : seg.event.status === 'Postponed' ? ' pill-postponed' : ''
                  return (
                    <div
                      key={`vs-${seg.event.id}`}
                      className={`day-pill villa-seg ${posClass}${statusClass}`}
                      style={{
                        background: venue?.color ?? '#ccc',
                        color: venue?.textColor ?? '#fff',
                      }}
                      title={buildPillTooltip(seg.event, eventTypes)}
                    >
                      {seg.event.venue_id === 'villa' ? villaSpanLabel(seg.event) : buildPillLabel(seg.event, eventTypes)}
                    </div>
                  )
                })}
                {/* Regular pills */}
                {visibleRegular.map((ev) => {
                  const venue = VENUE_BY_ID[ev.venue_id]
                  const aeStyle = getAeSubVenueStyle(ev)
                  const statusClass = ev.status === 'Cancelled' ? ' pill-cancelled' : ev.status === 'Postponed' ? ' pill-postponed' : ''
                  return (
                    <div
                      key={`${ev.id}-${ev.updated_at}`}
                      className={`day-pill${statusClass}`}
                      style={{
                        background: aeStyle?.background ?? venue?.color ?? '#ccc',
                        color: aeStyle?.color ?? venue?.textColor ?? '#fff',
                      }}
                      title={buildPillTooltip(ev, eventTypes)}
                    >
                      {buildPillLabel(ev, eventTypes)}{ev.status === 'Postponed' && <span className="pill-pp">PP</span>}
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

// ── Multi-day spanning helpers (Villa + TND) ──

function getSpanDates(ev) {
  if (ev.venue_id === 'villa') {
    const cin = ev.check_in_date || ev.date
    const cout = ev.check_out_date
    return (cin && cout && cout > cin) ? [cin, cout] : null
  }
  if (ev.venue_id === 'tender') {
    const cin = ev.date
    const cout = ev.end_date
    return (cin && cout && cout > cin) ? [cin, cout] : null
  }
  return null
}

function buildSpanMap(events, gridDays) {
  const spanMap = {} // { [isoDate]: [{ event, isStart, isEnd }] }
  const spanIds = new Set()
  const gridIsos = gridDays.map(toIsoDate)
  const gridSet = new Set(gridIsos)
  const firstGridIso = gridIsos[0]
  const lastGridIso = gridIsos[gridIsos.length - 1]

  // Collect valid spans (Villa + TND)
  const spans = []
  for (const ev of events) {
    const dates = getSpanDates(ev)
    if (!dates) continue
    spans.push({ ev, cin: dates[0], cout: dates[1] })
    spanIds.add(ev.id)
  }

  // Sort by start date for consistent rendering order
  spans.sort((a, b) => a.cin.localeCompare(b.cin))

  for (const { ev, cin, cout } of spans) {
    // Clamp iteration to visible grid range
    const iterStart = cin < firstGridIso ? firstGridIso : cin
    const iterEnd = cout > lastGridIso ? lastGridIso : cout

    let d = new Date(iterStart + 'T00:00:00')
    const end = new Date(iterEnd + 'T00:00:00')
    while (d <= end) {
      const iso = toIsoDate(d)
      if (gridSet.has(iso)) {
        if (!spanMap[iso]) spanMap[iso] = []
        spanMap[iso].push({
          event: ev,
          isStart: iso === cin,
          isEnd: iso === cout,
        })
      }
      d = addDays(d, 1)
    }
  }

  return { spanMap, spanIds }
}

function villaSpanLabel(ev) {
  return ev.sub_venue || '—'
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

function buildPillLabel(ev, eventTypes) {
  const s = SHIFT_INITIALS[ev.shift] || ''
  const p = ev.pax ? String(ev.pax).trim() : ''

  switch (ev.venue_id) {
    case 'ap': case 'am': case 'ae': case 'ar':
      return `${s}${p}${getEventTypeAbbr(ev.event_type, ev.event_type_other, eventTypes)}` || '—'

    case 'add':
      if (Array.isArray(ev.event_slots) && ev.event_slots.length > 1) {
        return `${ev.venue_name || '?'} (${ev.event_slots.length})`
      }
      return `${s}${p}${getEventTypeAbbr(ev.event_type, ev.event_type_other, eventTypes)}` || '—'

    case 'ac':
      if (Array.isArray(ev.event_slots) && ev.event_slots.length > 1) {
        const totalPax = ev.event_slots.reduce((sum, sl) => sum + (Number(sl.pax) || 0), 0)
        return `${ev.venue_name || '?'} ${totalPax || ''}`
      }
      return `${s}${p}${getEventTypeAbbr(ev.event_type, ev.event_type_other, eventTypes)}` || '—'

    case 'tender': {
      const etAbbr = ev.event_type
        ? getEventTypeAbbr(ev.event_type, ev.event_type_other, eventTypes)
        : customAbbr(ev.event_type_text)
      return `${p}${etAbbr}` || '—'
    }

    case 'villa':
      return ev.sub_venue || '—'

    case 'aee': {
      if (Array.isArray(ev.event_slots) && ev.event_slots.length > 1) {
        return `${ev.venue_name || '?'} (${ev.event_slots.length})`
      }
      return `${s}${p}${getEventTypeAbbr(ev.event_type, ev.event_type_other, eventTypes)}` || '—'
    }

    case 'ws': {
      const types = ev.service_type
      if (!types || types.length === 0) return 'WS'
      return `${types.length} Svc`
    }

    default:
      return '—'
  }
}

function buildPillTooltip(ev, eventTypes) {
  switch (ev.venue_id) {
    case 'ap': case 'am': case 'ae': case 'ar':
    case 'add': case 'ac': {
      if (Array.isArray(ev.event_slots) && ev.event_slots.length > 1) {
        const totalPax = ev.event_slots.reduce((sum, sl) => sum + (Number(sl.pax) || 0), 0)
        const slotSummaries = ev.event_slots.map(sl => {
          const t = sl.event_type === 'Other' ? (sl.event_type_other || '') : (sl.event_type || '')
          return [sl.shift, t].filter(Boolean).join(' ')
        }).filter(Boolean)
        return `Multi-Event (${ev.event_slots.length})${totalPax ? ` · ${totalPax} pax` : ''} · ${slotSummaries.join(', ')}`
      }
      const parts = []
      if (ev.shift) parts.push(ev.shift)
      if (ev.pax) parts.push(`${ev.pax} pax`)
      const ft = ev.event_type === 'Other' ? (ev.event_type_other || 'Other') : (ev.event_type || '')
      if (ft) parts.push(ft)
      return parts.join(' · ')
    }

    case 'tender': {
      const parts = []
      if (ev.pax) parts.push(`${ev.pax} pax`)
      const ft = ev.event_type === 'Other' ? (ev.event_type_other || 'Other')
        : (ev.event_type || ev.event_type_text || '')
      if (ft) parts.push(ft)
      if (ev.date && ev.end_date && ev.end_date > ev.date) {
        parts.push(`${ev.date} → ${ev.end_date}`)
      }
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
      if (Array.isArray(ev.event_slots) && ev.event_slots.length > 1) {
        const totalPax = ev.event_slots.reduce((sum, sl) => sum + (Number(sl.pax) || 0), 0)
        const slotSummaries = ev.event_slots.map(sl => {
          const t = sl.event_type === 'Other' ? (sl.event_type_other || '') : (sl.event_type || '')
          return [sl.shift, t].filter(Boolean).join(' ')
        }).filter(Boolean)
        return `Multi-Event (${ev.event_slots.length})${totalPax ? ` · ${totalPax} pax` : ''} · ${slotSummaries.join(', ')}`
      }
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
