import { memo, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { VENUE_BY_ID, SHIFT_BADGE, getSubVenueStyle } from '../config/venues.js'
import { formatTime12 } from '../lib/dates.js'
import { canAccessBooking } from '../lib/sectionPermissions.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { loadElementLabels, getElementLabel } from '../lib/elements.js'
import { isReviewable, isPastEvent, getQuickRating } from '../lib/reviews.js'
import { isPastPaymentEvent, isPaymentComplete } from '../lib/payments.js'

const OWN_VENUES = new Set(['ap', 'am', 'ae', 'ar'])

function isSectionFilled(val) { return val != null && val !== '' }

function getSortedSlots(event) {
  if (!Array.isArray(event.event_slots) || event.event_slots.length <= 1) return null
  return [...event.event_slots].sort((a, b) => {
    if (!a.time && !b.time) return 0
    if (!a.time) return 1
    if (!b.time) return -1
    return a.time.localeCompare(b.time)
  })
}

export default memo(function EventCard({ event, expanded = false, onToggle, onEdit, onDelete, user, reviewMap, onReview, onPayment }) {
  const { t, lang, formatShortDate } = useLanguage()
  const [elementLabels, setElementLabels] = useState({})
  const venue = VENUE_BY_ID[event.venue_id]
  const aeStyle = getSubVenueStyle(event)
  const isMultiEvent = Array.isArray(event.event_slots) && event.event_slots.length > 1
  const sortedSlots = isMultiEvent ? getSortedSlots(event) : null
  const earliestTime = sortedSlots?.[0]?.time
  const shiftBadge = !isMultiEvent && event.shift ? SHIFT_BADGE[event.shift] : null
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

  const isCancelled = event.status === 'Cancelled'
  const isPostponed = event.status === 'Postponed'
  const past = isPastEvent(event)
  const reviewableEvent = isReviewable(event)
  const paymentEvent = isPastPaymentEvent(event)
  const paymentDone = paymentEvent && isPaymentComplete(event)

  const handleCardClick = () => {
    if (past && reviewableEvent) {
      onReview?.(event)
    } else if (paymentEvent) {
      onPayment?.(event)
    } else {
      onToggle?.()
    }
  }

  return (
    <article
      className={`event-card ${expanded ? 'expanded' : ''}${isCancelled ? ' cancelled' : ''}${isPostponed ? ' postponed' : ''}`}
      style={{ borderLeftColor: aeStyle?.color === '#1A1A1A' ? aeStyle.background : (venue?.color ?? '#ccc') }}
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
            onClick={handleCardClick}
            aria-expanded={expanded}
          >
            <span
              className="event-venue-badge"
              style={{ background: aeStyle?.background ?? venue?.color ?? '#ccc', color: aeStyle?.color ?? venue?.textColor ?? '#fff' }}
            >
              {venue?.short ?? '?'}
            </span>

            <div className="event-card-stack">
              <span className="event-primary">{primary}</span>
              <div className="event-card-meta">
                {isMultiEvent && earliestTime ? (
                  <span className="event-time event-time-tap" onClick={openTimePopup}>
                    {formatTime12(earliestTime)}<span className="time-expand-hint">&#9662;</span>
                  </span>
                ) : event.time && isOwnVenue ? (
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
                {event.venue_id === 'tender' && event.pax != null && event.pax !== '' && (
                  <span className="event-pax">{event.pax} pax</span>
                )}
                {event.sales_person && (
                  <span className="event-sales">{event.sales_person}</span>
                )}
                <span
                  className={`source-dot ${event.source}`}
                  aria-label={event.source === 'crm' ? t('CRM') : t('Manual')}
                  title={event.source === 'crm' ? t('CRM') : t('Manual')}
                />
                {isReviewable(event) && (
                  reviewMap?.has(event.id)
                    ? <span className="review-indicator review-done" title={t('Reviewed')} role="button" onClick={(e) => { e.stopPropagation(); onReview?.(event) }}>&#10003;</span>
                    : <span className="review-indicator review-pending" title={t('Review pending')} role="button" onClick={(e) => { e.stopPropagation(); onReview?.(event) }}>&#9203;</span>
                )}
                {paymentEvent && (
                  paymentDone
                    ? <span className="review-indicator review-done" title={t('Payment Completed')} role="button" onClick={(e) => { e.stopPropagation(); onPayment?.(event) }}>&#10003;</span>
                    : <span className="review-indicator review-pending" title={t('Payment pending')} role="button" onClick={(e) => { e.stopPropagation(); onPayment?.(event) }}>&#9203;</span>
                )}
              </div>
            </div>
            {isOwnVenue && (
              <div className="section-status-icons">
                <span
                  className={`section-icon ${isSectionFilled(event.decor_status) ? 'section-filled' : 'section-pending'}`}
                  title={isSectionFilled(event.decor_status) ? t('Decor filled') : t('Decor pending')}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 21a9 9 0 0 1 0 -18c4.97 0 9 3.582 9 8c0 1.06 -.474 2.078 -1.318 2.828a4.001 4.001 0 0 1 -2.682 1.172h-2.5a2 2 0 0 0 -1 3.75a1.3 1.3 0 0 1 -1 2.25" />
                    <circle cx="8.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
                    <circle cx="12.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
                    <circle cx="16.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
                  </svg>
                </span>
                <span
                  className={`section-icon ${isSectionFilled(event.entertainment_status) ? 'section-filled' : 'section-pending'}`}
                  title={isSectionFilled(event.entertainment_status) ? t('Entertainment filled') : t('Entertainment pending')}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="6" cy="17" r="3" />
                    <circle cx="16" cy="17" r="3" />
                    <polyline points="9 17 9 4 19 4 19 17" />
                    <line x1="9" y1="8" x2="19" y2="8" />
                  </svg>
                </span>
              </div>
            )}
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
            <div className="time-popup-row"><span className="time-popup-label">{t('Function Start')}</span><span>{formatTime12(event.time) || '\u2014'}</span></div>
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

      {showTimePopup && isMultiEvent && sortedSlots && createPortal(
        <>
          <div className="time-popup-backdrop" onClick={() => setShowTimePopup(false)} />
          <div
            className="time-popup"
            style={{ top: popupPos.top, left: popupPos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            {sortedSlots.map((slot, i) => {
              const sb = slot.shift ? SHIFT_BADGE[slot.shift] : null
              const type = slot.event_type === 'Other' ? (slot.event_type_other || '') : (slot.event_type || '')
              return (
                <div key={i} className="time-popup-row slot-time-row">
                  {sb ? (
                    <span className="slot-shift-dot" style={{ background: sb.color }}>{sb.short}</span>
                  ) : (
                    <span className="slot-shift-dot slot-shift-empty" />
                  )}
                  <span className="slot-time-val">{formatTime12(slot.time) || '\u2014'}</span>
                  <span className="slot-type-label">{type}</span>
                </div>
              )
            })}
          </div>
        </>,
        document.body
      )}

      <div className="event-card-details" aria-hidden={!expanded}>
        <div className="event-card-details-inner">
          {!isReviewable(event) && <>
          {/* External venue fields (Tender/WS — ADD/AC/AEE venue shown in title) */}
          {event.venue_name && event.venue_id !== 'add' && event.venue_id !== 'ac' && event.venue_id !== 'aee' && (
            <div className="detail-row"><span className="k">{t('Venue')}</span><span className="v">{event.venue_name}</span></div>
          )}
          {event.venue_type && (
            <div className="detail-row"><span className="k">{t('Type')}</span><span className="v">{t(event.venue_type)}</span></div>
          )}
          {(event.venue_id === 'ac' || event.venue_id === 'add') && event.site_availability && (
            <div className="detail-row">
              <span className="k">{t('Site Availability')}</span>
              <span className="v">{event.site_availability === 'Others' ? (event.site_availability_other || t('Others')) : t(event.site_availability)}</span>
            </div>
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
          {/* ── Tender-specific detail rows ── */}
          {event.venue_id === 'tender' && event.date && (
            <div className="detail-row"><span className="k">{t('Start Date')}</span><span className="v">{formatShortDate(event.date)}</span></div>
          )}
          {event.venue_id === 'tender' && event.end_date && (
            <div className="detail-row"><span className="k">{t('End Date')}</span><span className="v">{formatShortDate(event.end_date)}</span></div>
          )}
          {event.venue_id === 'tender' && (event.event_type || event.event_type_text) && (
            <div className="detail-row">
              <span className="k">{t('Event Type')}</span>
              <span className="v">{event.event_type === 'Other' ? (event.event_type_other || 'Other') : (event.event_type ? t(event.event_type) : event.event_type_text)}</span>
            </div>
          )}
          {event.venue_id === 'tender' && event.pax != null && event.pax !== '' && (
            <div className="detail-row"><span className="k">{t('Pax')}</span><span className="v">{event.pax}</span></div>
          )}
          {event.venue_id === 'tender' && event.tender_name && (
            <div className="detail-row"><span className="k">{t('Tender Name')}</span><span className="v">{event.tender_name}</span></div>
          )}
          {event.venue_id === 'tender' && event.phone && (
            <div className="detail-row"><span className="k">{t('Phone')}</span><span className="v">{event.phone}</span></div>
          )}
          {event.venue_id === 'tender' && event.sales_person && (
            <div className="detail-row"><span className="k">{t('Sales Person')}</span><span className="v">{event.sales_person}</span></div>
          )}

          {/* Multi-event slot rows */}
          {Array.isArray(event.event_slots) && event.event_slots.length > 1 && (
            <div className="detail-slots">
              {event.event_slots.map((slot, i) => {
                const parts = [
                  slot.event_type === 'Other' ? slot.event_type_other : slot.event_type,
                  slot.shift ? slot.shift.charAt(0).toUpperCase() : null,
                  slot.pax ? `${slot.pax} pax` : null,
                ]
                if (event.venue_id === 'aee' && Array.isArray(slot.elements) && slot.elements.length > 0) {
                  parts.push(slot.elements.join(', '))
                }
                if (event.venue_id === 'add') {
                  if (slot.decor_type) parts.push(slot.decor_type)
                  if (slot.color_theme) parts.push(slot.color_theme)
                }
                if (event.venue_id === 'ac') {
                  if (slot.menu_type) parts.push(slot.menu_type)
                  if (slot.menu_cat) parts.push(slot.menu_cat)
                }
                return (
                  <div key={i} className="detail-row detail-slot-row">
                    <span className="k">{t('Event')} {i + 1}</span>
                    <span className="v">{parts.filter(Boolean).join(' · ')}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── ADD single-event: Decor Type, Color Theme ── */}
          {event.venue_id === 'add' && event.decor_type
            && !(Array.isArray(event.event_slots) && event.event_slots.length > 1) && (
            <div className="detail-row"><span className="k">{t('Decor Type')}</span><span className="v">{t(event.decor_type)}</span></div>
          )}
          {event.venue_id === 'add' && event.color_theme
            && !(Array.isArray(event.event_slots) && event.event_slots.length > 1) && (
            <div className="detail-row"><span className="k">{t('Color Theme')}</span><span className="v">{event.color_theme}</span></div>
          )}

          {/* ── Single-event pax for AC/ADD/AEE (multi-event shows per-slot) ── */}
          {(event.venue_id === 'ac' || event.venue_id === 'aee' || event.venue_id === 'add') && event.pax != null && event.pax !== ''
            && !(Array.isArray(event.event_slots) && event.event_slots.length > 1) && (
            <div className="detail-row"><span className="k">{t('Pax')}</span><span className="v">{event.pax}</span></div>
          )}
          {event.venue_id === 'aee' && Array.isArray(event.elements) && event.elements.length > 0
            && !(Array.isArray(event.event_slots) && event.event_slots.length > 1) && (
            <div className="detail-row detail-elements">
              <span className="k">{t('Elements')}</span>
              <div className="v element-chips">
                {event.elements.map((el) => (
                  <span key={el} className="element-chip">{getElementLabel(el, lang, elementLabels)}</span>
                ))}
              </div>
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
          {event.menu_type && !(event.venue_id === 'ac' && Array.isArray(event.event_slots) && event.event_slots.length > 1) && (
            <div className="detail-row"><span className="k">{t('Menu Type')}</span><span className="v">{t(event.menu_type)}</span></div>
          )}
          {event.menu_cat && !(event.venue_id === 'ac' && Array.isArray(event.event_slots) && event.event_slots.length > 1) && (
            <div className="detail-row"><span className="k">{t('Menu Category')}</span><span className="v">{t(event.menu_cat)}</span></div>
          )}
          {event.delivery_person && (
            <div className="detail-row"><span className="k">{t('Delivery Person')}</span><span className="v">{event.delivery_person}</span></div>
          )}
          {event.venue_id === 'ac' && event.service_head && (
            <div className="detail-row"><span className="k">{t('Service Head')}</span><span className="v">{event.service_head}</span></div>
          )}
          {event.venue_id === 'add' && event.execution_person && (
            <div className="detail-row"><span className="k">{t('Execution Person')}</span><span className="v">{event.execution_person}</span></div>
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
            <div className="detail-row"><span className="k">{t(event.venue_id === 'add' ? 'Operation Manager' : 'F&B Service Manager')}</span><span className="v">{event.operation_manager}</span></div>
          )}
          {event.guest_category && (
            <div className="detail-row"><span className="k">{t('Guest Category')}</span><span className="v">{t(event.guest_category)}</span></div>
          )}
          {isOwnVenue && event.status && (
            <div className="detail-row"><span className="k">{t('Status')}</span><span className="v"><span className={`status-badge status-${event.status.toLowerCase()}`}>{t(event.status)}</span></span></div>
          )}
          {isOwnVenue && event.postponed_from_date && (
            <div className="detail-row"><span className="k">{t('Postponed From')}</span><span className="v">{formatShortDate(event.postponed_from_date)}</span></div>
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
          {Array.isArray(event.elements) && event.elements.length > 0
            && !(event.venue_id === 'aee' && Array.isArray(event.event_slots) && event.event_slots.length > 1) && (
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
          {event.venue_id === 'villa' && event.event_type && (
            <div className="detail-row">
              <span className="k">{t('Event Type')}</span>
              <span className="v">{event.event_type === 'Other' ? (event.event_type_other || 'Other') : t(event.event_type)}</span>
            </div>
          )}
          {event.venue_id === 'villa' && event.airbnb && (
            <div className="detail-row"><span className="k">{t('Airbnb')}</span><span className="v"><span className="status-badge status-confirmed">{t('Airbnb')}</span></span></div>
          )}
          {event.venue_id === 'villa' && event.check_in_date && (
            <div className="detail-row">
              <span className="k">{t('Check-In')}</span>
              <span className="v">{formatShortDate(event.check_in_date)}{event.check_in_time ? ` · ${formatTime12(event.check_in_time)}` : ''}</span>
            </div>
          )}
          {event.venue_id === 'villa' && event.check_out_date && (
            <div className="detail-row">
              <span className="k">{t('Check-Out')}</span>
              <span className="v">{formatShortDate(event.check_out_date)}{event.check_out_time ? ` · ${formatTime12(event.check_out_time)}` : ''}</span>
            </div>
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
          {event.venue_id === 'villa' && (event.extra_bedding != null && event.extra_bedding !== '' && event.extra_bedding !== 0) && (
            <div className="detail-row"><span className="k">{t('Extra Bedding')}</span><span className="v">{event.extra_bedding}</span></div>
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
            <div className="detail-row"><span className="k">{t('Status')}</span><span className="v"><span className={`status-badge status-${event.status.toLowerCase()}`}>{t(event.status)}</span></span></div>
          )}
          {!isOwnVenue && event.postponed_from_date && (
            <div className="detail-row"><span className="k">{t('Postponed From')}</span><span className="v">{formatShortDate(event.postponed_from_date)}</span></div>
          )}
          {event.notes && (
            <div className="event-card-notes"><span className="k">{t('Notes')}</span><span className="v">{event.notes}</span></div>
          )}
          </>}

          {/* ── Review summary (completed reviewable events) ── */}
          {isReviewable(event) && reviewMap?.has(event.id) && (() => {
            const rev = reviewMap.get(event.id)
            const quickRating = getQuickRating(rev, event.venue_id)
            return (
              <div className="review-summary-section">
                <div className="detail-section-heading">{t('REVIEW')}</div>
                <div className="review-summary-row">
                  <span className="review-summary-label">{t('Overall')}</span>
                  <span className="review-summary-stars">
                    {[1,2,3,4,5].map((s) => (
                      <span key={s} className={`review-star-sm ${s <= quickRating ? 'star-gold' : 'star-grey'}`}>&#9733;</span>
                    ))}
                  </span>
                </div>
                <div className="review-summary-row">
                  <span className="review-summary-label">{t('Payment')}</span>
                  <span className={`review-payment-badge-sm ${rev.review_payment_status === 'Completed' ? 'review-badge-green' : 'review-badge-orange'}`}>
                    {t(rev.review_payment_status)}
                  </span>
                </div>
                <button
                  type="button"
                  className="review-full-link"
                  onClick={(e) => { e.stopPropagation(); onReview?.(event) }}
                >
                  {t('View full review')} &rarr;
                </button>
              </div>
            )
          })()}

          {onEdit && canModify && !past && (
            <div className="event-card-actions">
              <button
                type="button"
                className="event-edit-btn"
                onClick={(e) => { e.stopPropagation(); onEdit(event) }}
              >
                {event.source === 'manual' ? t('Edit') : t('View')}
              </button>
              {reviewableEvent && (
                <button
                  type="button"
                  className={`event-review-btn ${reviewMap?.has(event.id) ? 'review-btn-muted' : 'review-btn-accent'}`}
                  onClick={(e) => { e.stopPropagation(); onReview?.(event) }}
                >
                  {reviewMap?.has(event.id) ? t('View Review') : t('Add Review')}
                </button>
              )}
            </div>
          )}
          {/* Show review button when past or user can't edit the booking */}
          {reviewableEvent && !(onEdit && canModify && !past) && (
            <div className="event-card-actions">
              <button
                type="button"
                className={`event-review-btn ${reviewMap?.has(event.id) ? 'review-btn-muted' : 'review-btn-accent'}`}
                onClick={(e) => { e.stopPropagation(); onReview?.(event) }}
              >
                {reviewMap?.has(event.id) ? t('View Review') : t('Add Review')}
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
})

function getPaymentColor(pct) {
  const n = Number(pct)
  if (n <= 30) return 'payment-green'
  if (n <= 60) return 'payment-yellow'
  return 'payment-red'
}

function buildPrimary(event, formatShortDate, t) {
  if (event.venue_id === 'tender') {
    const etLabel = event.event_type === 'Other' ? event.event_type_other
      : (event.event_type || event.event_type_text || '')
    return joinPipes([
      event.tender_name,
      etLabel,
      event.pax ? `${event.pax}pax` : null,
      event.venue_name,
    ])
  }
  if (event.venue_id === 'villa') {
    const parts = [event.guest_name]
    if (event.sub_venue) parts.push(t(event.sub_venue))
    if (event.pax) parts.push(`${event.pax}pax`)
    if (event.airbnb) parts.push('AB')
    return parts.filter(Boolean).join(' | ')
  }
  // Multi-event external venue bookings
  if (Array.isArray(event.event_slots) && event.event_slots.length > 1) {
    return joinPipes([event.guest_name, 'Multi-Event', event.venue_name])
  }
  // ADD/AC/AEE single-event: Name | EventType | VenueName (no pax, no menu_cat)
  if (event.venue_id === 'add' || event.venue_id === 'ac' || event.venue_id === 'aee') {
    return joinPipes([
      event.guest_name,
      event.event_type === 'Other' ? event.event_type_other : (event.event_type ? t(event.event_type) : null),
      event.venue_name,
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
