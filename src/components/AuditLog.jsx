import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { formatTimestampIST } from '../lib/dates.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'

const ACTION_COLORS = {
  create: '#22C55E', update: '#4A90D9', delete: '#E85D75',
  soft_delete: '#E85D75', bulk_delete: '#E85D75',
  login: '#95A5A6', logout: '#95A5A6',
  approve: '#22C55E', reject: '#E85D75',
  set_pin: '#4A90D9', change_pin: '#4A90D9',
}

const ACTION_LABEL_KEYS = {
  create: 'Created', update: 'Updated', delete: 'Deleted',
  soft_delete: 'Deleted', bulk_delete: 'Bulk Delete',
  login: 'Login', logout: 'Logout',
  approve: 'Approved', reject: 'Rejected',
  set_pin: 'Set PIN', change_pin: 'Change PIN',
}

const ROLE_COLORS = { admin: '#E85D75', gm: '#D4A24E', staff: '#95A5A6' }

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

function ExportIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function DateInput({ value, onChange, placeholder }) {
  const ref = useRef()
  const display = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('en-GB')
    : null

  return (
    <div className="date-input-wrap" onClick={() => { ref.current?.showPicker?.(); ref.current?.focus() }}>
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="date-input-native"
      />
      <div className="date-input-face">
        <span className={display ? '' : 'date-input-placeholder'}>
          {display || placeholder || 'dd/mm/yyyy'}
        </span>
      </div>
      {value && (
        <button
          type="button"
          className="date-input-clear"
          onClick={(e) => { e.stopPropagation(); onChange('') }}
          aria-label="Clear"
        >×</button>
      )}
    </div>
  )
}

export default function AuditLog({ onMenu, killSwitch }) {
  const { t, formatTimestampIST: formatTsIST } = useLanguage()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [showAllChanges, setShowAllChanges] = useState({})
  const [filterUser, setFilterUser] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [searchText, setSearchText] = useState('')
  const [users, setUsers] = useState([])
  const [exportOpen, setExportOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState('csv')
  const [exporting, setExporting] = useState(false)
  const [exportFrom, setExportFrom] = useState('')
  const [exportTo, setExportTo] = useState('')
  const [exportUser, setExportUser] = useState('')
  const [exportAction, setExportAction] = useState('')

  useEffect(() => {
    supabase.from('users').select('id, name, role').order('name')
      .then(({ data }) => setUsers(data ?? []))
  }, [])

  useEffect(() => { loadEntries(true) }, [filterUser, filterAction, filterFrom, filterTo])

  async function loadEntries(reset = false) {
    setLoading(true)
    const offset = reset ? 0 : entries.length
    let q = supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + 49)

    if (filterUser) q = q.eq('user_id', filterUser)
    if (filterAction) q = q.eq('action', filterAction)
    if (filterFrom) q = q.gte('created_at', filterFrom + 'T00:00:00')
    if (filterTo) q = q.lte('created_at', filterTo + 'T23:59:59')

    const { data, error } = await q
    if (error) { console.error(error); setLoading(false); return }
    const rows = data ?? []
    if (reset) setEntries(rows)
    else setEntries((prev) => [...prev, ...rows])
    setHasMore(rows.length === 50)
    setLoading(false)
  }

  const describeEntity = useCallback((entry) => {
    // Use structured summary if available
    if (entry.details?.summary) return entry.details.summary
    // Fallback for legacy entries
    if (entry.entity_type === 'session') {
      return entry.action === 'login' ? t('Logged in') : t('Logged out')
    }
    if (entry.entity_type === 'user') {
      const name = entry.details?.name || 'Unknown'
      const role = entry.details?.role || ''
      return `${t('User')} — ${name}${role ? ` (${role})` : ''}`
    }
    if (entry.entity_type === 'event') {
      const d = entry.details
      if (!d) return t('Event')
      if (entry.action === 'bulk_delete') {
        return `${t('Bulk delete')} — ${d.count || '?'} events`
      }
      const title = d.title || d.booking_title || d.new?.title || ''
      const venue = d.venue_id || d.new?.venue_id || ''
      return `${title}${venue ? ' | ' + venue.toUpperCase() : ''}`
    }
    if (entry.entity_type === 'event_type') {
      const name = entry.details?.name || ''
      return `${t('Event Type')} — ${name}`
    }
    return entry.entity_type
  }, [t])

  const getUserRole = (entry) => {
    if (entry.actor_role) return entry.actor_role
    const u = users.find((x) => x.id === entry.user_id)
    return u?.role || null
  }

  // Smart search — fuzzy multi-word AND matching
  const filteredEntries = entries.filter((entry) => {
    const q = searchText.trim().toLowerCase()
    if (!q) return true
    const words = q.split(/\s+/).filter(Boolean)
    const hay = [
      entry.user_name,
      entry.action,
      ACTION_LABEL_KEYS[entry.action],
      describeEntity(entry),
      entry.details ? JSON.stringify(entry.details) : '',
    ].filter(Boolean).join(' ').toLowerCase()
    return words.every((w) => hay.includes(w))
  })

  // ── Export helpers ──

  const openExport = () => {
    setExportFrom(filterFrom)
    setExportTo(filterTo)
    setExportUser(filterUser)
    setExportAction(filterAction)
    setExportOpen(true)
  }

  async function fetchExportData() {
    let q = supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5000)

    if (exportUser) q = q.eq('user_id', exportUser)
    if (exportAction) q = q.eq('action', exportAction)
    if (exportFrom) q = q.gte('created_at', exportFrom + 'T00:00:00')
    if (exportTo) q = q.lte('created_at', exportTo + 'T23:59:59')

    const { data, error } = await q
    if (error) throw error
    return data ?? []
  }

  // Describe entity for export (plain English, no t() wrapping)
  function describeEntityPlain(entry) {
    if (entry.details?.summary) return entry.details.summary
    if (entry.entity_type === 'session') {
      return entry.action === 'login' ? 'Logged in' : 'Logged out'
    }
    if (entry.entity_type === 'user') {
      const name = entry.details?.name || 'Unknown'
      const role = entry.details?.role || ''
      return `User — ${name}${role ? ` (${role})` : ''}`
    }
    if (entry.entity_type === 'event') {
      const d = entry.details
      if (!d) return 'Event'
      if (entry.action === 'bulk_delete') return `Bulk delete — ${d.count || '?'} events`
      const title = d.title || d.booking_title || d.new?.title || ''
      const venue = d.venue_id || d.new?.venue_id || ''
      return `${title}${venue ? ' | ' + venue.toUpperCase() : ''}`
    }
    if (entry.entity_type === 'event_type') {
      return `Event Type — ${entry.details?.name || ''}`
    }
    return entry.entity_type
  }

  function getUserRoleById(entry) {
    if (entry.actor_role) return entry.actor_role
    const u = users.find((x) => x.id === entry.user_id)
    return u?.role || ''
  }

  async function handleExport() {
    setExporting(true)
    try {
      const rows = await fetchExportData()
      if (rows.length === 0) { alert(t('No entries to export')); return }

      if (exportFormat === 'csv') {
        exportCSV(rows)
      } else {
        await exportPDF(rows)
      }
      setExportOpen(false)
    } catch (err) {
      console.error('[ambria] export failed', err)
    } finally {
      setExporting(false)
    }
  }

  function exportCSV(rows) {
    const header = ['Timestamp (IST)', 'User', 'Role', 'Action', 'Description', 'Details']
    const csvRows = [header.join(',')]
    for (const r of rows) {
      const ts = formatTimestampIST(r.created_at)
      const user = r.user_name || 'System'
      const role = getUserRoleById(r)
      const action = ACTION_LABEL_KEYS[r.action] || r.action
      const desc = describeEntityPlain(r)
      const details = r.details ? JSON.stringify(r.details).replace(/"/g, '""') : ''
      csvRows.push([
        `"${ts}"`, `"${user}"`, `"${role}"`, `"${action}"`, `"${desc}"`, `"${details}"`,
      ].join(','))
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    downloadBlob(blob, `audit-log-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  async function exportPDF(rows) {
    const { jsPDF } = await import('jspdf')
    await import('jspdf-autotable')
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    doc.setFontSize(14)
    doc.text('Ambria — Audit Log', 14, 15)
    doc.setFontSize(9)
    const dateRange = [exportFrom, exportTo].filter(Boolean).join(' to ') || 'All time'
    doc.text(`Exported: ${new Date().toLocaleString('en-IN')}  |  Range: ${dateRange}`, 14, 21)

    const head = [['Timestamp (IST)', 'User', 'Role', 'Action', 'Description']]
    const body = rows.map((r) => [
      formatTimestampIST(r.created_at),
      r.user_name || 'System',
      getUserRoleById(r),
      ACTION_LABEL_KEYS[r.action] || r.action,
      describeEntityPlain(r),
    ])

    doc.autoTable({
      startY: 25,
      head,
      body,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [232, 93, 117], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      margin: { left: 14, right: 14 },
    })

    doc.save(`audit-log-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  if (killSwitch) {
    return (
      <div className="panel-page">
        <div className="panel-header">
          <button className="icon-btn header-menu" onClick={onMenu} aria-label="Open menu">
            <MenuIcon />
          </button>
          <h2>{t('Audit Log')}</h2>
        </div>
        <div className="empty-state">{t('No data available')}</div>
      </div>
    )
  }

  return (
    <div className="panel-page">
      <div className="panel-header">
        <button className="icon-btn header-menu" onClick={onMenu} aria-label="Open menu">
          <MenuIcon />
        </button>
        <h2>{t('Audit Log')}</h2>
        <button className="btn-outline btn-sm export-btn" onClick={openExport}>
          <ExportIcon /> {t('Export')}
        </button>
      </div>

      <div className="audit-filters">
        <div className="audit-filter-group">
          <label className="audit-filter-label">{t('User')}</label>
          <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)}>
            <option value="">{t('All users')}</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div className="audit-filter-group">
          <label className="audit-filter-label">{t('Action')}</label>
          <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
            <option value="">{t('All actions')}</option>
            <option value="create">{t('Created')}</option>
            <option value="update">{t('Updated')}</option>
            <option value="delete">{t('Deleted')}</option>
            <option value="login">{t('Login')}</option>
            <option value="logout">{t('Logout')}</option>
          </select>
        </div>
        <div className="audit-filter-group">
          <label className="audit-filter-label">{t('From Date')}</label>
          <DateInput value={filterFrom} onChange={setFilterFrom} placeholder="dd/mm/yyyy" />
        </div>
        <div className="audit-filter-group">
          <label className="audit-filter-label">{t('To Date')}</label>
          <DateInput value={filterTo} onChange={setFilterTo} placeholder="dd/mm/yyyy" />
        </div>
      </div>

      <div className="panel-search">
        <input
          type="search"
          placeholder={t('Search audit log…')}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      </div>

      <div className="audit-list">
        {filteredEntries.map((entry) => {
          const role = getUserRole(entry)
          const changes = entry.details?.changes
          const hasChanges = Array.isArray(changes) && changes.length > 0
          const bookingTitle = entry.details?.booking_title
          const showAll = showAllChanges[entry.id]
          const visibleChanges = hasChanges ? (showAll ? changes : changes.slice(0, 5)) : []
          const hiddenCount = hasChanges ? changes.length - 5 : 0

          return (
            <div
              key={entry.id}
              className={`audit-entry ${expanded === entry.id ? 'expanded' : ''}`}
              onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
            >
              <div className="audit-entry-main">
                <div className="audit-top-row">
                  <span className="audit-time">{formatTsIST(entry.created_at)}</span>
                  <span
                    className="action-badge"
                    style={{ background: ACTION_COLORS[entry.action] || '#95A5A6' }}
                  >
                    {t(ACTION_LABEL_KEYS[entry.action] || entry.action)}
                  </span>
                </div>
                <div className="audit-who">
                  <span className="audit-user-name">{entry.user_name || t('System')}</span>
                  {role && (
                    <span className="role-badge sm" style={{ background: ROLE_COLORS[role] || '#95A5A6' }}>{t(role)}</span>
                  )}
                </div>
                <div className="audit-desc">{describeEntity(entry)}</div>
                {bookingTitle && entry.entity_type === 'event' && (
                  <div className="audit-booking-title">{t('Booking')}: {bookingTitle}</div>
                )}
              </div>
              {expanded === entry.id && hasChanges && (
                <div className="audit-changes">
                  {visibleChanges.map((c, i) => (
                    <div key={i} className="audit-change-row">
                      <span className="audit-change-bullet">•</span>
                      <span className="audit-change-label">{c.field_label}:</span>
                      <span className="audit-change-old">{c.old_value}</span>
                      <span className="audit-change-arrow">→</span>
                      <span className="audit-change-new">{c.new_value}</span>
                    </div>
                  ))}
                  {!showAll && hiddenCount > 0 && (
                    <button
                      type="button"
                      className="audit-show-more"
                      onClick={(e) => { e.stopPropagation(); setShowAllChanges((prev) => ({ ...prev, [entry.id]: true })) }}
                    >
                      {t('+{n} more changes', { n: hiddenCount })}
                    </button>
                  )}
                </div>
              )}
              {expanded === entry.id && !hasChanges && entry.details && (
                <pre className="audit-details">{JSON.stringify(entry.details, null, 2)}</pre>
              )}
            </div>
          )
        })}
        {filteredEntries.length === 0 && !loading && <div className="empty-state">{t('No audit entries found')}</div>}
      </div>

      {loading && <div className="loading">{t('Loading…')}</div>}
      {hasMore && !loading && entries.length > 0 && (
        <button className="btn-ghost load-more" onClick={() => loadEntries(false)}>{t('Load more')}</button>
      )}

      {/* Export modal */}
      {exportOpen && (
        <div className="modal-root" role="dialog" aria-modal="true">
          <div className="modal-backdrop" onClick={() => setExportOpen(false)} />
          <div className="panel-form-card export-card">
            <h3>{t('Export Audit Log')}</h3>

            <div className="export-filters">
              <div className="export-row">
                <label className="field-label">{t('From')}</label>
                <DateInput value={exportFrom} onChange={setExportFrom} placeholder="dd/mm/yyyy" />
              </div>
              <div className="export-row">
                <label className="field-label">{t('To')}</label>
                <DateInput value={exportTo} onChange={setExportTo} placeholder="dd/mm/yyyy" />
              </div>
              <div className="export-row">
                <label className="field-label">{t('User')}</label>
                <select value={exportUser} onChange={(e) => setExportUser(e.target.value)}>
                  <option value="">{t('All users')}</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="export-row">
                <label className="field-label">{t('Action')}</label>
                <select value={exportAction} onChange={(e) => setExportAction(e.target.value)}>
                  <option value="">{t('All actions')}</option>
                  <option value="create">{t('Created')}</option>
                  <option value="update">{t('Updated')}</option>
                  <option value="delete">{t('Deleted')}</option>
                  <option value="login">{t('Login')}</option>
                  <option value="logout">{t('Logout')}</option>
                </select>
              </div>
              <div className="export-row">
                <label className="field-label">{t('Format')}</label>
                <div className="export-format-toggle">
                  <button
                    type="button"
                    className={`format-btn ${exportFormat === 'csv' ? 'active' : ''}`}
                    onClick={() => setExportFormat('csv')}
                  >
                    CSV
                  </button>
                  <button
                    type="button"
                    className={`format-btn ${exportFormat === 'pdf' ? 'active' : ''}`}
                    onClick={() => setExportFormat('pdf')}
                  >
                    PDF
                  </button>
                </div>
              </div>
            </div>

            <div className="panel-form-actions">
              <button type="button" className="btn-ghost" onClick={() => setExportOpen(false)}>
                {t('Cancel')}
              </button>
              <button
                type="button"
                className="btn-save"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? t('Exporting…') : t('Download')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
