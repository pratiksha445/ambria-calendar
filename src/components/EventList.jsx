import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { VENUES, VENUE_BY_ID } from '../config/venues.js'
import BookingModal from './BookingModal.jsx'
import { fetchReviewsByEventIds, isReviewable, getQuickRating } from '../lib/reviews.js'
import * as XLSX from 'xlsx'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const SHIFT_ORDER = { Morning: 0, Lunch: 1, Sundowner: 2, Dinner: 3 }
const STATUS_COLORS = { Confirmed: '#27ae60', Tentative: '#f39c12', Cancelled: '#e74c3c', Postponed: '#8e44ad' }
const ALL_VENUE_IDS = VENUES.map((v) => v.id)

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

function getEventDate(ev) {
  if (ev.venue_id === 'villa') return ev.check_in_date || ev.date
  return ev.date
}

function getEndDate(ev) {
  if (ev.venue_id === 'villa') return ev.check_out_date || ''
  if (ev.venue_id === 'tender') return ev.end_date || ''
  return ''
}

function getGuestName(ev) {
  if (ev.venue_id === 'tender') return ev.tender_name || ''
  return ev.guest_name || ''
}

function getEventType(ev) {
  const slots = Array.isArray(ev.event_slots) ? ev.event_slots : []
  if (slots.length > 1) return 'Multi-Event'
  if (ev.venue_id === 'tender') return ev.event_type || ev.event_type_text || ''
  if (ev.event_type === 'Other') return ev.event_type_other || 'Other'
  return ev.event_type || ''
}

function getShift(ev) {
  const slots = Array.isArray(ev.event_slots) ? ev.event_slots : []
  if (slots.length > 1) return slots[0]?.shift || ''
  if (ev.venue_id === 'villa' || ev.venue_id === 'tender') return ''
  return ev.shift || ''
}

function getPax(ev) {
  const slots = Array.isArray(ev.event_slots) ? ev.event_slots : []
  if (slots.length > 1) {
    const total = slots.reduce((sum, s) => sum + (parseInt(s.pax) || 0), 0)
    return total || ''
  }
  return ev.pax || ''
}

function getVenueName(ev) {
  if (['ap','am','ae','ar','villa'].includes(ev.venue_id)) return ''
  return ev.venue_name || ''
}

function getSubVenue(ev) {
  if (['ap','am','ae','ar','villa'].includes(ev.venue_id)) return ev.sub_venue || ''
  return ''
}

function getPayment(ev) {
  const v = ev.payment_remaining_venue
  if (!v && v !== 0) return ''
  return `${v}%`
}

function truncate(s, max) {
  if (!s) return ''
  return s.length > max ? s.substring(0, max) + '…' : s
}

function getReviewStatus(ev, reviewMap) {
  if (!isReviewable(ev)) return 'N/A'
  return reviewMap.has(ev.id) ? 'Reviewed' : 'Pending'
}

function getOverallRating(ev, reviewMap) {
  if (!isReviewable(ev)) return ''
  const review = reviewMap.get(ev.id)
  return review ? getQuickRating(review, ev.venue_id) : ''
}

function monthRange(year, month) {
  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const last = new Date(year, month + 1, 0).getDate()
  const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  return { start, end }
}

export default function EventList({ currentUser, showToast, onMenu, killSwitch }) {
  const { t } = useLanguage()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedCats, setSelectedCats] = useState(new Set(ALL_VENUE_IDS))
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [editModal, setEditModal] = useState(null)
  const [catDropdownOpen, setCatDropdownOpen] = useState(false)
  const [reviewMap, setReviewMap] = useState(() => new Map())

  const monthLabel = `${MONTH_NAMES[month]} ${year}`

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1) }
    else setMonth((m) => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1) }
    else setMonth((m) => m + 1)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    const { start, end } = monthRange(year, month)

    // Fetch events whose date (or check_in_date for villa, or start date for TND) falls in the month
    // We use an OR query to cover villa check_in_date and TND date ranges
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .or(`and(venue_id.neq.villa,venue_id.neq.tender,date.gte.${start},date.lte.${end}),and(venue_id.eq.villa,check_in_date.gte.${start},check_in_date.lte.${end}),and(venue_id.eq.tender,date.gte.${start},date.lte.${end})`)
      .order('date', { ascending: true })

    if (error) { console.error(error); setLoading(false); return }
    setRows(data ?? [])
    setLoading(false)
  }, [year, month])

  useEffect(() => { loadData() }, [loadData])

  // Fetch reviews for reviewable events
  useEffect(() => {
    const reviewableIds = rows.filter(isReviewable).map((e) => e.id)
    if (reviewableIds.length === 0) { setReviewMap(new Map()); return }
    fetchReviewsByEventIds(reviewableIds)
      .then((map) => setReviewMap(map))
      .catch(() => {})
  }, [rows])

  // Filter + sort
  const filtered = useMemo(() => {
    let list = rows

    // Category filter
    if (selectedCats.size < ALL_VENUE_IDS.length) {
      list = list.filter((r) => selectedCats.has(r.venue_id))
    }

    // Status filter
    if (statusFilter) {
      list = list.filter((r) => r.status === statusFilter)
    }

    // Search
    if (search.trim()) {
      const words = search.trim().toLowerCase().split(/\s+/)
      list = list.filter((r) => {
        const hay = [
          r.guest_name, r.tender_name, r.venue_name, r.sales_person, r.title, r.phone,
        ].filter(Boolean).join(' ').toLowerCase()
        return words.every((w) => hay.includes(w))
      })
    }

    // Sort: date asc, then shift order
    list = [...list].sort((a, b) => {
      const da = getEventDate(a) || ''
      const db = getEventDate(b) || ''
      if (da < db) return -1
      if (da > db) return 1
      const sa = SHIFT_ORDER[a.shift] ?? 99
      const sb = SHIFT_ORDER[b.shift] ?? 99
      return sa - sb
    })

    return list
  }, [rows, selectedCats, statusFilter, search])

  // Summary stats
  const statusCounts = useMemo(() => {
    const counts = { Confirmed: 0, Tentative: 0, Cancelled: 0, Postponed: 0 }
    for (const r of filtered) { counts[r.status] = (counts[r.status] || 0) + 1 }
    return counts
  }, [filtered])

  const catCounts = useMemo(() => {
    const counts = {}
    for (const r of filtered) {
      const v = VENUE_BY_ID[r.venue_id]
      const label = v?.short || r.venue_id
      counts[label] = (counts[label] || 0) + 1
    }
    return counts
  }, [filtered])

  // Category toggle
  const toggleCat = (id) => {
    setSelectedCats((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const selectAllCats = () => setSelectedCats(new Set(ALL_VENUE_IDS))
  const selectNoCats = () => setSelectedCats(new Set())

  // Excel download
  const downloadExcel = () => {
    const headers = [
      '#', 'Date', 'End Date', 'Category', 'Sub-Venue', 'Guest Name', 'Phone',
      'Event Type', 'Shift', 'Pax', 'Venue Name', 'Sales Person', 'Guest Category',
      'Status', 'Payment Status', 'Pending Payment', 'Review Status', 'Overall Rating', 'Notes',
    ]

    const dataRows = filtered.map((ev, i) => [
      i + 1,
      formatDate(getEventDate(ev)),
      formatDate(getEndDate(ev)),
      VENUE_BY_ID[ev.venue_id]?.short || ev.venue_id,
      getSubVenue(ev),
      getGuestName(ev),
      ev.phone || '',
      getEventType(ev),
      getShift(ev),
      getPax(ev),
      getVenueName(ev),
      ev.sales_person || '',
      ev.guest_category || '',
      ev.status || '',
      ev.payment_timing || '',
      getPayment(ev),
      getReviewStatus(ev, reviewMap),
      getOverallRating(ev, reviewMap),
      ev.notes || '',
    ])

    const wb = XLSX.utils.book_new()

    // Build worksheet data: header title row, summary row, column headers, data
    const titleRow = [`Ambria Group — Event List — ${monthLabel}`]
    const summaryRow = [`Total: ${filtered.length} | Confirmed: ${statusCounts.Confirmed} | Tentative: ${statusCounts.Tentative} | Cancelled: ${statusCounts.Cancelled} | Postponed: ${statusCounts.Postponed}`]

    const wsData = [titleRow, summaryRow, headers, ...dataRows]
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // Merge title row across all columns
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
    ]

    // Auto-width columns
    const colWidths = headers.map((h, ci) => {
      let max = h.length
      for (const row of dataRows) {
        const val = String(row[ci] ?? '')
        if (val.length > max) max = val.length
      }
      return { wch: Math.min(max + 2, 40) }
    })
    ws['!cols'] = colWidths

    // Style header row (row 3, index 2) and title
    // SheetJS community edition has limited styling — apply what we can
    for (let c = 0; c < headers.length; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c })
      if (ws[cellRef]) ws[cellRef].s = { font: { bold: true, sz: 14 } }

      const headerRef = XLSX.utils.encode_cell({ r: 2, c })
      if (ws[headerRef]) ws[headerRef].s = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: 'E85D75' } } }
    }

    // Strikethrough cancelled rows
    for (let i = 0; i < dataRows.length; i++) {
      if (filtered[i].status === 'Cancelled') {
        for (let c = 0; c < headers.length; c++) {
          const cellRef = XLSX.utils.encode_cell({ r: i + 3, c })
          if (ws[cellRef]) ws[cellRef].s = { font: { strike: true } }
        }
      }
    }

    const sheetName = `${MONTH_NAMES[month]} ${year}`
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    XLSX.writeFile(wb, `Ambria-Event-List-${MONTH_NAMES[month]}-${year}.xlsx`)
  }

  const onSaved = () => {
    setEditModal(null)
    loadData()
    showToast?.(t('Booking saved'))
  }
  const onDeleted = () => {
    setEditModal(null)
    loadData()
    showToast?.(t('Booking deleted'))
  }

  if (killSwitch) {
    return (
      <div className="panel-page el-page">
        <div className="panel-header">
          <button className="icon-btn header-menu" onClick={onMenu}><MenuIcon /></button>
          <h2>{t('Event List')}</h2>
        </div>
        <div className="el-empty">{t('No data available')}</div>
      </div>
    )
  }

  return (
    <div className="panel-page el-page">
      <div className="panel-header">
        <button className="icon-btn header-menu" onClick={onMenu}><MenuIcon /></button>
        <h2>{t('Event List')}</h2>
        <button className="el-download-btn" onClick={downloadExcel} title={t('Download Excel')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span className="el-download-label">{t('Download Excel')}</span>
        </button>
      </div>

      {/* Month selector */}
      <div className="el-month-nav">
        <button className="el-month-arrow" onClick={prevMonth} aria-label="Previous month">&#9664;</button>
        <span className="el-month-label">{t(`month_${month}`)} {year}</span>
        <button className="el-month-arrow" onClick={nextMonth} aria-label="Next month">&#9654;</button>
      </div>

      {/* Filters */}
      <div className="el-filters">
        <div className="el-cat-dropdown">
          <button
            className="el-cat-toggle"
            onClick={() => setCatDropdownOpen((o) => !o)}
          >
            {selectedCats.size === ALL_VENUE_IDS.length ? t('All Categories') : `${selectedCats.size} ${t('selected')}`}
            <span className="el-cat-caret">&#9662;</span>
          </button>
          {catDropdownOpen && (
            <>
              <div className="el-cat-backdrop" onClick={() => setCatDropdownOpen(false)} />
              <div className="el-cat-menu">
                <div className="el-cat-actions">
                  <button onClick={selectAllCats}>{t('All')}</button>
                  <button onClick={selectNoCats}>{t('None')}</button>
                </div>
                {VENUES.map((v) => (
                  <label key={v.id} className="el-cat-option">
                    <input
                      type="checkbox"
                      checked={selectedCats.has(v.id)}
                      onChange={() => toggleCat(v.id)}
                    />
                    <span className="el-cat-badge" style={{ background: v.color, color: v.textColor }}>{v.short}</span>
                    <span>{t(v.name)}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        <select className="el-status-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">{t('All Statuses')}</option>
          <option value="Confirmed">{t('Confirmed')}</option>
          <option value="Tentative">{t('Tentative')}</option>
          <option value="Cancelled">{t('Cancelled')}</option>
          <option value="Postponed">{t('Postponed')}</option>
        </select>

        <input
          type="search"
          className="el-search"
          placeholder={t('Search guest, venue, sales person…')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Summary bar */}
      {!loading && filtered.length > 0 && (
        <div className="el-summary">
          <div className="el-summary-status">
            <span className="el-summary-total">{t('Total')}: {filtered.length}</span>
            {Object.entries(statusCounts).map(([s, c]) => c > 0 && (
              <span key={s} className="el-summary-stat" style={{ color: STATUS_COLORS[s] }}>
                {t(s)}: {c}
              </span>
            ))}
          </div>
          <div className="el-summary-cats">
            {VENUES.map((v) => {
              const c = catCounts[v.short]
              if (!c) return null
              return (
                <span key={v.id} className="el-cat-chip" style={{ background: v.color, color: v.textColor }}>
                  {v.short}: {c}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="el-empty">{t('Loading…')}</div>
      ) : filtered.length === 0 ? (
        <div className="el-empty">{t('No events found for {month} {year}', { month: t(`month_${month}`), year })}</div>
      ) : (
        <div className="el-table-wrap">
          <table className="el-table">
            <thead>
              <tr>
                <th className="el-th-sticky">#</th>
                <th className="el-th-sticky el-th-date">{t('Date')}</th>
                <th>{t('End Date')}</th>
                <th className="el-th-sticky el-th-cat">{t('Category')}</th>
                <th>{t('Sub-Venue')}</th>
                <th>{t('Guest Name')}</th>
                <th>{t('Phone')}</th>
                <th>{t('Event Type')}</th>
                <th>{t('Shift')}</th>
                <th>{t('Pax')}</th>
                <th>{t('Venue Name')}</th>
                <th>{t('Sales Person')}</th>
                <th>{t('Guest Category')}</th>
                <th>{t('Status')}</th>
                <th>{t('Payment Status')}</th>
                <th>{t('Pending Payment')}</th>
                <th>{t('Review')}</th>
                <th>{t('Notes')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ev, idx) => {
                const venue = VENUE_BY_ID[ev.venue_id]
                const isCancelled = ev.status === 'Cancelled'
                const isPostponed = ev.status === 'Postponed'
                return (
                  <tr
                    key={ev.id}
                    className={`el-row ${isCancelled ? 'el-row-cancelled' : ''}`}
                    onClick={() => setEditModal(ev)}
                  >
                    <td>{idx + 1}</td>
                    <td className="el-td-date">
                      {formatDate(getEventDate(ev))}
                      {isPostponed && <span className="el-pp-badge">PP</span>}
                    </td>
                    <td>{formatDate(getEndDate(ev))}</td>
                    <td>
                      <span className="el-venue-badge" style={{ background: venue?.color || '#999', color: venue?.textColor || '#fff' }}>
                        {venue?.short || ev.venue_id}
                      </span>
                    </td>
                    <td>{getSubVenue(ev)}</td>
                    <td className={isCancelled ? 'el-strike' : ''}>{getGuestName(ev)}</td>
                    <td>
                      {ev.phone ? (
                        <a href={`tel:${ev.phone}`} className="el-phone-link" onClick={(e) => e.stopPropagation()}>{ev.phone}</a>
                      ) : ''}
                    </td>
                    <td>{getEventType(ev)}</td>
                    <td>{getShift(ev)}</td>
                    <td>{getPax(ev)}</td>
                    <td>{getVenueName(ev)}</td>
                    <td>{ev.sales_person || ''}</td>
                    <td>{ev.guest_category || ''}</td>
                    <td>
                      <span className="el-status-badge" style={{ background: STATUS_COLORS[ev.status] || '#999' }}>
                        {t(ev.status || '')}
                      </span>
                    </td>
                    <td>{ev.payment_timing || ''}</td>
                    <td>{getPayment(ev)}</td>
                    <td>
                      {(() => {
                        const rs = getReviewStatus(ev, reviewMap)
                        if (rs === 'Reviewed') return <span className="el-review-done">{t('✓ Reviewed')}</span>
                        if (rs === 'Pending') return <span className="el-review-pending">{t('Pending')}</span>
                        return '—'
                      })()}
                    </td>
                    <td title={ev.notes || ''}>{truncate(ev.notes, 50)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Booking detail modal */}
      <BookingModal
        open={!!editModal}
        initial={editModal}
        onClose={() => setEditModal(null)}
        onSaved={onSaved}
        onDeleted={onDeleted}
        user={currentUser}
      />
    </div>
  )
}
