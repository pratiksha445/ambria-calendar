import * as XLSX from 'xlsx'
import { VENUE_BY_ID } from '../config/venues.js'

/**
 * Column definitions for the Excel export.
 * key = event row field, header = column header text.
 */
const COLUMNS = [
  { key: 'date', header: 'Date' },
  { key: 'time', header: 'Function Start Time' },
  { key: '_category', header: 'Category' },
  { key: 'sub_venue', header: 'Sub-Venue' },
  { key: 'title', header: 'Title' },
  { key: 'event_type', header: 'Event Type' },
  { key: 'shift', header: 'Shift' },
  { key: 'status', header: 'Status' },
  { key: 'guest_name', header: 'Guest Name' },
  { key: 'phone', header: 'Guest Phone' },
  { key: 'pax', header: 'Pax' },
  { key: 'guest_category', header: 'Guest Category' },
  { key: 'sales_person', header: 'Sales Person' },
  { key: 'booking_status', header: 'Package Type' },
  { key: 'menu_type', header: 'Menu Type' },
  { key: 'menu_cat', header: 'Menu Category' },
  { key: 'fp_status', header: 'FP Status' },
  { key: 'rooms', header: 'Rooms' },
  { key: 'liquor', header: 'Liquor' },
  { key: 'decor_status', header: 'Decor Status' },
  { key: 'entertainment_status', header: 'Entertainment Status' },
  { key: 'function_category', header: 'Decor Category' },
  { key: 'elements', header: 'Elements' },
  { key: 'delivery_person', header: 'Delivery Person' },
  { key: 'decor_delivery_person', header: 'Delivery Person (Decor)' },
  { key: 'decor_operation_manager', header: 'Operation Manager (Decor)' },
  { key: 'ent_delivery_person', header: 'Delivery Person (Entertainment)' },
  { key: 'operation_manager', header: 'F&B Service Manager' },
  { key: 'payment_remaining_venue', header: 'Pending Payment %' },
  { key: 'payment_remaining_decor', header: 'Payment Remaining (Decor) %' },
  { key: 'payment_remaining_ent', header: 'Payment Remaining (Ent) %' },
  { key: 'payment_timing', header: 'Payment Status' },
  { key: 'decor_time', header: 'Decor Time' },
  { key: 'chaat_time', header: 'Chaat Time' },
  { key: 'baraat_time', header: 'Baraat Time' },
  { key: 'wind_up_time', header: 'Wind Up Time' },
  { key: 'varmala_time', header: 'Varmala Time' },
  { key: 'pheras_time', header: 'Pheras Time' },
  { key: 'venue_name', header: 'Venue Name' },
  { key: 'venue_type', header: 'Venue Type' },
  { key: 'location', header: 'Location' },
  { key: 'decor_type', header: 'Decor Type' },
  { key: 'color_theme', header: 'Color Theme' },
  { key: 'site_availability', header: 'Site Availability' },
  { key: 'site_availability_other', header: 'Site Availability (Other)' },
  { key: 'execution_person', header: 'Execution Person' },
  { key: 'venue_manager_name', header: 'Venue Manager Name' },
  { key: 'venue_manager_number', header: 'Venue Manager Number' },
  { key: 'service_head', header: 'Service Head' },
  { key: 'kitchen_head', header: 'Kitchen Head' },
  { key: 'tender_name', header: 'Tender Name' },
  { key: 'service_type', header: 'Service Type' },
  { key: 'service_type_other', header: 'Service Type (Other)' },
  { key: 'vendor_name', header: 'Vendor Name' },
  { key: 'vendor_phone', header: 'Vendor Phone' },
  { key: 'source', header: 'Source' },
  { key: 'notes', header: 'Notes' },
]

const TIME_KEYS = new Set(['time', 'decor_time', 'chaat_time', 'baraat_time', 'wind_up_time', 'varmala_time', 'pheras_time'])

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
      if (TIME_KEYS.has(col.key)) {
        const t12 = formatTime12(ev[col.key])
        if (col.key === 'wind_up_time' && ev.wind_up_next_day && t12) return `${t12} (+1)`
        if (col.key === 'pheras_time' && ev.pheras_next_day && t12) return `${t12} (+1)`
        return t12
      }
      if (col.key === 'elements') {
        return Array.isArray(ev.elements) ? ev.elements.join('; ') : ''
      }
      if (col.key === 'service_type') {
        return Array.isArray(ev.service_type) ? ev.service_type.join('; ') : ''
      }
      if (col.key === 'liquor') return ev.liquor ? 'Yes' : 'No'
      if (col.key === 'source') return (ev.source || '').toUpperCase()
      if (col.key.startsWith('payment_remaining_')) {
        const val = ev[col.key]
        return (val != null && val !== '') ? `${val}%` : ''
      }
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
