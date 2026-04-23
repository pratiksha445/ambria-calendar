import * as XLSX from 'xlsx'
import { VENUE_BY_ID } from '../config/venues.js'

/**
 * Column definitions for the Excel export.
 * key = event row field, header = column header text.
 */
const COLUMNS = [
  { key: 'date', header: 'Date' },
  { key: 'time', header: 'Time' },
  { key: '_category', header: 'Category' },
  { key: 'sub_venue', header: 'Sub-Venue' },
  { key: 'title', header: 'Title' },
  { key: 'event_type', header: 'Event Type' },
  { key: 'shift', header: 'Shift' },
  { key: 'status', header: 'Status' },
  { key: 'guest_name', header: 'Guest Name' },
  { key: 'phone', header: 'Phone' },
  { key: 'pax', header: 'Pax' },
  { key: 'sales_person', header: 'Sales Person' },
  { key: 'booking_status', header: 'Booking Status' },
  { key: 'menu_type', header: 'Menu Type' },
  { key: 'menu_cat', header: 'Menu Category' },
  { key: 'fp_status', header: 'FP Status' },
  { key: 'venue_name', header: 'Venue Name' },
  { key: 'venue_type', header: 'Venue Type' },
  { key: 'location', header: 'Location' },
  { key: 'decor_type', header: 'Decor Type' },
  { key: 'tender_name', header: 'Tender Name' },
  { key: 'source', header: 'Source' },
  { key: 'notes', header: 'Notes' },
]

function formatTime12(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  if (isNaN(h)) return t
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 || 12
  return `${hr}:${String(m).padStart(2, '0')} ${suffix}`
}

/**
 * Build and download an xlsx file from an array of event rows.
 */
export function exportEventsToExcel(events, filename) {
  const headers = COLUMNS.map((c) => c.header)

  const rows = events.map((ev) =>
    COLUMNS.map((col) => {
      if (col.key === '_category') {
        const v = VENUE_BY_ID[ev.venue_id]
        return v ? `${v.short} — ${v.name}` : ev.venue_id || ''
      }
      if (col.key === 'time') return formatTime12(ev.time)
      if (col.key === 'source') return (ev.source || '').toUpperCase()
      return ev[col.key] ?? ''
    })
  )

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])

  // Bold header row
  const range = XLSX.utils.decode_range(ws['!ref'])
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    if (ws[addr]) {
      ws[addr].s = { font: { bold: true } }
    }
  }

  // Auto-width columns
  const colWidths = headers.map((h, i) => {
    let max = h.length
    for (const row of rows) {
      const len = String(row[i] ?? '').length
      if (len > max) max = len
    }
    return { wch: Math.min(max + 2, 50) }
  })
  ws['!cols'] = colWidths

  // Freeze first row
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Bookings')

  XLSX.writeFile(wb, filename)
}
