import { useMemo } from 'react'
import { startOfWeek, addDays, isSameDay, toIsoDate } from '../lib/dates.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'

export default function WeekView({ currentDate, selectedDate, onSelectDate, events }) {
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
          if (iso >= ev.check_in_date && iso <= ev.check_out_date) {
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
