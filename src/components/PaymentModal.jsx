import { useState, useEffect, useRef } from 'react'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { VENUE_BY_ID } from '../config/venues.js'
import { isPaymentComplete, canMarkPayment, markPaymentComplete, fetchPaymentCompletion } from '../lib/payments.js'

export default function PaymentModal({ open, event, user, onClose, onPaymentSaved }) {
  const { t, formatShortDate } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [markComplete, setMarkComplete] = useState(false)
  const [remark, setRemark] = useState('')
  const [completion, setCompletion] = useState(null) // audit_log entry for who/when
  const [dragY, setDragY] = useState(0)
  const dragRef = useRef({ startY: 0, tracking: false })

  const completed = event ? isPaymentComplete(event) : false
  const canMark = canMarkPayment(user, event)

  useEffect(() => {
    if (!open || !event) return
    setLoading(true)
    setDragY(0)
    setMarkComplete(false)
    setRemark('')
    setSaveError(null)
    dragRef.current = { startY: 0, tracking: false }

    if (completed) {
      fetchPaymentCompletion(event.id)
        .then((data) => setCompletion(data))
        .finally(() => setLoading(false))
    } else {
      setCompletion(null)
      setLoading(false)
    }
  }, [open, event?.id, completed])

  // Escape to close
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Lock body scroll
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open || !event) return null

  const venue = VENUE_BY_ID[event.venue_id]
  const eventDate = event.venue_id === 'tender'
    ? (event.end_date || event.date)
    : event.date
  const title = event.venue_id === 'tender'
    ? (event.tender_name || event.guest_name || t('Event'))
    : (event.guest_name || t('Event'))

  const handleSave = async () => {
    if (!markComplete || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await markPaymentComplete(event.id, user, remark)
      onPaymentSaved?.(event.id, updated)
      onClose?.()
    } catch (err) {
      console.error('[ambria] payment save failed', err)
      setSaveError(err?.message || String(err))
    } finally {
      setSaving(false)
    }
  }

  // Drag to close
  const onHandleTouchStart = (e) => {
    dragRef.current = { startY: e.touches[0].clientY, tracking: true }
  }
  const onHandleTouchMove = (e) => {
    if (!dragRef.current.tracking) return
    const dy = e.touches[0].clientY - dragRef.current.startY
    setDragY(Math.max(0, dy))
  }
  const onHandleTouchEnd = () => {
    if (!dragRef.current.tracking) return
    dragRef.current.tracking = false
    if (dragY > 100) onClose?.()
    else setDragY(0)
  }

  const sheetStyle = dragY > 0 ? { transform: `translateY(${dragY}px)` } : undefined

  return (
    <div className="modal-root payment-modal-root" role="dialog" aria-modal="true">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-sheet payment-modal-sheet" style={sheetStyle}>
        <div
          className="modal-handle"
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
          aria-hidden="true"
        >
          <span className="modal-handle-bar" />
        </div>

        <div className="payment-modal-content">
          {/* Header */}
          <div className="review-modal-header">
            <h3 className="review-modal-title">{title}</h3>
            <button className="icon-btn review-modal-close" onClick={onClose} aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Event info */}
          <div className="review-event-info">
            <div className="review-event-meta">
              <span className="review-venue-badge" style={{ background: venue?.color ?? '#ccc', color: venue?.textColor ?? '#fff' }}>
                {venue?.short ?? '?'}
              </span>
              <span>{formatShortDate(eventDate)}</span>
              {event.venue_name && <span>· {event.venue_name}</span>}
            </div>
          </div>

          {loading ? (
            <div className="review-loading">{t('Loading...')}</div>
          ) : completed ? (
            /* ── Payment completed — read-only view ── */
            <div className="payment-completed-view">
              <div className="payment-completed-badge">
                <span className="payment-completed-icon">&#10003;</span>
                <span className="payment-completed-text">{t('Payment Completed')}</span>
              </div>
              {completion && (
                <div className="review-reviewer-line">
                  {t('Marked by')} <strong>{completion.user_name}</strong>
                  {completion.created_at && (
                    <span className="review-reviewer-date"> · {formatShortDate(completion.created_at.slice(0, 10))}</span>
                  )}
                </div>
              )}
              {completion?.details?.remark && (
                <div className="payment-remark-section">
                  <span className="review-field-label">{t('Remark')}</span>
                  <p className="review-remark-text">{completion.details.remark}</p>
                </div>
              )}
            </div>
          ) : canMark ? (
            /* ── Payment form ── */
            <div className="review-form">
              {/* Current payment info — read-only */}
              <div className="payment-info-row">
                <span className="review-field-label">{t('Pending Payment')}</span>
                <span className="payment-info-value">{event.payment_remaining_venue ?? '—'}%</span>
              </div>
              <div className="payment-info-row">
                <span className="review-field-label">{t('Payment Status')}</span>
                <span className="payment-info-value">{event.payment_timing ? t(event.payment_timing) : '—'}</span>
              </div>

              {/* Mark complete toggle */}
              <label className="payment-toggle-row">
                <input
                  type="checkbox"
                  checked={markComplete}
                  onChange={(e) => setMarkComplete(e.target.checked)}
                  className="payment-checkbox"
                />
                <span className="payment-toggle-label">{t('Mark Payment Complete')}</span>
              </label>

              {/* Remark */}
              <div className="review-field">
                <label className="review-field-label">{t('Remark')}</label>
                <textarea
                  className="review-textarea"
                  rows={3}
                  placeholder={t('Any notes about the payment...')}
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                />
              </div>

              {saveError && (
                <div className="review-save-error">{saveError}</div>
              )}

              <button
                type="button"
                className="review-submit-btn"
                disabled={!markComplete || saving}
                onClick={handleSave}
              >
                {saving ? t('Saving...') : t('Save')}
              </button>
            </div>
          ) : (
            /* ── No permission ── */
            <div className="review-empty-msg">
              {completed ? t('Payment Completed') : t('Payment pending')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
