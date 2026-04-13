import { useEffect, useMemo, useState } from 'react'
import { VENUES, VENUE_BY_ID } from '../config/venues.js'
import { getFormConfig, getAllFields, isFieldRequired } from '../config/formFields.js'
import { autoTitle } from '../lib/autoTitle.js'
import { createEvent, updateEvent, deleteEvent } from '../lib/events.js'
import Field from './Field.jsx'

// Fields we manage directly (id/bookkeeping), never as user inputs.
const SYSTEM_KEYS = new Set([
  'id', 'created_at', 'updated_at', 'source', 'crm_id', 'synced_at', 'title', 'venue_id',
])

function blankForm(venueId, defaults = {}) {
  return {
    venue_id: venueId,
    status: 'Confirmed',
    ...defaults,
  }
}

export default function BookingForm({ initial, onSaved, onDeleted, onClose }) {
  const editing = !!(initial && initial.id)

  const [venueId, setVenueId] = useState(() => initial?.venue_id ?? 'ap')
  const [form, setForm] = useState(() =>
    editing ? { ...initial } : blankForm(venueId)
  )
  // null = stay in auto-title mode; string = manual override
  const [manualTitle, setManualTitle] = useState(() =>
    editing && initial.title && initial.title !== autoTitle(initial) ? initial.title : null
  )
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const sections = useMemo(() => getFormConfig(venueId), [venueId])
  const computedTitle = useMemo(() => autoTitle({ ...form, venue_id: venueId }), [form, venueId])
  const displayTitle = manualTitle ?? computedTitle

  // When category switches, reset per-category fields and sub-venue.
  useEffect(() => {
    if (editing) return
    setForm((prev) => blankForm(venueId, {
      // carry over guest contact basics if the user already typed some
      guest_name: prev.guest_name,
      phone: prev.phone,
      notes: prev.notes,
    }))
    setErrors({})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId])

  const setField = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      // When booking_status transitions away from VMD, clear the VMD-only fields
      // so they don't travel as stale values on save.
      if (key === 'booking_status' && value !== 'VMD') {
        next.menu_type = ''
        next.menu_cat = ''
        next.fp_status = ''
      }
      // When event_type changes away from Other, wipe the override text.
      if (key === 'event_type' && value !== 'Other') {
        next.event_type_other = ''
      }
      return next
    })
    setErrors((prev) => {
      if (!prev[key]) return prev
      const { [key]: _gone, ...rest } = prev
      return rest
    })
  }

  const onTitleChange = (e) => setManualTitle(e.target.value)
  const resetTitle = () => setManualTitle(null)

  const validate = () => {
    const all = getAllFields(venueId)
    const nextErrors = {}
    for (const field of all) {
      if (!isFieldRequired(field, form)) continue
      const v = form[field.key]
      if (v === undefined || v === null || v === '') {
        nextErrors[field.key] = 'Required'
      }
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const buildPayload = () => {
    const all = getAllFields(venueId)
    const payload = {
      venue_id: venueId,
      title: (manualTitle ?? computedTitle) || 'Untitled',
      status: form.status || 'Confirmed',
    }
    for (const field of all) {
      if (field.disabledWhen && field.disabledWhen(form)) continue
      if (field.showWhen && !field.showWhen(form)) continue
      if (SYSTEM_KEYS.has(field.key)) continue
      const v = form[field.key]
      payload[field.key] = v === '' || v === undefined ? null : v
    }
    // Villa stores the check-in date as `date` for calendar placement.
    if (venueId === 'villa' && form.check_in_date) {
      payload.date = form.check_in_date
    }
    return payload
  }

  const onSave = async (e) => {
    e.preventDefault()
    setSubmitError(null)
    if (!validate()) return
    setSaving(true)
    try {
      const payload = buildPayload()
      const row = editing
        ? await updateEvent(initial.id, payload)
        : await createEvent(payload)
      onSaved?.(row)
    } catch (err) {
      console.error('[ambria] save failed', err)
      setSubmitError(err?.message ?? String(err))
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (!editing) return
    setSubmitError(null)
    setDeleting(true)
    try {
      await deleteEvent(initial.id)
      onDeleted?.(initial.id)
    } catch (err) {
      console.error('[ambria] delete failed', err)
      setSubmitError(err?.message ?? String(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <form className="booking-form" onSubmit={onSave} noValidate>
      <div className="form-header">
        <div className="form-title-row">
          <h2>{editing ? 'Edit booking' : 'New booking'}</h2>
          <button type="button" className="icon-btn form-close" onClick={onClose} aria-label="Close">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {!editing && (
          <div className="category-pills" role="tablist" aria-label="Category">
            {VENUES.map((v) => {
              const active = v.id === venueId
              return (
                <button
                  key={v.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`category-pill ${active ? 'active' : ''}`}
                  onClick={() => setVenueId(v.id)}
                  style={active ? { background: v.color, borderColor: v.color } : { borderColor: v.color }}
                >
                  <span
                    className="category-pill-dot"
                    style={{ background: active ? '#fff' : v.color }}
                  />
                  {v.short}
                </button>
              )
            })}
          </div>
        )}

        {editing && (
          <div className="editing-category">
            <span
              className="category-pill-dot"
              style={{ background: VENUE_BY_ID[venueId]?.color }}
            />
            <span>{VENUE_BY_ID[venueId]?.name}</span>
          </div>
        )}

        <div className="field title-field">
          <label htmlFor="booking-title" className="field-label">Title</label>
          <div className="title-input-row">
            <input
              id="booking-title"
              type="text"
              value={displayTitle}
              onChange={onTitleChange}
              placeholder="Auto-generated as you fill in fields"
            />
            {manualTitle !== null && (
              <button
                type="button"
                className="title-reset"
                onClick={resetTitle}
                aria-label="Reset to auto-title"
                title="Reset to auto-title"
              >
                ↻
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="form-body">
        {sections.map((section) => (
          <div key={section.title} className="form-section">
            <div className="form-section-title">{section.title}</div>
            <div className="form-grid">
              {section.fields.map((field) => (
                <Field
                  key={field.key}
                  field={field}
                  form={form}
                  value={form[field.key]}
                  onChange={setField}
                  error={errors[field.key]}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="form-footer">
        {submitError && <div className="form-error-banner">{submitError}</div>}
        {editing && (
          confirmDelete ? (
            <div className="confirm-delete">
              <span>Delete this booking?</span>
              <button
                type="button"
                className="btn-danger"
                onClick={onDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn-delete"
              onClick={() => setConfirmDelete(true)}
            >
              Delete booking
            </button>
          )
        )}
        <button
          type="submit"
          className="btn-save"
          disabled={saving}
        >
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Save booking'}
        </button>
      </div>
    </form>
  )
}
