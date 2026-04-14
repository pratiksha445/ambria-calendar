import { useEffect, useState } from 'react'
import { VENUE_BY_ID, SHIFT_BADGE } from '../config/venues.js'

export default function EventCard({ event, expanded = false, onToggle, onEdit, onDelete }) {
  const venue = VENUE_BY_ID[event.venue_id]
  const shiftBadge = event.shift ? SHIFT_BADGE[event.shift] : null
  const primary = buildPrimary(event)
  const [confirmDel, setConfirmDel] = useState(false)

  useEffect(() => {
    if (!expanded) setConfirmDel(false)
  }, [expanded])

  const startDel = (e) => { e.stopPropagation(); setConfirmDel(true) }
  const cancelDel = (e) => { e.stopPropagation(); setConfirmDel(false) }
  const doDelete = (e) => {
    e.stopPropagation()
    onDelete?.(event)
    setConfirmDel(false)
  }

  return (
    <article
      className={`event-card ${expanded ? 'expanded' : ''}`}
      style={{ borderLeftColor: venue?.color ?? '#ccc' }}
    >
      {confirmDel ? (
        <div className="event-card-confirm">
          <span>Delete?</span>
          <div className="event-card-confirm-actions">
            <button type="button" className="btn-ghost" onClick={cancelDel}>Cancel</button>
            <button type="button" className="btn-danger" onClick={doDelete}>Delete</button>
          </div>
        </div>
      ) : (
        <div className="event-card-compact">
          <button
            type="button"
            className="event-card-row"
            onClick={onToggle}
            aria-expanded={expanded}
          >
            <span
              className="event-venue-badge"
              style={{ background: venue?.color ?? '#ccc' }}
            >
              {venue?.short ?? '?'}
            </span>

            <div className="event-card-stack">
              <span className="event-primary">{primary}</span>
              <div className="event-card-meta">
                {event.time && (
                  <span className="event-time">{formatTime(event.time)}</span>
                )}
                {shiftBadge && (
                  <span className="shift-badge" style={{ background: shiftBadge.color }}>
                    {shiftBadge.short}
                  </span>
                )}
                {event.sales_person && (
                  <span className="event-sales">{event.sales_person}</span>
                )}
                <span
                  className={`source-dot ${event.source}`}
                  aria-label={event.source === 'crm' ? 'CRM' : 'Manual'}
                  title={event.source === 'crm' ? 'CRM' : 'Manual'}
                />
              </div>
            </div>
          </button>
          {onDelete && (
            <button
              type="button"
              className="card-trash-btn"
              onClick={startDel}
              aria-label="Delete event"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          )}
        </div>
      )}

      <div className="event-card-details" aria-hidden={!expanded}>
        <div className="event-card-details-inner">
          {event.sub_venue && (
            <div><span className="k">Sub-venue</span> {event.sub_venue}</div>
          )}
          {event.venue_name && (
            <div><span className="k">Venue</span> {event.venue_name}</div>
          )}
          {event.venue_type && (
            <div><span className="k">Type</span> {event.venue_type}</div>
          )}
          {(event.guest_name || event.tender_name) && (
            <div><span className="k">Guest</span> {event.guest_name || event.tender_name}</div>
          )}
          {event.phone && <div><span className="k">Phone</span> {event.phone}</div>}
          {event.pax && <div><span className="k">Pax</span> {event.pax}</div>}
          {event.sales_person && (
            <div><span className="k">Sales</span> {event.sales_person}</div>
          )}
          {event.status && (
            <div><span className="k">Status</span> {event.status}</div>
          )}
          {onEdit && (
            <div className="event-card-actions">
              <button
                type="button"
                className="event-edit-btn"
                onClick={(e) => { e.stopPropagation(); onEdit(event) }}
              >
                {event.source === 'manual' ? 'Edit' : 'View'}
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

function buildPrimary(event) {
  if (event.venue_id === 'tender') {
    return joinPipes([event.tender_name, event.event_type_text, event.venue_name])
  }
  if (event.venue_id === 'villa') {
    return joinPipes([
      event.guest_name,
      event.sub_venue,
      formatShortDate(event.check_in_date),
    ])
  }
  return joinPipes([
    event.guest_name,
    event.event_type === 'Other' ? event.event_type_other : event.event_type,
    event.pax ? `${event.pax}pax` : null,
    event.menu_cat,
    event.venue_name,
  ])
}

function joinPipes(parts) {
  return parts.filter(Boolean).join(' | ')
}

function formatTime(t) {
  return typeof t === 'string' ? t.slice(0, 5) : t
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatShortDate(iso) {
  if (!iso || typeof iso !== 'string') return null
  const [, m, d] = iso.split('-').map(Number)
  if (!m || !d) return null
  return `${d} ${SHORT_MONTHS[m - 1]}`
}
