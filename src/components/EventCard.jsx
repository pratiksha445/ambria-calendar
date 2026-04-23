import { useEffect, useState } from 'react'
import { VENUE_BY_ID, SHIFT_BADGE } from '../config/venues.js'
import { formatTime12 } from '../lib/dates.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'

export default function EventCard({ event, expanded = false, onToggle, onEdit, onDelete, user }) {
  const { t, formatShortDate } = useLanguage()
  const venue = VENUE_BY_ID[event.venue_id]
  const shiftBadge = event.shift ? SHIFT_BADGE[event.shift] : null
  const primary = buildPrimary(event, formatShortDate)
  const [confirmDel, setConfirmDel] = useState(false)
  const canModify = user?.role === 'admin' || (event.created_by != null && user?.id === event.created_by)

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
          <span>{t('Delete?')}</span>
          <div className="event-card-confirm-actions">
            <button type="button" className="btn-ghost" onClick={cancelDel}>{t('Cancel')}</button>
            <button type="button" className="btn-danger" onClick={doDelete}>{t('Delete')}</button>
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
              style={{ background: venue?.color ?? '#ccc', color: venue?.textColor ?? '#fff' }}
            >
              {venue?.short ?? '?'}
            </span>

            <div className="event-card-stack">
              <span className="event-primary">{primary}</span>
              <div className="event-card-meta">
                {event.time && (
                  <span className="event-time">{formatTime12(event.time)}</span>
                )}
                {shiftBadge && (
                  <span className="shift-badge" style={{ background: shiftBadge.color }}>
                    {t(`shift_short_${event.shift}`)}
                  </span>
                )}
                {event.sales_person && (
                  <span className="event-sales">{event.sales_person}</span>
                )}
                <span
                  className={`source-dot ${event.source}`}
                  aria-label={event.source === 'crm' ? t('CRM') : t('Manual')}
                  title={event.source === 'crm' ? t('CRM') : t('Manual')}
                />
              </div>
            </div>
          </button>
          {onDelete && canModify && (
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
            <div className="detail-row"><span className="k">{t('Sub-venue')}</span><span className="v">{event.sub_venue}</span></div>
          )}
          {event.venue_name && (
            <div className="detail-row"><span className="k">{t('Venue')}</span><span className="v">{event.venue_name}</span></div>
          )}
          {event.venue_type && (
            <div className="detail-row"><span className="k">{t('Type')}</span><span className="v">{t(event.venue_type)}</span></div>
          )}
          {event.location && (
            <div className="detail-row event-detail-location">
              <span className="k">{t('Location')}</span>
              <span className="v">
                {event.location}
                <a
                  href={getMapsUrl(event.location)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="map-pin-btn inline"
                  aria-label="Open in Google Maps"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </a>
              </span>
            </div>
          )}
          {(event.guest_name || event.tender_name) && (
            <div className="detail-row"><span className="k">{t('Guest')}</span><span className="v">{event.guest_name || event.tender_name}</span></div>
          )}
          {event.pax && (
            <div className="detail-row"><span className="k">{t('Pax')}</span><span className="v">{event.pax}</span></div>
          )}
          {event.sales_person && (
            <div className="detail-row"><span className="k">{t('Sales')}</span><span className="v">{event.sales_person}</span></div>
          )}
          {event.booking_status && (
            <div className="detail-row"><span className="k">{t('Booking Status')}</span><span className="v">{t(event.booking_status)}</span></div>
          )}
          {event.fp_status && (
            <div className="detail-row"><span className="k">{t('FP Status')}</span><span className="v">{t(event.fp_status)}</span></div>
          )}
          {event.menu_type && (
            <div className="detail-row"><span className="k">{t('Menu Type')}</span><span className="v">{t(event.menu_type)}</span></div>
          )}
          {event.menu_cat && (
            <div className="detail-row"><span className="k">{t('Menu Category')}</span><span className="v">{event.menu_cat}</span></div>
          )}
          {event.decor_type && (
            <div className="detail-row"><span className="k">{t('Decor Type')}</span><span className="v">{event.decor_type}</span></div>
          )}
          {event.pool_included && (
            <div className="detail-row"><span className="k">{t('Pool Included')}</span><span className="v">{t(event.pool_included)}</span></div>
          )}
          {event.meal_included && (
            <div className="detail-row"><span className="k">{t('Meal Included')}</span><span className="v">{t(event.meal_included)}</span></div>
          )}
          {event.added_service && (
            <div className="detail-row"><span className="k">{t('Added Service')}</span><span className="v">{event.added_service}</span></div>
          )}
          {event.status && (
            <div className="detail-row"><span className="k">{t('Status')}</span><span className="v">{t(event.status)}</span></div>
          )}
          {event.notes && (
            <div className="event-card-notes"><span className="k">{t('Notes')}</span><span className="v">{event.notes}</span></div>
          )}
          {onEdit && canModify && (
            <div className="event-card-actions">
              <button
                type="button"
                className="event-edit-btn"
                onClick={(e) => { e.stopPropagation(); onEdit(event) }}
              >
                {event.source === 'manual' ? t('Edit') : t('View')}
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

function buildPrimary(event, formatShortDate) {
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

function getMapsUrl(location) {
  if (!location) return '#'
  if (location.startsWith('http')) return location
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
}
