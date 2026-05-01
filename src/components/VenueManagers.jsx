import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import BookingModal from './BookingModal.jsx'

const PAGE_SIZE = 25

const DEPT_LABEL = { add: 'Decor', ac: 'Cuisine' }
const DEPT_COLOR = { add: '#D4B83D', ac: '#E74C3C' }


function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

function threeMonthsAgo() {
  const d = new Date()
  d.setMonth(d.getMonth() - 3)
  return isoDate(d)
}

function isoDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

function isUrl(s) {
  if (!s) return false
  return s.startsWith('http') || s.startsWith('www.') || s.includes('google.com/maps')
}

function mapsUrl(loc) {
  if (!loc) return '#'
  if (loc.startsWith('http')) return loc
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}`
}

function exportCsv(rows, t) {
  const headers = [
    'Venue Manager Name', 'Venue Manager Number', 'Department', 'Venue Name',
    'Venue Type', 'Location', 'Event Date', 'Guest Name',
    'Guest Phone', 'Sales Person',
  ]
  const escape = (v) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.join(',')]
  for (const r of rows) {
    lines.push([
      escape(r.venue_manager_name), escape(r.venue_manager_number),
      escape(DEPT_LABEL[r.venue_id] || r.venue_id), escape(r.venue_name),
      escape(r.venue_type), escape(r.location), escape(r.date),
      escape(r.guest_name), escape(r.phone),
      escape(r.sales_person),
    ].join(','))
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `venue-managers-${isoDate(new Date())}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function VenueManagers({ currentUser, showToast, onMenu }) {
  const { t, formatShortDate } = useLanguage()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState(threeMonthsAgo)
  const [dateTo, setDateTo] = useState(() => isoDate(new Date()))
  const [grouped, setGrouped] = useState(false)
  const [expandedGroup, setExpandedGroup] = useState(null)
  const [page, setPage] = useState(0)
  const [editModal, setEditModal] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('events')
      .select('*')
      .in('venue_id', ['add', 'ac'])
      .not('venue_manager_name', 'is', null)
      .neq('venue_manager_name', '')
      .is('deleted_at', null)
      .order('date', { ascending: false })

    if (category) q = q.eq('venue_id', category)
    if (dateFrom) q = q.gte('date', dateFrom)
    if (dateTo) q = q.lte('date', dateTo)

    const { data, error } = await q
    if (error) { console.error(error); setLoading(false); return }
    setRows(data ?? [])
    setLoading(false)
  }, [category, dateFrom, dateTo])

  useEffect(() => { loadData() }, [loadData])

  // Client-side search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const words = search.trim().toLowerCase().split(/\s+/)
    return rows.filter((r) => {
      const hay = [r.venue_manager_name, r.venue_manager_number, r.venue_name, r.guest_name]
        .filter(Boolean).join(' ').toLowerCase()
      return words.every((w) => hay.includes(w))
    })
  }, [rows, search])

  // Grouped view
  const groups = useMemo(() => {
    if (!grouped) return null
    const map = {}
    for (const r of filtered) {
      const key = `${(r.venue_manager_name || '').trim().toLowerCase()}|${(r.venue_manager_number || '').trim()}`
      if (!map[key]) {
        map[key] = {
          name: r.venue_manager_name,
          number: r.venue_manager_number,
          departments: new Set(),
          venues: [],
          count: 0,
          lastDate: r.date,
          bookings: [],
        }
      }
      const g = map[key]
      g.departments.add(DEPT_LABEL[r.venue_id] || r.venue_id)
      g.count++
      if (r.date > g.lastDate) g.lastDate = r.date
      if (r.venue_name && !g.venues.includes(r.venue_name)) g.venues.push(r.venue_name)
      g.bookings.push(r)
    }
    return Object.values(map).sort((a, b) => b.lastDate.localeCompare(a.lastDate))
  }, [filtered, grouped])

  // Pagination
  const totalPages = grouped
    ? Math.ceil((groups?.length || 0) / PAGE_SIZE)
    : Math.ceil(filtered.length / PAGE_SIZE)
  const pagedRows = grouped ? null : filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const pagedGroups = grouped ? (groups || []).slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) : null

  useEffect(() => { setPage(0) }, [search, category, dateFrom, dateTo, grouped])

  const onSaved = (row) => {
    setEditModal(null)
    loadData()
    showToast?.(t('Booking saved'))
  }
  const onDeleted = () => {
    setEditModal(null)
    loadData()
    showToast?.(t('Booking deleted'))
  }

  return (
    <div className="panel-page vm-page">
      <div className="panel-header">
        <button className="icon-btn header-menu" onClick={onMenu}><MenuIcon /></button>
        <h2>{t('Venue Managers')}</h2>
        <button className="vm-export-btn" onClick={() => exportCsv(filtered, t)} title={t('Export CSV')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span className="vm-export-label">{t('Export CSV')}</span>
        </button>
      </div>

      {/* Filters */}
      <div className="vm-filters">
        <input
          type="search"
          className="vm-search"
          placeholder={t('Search manager, venue, guest…')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="vm-filter-select" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">{t('All Categories')}</option>
          <option value="add">{t('ADD — Decor')}</option>
          <option value="ac">{t('AC — Cuisine')}</option>
        </select>
        <input type="date" className="vm-date-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <span className="vm-date-sep">–</span>
        <input type="date" className="vm-date-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <button
          className={`vm-group-btn ${grouped ? 'vm-group-active' : ''}`}
          onClick={() => setGrouped((g) => !g)}
        >
          {grouped ? t('Show all bookings') : t('Group by Manager')}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="vm-empty">{t('Loading…')}</div>
      ) : filtered.length === 0 ? (
        <div className="vm-empty">{t('No venue managers found')}</div>
      ) : grouped ? (
        /* ── Grouped view ── */
        <div className="vm-list">
          {pagedGroups.map((g, gi) => {
            const key = `${g.name}|${g.number}`
            const isOpen = expandedGroup === key
            const venueDisplay = g.venues.length <= 3 ? g.venues.join(', ') : `${g.venues.slice(0, 3).join(', ')} +${g.venues.length - 3} more`
            return (
              <div key={key} className="vm-group-card">
                <button className="vm-group-row" onClick={() => setExpandedGroup(isOpen ? null : key)}>
                  <div className="vm-group-main">
                    <span className="vm-mgr-name">{g.name}</span>
                    {g.number && <a href={`tel:${g.number}`} className="vm-mgr-phone" onClick={(e) => e.stopPropagation()}>{g.number}</a>}
                  </div>
                  <div className="vm-group-meta">
                    {[...g.departments].map((d) => (
                      <span key={d} className="vm-dept-badge" style={{ background: d === 'Decor' ? DEPT_COLOR.add : DEPT_COLOR.ac }}>{t(d)}</span>
                    ))}
                    <span className="vm-group-count">{g.count} {t('bookings')}</span>
                    <span className="vm-group-date">{t('Last')}: {formatDate(g.lastDate)}</span>
                  </div>
                  <div className="vm-group-venues">{venueDisplay}</div>
                  <span className={`vm-chevron ${isOpen ? 'open' : ''}`}>&#9662;</span>
                </button>
                {isOpen && (
                  <div className="vm-group-expand">
                    {g.bookings.map((r) => (
                      <Row key={r.id} r={r} t={t} formatShortDate={formatShortDate} onEdit={() => setEditModal(r)} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* ── Flat list ── */
        <div className="vm-list">
          {/* Desktop table header */}
          <div className="vm-table-header">
            <span>{t('Manager')}</span>
            <span>{t('Department')}</span>
            <span>{t('Venue')}</span>
            <span>{t('Date')}</span>
            <span>{t('Guest')}</span>
            <span>{t('Sales Person')}</span>
          </div>
          {pagedRows.map((r) => (
            <Row key={r.id} r={r} t={t} formatShortDate={formatShortDate} onEdit={() => setEditModal(r)} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="vm-pagination">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>{t('Previous')}</button>
          <span>{page + 1} / {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>{t('Next')}</button>
        </div>
      )}

      {/* Edit modal */}
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

function Row({ r, t, formatShortDate, onEdit }) {
  const dept = DEPT_LABEL[r.venue_id] || r.venue_id
  return (
    <button className="vm-row" onClick={onEdit}>
      <div className="vm-row-main">
        <span className="vm-mgr-name">{r.venue_manager_name}</span>
        {r.venue_manager_number && (
          <a href={`tel:${r.venue_manager_number}`} className="vm-mgr-phone" onClick={(e) => e.stopPropagation()}>{r.venue_manager_number}</a>
        )}
      </div>
      <span className="vm-dept-badge" style={{ background: DEPT_COLOR[r.venue_id] || '#999' }}>{t(dept)}</span>
      <div className="vm-row-venue">
        <span>{r.venue_name || '—'}</span>
        {r.location && (
          isUrl(r.location) ? (
            <a href={mapsUrl(r.location)} target="_blank" rel="noopener noreferrer" className="vm-loc-link" onClick={(e) => e.stopPropagation()}>
              {t('Map')}
            </a>
          ) : (
            <span className="vm-loc-text">{r.location}</span>
          )
        )}
      </div>
      <span className="vm-row-date">{formatDate(r.date)}</span>
      <div className="vm-row-guest">
        <span>{r.guest_name || '—'}</span>
        {r.phone && <span className="vm-guest-phone">{r.phone}</span>}
      </div>
      <span className="vm-row-sales">{r.sales_person || '—'}</span>
    </button>
  )
}
