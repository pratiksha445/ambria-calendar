import { useEffect, useMemo, useState } from 'react'
import { VENUES, VENUE_BY_ID } from '../config/venues.js'
import {
  getFormConfig, getAllFields, isFieldRequired,
  FIELD_MAP, ALL_SAVEABLE_KEYS, STATUSES,
  parsePhoneCode, getCodeFromValue,
} from '../config/formFields.js'
import { autoTitle } from '../lib/autoTitle.js'
import { sanitizeText, sanitizePhone, sanitizePax } from '../lib/sanitize.js'
import { createEvent, updateEvent, deleteEvent } from '../lib/events.js'
import { fetchActiveEventTypes } from '../lib/eventTypes.js'
import { fetchActiveUsers, fetchFilteredUsers } from '../lib/users.js'
import { fetchActiveElements, getElementLabel } from '../lib/elements.js'
import { getEditableSections, getLockedFieldKeys } from '../lib/sectionPermissions.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import Field from './Field.jsx'

function blankForm(venueId, defaults = {}) {
  return {
    venue_id: venueId,
    status: 'Confirmed',
    phone_code: '+91',
    ...defaults,
  }
}

export default function BookingForm({ initial, onSaved, onDeleted, onClose, user }) {
  const { t, lang } = useLanguage()
  const editing = !!(initial && initial.id)
  const readOnly = editing && initial?.source !== 'manual'

  const [venueId, setVenueId] = useState(() => initial?.venue_id ?? '')
  const [form, setForm] = useState(() => {
    if (editing) {
      const parsed = parsePhoneCode(initial.phone)
      return { ...initial, phone: parsed.number, phone_code: parsed.value }
    }
    return blankForm(venueId, { date: initial?.date })
  })
  const [manualTitle, setManualTitle] = useState(() =>
    editing && initial.title && initial.title !== autoTitle(initial) ? initial.title : null
  )
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [dynamicEventTypes, setDynamicEventTypes] = useState(null)
  const [dynamicElements, setDynamicElements] = useState(null)
  const [activeUsers, setActiveUsers] = useState([])
  const [filteredUsersMap, setFilteredUsersMap] = useState({})
  const [collapsedSections, setCollapsedSections] = useState({})
  const [lockToast, setLockToast] = useState(false)

  // Section-level edit permissions (AP/AM/AE/AR only, editing only)
  const editableSections = useMemo(
    () => getEditableSections(user, initial, venueId),
    [user, initial, venueId]
  )

  const showLockToast = () => {
    setLockToast(true)
    setTimeout(() => setLockToast(false), 2500)
  }

  useEffect(() => {
    fetchActiveEventTypes()
      .then((types) => setDynamicEventTypes(types.map((t) => ({ name: t.name, abbreviation: t.abbreviation || '' }))))
      .catch(() => setDynamicEventTypes(null))
    fetchActiveUsers()
      .then(setActiveUsers)
      .catch(() => setActiveUsers([]))
    fetchActiveElements()
      .then((rows) => setDynamicElements(
        rows.map((el) => ({ value: el.name, label: getElementLabel(el.name, lang, { [el.name]: el.name_hi }) }))
      ))
      .catch(() => setDynamicElements(null))
  }, [])

  const sections = useMemo(() => getFormConfig(venueId, dynamicEventTypes, dynamicElements), [venueId, dynamicEventTypes, dynamicElements])

  // Fetch filtered user lists for fields with userFilter (e.g. AP/AM/AE/AR forms)
  const filterKeysStr = useMemo(() => {
    const keys = new Set()
    for (const s of sections) {
      for (const f of s.fields) {
        if (f.userFilter) keys.add(JSON.stringify(f.userFilter))
      }
    }
    return [...keys].sort().join('|')
  }, [sections])

  useEffect(() => {
    if (!filterKeysStr) { setFilteredUsersMap({}); return }
    const keys = filterKeysStr.split('|')
    Promise.all(
      keys.map((key) =>
        fetchFilteredUsers(JSON.parse(key))
          .then((users) => [key, users])
          .catch(() => [key, []])
      )
    ).then((results) => setFilteredUsersMap(Object.fromEntries(results)))
  }, [filterKeysStr])
  const computedTitle = useMemo(() => autoTitle({ ...form, venue_id: venueId }), [form, venueId])
  const displayTitle = manualTitle ?? computedTitle

  const getUsersForField = (field) => {
    if (!field.userFilter) return activeUsers
    const key = JSON.stringify(field.userFilter)
    return filteredUsersMap[key] ?? activeUsers
  }

  // When category switches, reset per-category fields and sub-venue.
  useEffect(() => {
    if (editing) return
    setForm((prev) => blankForm(venueId, {
      date: prev.date,
      guest_name: prev.guest_name,
      phone: prev.phone,
      phone_code: prev.phone_code,
      notes: prev.notes,
    }))
    setErrors({})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId])

  const setField = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'booking_status' && !['VM', 'VME', 'VMD', 'VMDE'].includes(value)) {
        next.menu_type = ''
        next.menu_cat = ''
        next.fp_status = ''
      }
      if (key === 'menu_type') {
        next.menu_cat = ''
      }
      if (key === 'site_availability' && value !== 'Others') {
        next.site_availability_other = ''
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
    const all = getAllFields(venueId, dynamicEventTypes, dynamicElements)
    const lockedKeys = getLockedFieldKeys(sections, editableSections)
    const nextErrors = {}
    for (const field of all) {
      if (editing && lockedKeys.has(field.key)) continue // skip locked-section fields
      if (field.showWhen && !field.showWhen(form)) continue
      if (field.disabledWhen && field.disabledWhen(form)) continue

      const v = form[field.key]

      const isEmpty = Array.isArray(v) ? v.length === 0 : (v === undefined || v === null || v === '')
      if (isFieldRequired(field, form) && isEmpty) {
        nextErrors[field.key] = 'Required'
        continue
      }

      // Percent-range validation — block values outside 0-100
      if (field.suffix === '%' && v !== undefined && v !== null && v !== '') {
        const n = parseInt(v, 10)
        if (isNaN(n) || n < 0 || n > 100) {
          nextErrors[field.key] = 'Must be 0–100'
          continue
        }
      }

      // Dropdown validation — reject values not in the options list
      if ((field.type === 'select' || field.type === 'searchable-select') && field.options && v && v !== '') {
        const validValues = field.options.map((o) => typeof o === 'object' ? (o.value ?? o) : o)
        if (!validValues.includes(v)) {
          nextErrors[field.key] = 'Invalid selection'
        }
      }
    }
    setErrors(nextErrors)

    const errorKeys = Object.keys(nextErrors)
    if (errorKeys.length > 0) {
      // Build descriptive error listing the field labels
      const labels = errorKeys.map((key) => {
        const f = all.find((fd) => fd.key === key)
        return f ? t(f.label) : key
      })
      setSubmitError(t('Please fill required fields') + ': ' + labels.join(', '))
      // Scroll to first error field after render
      requestAnimationFrame(() => {
        const el = document.getElementById(`field-${errorKeys[0]}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el.focus()
        }
      })
      return false
    }
    return true
  }

  const buildPayload = () => {
    const validKeys = new Set(FIELD_MAP[venueId] || [])
    const all = getAllFields(venueId, dynamicEventTypes, dynamicElements)
    // Exclude fields from locked sections (permission-based)
    const lockedKeys = getLockedFieldKeys(sections, editableSections)
    // Also lock the corresponding _id fields
    const lockedWithIds = new Set(lockedKeys)
    for (const k of lockedKeys) lockedWithIds.add(k + '_id')

    const payload = {
      venue_id: venueId,
      title: sanitizeText((manualTitle ?? computedTitle) || 'Untitled', 'title'),
      status: STATUSES.includes(form.status) ? form.status : 'Confirmed',
    }

    // Only include keys valid for this category — skip irrelevant columns entirely
    // to prevent leaking columns from other categories (e.g. kitchen_head on AP save).
    for (const key of ALL_SAVEABLE_KEYS) {
      if (!validKeys.has(key)) continue
      // Skip locked-section fields entirely — don't overwrite them
      if (editing && lockedWithIds.has(key)) continue

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
      // _id fields are UUIDs set by user-select dual-write — pass through directly
      if (key.endsWith('_id')) {
        payload[key] = raw || null
        continue
      }
      if (key === 'phone') {
        const num = raw ? String(raw).replace(/[^\d\s]/g, '').trim() : ''
        if (num) {
          const code = getCodeFromValue(form.phone_code || '+91')
          payload[key] = sanitizePhone(code + ' ' + num)
        } else {
          payload[key] = null
        }
      } else if (key === 'pax' || key === 'rooms') {
        payload[key] = sanitizePax(raw)
      } else if (fieldDef && (fieldDef.type === 'date' || fieldDef.type === 'time' || fieldDef.type === 'select' || fieldDef.type === 'searchable-select')) {
        payload[key] = raw || null
      } else if (fieldDef?.type === 'multiselect') {
        payload[key] = Array.isArray(raw) && raw.length > 0 ? raw : null
      } else {
        payload[key] = sanitizeText(raw, key)
      }
    }

    // Backfill _id for user-select fields where name is set but _id is missing
    // (handles legacy rows created before dual-write was added)
    for (const section of sections) {
      for (const field of section.fields) {
        if (field.type !== 'user-select') continue
        const nameKey = field.key
        const idKey = nameKey + '_id'
        if (!payload[nameKey] || payload[idKey]) continue
        const users = getUsersForField(field)
        const match = users.find((u) => (typeof u === 'string' ? u : u.name) === payload[nameKey])
        if (match && typeof match === 'object') {
          payload[idKey] = match.id
        }
      }
    }

    // Villa stores check-in date as `date` for calendar placement.
    if (venueId === 'villa' && payload.check_in_date) {
      payload.date = payload.check_in_date
    }

    // Final defensive strip: only keep keys valid for this category + meta
    const allowed = new Set(['venue_id', 'title', 'status', 'date', ...validKeys])
    for (const key of Object.keys(payload)) {
      if (!allowed.has(key)) delete payload[key]
    }

    console.log('[ambria save]', {
      category: venueId,
      bookingId: initial?.id,
      userId: user?.id,
      userRole: user?.role,
      columnsBeingSent: Object.keys(payload).sort(),
    })

    return payload
  }

  const onSave = async (e) => {
    e.preventDefault()
    if (readOnly) return
    setSubmitError(null)
    if (!venueId) { setSubmitError(t('Please select a category')); return }
    if (!validate()) return
    setSaving(true)
    try {
      const payload = buildPayload()
      const row = editing
        ? await updateEvent(initial.id, payload, user)
        : await createEvent(payload, user)
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
      await deleteEvent(initial.id, user)
      onDeleted?.(initial.id)
    } catch (err) {
      console.error('[ambria] delete failed', err)
      setSubmitError(err?.message ?? String(err))
    } finally {
      setDeleting(false)
    }
  }

  const heading = readOnly ? t('View booking') : editing ? t('Edit booking') : t('New booking')

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

        {!editing ? (
          <div className="field category-field">
            <label htmlFor="booking-category" className="field-label">{t('Category')} <span className="required-star">*</span></label>
            <select
              id="booking-category"
              value={venueId}
              onChange={(e) => setVenueId(e.target.value)}
              className={!venueId ? 'placeholder-select' : ''}
            >
              <option value="" disabled>{t('Select a category…')}</option>
              {VENUES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.short} — {t(v.name)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="editing-category">
            <span
              className="category-pill-dot"
              style={{ background: VENUE_BY_ID[venueId]?.color }}
            />
            <span>{t(VENUE_BY_ID[venueId]?.name)}</span>
          </div>
        )}

        <div className="field title-field">
          <label htmlFor="booking-title" className="field-label">{t('Title')}</label>
          <div className="title-input-row">
            <input
              id="booking-title"
              type="text"
              value={displayTitle}
              onChange={onTitleChange}
              placeholder={t('Auto-generated as you fill in fields')}
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
        {sections.map((section, si) => {
          const sectionKey = section.title || `section-${si}`
          const isCollapsible = !!section.collapsible
          const isCollapsed = isCollapsible && collapsedSections[sectionKey] !== false
          const toggleCollapse = () => setCollapsedSections((prev) => ({
            ...prev, [sectionKey]: prev[sectionKey] === false ? true : false,
          }))
          // Section lock: if editableSections is a Set and this titled section is not in it
          const sectionLocked = editableSections && section.title && !editableSections.has(section.title)
          const sectionReadOnly = readOnly || sectionLocked

          return (
          <div key={sectionKey} className={`form-section ${section.prominent ? 'form-section-prominent' : ''} ${sectionLocked ? 'form-section-locked' : ''}`}>
            {section.title && (
              <div
                className={`form-section-title ${section.prominent ? 'form-section-title-prominent' : ''} ${isCollapsible ? 'form-section-title-collapsible' : ''}`}
                onClick={isCollapsible ? toggleCollapse : undefined}
                role={isCollapsible ? 'button' : undefined}
                tabIndex={isCollapsible ? 0 : undefined}
                onKeyDown={isCollapsible ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCollapse() } } : undefined}
              >
                {isCollapsible && (
                  <span className={`section-chevron ${isCollapsed ? '' : 'open'}`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </span>
                )}
                {t(section.title)}
                {sectionLocked && <span className="section-lock-icon" aria-label="Locked">🔒</span>}
              </div>
            )}
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
            <div
              className={`form-grid ${isCollapsed ? 'form-grid-collapsed' : ''}`}
              onClick={sectionLocked ? showLockToast : undefined}
            >
              {section.fields.map((field) => {
                if (field.type === 'group') {
                  return (
                    <div key={field.key} className={`field-group field-group-${field.columns || 2}`}>
                      {field.fields.map((f) => (
                        <Field
                          key={f.key}
                          field={f}
                          form={form}
                          value={form[f.key]}
                          onChange={setField}
                          error={errors[f.key]}
                          readOnly={sectionReadOnly}
                          activeUsers={getUsersForField(f)}
                        />
                      ))}
                    </div>
                  )
                }
                return (
                  <Field
                    key={field.key}
                    field={field}
                    form={form}
                    value={form[field.key]}
                    onChange={setField}
                    error={errors[field.key]}
                    readOnly={sectionReadOnly}
                    activeUsers={getUsersForField(field)}
                  />
                )
              })}
            </div>
          </div>
          )
        })}
      </div>
      {lockToast && (
        <div className="lock-toast">{t("You don't have permission to edit this section.")}</div>
      )}

      <div className="form-footer">
        {submitError && <div className="form-error-banner">{t(submitError)}</div>}
        {editing && !readOnly && user?.role === 'admin' && (
          confirmDelete ? (
            <div className="confirm-delete">
              <span>{t('Delete this booking?')}</span>
              <button
                type="button"
                className="btn-danger"
                onClick={onDelete}
                disabled={deleting}
              >
                {deleting ? t('Deleting…') : t('Yes, delete')}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
              >
                {t('Cancel')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn-delete"
              onClick={() => setConfirmDelete(true)}
            >
              {t('Delete booking')}
            </button>
          )
        )}
        {!readOnly && (
          <button
            type="submit"
            className="btn-save"
            disabled={saving}
          >
            {saving ? t('Saving…') : editing ? t('Save changes') : t('Save booking')}
          </button>
        )}
      </div>
    </form>
  )
}
