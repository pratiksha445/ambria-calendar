import { VENUE_BY_ID, SHIFT_BADGE } from '../config/venues.js'

export default function EventCard({ event, expanded = false, onToggle }) {
  const venue = VENUE_BY_ID[event.venue_id]
  const shiftBadge = event.shift ? SHIFT_BADGE[event.shift] : null
  const guest = event.guest_name || event.tender_name
  const primary = buildPrimary(event)

  return (
    <article
      className={`event-card ${expanded ? 'expanded' : ''}`}
      style={{ borderLeftColor: venue?.color ?? '#ccc' }}
    >
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
          {guest && <div><span className="k">Guest</span> {guest}</div>}
          {event.phone && <div><span className="k">Phone</span> {event.phone}</div>}
          {event.pax && <div><span className="k">Pax</span> {event.pax}</div>}
          {event.sales_person && (
            <div><span className="k">Sales</span> {event.sales_person}</div>
          )}
          {event.status && (
            <div><span className="k">Status</span> {event.status}</div>
          )}
        </div>
      </div>
    </article>
  )
}

// Build the pipe-separated primary line from raw event fields (not the stored
// title), so the UI layout is stable even when titles are manually overridden.
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
