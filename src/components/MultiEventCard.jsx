// One card for a guest's several functions at one of our own venues on one
// day (see lib/multiEvent.js). Collapsed: "Guest | Multi-Event (2)" with a
// shift badge per function. Expanded: each function's own EventCard, so edit,
// delete, review and payment work per function exactly as before.

import { memo, useState } from 'react'
import { VENUE_BY_ID, SHIFT_BADGE } from '../config/venues.js'
import { formatTime12 } from '../lib/dates.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import EventCard from './EventCard.jsx'

export default memo(function MultiEventCard({ events, expanded = false, onToggle, onEdit, onDelete, user, reviewMap, onReview, onPayment }) {
  const { t } = useLanguage()
  const [openId, setOpenId] = useState(null)
  const first = events[0]
  const venue = VENUE_BY_ID[first.venue_id]
  const guest = events.map((e) => e.guest_name).find(Boolean) || ''
  const totalPax = events.reduce((sum, e) => sum + (Number(e.pax) || 0), 0)
  const firstTime = events.map((e) => e.time).find(Boolean)
  const sales = [...new Set(events.map((e) => e.sales_person).filter(Boolean))].join(', ')
  const primary = [guest, `${t('Multi-Event')} (${events.length})`, totalPax ? `${totalPax}pax` : null].filter(Boolean).join(' | ')

  return (
    <article
      className={`event-card multi-event-card ${expanded ? 'expanded' : ''}`}
      style={{ borderLeftColor: venue?.color ?? '#ccc' }}
    >
      <div className="event-card-compact">
        <button type="button" className="event-card-row" onClick={onToggle} aria-expanded={expanded}>
          <span className="event-venue-badge" style={{ background: venue?.color ?? '#ccc', color: venue?.textColor ?? '#fff' }}>
            {venue?.short ?? '?'}
          </span>
          <div className="event-card-stack">
            <span className="event-primary">{primary}</span>
            <div className="event-card-meta">
              {firstTime && <span className="event-time">{formatTime12(firstTime)}</span>}
              {events.map((e) => {
                const sb = e.shift ? SHIFT_BADGE[e.shift] : null
                return sb ? (
                  <span key={e.id} className="shift-badge" style={{ background: sb.color }} title={e.event_type || ''}>
                    {t(`shift_short_${e.shift}`)}
                  </span>
                ) : null
              })}
              {sales && <span className="event-sales">{sales}</span>}
            </div>
          </div>
          <span className="multi-event-chevron" aria-hidden="true">{expanded ? '▴' : '▾'}</span>
        </button>
      </div>

      {expanded && (
        <div className="multi-event-children">
          {events.map((e) => (
            <EventCard
              key={e.id}
              event={e}
              expanded={openId === e.id}
              onToggle={() => setOpenId((prev) => (prev === e.id ? null : e.id))}
              onEdit={onEdit}
              onDelete={onDelete}
              user={user}
              reviewMap={reviewMap}
              onReview={onReview}
              onPayment={onPayment}
            />
          ))}
        </div>
      )}
    </article>
  )
})
