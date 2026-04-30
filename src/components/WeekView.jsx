import { useMemo } from 'react'
import { startOfWeek, addDays, isSameDay, toIsoDate } from '../lib/dates.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'

export default function WeekView({ currentDate, selectedDate, onSelectDate, events }) {
  const { dayLabel } = useLanguage()
  const weekStart = startOfWeek(currentDate)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const eventsByDay = useMemo(() => events.reduce((acc, ev) => {
    (acc[ev.date] = acc[ev.date] || []).push(ev)
    return acc
  }, {}), [events])

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
    </div>
  )
}
