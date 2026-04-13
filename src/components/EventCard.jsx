import { VENUE_BY_ID, SHIFT_BADGE } from '../config/venues.js'

export default function EventCard({ event, expanded = false, onToggle }) {
  const venue = VENUE_BY_ID[event.venue_id]
  const shiftBadge = event.shift ? SHIFT_BADGE[event.shift] : null
  const guest = event.guest_name || event.tender_name

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
          <span className="event-title">{event.title}</span>
          <div className="event-card-meta">
            {event.time && (
              <span className="event-time">{formatTime(event.time)}</span>
            )}
            {shiftBadge && (
              <span className="shift-badge" style={{ background: shiftBadge.color }}>
                {shiftBadge.short}
              </span>
            )}
            {event.pax && <span className="event-pax">{event.pax}pax</span>}
            {event.menu_cat && (
              <span className="menu-cat-badge">{event.menu_cat}</span>
            )}
          </div>
        </div>

        <span
          className={`source-dot ${event.source}`}
          aria-label={event.source === 'crm' ? 'CRM' : 'Manual'}
          title={event.source === 'crm' ? 'CRM' : 'Manual'}
        />
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

function formatTime(t) {
  return typeof t === 'string' ? t.slice(0, 5) : t
}
