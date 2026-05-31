import { useMemo } from 'react'
import { startOfWeek, addDays, isSameDay, toIsoDate } from '../lib/dates.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'

const SEASON_COLORS = { "King's": '#D4A017', 'Perfect': '#2AAA8A' }

export default function WeekView({ currentDate, selectedDate, onSelectDate, events, seasonData, getSeasonCategory }) {
  const { dayLabel } = useLanguage()
  const weekStart = startOfWeek(currentDate)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // Count events per day, including Villa events that span through the day
  const countByDay = useMemo(() => {
    const map = {}
    for (const d of days) {
      const iso = toIsoDate(d)
      map[iso] = 0
    }
    for (const ev of events) {
      // Villa multi-day: count on every day within the stay
      if (ev.venue_id === 'villa' && ev.check_in_date && ev.check_out_date && ev.check_out_date > ev.check_in_date) {
        for (const d of days) {
          const iso = toIsoDate(d)
          if (iso >= ev.check_in_date && iso < ev.check_out_date) {
            map[iso] = (map[iso] || 0) + 1
          }
        }
      // TND multi-day: count on every day within the date range
      } else if (ev.venue_id === 'tender' && ev.date && ev.end_date && ev.end_date > ev.date) {
        for (const d of days) {
          const iso = toIsoDate(d)
          if (iso >= ev.date && iso <= ev.end_date) {
            map[iso] = (map[iso] || 0) + 1
          }
        }
      } else {
        // Normal single-day event
        if (map[ev.date] !== undefined) {
          map[ev.date] = (map[ev.date] || 0) + 1
        }
      }
    }
    return map
  }, [events, days])

  return (
    <div className="week-view">
      <div className="week-strip">
        {days.map((d, i) => {
          const iso = toIsoDate(d)
          const count = countByDay[iso] || 0
          const isSelected = isSameDay(d, selectedDate)
          return (
            <button
              key={i}
              className={`week-chip ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectDate(d)}
            >
              {(() => { const s = getSeasonCategory ? getSeasonCategory(iso, seasonData) : null; const c = s ? SEASON_COLORS[s] : null; return c ? <span className="season-badge" style={{ background: c }} title={s} /> : null })()}
              <span className="week-chip-day">{dayLabel(d)}</span>
              <span className="week-chip-date">{d.getDate()}</span>
              {count > 0 && <span className="week-chip-count">{count}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
