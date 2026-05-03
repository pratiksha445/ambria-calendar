import { useEffect, useMemo, useState } from 'react'
import { VENUES, VENUE_BY_ID } from '../config/venues.js'
import {
  getFormConfig, getAllFields, getSlotFields, isFieldRequired,
  FIELD_MAP, ALL_SAVEABLE_KEYS, STATUSES,
  parsePhoneCode, getCodeFromValue,
} from '../config/formFields.js'
import { autoTitle } from '../lib/autoTitle.js'
import { sanitizeText, sanitizePhone, sanitizePax } from '../lib/sanitize.js'
import { createEvent, updateEvent, deleteEvent } from '../lib/events.js'
import { fetchFilteredUsers } from '../lib/users.js'
import { getElementLabel } from '../lib/elements.js'
import { useDirectory } from '../contexts/DirectoryContext.jsx'
import { getEditableSections, getLockedFieldKeys } from '../lib/sectionPermissions.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import Field from './Field.jsx'

const SLOT_CATEGORIES = new Set(['add', 'ac', 'aee'])
const MAX_SLOTS = 5
const SLOT_KEYS = {
  add: ['event_type', 'event_type_other', 'shift', 'time', 'pax', 'decor_type', 'color_theme'],
  ac:  ['event_type', 'event_type_other', 'shift', 'time', 'pax', 'menu_type', 'menu_cat'],
  aee: ['event_type', 'event_type_other', 'shift', 'time', 'pax', 'elements'],
}

function emptySlot(venueId) {
  const obj = {}
  for (const k of SLOT_KEYS[venueId] || []) obj[k] = k === 'elements' ? [] : ''
  return obj
}

function buildSlotsFromTopLevel(form, venueId) {
  const slot = {}
  for (const k of SLOT_KEYS[venueId] || []) slot[k] = form[k] ?? (k === 'elements' ? [] : '')
  return [slot]
}

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
  const { eventTypes: dirEventTypes, users: dirUsers, elements: dirElements } = useDirectory()
  const editing = !!(initial && initial.id)
  const readOnly = editing && initial?.source !== 'manual'
  const todayStr = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])
  // For new bookings, inject min=today on primary date pickers
  const augmentField = (f) => {
    if (!editing && f.type === 'date' && (f.key === 'date' || f.key === 'check_in_date')) {
      return { ...f, min: todayStr }
    }
    return f
  }

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
  const [filteredUsersMap, setFilteredUsersMap] = useState({})
  const [collapsedSections, setCollapsedSections] = useState({})
  const [lockToast, setLockToast] = useState(false)
  const [showPostponeModal, setShowPostponeModal] = useState(false)
  const [postponeDate, setPostponeDate] = useState('')
  const [postponeEndDate, setPostponeEndDate] = useState('')
  const [pendingPayload, setPendingPayload] = useState(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelMode, setCancelMode] = useState('entire')
  const [cancelFromDate, setCancelFromDate] = useState('')
  const [eventSlots, setEventSlots] = useState(() => {
    if (!SLOT_CATEGORIES.has(venueId)) return []
    if (editing && Array.isArray(initial.event_slots) && initial.event_slots.length > 0) {
      return initial.event_slots
    }
    if (editing) return buildSlotsFromTopLevel(initial, venueId)
    return [emptySlot(venueId)]
  })

  // Derive dropdown data from DirectoryContext (cached, stale-while-revalidate)
  const dynamicEventTypes = useMemo(
    () => dirEventTypes.length > 0 ? dirEventTypes.map((t) => ({ name: t.name, abbreviation: t.abbreviation || '' })) : null,
    [dirEventTypes],
  )
  const dynamicElements = useMemo(
    () => dirElements.length > 0 ? dirElements.map((el) => ({ value: el.name, label: getElementLabel(el.name, lang, { [el.name]: el.name_hi }) })) : null,
    [dirElements, lang],
  )
  const activeUsers = dirUsers

  // Section-level edit permissions (AP/AM/AE/AR only, editing only)
  const editableSections = useMemo(
    () => getEditableSections(user, initial, venueId),
    [user, initial, venueId]
  )

  const showLockToast = () => {
    setLockToast(true)
    setTimeout(() => setLockToast(false), 2500)
  }

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
  const computedTitle = useMemo(() => autoTitle({ ...form, venue_id: venueId, event_slots: eventSlots }, t), [form, venueId, eventSlots, t])
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
    if (SLOT_CATEGORIES.has(venueId)) setEventSlots([emptySlot(venueId)])
    else setEventSlots([])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId])

  const setSlotField = (index, key, value) => {
    setEventSlots((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [key]: value }
      if (key === 'menu_type') next[index].menu_cat = ''
      if (key === 'event_type' && value !== 'Other') next[index].event_type_other = ''
      return next
    })
    setErrors((prev) => {
      const errKey = `slot_${index}_${key}`
      if (!prev[errKey]) return prev
      const { [errKey]: _gone, ...rest } = prev
      return rest
    })
  }

  const addSlot = () => {
    if (eventSlots.length >= MAX_SLOTS) return
    setEventSlots((prev) => [...prev, emptySlot(venueId)])
  }

  const removeSlot = (index) => {
    if (index === 0) return
    setEventSlots((prev) => prev.filter((_, i) => i !== index))
  }

  const hasSlotErrors = (si) => Object.keys(errors).some((k) => k.startsWith(`slot_${si}_`))

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
      if (key === 'decor_status' && value === 'Outdoor') {
        next.function_category = ''
        next.payment_remaining_decor = ''
        next.decor_delivery_person = ''
        next.decor_delivery_person_id = null
        next.decor_operation_manager = ''
        next.decor_operation_manager_id = null
      }
      if (key === 'entertainment_status' && value === 'Outdoor') {
        next.elements = []
        next.payment_remaining_ent = ''
        next.ent_delivery_person = ''
        next.ent_delivery_person_id = null
      }
      if (key === 'site_availability' && value !== 'Others') {
        next.site_availability_other = ''
      }
      if (key === 'event_type' && value !== 'Other') {
        next.event_type_other = ''
      }
      if (key === 'event_type' && value !== 'Wedding' && value !== 'Nikah' && value !== 'South Indian Wedding') {
        next.baraat_time = ''
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

    // Slot-level validation for ADD/AC/AEE
    const slotFieldDefs = SLOT_CATEGORIES.has(venueId) ? getSlotFields(venueId, dynamicEventTypes, dynamicElements) : []
    for (let si = 0; si < eventSlots.length; si++) {
      const slot = eventSlots[si]
      for (const field of slotFieldDefs) {
        if (field.showWhen && !field.showWhen(slot)) continue
        if (field.disabledWhen && field.disabledWhen(slot)) continue
        const v = slot[field.key]
        const isEmpty = Array.isArray(v) ? v.length === 0 : (v === undefined || v === null || v === '')
        if (isFieldRequired(field, slot) && isEmpty) {
          nextErrors[`slot_${si}_${field.key}`] = 'Required'
        }
      }
    }

    // Past-date validation
    const primaryDateKey = venueId === 'villa' ? 'check_in_date' : 'date'
    const dateVal = form[primaryDateKey]
    if (dateVal && dateVal < todayStr) {
      if (!editing) {
        nextErrors[primaryDateKey] = 'Date cannot be in the past'
      } else if (dateVal !== initial?.[primaryDateKey]) {
        nextErrors[primaryDateKey] = 'Date cannot be in the past'
      }
    }

    setErrors(nextErrors)

    const errorKeys = Object.keys(nextErrors)
    if (errorKeys.length > 0) {
      // Build descriptive error listing the field labels
      const slotAllFields = slotFieldDefs.length > 0 ? slotFieldDefs : []
      const labels = errorKeys.map((key) => {
        const slotMatch = key.match(/^slot_(\d+)_(.+)$/)
        if (slotMatch) {
          const sf = slotAllFields.find((fd) => fd.key === slotMatch[2])
          return `Event ${Number(slotMatch[1]) + 1}: ${sf ? t(sf.label) : slotMatch[2]}`
        }
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

    // Slot[0] → top-level sync for backward compatibility (calendar pills, search, etc.)
    if (SLOT_CATEGORIES.has(venueId) && eventSlots.length > 0) {
      payload.event_slots = eventSlots
      const s0 = eventSlots[0]
      payload.event_type = s0.event_type || null
      payload.event_type_other = s0.event_type_other || null
      payload.shift = s0.shift || null
      payload.time = s0.time || null
      payload.pax = sanitizePax(s0.pax)
      if (venueId === 'add') {
        payload.decor_type = s0.decor_type || null
        payload.color_theme = s0.color_theme || null
      }
      if (venueId === 'ac') {
        payload.menu_type = s0.menu_type || null
        payload.menu_cat = s0.menu_cat || null
      }
      if (venueId === 'aee') {
        payload.elements = Array.isArray(s0.elements) && s0.elements.length > 0 ? s0.elements : null
      }
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

    const payload = buildPayload()

    // Intercept: status changing TO Postponed → show date-picker modal
    if (editing && form.status === 'Postponed' && initial?.status !== 'Postponed') {
      setPendingPayload(payload)
      setPostponeDate('')
      setPostponeEndDate('')
      setShowPostponeModal(true)
      return
    }

    // Intercept: status changing TO Cancelled on multi-day Villa/TND → show cancel modal
    if (editing && form.status === 'Cancelled' && initial?.status !== 'Cancelled') {
      const isMultiDayVilla = venueId === 'villa' && initial.check_in_date && initial.check_out_date && initial.check_out_date > initial.check_in_date
      const isMultiDayTnd = venueId === 'tender' && initial.date && initial.end_date && initial.end_date > initial.date
      if (isMultiDayVilla || isMultiDayTnd) {
        setPendingPayload(payload)
        setCancelMode('entire')
        setCancelFromDate('')
        setShowCancelModal(true)
        return
      }
    }

    setSaving(true)
    try {
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

  const isoFromDate = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  // Auto-fill postpone end date when start date changes (preserve duration)
  const onPostponeDateChange = (newStart) => {
    setPostponeDate(newStart)
    if (!newStart) { setPostponeEndDate(''); return }
    if (venueId === 'villa' && initial.check_in_date && initial.check_out_date) {
      const origDays = Math.round((new Date(initial.check_out_date + 'T00:00:00') - new Date(initial.check_in_date + 'T00:00:00')) / 86400000)
      const nd = new Date(newStart + 'T00:00:00')
      nd.setDate(nd.getDate() + origDays)
      setPostponeEndDate(isoFromDate(nd))
    } else if (venueId === 'tender' && initial.date && initial.end_date) {
      const origDays = Math.round((new Date(initial.end_date + 'T00:00:00') - new Date(initial.date + 'T00:00:00')) / 86400000)
      const nd = new Date(newStart + 'T00:00:00')
      nd.setDate(nd.getDate() + origDays)
      setPostponeEndDate(isoFromDate(nd))
    }
  }

  const confirmPostpone = async () => {
    if (!postponeDate || !pendingPayload) return
    setSaving(true)
    setShowPostponeModal(false)
    try {
      const payload = { ...pendingPayload }
      payload.postponed_at = new Date().toISOString()

      if (venueId === 'villa') {
        payload.postponed_from_date = initial.check_in_date || initial.date
        payload.check_in_date = postponeDate
        payload.date = postponeDate
        payload.check_out_date = postponeEndDate || postponeDate
      } else if (venueId === 'tender') {
        payload.postponed_from_date = initial.date
        payload.date = postponeDate
        payload.end_date = postponeEndDate || null
      } else {
        payload.postponed_from_date = initial.date
        payload.date = postponeDate
      }

      const row = await updateEvent(initial.id, payload, user)
      onSaved?.(row)
    } catch (err) {
      console.error('[ambria] postpone save failed', err)
      setSubmitError(err?.message ?? String(err))
    } finally {
      setSaving(false)
      setPendingPayload(null)
    }
  }

  const cancelPostpone = () => {
    setShowPostponeModal(false)
    setPendingPayload(null)
    setPostponeDate('')
    setPostponeEndDate('')
    setField('status', initial?.status || 'Confirmed')
  }

  const confirmCancel = async () => {
    if (!pendingPayload) return
    setSaving(true)
    setShowCancelModal(false)
    try {
      if (cancelMode === 'entire') {
        // Cancel entire booking
        const row = await updateEvent(initial.id, pendingPayload, user)
        onSaved?.(row)
      } else {
        // Partial cancel — split into truncated original + new cancelled portion
        if (!cancelFromDate) return

        const dayBefore = new Date(cancelFromDate + 'T00:00:00')
        dayBefore.setDate(dayBefore.getDate() - 1)
        const dayBeforeIso = isoFromDate(dayBefore)

        // 1. Truncate original booking (keep its current status)
        const truncPayload = { ...pendingPayload }
        truncPayload.status = initial.status // restore original status
        if (venueId === 'villa') {
          truncPayload.check_out_date = cancelFromDate
        } else {
          truncPayload.end_date = dayBeforeIso
        }
        await updateEvent(initial.id, truncPayload, user)

        // 2. Create new cancelled portion
        const cancelledPayload = { ...pendingPayload }
        cancelledPayload.status = 'Cancelled'
        // Clear postpone metadata on the split
        cancelledPayload.postponed_from_date = null
        cancelledPayload.postponed_at = null
        if (venueId === 'villa') {
          cancelledPayload.check_in_date = cancelFromDate
          cancelledPayload.date = cancelFromDate
          cancelledPayload.check_out_date = initial.check_out_date
        } else {
          cancelledPayload.date = cancelFromDate
          cancelledPayload.end_date = initial.end_date
        }
        // Remove id so createEvent generates a new one
        delete cancelledPayload.id
        cancelledPayload.source = 'manual'
        cancelledPayload.created_by = user?.id || null

        const newRow = await createEvent(cancelledPayload, user)
        // Return the original (truncated) row to refresh the UI
        onSaved?.({ ...initial, ...truncPayload, _splitCreatedId: newRow.id })
      }
    } catch (err) {
      console.error('[ambria] cancel save failed', err)
      setSubmitError(err?.message ?? String(err))
    } finally {
      setSaving(false)
      setPendingPayload(null)
    }
  }

  const cancelCancelModal = () => {
    setShowCancelModal(false)
    setPendingPayload(null)
    setCancelFromDate('')
    setCancelMode('entire')
    setField('status', initial?.status || 'Confirmed')
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

          // Event-slots section — render slot cards instead of normal fields
          if (section.type === 'event-slots' && SLOT_CATEGORIES.has(venueId)) {
            const slotFields = getSlotFields(venueId, dynamicEventTypes, dynamicElements)
            return (
              <div key={sectionKey} className="form-section">
                <div className="form-section-title">{t('Events')}</div>
                {eventSlots.map((slot, slotIdx) => (
                  <div
                    key={slotIdx}
                    className={`slot-card ${hasSlotErrors(slotIdx) ? 'slot-card-error' : ''}`}
                    style={{ borderLeftColor: VENUE_BY_ID[venueId]?.color }}
                  >
                    <div className="slot-card-header">
                      <span className="slot-card-label">{t('Event')} {slotIdx + 1}</span>
                      {slotIdx > 0 && !sectionReadOnly && (
                        <button type="button" className="slot-delete-btn" onClick={() => removeSlot(slotIdx)} aria-label={`Delete Event ${slotIdx + 1}`}>×</button>
                      )}
                    </div>
                    <div className="slot-grid">
                      {slotFields.map((field) => {
                        if (field.showWhen && !field.showWhen(slot)) return null
                        return (
                          <Field
                            key={field.key}
                            field={field}
                            form={slot}
                            value={slot[field.key]}
                            onChange={(key, val) => setSlotField(slotIdx, key, val)}
                            error={errors[`slot_${slotIdx}_${field.key}`]}
                            readOnly={sectionReadOnly}
                            activeUsers={[]}
                          />
                        )
                      })}
                    </div>
                  </div>
                ))}
                {eventSlots.length < MAX_SLOTS && !sectionReadOnly && (
                  <button type="button" className="add-slot-btn" onClick={addSlot}>+ {t('Add Event')}</button>
                )}
              </div>
            )
          }

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
                          field={augmentField(f)}
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
                    field={augmentField(field)}
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

      {showPostponeModal && (
        <div className="postpone-overlay" onClick={cancelPostpone}>
          <div className="postpone-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('Postpone Event')}</h3>
            <p>{t('Select the new date for this event')}</p>
            {(venueId === 'villa' || venueId === 'tender') ? (
              <div className="postpone-date-row">
                <div className="postpone-date-group">
                  <label className="postpone-date-label">
                    {venueId === 'villa' ? t('New check-in date') : t('New start date')}
                  </label>
                  <input
                    type="date"
                    className="postpone-date-input"
                    value={postponeDate}
                    onChange={(e) => onPostponeDateChange(e.target.value)}
                    min={todayStr}
                  />
                </div>
                <div className="postpone-date-group">
                  <label className="postpone-date-label">
                    {venueId === 'villa' ? t('New check-out date') : t('New end date')}
                  </label>
                  <input
                    type="date"
                    className="postpone-date-input"
                    value={postponeEndDate}
                    onChange={(e) => setPostponeEndDate(e.target.value)}
                    min={postponeDate || todayStr}
                  />
                </div>
              </div>
            ) : (
              <>
                <label className="postpone-date-label">{t('New date')}</label>
                <input
                  type="date"
                  className="postpone-date-input"
                  value={postponeDate}
                  onChange={(e) => setPostponeDate(e.target.value)}
                  min={todayStr}
                />
              </>
            )}
            <div className="postpone-actions">
              <button type="button" className="btn-ghost" onClick={cancelPostpone}>{t('Cancel')}</button>
              <button
                type="button"
                className="btn-save"
                disabled={!postponeDate || saving}
                onClick={confirmPostpone}
              >
                {t('Confirm Postpone')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="postpone-overlay" onClick={cancelCancelModal}>
          <div className="postpone-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('Cancel Booking')}</h3>
            <p>
              {venueId === 'villa'
                ? t('This booking spans {start} to {end}. Cancel from which date?')
                    .replace('{start}', initial.check_in_date).replace('{end}', initial.check_out_date)
                : t('This booking spans {start} to {end}. Cancel from which date?')
                    .replace('{start}', initial.date).replace('{end}', initial.end_date)
              }
            </p>
            <div className="cancel-options">
              <label className="cancel-option">
                <input type="radio" name="cancelMode" value="entire" checked={cancelMode === 'entire'} onChange={() => setCancelMode('entire')} />
                <span>{t('Cancel entire booking')}</span>
              </label>
              <label className="cancel-option">
                <input type="radio" name="cancelMode" value="partial" checked={cancelMode === 'partial'} onChange={() => setCancelMode('partial')} />
                <span>{t('Cancel from a specific date')}</span>
              </label>
            </div>
            {cancelMode === 'partial' && (
              <div className="cancel-date-section">
                <label className="postpone-date-label">{t('Cancel from date')}</label>
                <input
                  type="date"
                  className="postpone-date-input"
                  value={cancelFromDate}
                  onChange={(e) => setCancelFromDate(e.target.value)}
                  min={(() => {
                    const start = venueId === 'villa' ? initial.check_in_date : initial.date
                    if (!start) return undefined
                    const d = new Date(start + 'T00:00:00')
                    d.setDate(d.getDate() + 1)
                    return isoFromDate(d)
                  })()}
                  max={venueId === 'villa' ? initial.check_out_date : initial.end_date}
                />
              </div>
            )}
            <div className="postpone-actions">
              <button type="button" className="btn-ghost" onClick={cancelCancelModal}>{t('Go Back')}</button>
              <button
                type="button"
                className="btn-cancel-confirm"
                disabled={saving || (cancelMode === 'partial' && !cancelFromDate)}
                onClick={confirmCancel}
              >
                {t('Confirm Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
