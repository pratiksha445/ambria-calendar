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

/** Convert "HH:MM" or "HH:MM:SS" to "h:mm AM/PM" */
export function formatTime12(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return timeStr
  const parts = timeStr.slice(0, 5).split(':')
  if (parts.length < 2) return timeStr
  let h = parseInt(parts[0], 10)
  const m = parts[1]
  if (isNaN(h)) return timeStr
  const ampm = h >= 12 ? 'PM' : 'AM'
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${h}:${m} ${ampm}`
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Format a UTC timestamp string (from Supabase) to IST "21 Apr 2026, 5:44 PM" */
export function formatTimestampIST(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  // Convert to IST (UTC+5:30)
  const ist = new Date(d.getTime() + (5.5 * 60 * 60 * 1000))
  const day = ist.getUTCDate()
  const month = SHORT_MONTHS[ist.getUTCMonth()]
  const year = ist.getUTCFullYear()
  let h = ist.getUTCHours()
  const m = String(ist.getUTCMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${day} ${month} ${year}, ${h}:${m} ${ampm}`
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
