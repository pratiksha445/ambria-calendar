// Small date helpers. All functions operate on native Date objects in local time
// and speak ISO "YYYY-MM-DD" strings at Supabase boundaries.

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function toIsoDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatMonthYear(d) {
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
}

export function formatDayHeader(d) {
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`
}

export function dayLabel(d) {
  return DAY_NAMES[d.getDay()]
}

export function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

export function startOfWeek(d) {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  copy.setDate(copy.getDate() - copy.getDay())
  return copy
}

export function addDays(d, n) {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + n)
  return copy
}

export function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// 6-row month grid (42 cells) starting from the Sunday before the 1st.
export function buildMonthGrid(currentDate) {
  const first = startOfMonth(currentDate)
  const gridStart = startOfWeek(first)
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
}
