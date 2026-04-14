import { useEffect, useMemo, useState } from 'react'
import { VENUES, VENUE_BY_ID } from '../config/venues.js'
import {
  getFormConfig, getAllFields, isFieldRequired,
  FIELD_MAP, ALL_SAVEABLE_KEYS, STATUSES,
} from '../config/formFields.js'
import { autoTitle } from '../lib/autoTitle.js'
import { sanitizeText, sanitizePhone, sanitizePax } from '../lib/sanitize.js'
import { createEvent, updateEvent, deleteEvent } from '../lib/events.js'
import Field from './Field.jsx'

function blankForm(venueId, defaults = {}) {
  return {
    venue_id: venueId,
    status: 'Confirmed',
    ...defaults,
  }
}

export default function BookingForm({ initial, onSaved, onDeleted, onClose }) {
  const editing = !!(initial && initial.id)
  const readOnly = editing && initial?.source !== 'manual'

  const [venueId, setVenueId] = useState(() => initial?.venue_id ?? 'ap')
  const [form, setForm] = useState(() =>
    editing ? { ...initial } : blankForm(venueId)
  )
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
      if (key === 'booking_status' && value !== 'VMD') {
        next.menu_type = ''
        next.menu_cat = ''
        next.fp_status = ''
      }
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
      if (field.showWhen && !field.showWhen(form)) continue
      if (field.disabledWhen && field.disabledWhen(form)) continue

      const v = form[field.key]

      if (isFieldRequired(field, form) && (v === undefined || v === null || v === '')) {
        nextErrors[field.key] = 'Required'
        continue
      }

      // Dropdown validation — reject values not in the options list
      if (field.type === 'select' && field.options && v && v !== '') {
        if (!field.options.includes(v)) {
          nextErrors[field.key] = 'Invalid selection'
        }
      }
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const buildPayload = () => {
    const validKeys = new Set(FIELD_MAP[venueId] || [])
    const all = getAllFields(venueId)

    const payload = {
      venue_id: venueId,
      title: sanitizeText((manualTitle ?? computedTitle) || 'Untitled', 'title'),
      status: STATUSES.includes(form.status) ? form.status : 'Confirmed',
    }

    // Field parity: iterate every saveable key, include or null out.
    for (const key of ALL_SAVEABLE_KEYS) {
      if (!validKeys.has(key)) {
        payload[key] = null
        continue
      }

      const fieldDef = all.find((f) => f.key === key)
      if (fieldDef) {
        if (fieldDef.disabledWhen && fieldDef.disabledWhen(form)) {
          payload[key] = null
          continue
        }
        if (fieldDef.showWhen && !fieldDef.showWhen(form)) {
          payload[key] = null
          continue
        }
      }

      const raw = form[key]
      if (key === 'phone') {
        payload[key] = sanitizePhone(raw)
      } else if (key === 'pax') {
        payload[key] = sanitizePax(raw)
      } else if (fieldDef && (fieldDef.type === 'date' || fieldDef.type === 'time' || fieldDef.type === 'select')) {
        payload[key] = raw || null
      } else {
        payload[key] = sanitizeText(raw, key)
      }
    }

    // Villa stores check-in date as `date` for calendar placement.
    if (venueId === 'villa' && payload.check_in_date) {
      payload.date = payload.check_in_date
    }

    return payload
  }

  const onSave = async (e) => {
    e.preventDefault()
    if (readOnly) return
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

  const heading = readOnly ? 'View booking' : editing ? 'Edit booking' : 'New booking'

  return (
    <form className="booking-form" onSubmit={onSave} noValidate>
      <div className="form-header">
        <div className="form-title-row">
          <h2>{heading}</h2>
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
              disabled={readOnly}
            />
            {manualTitle !== null && !readOnly && (
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
                  readOnly={readOnly}
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
        {!readOnly && (
          <button
            type="submit"
            className="btn-save"
            disabled={saving}
          >
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Save booking'}
          </button>
        )}
      </div>
    </form>
  )
}
