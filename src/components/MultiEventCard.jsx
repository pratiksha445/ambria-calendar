// One card for a guest's several functions at one of our own venues on the
// same day and lawn (see lib/multiEvent.js), laid out like the ADD / AC / AEE
// Multi-Event card: "Event 1 / Event 2" rows, then one Venue / Decor /
// Entertainment section. A value that differs between the functions is shown
// per function ("Haldi: Veg · Sangeet: Non-Veg").
// Each function is still its own booking, so Edit / Review are per function.

import { memo } from 'react'
import { VENUE_BY_ID, SHIFT_BADGE, getSubVenueStyle } from '../config/venues.js'
import { formatTime12 } from '../lib/dates.js'
import { canAccessBooking } from '../lib/sectionPermissions.js'
import { isReviewable, isPastEvent } from '../lib/reviews.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'

const blank = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0)

function funcName(e, t) {
  if (e.event_type === 'Other') return e.event_type_other || t('Other')
  return e.event_type ? t(e.event_type) : (e.shift ? t(e.shift) : t('Event'))
}

function paymentColor(pct) {
  const n = Number(pct)
  return n <= 30 ? 'payment-green' : n <= 60 ? 'payment-yellow' : 'payment-red'
}

export default memo(function MultiEventCard({ events, expanded = false, onToggle, onEdit, user, reviewMap, onReview }) {
  const { t, formatShortDate } = useLanguage()
  const first = events[0]
  const venue = VENUE_BY_ID[first.venue_id]
  // Lawn colour (AE Valencia grey, Aura brown …), same as a single card;
  // every function in a group shares the lawn
  const aeStyle = getSubVenueStyle(first)
  const guest = events.map((e) => e.guest_name).find(Boolean) || ''
  const totalPax = events.reduce((sum, e) => sum + (Number(e.pax) || 0), 0)
  const firstTime = events.map((e) => e.time).find(Boolean)
  const sales = [...new Set(events.map((e) => e.sales_person).filter(Boolean))].join(', ')
  const primary = [guest, `${t('Multi-Event')} (${events.length})`, totalPax ? `${totalPax}pax` : null].filter(Boolean).join(' | ')
  const allFilled = (k) => events.every((e) => !blank(e[k]))

  /** One detail row: shown once when every function agrees, else per function */
  const row = (label, get, render = (v) => v) => {
    const vals = events.map(get)
    if (vals.every(blank)) return null
    const same = vals.every((v) => String(v ?? '') === String(vals[0] ?? ''))
    return (
      <div className="detail-row" key={label}>
        <span className="k">{t(label)}</span>
        <span className="v">
          {same ? render(vals[0]) : events.map((e, i) => (
            <span key={e.id} className="multi-event-split">{funcName(e, t)}: {blank(vals[i]) ? '—' : render(vals[i])}</span>
          ))}
        </span>
      </div>
    )
  }
  const pct = (v) => (
    <span className="payment-val">
      <span>{v}%</span>
      <span className="payment-bar"><span className={`payment-bar-fill ${paymentColor(v)}`} style={{ width: `${100 - Number(v)}%`, display: 'block' }} /></span>
    </span>
  )
  const any = (...keys) => events.some((e) => keys.some((k) => !blank(e[k])))

  return (
    <article
      className={`event-card multi-event-card ${expanded ? 'expanded' : ''}`}
      style={{ borderLeftColor: aeStyle?.color === '#1A1A1A' ? aeStyle.background : (venue?.color ?? '#ccc') }}
    >
      <div className="event-card-compact">
        <button type="button" className="event-card-row" onClick={onToggle} aria-expanded={expanded}>
          <span className="event-venue-badge" style={{ background: aeStyle?.background ?? venue?.color ?? '#ccc', color: aeStyle?.color ?? venue?.textColor ?? '#fff' }}>
            {venue?.short ?? '?'}
          </span>
          <div className="event-card-stack">
            <span className="event-primary">{primary}</span>
            <div className="event-card-meta">
              {firstTime && <span className="event-time">{formatTime12(firstTime)}</span>}
              {events.map((e) => {
                const sb = e.shift ? SHIFT_BADGE[e.shift] : null
                return sb ? (
                  <span key={e.id} className="shift-badge" style={{ background: sb.color }} title={funcName(e, t)}>
                    {t(`shift_short_${e.shift}`)}
                  </span>
                ) : null
              })}
              {sales && <span className="event-sales">{sales}</span>}
            </div>
          </div>
          <div className="section-status-icons">
            <span className={`section-icon ${allFilled('decor_status') ? 'section-filled' : 'section-pending'}`} title={t(allFilled('decor_status') ? 'Decor filled' : 'Decor pending')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21a9 9 0 0 1 0 -18c4.97 0 9 3.582 9 8c0 1.06 -.474 2.078 -1.318 2.828a4.001 4.001 0 0 1 -2.682 1.172h-2.5a2 2 0 0 0 -1 3.75a1.3 1.3 0 0 1 -1 2.25" />
                <circle cx="8.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
                <circle cx="12.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
                <circle cx="16.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
              </svg>
            </span>
            <span className={`section-icon ${allFilled('entertainment_status') ? 'section-filled' : 'section-pending'}`} title={t(allFilled('entertainment_status') ? 'Entertainment filled' : 'Entertainment pending')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6" cy="17" r="3" />
                <circle cx="16" cy="17" r="3" />
                <polyline points="9 17 9 4 19 4 19 17" />
                <line x1="9" y1="8" x2="19" y2="8" />
              </svg>
            </span>
          </div>
        </button>
      </div>

      <div className="event-card-details" aria-hidden={!expanded}>
        <div className="event-card-details-inner">
          {/* Event 1 / Event 2 … — one line per function */}
          <div className="detail-slots">
            {events.map((e, i) => (
              <div key={e.id} className="detail-row detail-slot-row">
                <span className="k">{t('Event')} {i + 1}</span>
                <span className="v">
                  {[
                    funcName(e, t),
                    e.shift ? e.shift.charAt(0).toUpperCase() : null,
                    e.pax ? `${e.pax} pax` : null,
                    e.menu_type ? t(e.menu_type) : null,
                    e.menu_cat ? t(e.menu_cat) : null,
                    e.time ? formatTime12(e.time) : null,
                  ].filter(Boolean).join(' · ')}
                </span>
              </div>
            ))}
          </div>

          <div className="detail-section-heading">{t('Venue')}</div>
          {row('Sub-venue', (e) => e.sub_venue, (v) => t(v))}
          {row('Package Type', (e) => e.booking_status, (v) => t(v))}
          {row('FP Status', (e) => e.fp_status, (v) => t(v))}
          {row('Rooms', (e) => e.rooms)}
          {row('Comp. Plates', (e) => (e.complimentary_plates ? e.complimentary_plates : null))}
          {row('Liquor', (e) => (e.liquor ? 'Yes' : 'No'), (v) => t(v))}
          {row('Delivery Person', (e) => e.delivery_person)}
          {row('Pending Payment', (e) => e.payment_remaining_venue, pct)}
          {row('Payment Status', (e) => e.payment_timing, (v) => t(v))}
          {row('F&B Service Manager', (e) => e.operation_manager)}
          {row('Guest Category', (e) => e.guest_category, (v) => t(v))}
          {row('Reference Guest', (e) => e.reference_guest)}
          {row('Status', (e) => e.status, (v) => <span className={`status-badge status-${String(v).toLowerCase()}`}>{t(v)}</span>)}
          {row('Postponed From', (e) => e.postponed_from_date, (v) => formatShortDate(v))}
          {row('Dumping Date', (e) => e.setup_date, (v) => formatShortDate(v))}
          {row('Clearance Date', (e) => e.clearance_date, (v) => formatShortDate(v))}

          {any('decor_status', 'function_category', 'payment_remaining_decor', 'decor_delivery_person', 'decor_operation_manager') && (
            <div className="detail-section-heading">{t('Decor')}</div>
          )}
          {row('Decor Status', (e) => e.decor_status, (v) => t(v))}
          {row('Decor Category', (e) => e.function_category, (v) => t(v))}
          {row('Pending Payment', (e) => e.payment_remaining_decor, pct)}
          {row('Delivery Person', (e) => e.decor_delivery_person)}
          {row('Operation Manager', (e) => e.decor_operation_manager)}

          {any('entertainment_status', 'payment_remaining_ent', 'ent_delivery_person') && (
            <div className="detail-section-heading">{t('Entertainment')}</div>
          )}
          {row('Entertainment Status', (e) => e.entertainment_status, (v) => t(v))}
          {row('Pending Payment', (e) => e.payment_remaining_ent, pct)}
          {row('Delivery Person', (e) => e.ent_delivery_person)}

          {events.some((e) => e.notes) && (
            <div className="event-card-notes">
              <span className="k">{t('Notes')}</span>
              <span className="v">{events.filter((e) => e.notes).map((e) => `${funcName(e, t)}: ${e.notes}`).join('\n')}</span>
            </div>
          )}

          {/* Each function is its own booking: Edit / Review per function */}
          <div className="event-card-actions multi-event-actions">
            {events.map((e) => {
              const canEdit = onEdit && canAccessBooking(user, e) && !isPastEvent(e)
              const reviewable = isReviewable(e)
              return (
                <span key={e.id} className="multi-event-action-group">
                  {canEdit && (
                    <button type="button" className="event-edit-btn" onClick={(ev) => { ev.stopPropagation(); onEdit(e) }}>
                      {e.source === 'manual' ? t('Edit') : t('View')} · {funcName(e, t)}
                    </button>
                  )}
                  {reviewable && (
                    <button
                      type="button"
                      className={`event-review-btn ${reviewMap?.has(e.id) ? 'review-btn-muted' : 'review-btn-accent'}`}
                      onClick={(ev) => { ev.stopPropagation(); onReview?.(e) }}
                    >
                      {reviewMap?.has(e.id) ? t('View Review') : t('Add Review')} · {funcName(e, t)}
                    </button>
                  )}
                </span>
              )
            })}
          </div>
        </div>
      </div>
    </article>
  )
})
