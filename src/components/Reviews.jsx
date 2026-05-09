import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { VENUES, VENUE_BY_ID } from '../config/venues.js'
import { getRatingFields, getQuickRating } from '../lib/reviews.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import * as XLSX from 'xlsx'

const REVIEWABLE_IDS = ['ap', 'am', 'ae', 'ar', 'villa', 'add', 'ac', 'aee']
const REVIEWABLE_VENUES = VENUES.filter((v) => REVIEWABLE_IDS.includes(v.id))

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

function formatDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

function getEventDate(ev) {
  if (ev.venue_id === 'villa') return ev.check_out_date || ev.check_in_date || ev.date
  return ev.date
}

function getEventTitle(ev) {
  return ev.title || ev.guest_name || ev.tender_name || ev.venue_name || '—'
}

function avgRating(review, venueId) {
  if (!review) return null
  const fields = getRatingFields(venueId)
  const vals = fields.map((f) => review[f.key]).filter((v) => v != null && v > 0)
  if (vals.length === 0) return null
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
}

function stars(n) {
  if (!n || n <= 0) return '—'
  return '\u2605'.repeat(n) + '\u2606'.repeat(5 - n)
}

export default function Reviews({ currentUser, showToast, onMenu, killSwitch }) {
  const { t } = useLanguage()
  const [events, setEvents] = useState([])
  const [reviewMap, setReviewMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [catFilter, setCatFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)

    // Fetch all past events from reviewable categories (regardless of deleted_at)
    const { data: evData, error: evErr } = await supabase
      .from('events')
      .select('*')
      .in('venue_id', REVIEWABLE_IDS)
      .or(`and(venue_id.neq.villa,date.lt.${today}),and(venue_id.eq.villa,check_out_date.lt.${today})`)
      .order('date', { ascending: false })

    if (evErr) { console.error(evErr); setLoading(false); return }
    const evts = evData ?? []
    setEvents(evts)

    // Fetch reviews for all these events
    if (evts.length > 0) {
      const ids = evts.map((e) => e.id)
      // Supabase .in() has a limit, batch if needed
      const batchSize = 300
      const allReviews = {}
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize)
        const { data: rData } = await supabase
          .from('reviews')
          .select('*')
          .in('event_id', batch)
        if (rData) {
          for (const r of rData) allReviews[r.event_id] = r
        }
      }
      setReviewMap(allReviews)
    } else {
      setReviewMap({})
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Filtering
  const filtered = useMemo(() => {
    if (killSwitch) return []
    let list = events

    // Tab filter
    if (tab === 'pending') list = list.filter((e) => !reviewMap[e.id])

    // Category
    if (catFilter) list = list.filter((e) => e.venue_id === catFilter)

    // Status (review status)
    if (statusFilter === 'reviewed') list = list.filter((e) => !!reviewMap[e.id])
    else if (statusFilter === 'pending') list = list.filter((e) => !reviewMap[e.id])

    // Date range
    if (dateFrom) list = list.filter((e) => getEventDate(e) >= dateFrom)
    if (dateTo) list = list.filter((e) => getEventDate(e) <= dateTo)

    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((e) => {
        const title = getEventTitle(e).toLowerCase()
        const guest = (e.guest_name || e.tender_name || '').toLowerCase()
        const reviewer = (reviewMap[e.id]?.submitted_by_name || '').toLowerCase()
        return title.includes(q) || guest.includes(q) || reviewer.includes(q)
      })
    }

    return list
  }, [events, reviewMap, tab, catFilter, statusFilter, dateFrom, dateTo, search, killSwitch])

  // Summary stats
  const summary = useMemo(() => {
    const total = events.length
    const reviewed = events.filter((e) => !!reviewMap[e.id]).length
    const pending = total - reviewed
    const reviews = Object.values(reviewMap)
    let avgOverall = null
    if (reviews.length > 0) {
      const ratings = reviews.map((r) => {
        const ev = events.find((e) => e.id === r.event_id)
        if (!ev) return null
        const avg = avgRating(r, ev.venue_id)
        return avg ? parseFloat(avg) : null
      }).filter(Boolean)
      if (ratings.length > 0) {
        avgOverall = (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
      }
    }
    return { total, reviewed, pending, avgOverall }
  }, [events, reviewMap])

  // Excel download
  const downloadExcel = () => {
    // Build header: fixed columns + dynamic rating columns per row
    const fixedHeaders = [
      '#', 'Event Title', 'Category', 'Event Date', 'Guest Name', 'Sales Person',
      'Review Status', 'Reviewed By', 'Submitted Date', 'Payment Status', 'Average Rating', 'Remark',
    ]

    // Collect all possible rating field keys across all categories
    const allRatingFields = []
    const seenKeys = new Set()
    for (const vid of REVIEWABLE_IDS) {
      for (const f of getRatingFields(vid)) {
        if (!seenKeys.has(f.key)) {
          seenKeys.add(f.key)
          allRatingFields.push(f)
        }
      }
    }

    const headers = [...fixedHeaders, ...allRatingFields.map((f) => f.label)]

    const dataRows = filtered.map((ev, i) => {
      const review = reviewMap[ev.id]
      const venue = VENUE_BY_ID[ev.venue_id]
      const avg = review ? avgRating(review, ev.venue_id) : ''
      const fixed = [
        i + 1,
        getEventTitle(ev),
        venue?.short || ev.venue_id,
        formatDate(getEventDate(ev)),
        ev.guest_name || ev.tender_name || '',
        ev.sales_person || '',
        review ? 'Reviewed' : 'Pending',
        review?.submitted_by_name || '',
        review ? formatDateTime(review.submitted_at) : '',
        review?.review_payment_status || '',
        avg || '',
        review?.remark || '',
      ]
      const ratings = allRatingFields.map((f) => {
        if (!review) return ''
        const fields = getRatingFields(ev.venue_id)
        if (!fields.some((rf) => rf.key === f.key)) return ''
        return review[f.key] || ''
      })
      return [...fixed, ...ratings]
    })

    const wb = XLSX.utils.book_new()
    const titleRow = ['Ambria Group — Reviews Report']
    const summaryRow = [`Total: ${summary.total} | Reviewed: ${summary.reviewed} | Pending: ${summary.pending}${summary.avgOverall ? ` | Avg Rating: ${summary.avgOverall}` : ''}`]
    const wsData = [titleRow, summaryRow, headers, ...dataRows]
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
    ]

    const colWidths = headers.map((h, ci) => {
      let max = h.length
      for (const row of dataRows) {
        const val = String(row[ci] ?? '')
        if (val.length > max) max = val.length
      }
      return { wch: Math.min(max + 2, 40) }
    })
    ws['!cols'] = colWidths

    for (let c = 0; c < headers.length; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c })
      if (ws[cellRef]) ws[cellRef].s = { font: { bold: true, sz: 14 } }
      const headerRef = XLSX.utils.encode_cell({ r: 2, c })
      if (ws[headerRef]) ws[headerRef].s = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: 'E85D75' } } }
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Reviews')
    XLSX.writeFile(wb, 'Ambria-Reviews-Report.xlsx')
  }

  const toggleExpand = (id) => setExpandedId((prev) => prev === id ? null : id)

  return (
    <div className="panel-page rv-page">
      <div className="panel-header">
        <button className="icon-btn header-menu" onClick={onMenu}><MenuIcon /></button>
        <h2>{t('Reviews')}</h2>
        <button className="el-download-btn" onClick={downloadExcel} title={t('Download Excel')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span className="el-download-label">{t('Download Excel')}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="rv-tabs">
        <button className={`rv-tab${tab === 'all' ? ' rv-tab-active' : ''}`} onClick={() => setTab('all')}>
          {t('All')} <span className="rv-tab-count">{summary.total}</span>
        </button>
        <button className={`rv-tab${tab === 'pending' ? ' rv-tab-active' : ''}`} onClick={() => setTab('pending')}>
          {t('Pending')} <span className="rv-tab-count rv-tab-count-pending">{summary.pending}</span>
        </button>
      </div>

      {/* Summary bar */}
      {!loading && (
        <div className="rv-summary">
          <span className="rv-summary-stat">{t('Total')}: <strong>{summary.total}</strong></span>
          <span className="rv-summary-stat rv-stat-green">{t('Reviewed')}: <strong>{summary.reviewed}</strong></span>
          <span className="rv-summary-stat rv-stat-orange">{t('Pending')}: <strong>{summary.pending}</strong></span>
          {summary.avgOverall && (
            <span className="rv-summary-stat">{t('Avg Rating')}: <strong>{summary.avgOverall}</strong> {'\u2605'}</span>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="el-filters">
        <select className="el-status-select" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="">{t('All Categories')}</option>
          {REVIEWABLE_VENUES.map((v) => (
            <option key={v.id} value={v.id}>{v.short} — {t(v.name)}</option>
          ))}
        </select>
        <select className="el-status-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">{t('All Statuses')}</option>
          <option value="reviewed">{t('Reviewed')}</option>
          <option value="pending">{t('Pending')}</option>
        </select>
        <input type="date" className="rv-date-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} placeholder="From" />
        <input type="date" className="rv-date-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} placeholder="To" />
        <input
          type="search"
          className="el-search"
          placeholder={t('Search title, guest, reviewer…')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="el-empty">{t('Loading…')}</div>
      ) : filtered.length === 0 ? (
        <div className="el-empty">{t('No events found')}</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="rv-table-wrap rv-desktop-only">
            <table className="el-table rv-table">
              <thead>
                <tr>
                  <th>{t('Event Title')}</th>
                  <th>{t('Category')}</th>
                  <th>{t('Event Date')}</th>
                  <th>{t('Review Status')}</th>
                  <th>{t('Reviewed By')}</th>
                  <th>{t('Submitted Date')}</th>
                  <th>{t('Payment Status')}</th>
                  <th>{t('Avg Rating')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ev) => {
                  const review = reviewMap[ev.id]
                  const venue = VENUE_BY_ID[ev.venue_id]
                  const avg = review ? avgRating(review, ev.venue_id) : null
                  const isExpanded = expandedId === ev.id
                  return (
                    <DesktopRow
                      key={ev.id}
                      ev={ev}
                      review={review}
                      venue={venue}
                      avg={avg}
                      isExpanded={isExpanded}
                      onToggle={() => toggleExpand(ev.id)}
                      t={t}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="rv-mobile-only">
            {filtered.map((ev) => {
              const review = reviewMap[ev.id]
              const venue = VENUE_BY_ID[ev.venue_id]
              const avg = review ? avgRating(review, ev.venue_id) : null
              const isExpanded = expandedId === ev.id
              return (
                <MobileCard
                  key={ev.id}
                  ev={ev}
                  review={review}
                  venue={venue}
                  avg={avg}
                  isExpanded={isExpanded}
                  onToggle={() => toggleExpand(ev.id)}
                  t={t}
                />
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function ReviewStatusBadge({ review, t }) {
  if (review) return <span className="rv-badge rv-badge-green">{t('Reviewed')}</span>
  return <span className="rv-badge rv-badge-orange">{t('Pending')}</span>
}

function PaymentBadge({ review, t }) {
  if (!review?.review_payment_status) return <span>—</span>
  const isComplete = review.review_payment_status === 'Completed'
  return (
    <span className={`rv-badge ${isComplete ? 'rv-badge-green' : 'rv-badge-orange'}`}>
      {t(review.review_payment_status)}
    </span>
  )
}

function ExpandedDetails({ ev, review, t }) {
  const fields = getRatingFields(ev.venue_id)
  if (!review) {
    return <div className="rv-expand-empty">{t('No review submitted')}</div>
  }
  return (
    <div className="rv-expand-content">
      <div className="rv-ratings-grid">
        {fields.map((f) => {
          const val = review[f.key]
          return (
            <div key={f.key} className="rv-rating-item">
              <span className="rv-rating-label">{t(f.label)}</span>
              <span className="rv-rating-stars">{val ? stars(val) : '—'}</span>
            </div>
          )
        })}
      </div>
      {review.remark && (
        <div className="rv-remark">
          <span className="rv-remark-label">{t('Remark')}:</span> {review.remark}
        </div>
      )}
    </div>
  )
}

function DesktopRow({ ev, review, venue, avg, isExpanded, onToggle, t }) {
  return (
    <>
      <tr className="el-row" onClick={onToggle}>
        <td>{getEventTitle(ev)}</td>
        <td>
          <span className="el-venue-badge" style={{ background: venue?.color || '#999', color: venue?.textColor || '#fff' }}>
            {venue?.short || ev.venue_id}
          </span>
        </td>
        <td>{formatDate(getEventDate(ev))}</td>
        <td><ReviewStatusBadge review={review} t={t} /></td>
        <td>{review?.submitted_by_name || '—'}</td>
        <td>{review ? formatDateTime(review.submitted_at) : '—'}</td>
        <td><PaymentBadge review={review} t={t} /></td>
        <td>{avg ? <span className="rv-avg">{avg} {'\u2605'}</span> : '—'}</td>
      </tr>
      {isExpanded && (
        <tr className="rv-expand-row">
          <td colSpan={8}>
            <ExpandedDetails ev={ev} review={review} t={t} />
          </td>
        </tr>
      )}
    </>
  )
}

function MobileCard({ ev, review, venue, avg, isExpanded, onToggle, t }) {
  return (
    <div className="rv-card" onClick={onToggle}>
      <div className="rv-card-top">
        <span className="el-venue-badge" style={{ background: venue?.color || '#999', color: venue?.textColor || '#fff' }}>
          {venue?.short || ev.venue_id}
        </span>
        <ReviewStatusBadge review={review} t={t} />
      </div>
      <div className="rv-card-title">{getEventTitle(ev)}</div>
      <div className="rv-card-meta">
        <span>{formatDate(getEventDate(ev))}</span>
        {avg && <span className="rv-avg">{avg} {'\u2605'}</span>}
      </div>
      {review && (
        <div className="rv-card-meta">
          <span>{t('By')}: {review.submitted_by_name || '—'}</span>
          <PaymentBadge review={review} t={t} />
        </div>
      )}
      {isExpanded && (
        <div className="rv-card-expand">
          <ExpandedDetails ev={ev} review={review} t={t} />
        </div>
      )}
    </div>
  )
}
