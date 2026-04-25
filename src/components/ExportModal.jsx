import { useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { VENUES } from '../config/venues.js'
import { fetchEvents } from '../lib/events.js'
import { exportEventsToExcel } from '../lib/exportExcel.js'
import { toIsoDate } from '../lib/dates.js'

const SOURCES = ['crm', 'manual']
const STATUSES_FILTER = ['Confirmed', 'Tentative']

export default function ExportModal({ open, onClose, defaultFrom, defaultTo }) {
  const { t } = useLanguage()
  const [fromDate, setFromDate] = useState(defaultFrom || '')
  const [toDate, setToDate] = useState(defaultTo || '')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [source, setSource] = useState('')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState(null)

  // Reset state when modal opens with new defaults
  const [prevOpen, setPrevOpen] = useState(false)
  if (open && !prevOpen) {
    // Just opened — reset to defaults
    if (defaultFrom && fromDate !== defaultFrom) setFromDate(defaultFrom)
    if (defaultTo && toDate !== defaultTo) setToDate(defaultTo)
    setCategory('')
    setStatus('')
    setSource('')
    setError(null)
    setExporting(false)
  }
  if (open !== prevOpen) setPrevOpen(open)

  if (!open) return null

  const handleExport = async () => {
    if (!fromDate || !toDate) {
      setError(t('Please select date range'))
      return
    }
    setExporting(true)
    setError(null)
    try {
      let rows = await fetchEvents(fromDate, toDate)

      // Apply filters
      if (category) {
        rows = rows.filter((ev) => ev.venue_id === category)
      }
      if (status) {
        rows = rows.filter((ev) => ev.status === status)
      }
      if (source) {
        rows = rows.filter((ev) => ev.source === source)
      }

      if (rows.length === 0) {
        setError(t('No bookings to export'))
        setExporting(false)
        return
      }

      // Sort by date then time
      rows.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))

      // Generate filename
      const isSingleDay = fromDate === toDate
      let filename
      if (isSingleDay) {
        const d = new Date(fromDate + 'T00:00:00')
        const day = d.getDate()
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        const mon = months[d.getMonth()]
        const yr = d.getFullYear()
        filename = `ambria-bookings-${day}-${mon}-${yr}.xlsx`
      } else {
        filename = `ambria-bookings-${fromDate}.xlsx`
      }

      exportEventsToExcel(rows, filename)
      onClose()
    } catch (err) {
      console.error('[ambria] export failed', err)
      setError(err?.message || 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="export-modal-root" role="dialog" aria-modal="true">
      <div className="export-modal-backdrop" onClick={onClose} />
      <div className="export-modal-sheet">
        <div className="export-modal-header">
          <h2>{t('Export Bookings')}</h2>
          <button className="icon-btn day-modal-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="export-modal-body">
          <div className="export-field">
            <label>{t('From')}</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="export-field">
            <label>{t('To')}</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="export-field">
            <label>{t('Category')}</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">{t('All Categories')}</option>
              {VENUES.map((v) => (
                <option key={v.id} value={v.id}>{v.short} — {t(v.name)}</option>
              ))}
            </select>
          </div>
          <div className="export-field">
            <label>{t('Status')}</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{t('All')}</option>
              {STATUSES_FILTER.map((s) => (
                <option key={s} value={s}>{t(s)}</option>
              ))}
            </select>
          </div>
          <div className="export-field">
            <label>{t('Source')}</label>
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">{t('All')}</option>
              {SOURCES.map((s) => (
                <option key={s} value={s}>{t(s === 'crm' ? 'CRM' : 'Manual')}</option>
              ))}
            </select>
          </div>

          {error && <div className="export-error">{error}</div>}

          <button
            className="export-download-btn"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? t('Exporting…') : t('Export Excel')}
          </button>
        </div>
      </div>
    </div>
  )
}
