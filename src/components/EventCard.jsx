import { useState } from 'react'
import { VENUE_BY_ID, SHIFT_BADGE } from '../config/venues.js'

export default function EventCard({ event, detailed = false }) {
  const [open, setOpen] = useState(false)
  const venue = VENUE_BY_ID[event.venue_id]
  const shiftBadge = event.shift ? SHIFT_BADGE[event.shift] : null
  const showDetails = detailed || open

  const guest = event.guest_name || event.tender_name
  const subVenueOrVenue = event.sub_venue || event.venue_name

  return (
    <article
      className="event-card"
      style={{ borderLeftColor: venue?.color ?? '#ccc' }}
      onClick={() => !detailed && setOpen((v) => !v)}
    >
      <div className="event-card-head">
        <span
          className="event-venue-badge"
          style={{ background: venue?.color ?? '#ccc' }}
        >
          {venue?.short ?? '?'}
        </span>
        <span className="event-title">{event.title}</span>
      </div>

      <div className="event-card-meta">
        {event.time && <span className="event-time">{formatTime(event.time)}</span>}
        {shiftBadge && (
          <span className="shift-badge" style={{ background: shiftBadge.color }}>
            {shiftBadge.short}
          </span>
        )}
        {subVenueOrVenue && !showDetails && (
          <span className="event-subvenue">{subVenueOrVenue}</span>
        )}
        <span className={`source-badge ${event.source}`}>
          {event.source === 'crm' ? 'CRM' : 'Manual'}
        </span>
      </div>

      {showDetails && (
        <div className="event-card-details">
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
      )}
    </article>
  )
}

function formatTime(t) {
  // Supabase returns time as "HH:MM:SS" — trim to HH:MM
  return typeof t === 'string' ? t.slice(0, 5) : t
}
