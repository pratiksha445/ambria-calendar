import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { VENUE_BY_ID, SHIFT_BADGE } from '../config/venues.js'
import { formatTime12 } from '../lib/dates.js'
import { canAccessBooking } from '../lib/sectionPermissions.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { loadElementLabels, getElementLabel } from '../lib/elements.js'

const OWN_VENUES = new Set(['ap', 'am', 'ae', 'ar'])

export default function EventCard({ event, expanded = false, onToggle, onEdit, onDelete, user }) {
  const { t, lang, formatShortDate } = useLanguage()
  const [elementLabels, setElementLabels] = useState({})
  const venue = VENUE_BY_ID[event.venue_id]
  const shiftBadge = event.shift ? SHIFT_BADGE[event.shift] : null
  const primary = buildPrimary(event, formatShortDate, t)
  const [confirmDel, setConfirmDel] = useState(false)
  const canModify = canAccessBooking(user, event)
  const isOwnVenue = OWN_VENUES.has(event.venue_id)
  const [showTimePopup, setShowTimePopup] = useState(false)
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    loadElementLabels().then(setElementLabels).catch(() => {})
  }, [])

  useEffect(() => {
    if (!expanded) setConfirmDel(false)
    setShowTimePopup(false)
  }, [expanded])

  const startDel = (e) => { e.stopPropagation(); setConfirmDel(true) }
  const cancelDel = (e) => { e.stopPropagation(); setConfirmDel(false) }
  const doDelete = (e) => {
    e.stopPropagation()
    onDelete?.(event)
    setConfirmDel(false)
  }

  const openTimePopup = (e) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const popupH = 200 // approximate height of 6 rows
    const popupW = 210
    let top = rect.bottom + 4
    let left = Math.max(8, rect.left - 40)
    // Clamp within viewport
    if (top + popupH > window.innerHeight - 8) top = Math.max(8, rect.top - popupH - 4)
    if (left + popupW > window.innerWidth - 8) left = window.innerWidth - popupW - 8
    setPopupPos({ top, left })
    setShowTimePopup((prev) => !prev)
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
                {event.time && isOwnVenue ? (
                  <span className="event-time event-time-tap" onClick={openTimePopup}>
                    {formatTime12(event.time)}
                  </span>
                ) : event.time ? (
                  <span className="event-time">{formatTime12(event.time)}</span>
                ) : null}
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
          {onDelete && canModify && user?.role === 'admin' && (
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

      {showTimePopup && isOwnVenue && createPortal(
        <>
          <div className="time-popup-backdrop" onClick={() => setShowTimePopup(false)} />
          <div
            className="time-popup"
            style={{ top: popupPos.top, left: popupPos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="time-popup-row"><span className="time-popup-label">{t('Assembly')}</span><span>{formatTime12(event.time) || '\u2014'}</span></div>
            <div className="time-popup-row"><span className="time-popup-label">{t('Decor')}</span><span>{formatTime12(event.decor_time) || '\u2014'}</span></div>
            <div className="time-popup-row"><span className="time-popup-label">{t('Chaat')}</span><span>{formatTime12(event.chaat_time) || '\u2014'}</span></div>
            <div className="time-popup-row"><span className="time-popup-label">{t('Baraat')}</span><span>{formatTime12(event.baraat_time) || '\u2014'}</span></div>
            <div className="time-popup-row"><span className="time-popup-label">{t('Wind Up')}</span><span>{formatTime12(event.wind_up_time) || '\u2014'}{event.wind_up_next_day && <span className="next-day-badge">+1</span>}</span></div>
            <div className="time-popup-row"><span className="time-popup-label">{t('Varmala')}</span><span>{formatTime12(event.varmala_time) || '\u2014'}</span></div>
            <div className="time-popup-row"><span className="time-popup-label">{t('Pheras')}</span><span>{formatTime12(event.pheras_time) || '\u2014'}{event.pheras_next_day && <span className="next-day-badge">+1</span>}</span></div>
          </div>
        </>,
        document.body
      )}

      <div className="event-card-details" aria-hidden={!expanded}>
        <div className="event-card-details-inner">
          {/* External venue fields (ADD/AC/AEE/Tender) */}
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

          {/* ── Venue section (own-venue only) ── */}
          {isOwnVenue && <div className="detail-section-heading">{t('Venue')}</div>}
          {event.sub_venue && (
            <div className="detail-row"><span className="k">{t('Sub-venue')}</span><span className="v">{t(event.sub_venue)}</span></div>
          )}
          {event.booking_status && (
            <div className="detail-row"><span className="k">{t('Package Type')}</span><span className="v">{t(event.booking_status)}</span></div>
          )}
          {event.fp_status && (
            <div className="detail-row"><span className="k">{t('FP Status')}</span><span className="v">{t(event.fp_status)}</span></div>
          )}
          {event.rooms != null && event.rooms !== '' && (
            <div className="detail-row"><span className="k">{t('Rooms')}</span><span className="v">{event.rooms}</span></div>
          )}
          {isOwnVenue && (
            <div className="detail-row"><span className="k">{t('Liquor')}</span><span className="v">{event.liquor ? t('Yes') : t('No')}</span></div>
          )}
          {event.menu_type && (
            <div className="detail-row"><span className="k">{t('Menu Type')}</span><span className="v">{t(event.menu_type)}</span></div>
          )}
          {event.menu_cat && (
            <div className="detail-row"><span className="k">{t('Menu Category')}</span><span className="v">{t(event.menu_cat)}</span></div>
          )}
          {event.delivery_person && (
            <div className="detail-row"><span className="k">{t('Delivery Person')}</span><span className="v">{event.delivery_person}</span></div>
          )}
          {isOwnVenue && (event.payment_remaining_venue != null && event.payment_remaining_venue !== '') && (
            <div className="detail-row detail-payment">
              <span className="k">{t('Pending Payment')}</span>
              <div className="v payment-val">
                <span>{event.payment_remaining_venue}%</span>
                <div className="payment-bar">
                  <div
                    className={`payment-bar-fill ${getPaymentColor(event.payment_remaining_venue)}`}
                    style={{ width: `${event.payment_remaining_venue}%` }}
                  />
                </div>
              </div>
            </div>
          )}
          {isOwnVenue && event.payment_timing && (
            <div className="detail-row"><span className="k">{t('Payment Status')}</span><span className="v">{t(event.payment_timing)}</span></div>
          )}
          {event.operation_manager && (
            <div className="detail-row"><span className="k">{t('F&B Service Manager')}</span><span className="v">{event.operation_manager}</span></div>
          )}
          {isOwnVenue && event.guest_category && (
            <div className="detail-row"><span className="k">{t('Guest Category')}</span><span className="v">{t(event.guest_category)}</span></div>
          )}
          {isOwnVenue && event.status && (
            <div className="detail-row"><span className="k">{t('Status')}</span><span className="v">{t(event.status)}</span></div>
          )}

          {/* ── Decor section ── */}
          {isOwnVenue && (event.decor_status || event.function_category || (event.payment_remaining_decor != null && event.payment_remaining_decor !== '') || event.decor_delivery_person || event.decor_operation_manager) && (
            <div className="detail-section-heading">{t('Decor')}</div>
          )}
          {event.decor_status && (
            <div className="detail-row"><span className="k">{t('Decor Status')}</span><span className="v">{t(event.decor_status)}</span></div>
          )}
          {event.function_category && (
            <div className="detail-row"><span className="k">{t('Decor Category')}</span><span className="v">{t(event.function_category)}</span></div>
          )}
          {(event.payment_remaining_decor != null && event.payment_remaining_decor !== '') && (
            <div className="detail-row detail-payment">
              <span className="k">{t('Pending Payment')}</span>
              <div className="v payment-val">
                <span>{event.payment_remaining_decor}%</span>
                <div className="payment-bar">
                  <div
                    className={`payment-bar-fill ${getPaymentColor(event.payment_remaining_decor)}`}
                    style={{ width: `${event.payment_remaining_decor}%` }}
                  />
                </div>
              </div>
            </div>
          )}
          {event.decor_delivery_person && (
            <div className="detail-row"><span className="k">{t('Delivery Person')}</span><span className="v">{event.decor_delivery_person}</span></div>
          )}
          {event.decor_operation_manager && (
            <div className="detail-row"><span className="k">{t('Operation Manager')}</span><span className="v">{event.decor_operation_manager}</span></div>
          )}

          {/* ── Entertainment section ── */}
          {isOwnVenue && (event.entertainment_status || (Array.isArray(event.elements) && event.elements.length > 0) || (event.payment_remaining_ent != null && event.payment_remaining_ent !== '') || event.ent_delivery_person) && (
            <div className="detail-section-heading">{t('Entertainment')}</div>
          )}
          {event.entertainment_status && (
            <div className="detail-row"><span className="k">{t('Entertainment Status')}</span><span className="v">{t(event.entertainment_status)}</span></div>
          )}
          {Array.isArray(event.elements) && event.elements.length > 0 && (
            <div className="detail-row detail-elements">
              <span className="k">{t('Elements')}</span>
              <div className="v element-chips">
                {event.elements.map((el) => (
                  <span key={el} className="element-chip">{getElementLabel(el, lang, elementLabels)}</span>
                ))}
              </div>
            </div>
          )}
          {(event.payment_remaining_ent != null && event.payment_remaining_ent !== '') && (
            <div className="detail-row detail-payment">
              <span className="k">{t('Pending Payment')}</span>
              <div className="v payment-val">
                <span>{event.payment_remaining_ent}%</span>
                <div className="payment-bar">
                  <div
                    className={`payment-bar-fill ${getPaymentColor(event.payment_remaining_ent)}`}
                    style={{ width: `${event.payment_remaining_ent}%` }}
                  />
                </div>
              </div>
            </div>
          )}
          {event.ent_delivery_person && (
            <div className="detail-row"><span className="k">{t('Delivery Person')}</span><span className="v">{event.ent_delivery_person}</span></div>
          )}

          {/* Villa fields */}
          {event.pool_included && (
            <div className="detail-row"><span className="k">{t('Pool Included')}</span><span className="v">{t(event.pool_included)}</span></div>
          )}
          {event.meal_included && (
            <div className="detail-row"><span className="k">{t('Meal Included')}</span><span className="v">{t(event.meal_included)}</span></div>
          )}
          {event.added_service && (
            <div className="detail-row"><span className="k">{t('Added Service')}</span><span className="v">{event.added_service}</span></div>
          )}

          {/* ── Payment (non-own-venue categories) ── */}
          {!isOwnVenue && (event.payment_remaining_venue != null && event.payment_remaining_venue !== '') && (
            <div className="detail-row detail-payment">
              <span className="k">{t('Pending Payment %')}</span>
              <div className="v payment-val">
                <span>{event.payment_remaining_venue}%</span>
                <div className="payment-bar">
                  <div
                    className={`payment-bar-fill ${getPaymentColor(event.payment_remaining_venue)}`}
                    style={{ width: `${event.payment_remaining_venue}%` }}
                  />
                </div>
              </div>
            </div>
          )}
          {!isOwnVenue && event.payment_timing && (
            <div className="detail-row"><span className="k">{t('Payment Status')}</span><span className="v">{t(event.payment_timing)}</span></div>
          )}

          {!isOwnVenue && event.status && (
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

function getPaymentColor(pct) {
  const n = Number(pct)
  if (n <= 30) return 'payment-green'
  if (n <= 60) return 'payment-yellow'
  return 'payment-red'
}

function buildPrimary(event, formatShortDate, t) {
  if (event.venue_id === 'tender') {
    return joinPipes([event.tender_name, event.event_type_text, event.venue_name])
  }
  if (event.venue_id === 'villa') {
    return joinPipes([
      event.guest_name,
      event.sub_venue ? t(event.sub_venue) : null,
      formatShortDate(event.check_in_date),
    ])
  }
  return joinPipes([
    event.guest_name,
    event.event_type === 'Other' ? event.event_type_other : (event.event_type ? t(event.event_type) : null),
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
