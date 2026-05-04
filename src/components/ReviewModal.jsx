import { useState, useEffect, useRef } from 'react'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { fetchReview, upsertReview, canEditReview, getRatingFields, areRatingsOptional } from '../lib/reviews.js'
import { VENUE_BY_ID } from '../config/venues.js'

function StarRating({ value, onChange, readonly }) {
  const handleClick = (star) => {
    if (readonly) return
    if (value === star) {
      onChange(star - 1)
    } else {
      onChange(star)
    }
  }

  return (
    <div className="star-rating-row">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`star-btn ${star <= value ? 'star-filled' : 'star-empty'}${readonly ? ' star-readonly' : ''}`}
          onClick={() => handleClick(star)}
          disabled={readonly}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
        >
          <svg viewBox="0 0 24 24" className="star-svg">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
      ))}
    </div>
  )
}

export default function ReviewModal({ open, event, user, onClose, onReviewSaved }) {
  const { t, formatShortDate } = useLanguage()
  const [review, setReview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [form, setForm] = useState({})
  const [dragY, setDragY] = useState(0)
  const dragRef = useRef({ startY: 0, tracking: false })

  const ratingFields = event ? getRatingFields(event.venue_id) : []
  const canEdit = canEditReview(user, event)
  const isExistingReview = !!review

  useEffect(() => {
    if (!open || !event) return
    setLoading(true)
    setDragY(0)
    dragRef.current = { startY: 0, tracking: false }
    const fields = getRatingFields(event.venue_id)
    fetchReview(event.id)
      .then((r) => {
        setReview(r)
        if (r) {
          const f = { review_payment_status: r.review_payment_status, remark: r.remark || '' }
          for (const fd of fields) f[fd.key] = r[fd.key] || 0
          setForm(f)
        } else {
          const f = { review_payment_status: '', remark: '' }
          for (const fd of fields) f[fd.key] = 0
          setForm(f)
        }
      })
      .catch((err) => console.error('[ambria] fetch review failed', err))
      .finally(() => setLoading(false))
  }, [open, event?.id])

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
  const isCancelled = event.status === 'Cancelled'
  const showForm = canEdit

  const optionalRatings = event ? areRatingsOptional(event.venue_id) : false
  const isFormValid = form.review_payment_status &&
    (optionalRatings || ratingFields.every((f) => form[f.key] >= 1))

  const handleSubmit = async () => {
    if (!isFormValid || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      const data = await upsertReview({
        ...form,
        id: review?.id,
        event_id: event.id,
        event_title: event.title,
        _venueId: event.venue_id,
      }, user)
      setReview(data)
      onReviewSaved?.(event.id, data)
      onClose?.()
    } catch (err) {
      console.error('[ambria] save review failed', err)
      setSaveError(err?.message || String(err))
    } finally {
      setSaving(false)
    }
  }

  const setRating = (key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }))
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
    <div className="modal-root review-modal-root" role="dialog" aria-modal="true">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-sheet review-modal-sheet" style={sheetStyle}>
        <div
          className="modal-handle"
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
          aria-hidden="true"
        >
          <span className="modal-handle-bar" />
        </div>

        <div className="review-modal-content">
          {/* Header */}
          <div className="review-modal-header">
            <h3 className="review-modal-title">{event.title || t('Event Review')}</h3>
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
              <span>{formatShortDate(event.venue_id === 'villa' ? (event.check_in_date || event.date) : event.date)}</span>
              {event.sub_venue && <span>· {t(event.sub_venue)}</span>}
              {event.venue_name && event.venue_id === 'add' && <span>· {event.venue_name}</span>}
            </div>
          </div>

          {isCancelled && (
            <div className="review-cancelled-note">
              {t('This event was cancelled')}
            </div>
          )}

          {loading ? (
            <div className="review-loading">{t('Loading…')}</div>
          ) : showForm ? (
            /* ── Editable form ── */
            <div className="review-form">
              {/* Payment Status */}
              <div className="review-field">
                <label className="review-field-label">{t('Payment Status')} <span className="review-required">*</span></label>
                <select
                  className="review-select"
                  value={form.review_payment_status}
                  onChange={(e) => setForm((prev) => ({ ...prev, review_payment_status: e.target.value }))}
                >
                  <option value="">{t('— Select —')}</option>
                  <option value="Completed">{t('Completed')}</option>
                  <option value="Pending">{t('Pending')}</option>
                </select>
              </div>

              {/* Ratings — category-aware */}
              {ratingFields.map((f) => (
                <div key={f.key} className="review-rating-field">
                  <span className="review-rating-label">{t(f.label)} {!optionalRatings && <span className="review-required">*</span>}</span>
                  <StarRating
                    value={form[f.key] || 0}
                    onChange={(val) => setRating(f.key, val)}
                    readonly={false}
                  />
                </div>
              ))}

              {/* Remark */}
              <div className="review-field">
                <label className="review-field-label">{t('Remark')}</label>
                <textarea
                  className="review-textarea"
                  rows={3}
                  placeholder={t('Any additional comments about the event...')}
                  value={form.remark}
                  onChange={(e) => setForm((prev) => ({ ...prev, remark: e.target.value }))}
                />
              </div>

              {/* Error */}
              {saveError && (
                <div className="review-save-error">{saveError}</div>
              )}

              {/* Submit */}
              <button
                type="button"
                className="review-submit-btn"
                disabled={!isFormValid || saving}
                onClick={handleSubmit}
              >
                {saving ? t('Saving…') : isExistingReview ? t('Update Review') : t('Submit Review')}
              </button>
            </div>
          ) : isExistingReview ? (
            /* ── Read-only view ── */
            <div className="review-readonly">
              <div className="review-payment-row">
                <span className="review-field-label">{t('Payment Status')}</span>
                <span className={`review-payment-badge ${review.review_payment_status === 'Completed' ? 'review-badge-green' : 'review-badge-orange'}`}>
                  {t(review.review_payment_status)}
                </span>
              </div>

              {ratingFields
                .filter((f) => !optionalRatings || (review[f.key] != null && review[f.key] > 0))
                .map((f) => (
                <div key={f.key} className="review-rating-field">
                  <span className="review-rating-label">{t(f.label)}</span>
                  <StarRating value={review[f.key] || 0} readonly />
                </div>
              ))}

              {review.remark && (
                <div className="review-remark-section">
                  <span className="review-field-label">{t('Remark')}</span>
                  <p className="review-remark-text">{review.remark}</p>
                </div>
              )}

              <div className="review-submitted-by">
                {t('Submitted by {name} on {date}', {
                  name: review.submitted_by_name || t('Unknown'),
                  date: formatShortDate(review.submitted_at?.slice(0, 10)),
                })}
              </div>
            </div>
          ) : (
            /* ── No review yet, user can't submit ── */
            <div className="review-empty-msg">
              {t('No review yet. The delivery person or sales person assigned to this event can submit a review.')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
