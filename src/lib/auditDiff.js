// Audit diff engine — compares old and new event data and produces
// structured changes for the audit log.

import { getFormConfig, getAllFields } from '../config/formFields.js'
import { VENUE_BY_ID } from '../config/venues.js'

// ---------- Value formatting for human-readable audit logs ----------

function formatTime12(t) {
  if (!t) return '(empty)'
  const [h, m] = t.split(':').map(Number)
  if (isNaN(h)) return t
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 || 12
  return `${hr}:${String(m).padStart(2, '0')} ${suffix}`
}

function formatDate(d) {
  if (!d) return '(empty)'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function formatValue(key, val, fieldDef) {
  if (val === null || val === undefined || val === '') return '(empty)'

  // Boolean fields
  if (fieldDef?.type === 'checkbox' || typeof val === 'boolean') {
    return val ? 'Yes' : 'No'
  }
  // Time fields
  if (fieldDef?.type === 'time') return formatTime12(val)
  // Date fields
  if (fieldDef?.type === 'date') return formatDate(val)
  // Array fields (elements, service_type)
  if (Array.isArray(val)) return val.length > 0 ? val.join(', ') : '(empty)'

  return String(val)
}

// ---------- Field → section mapping ----------

function buildFieldSectionMap(venueId) {
  const sections = getFormConfig(venueId, null, null)
  const map = {}
  for (const section of sections) {
    const sectionName = section.title || 'Other'
    for (const field of section.fields) {
      if (field.type === 'group') {
        for (const f of field.fields) {
          map[f.key] = sectionName
          if (f.inlineCheckbox) map[f.inlineCheckbox.key] = sectionName
        }
      } else {
        map[field.key] = sectionName
        if (field.inlineCheckbox) map[field.inlineCheckbox.key] = sectionName
      }
    }
  }
  return map
}

function buildFieldLabelMap(venueId) {
  const all = getAllFields(venueId, null, null)
  const map = {}
  for (const f of all) {
    map[f.key] = f.label
    if (f.inlineCheckbox) map[f.inlineCheckbox.key] = f.inlineCheckbox.label
  }
  return map
}

function getFieldDef(venueId, key) {
  const all = getAllFields(venueId, null, null)
  const direct = all.find((f) => f.key === key)
  if (direct) return direct
  // Check for inline checkbox keys embedded in parent fields
  const parent = all.find((f) => f.inlineCheckbox?.key === key)
  if (parent) return { type: 'checkbox', key, label: parent.inlineCheckbox.label }
  return null
}

// Keys to skip in diffs (internal, auto-generated, or _id shadow fields)
const SKIP_KEYS = new Set([
  'id', 'created_at', 'updated_at', 'deleted_at', 'source', 'created_by',
  'venue_id', 'title', 'phone_code',
])

/**
 * Build structured diff between old and new event data.
 * @returns {{ changes: Array, sections_edited: string[], summary: string } | null}
 *   null if no changes detected
 */
export function buildAuditDiff(oldData, newData, venueId) {
  if (!oldData || !newData) return null

  const sectionMap = buildFieldSectionMap(venueId)
  const labelMap = buildFieldLabelMap(venueId)
  const changes = []

  const allKeys = new Set([...Object.keys(newData), ...Object.keys(oldData)])

  for (const key of allKeys) {
    if (SKIP_KEYS.has(key)) continue
    if (key.endsWith('_id')) continue // skip shadow _id fields from display

    const oldVal = oldData[key] ?? null
    const newVal = newData[key] ?? null

    // Deep compare for arrays
    if (Array.isArray(oldVal) || Array.isArray(newVal)) {
      const oldArr = Array.isArray(oldVal) ? oldVal : []
      const newArr = Array.isArray(newVal) ? newVal : []
      if (oldArr.length === newArr.length && oldArr.every((v, i) => v === newArr[i])) continue
    } else {
      if (String(oldVal ?? '') === String(newVal ?? '')) continue
    }

    const fieldDef = getFieldDef(venueId, key)
    // For user-reference fields, log the name not UUID
    const isUserField = fieldDef?.type === 'user-select'

    changes.push({
      field: key,
      field_label: labelMap[key] || key,
      section: sectionMap[key] || 'Other',
      old_value: formatValue(key, oldVal, fieldDef),
      new_value: formatValue(key, newVal, fieldDef),
    })
  }

  if (changes.length === 0) return null

  const sectionsEdited = [...new Set(changes.map((c) => c.section))]
  const summary = buildSummary(changes, sectionsEdited)

  return { changes, sections_edited: sectionsEdited, summary }
}

function buildSummary(changes, sectionsEdited) {
  const count = changes.length
  const sectionStr = sectionsEdited.join(' and ')

  if (count === 1) {
    const c = changes[0]
    return `Changed ${c.field_label} from ${c.old_value} to ${c.new_value}`
  }
  if (count <= 3) {
    const labels = changes.map((c) => c.field_label).join(', ')
    return `Updated ${labels} in ${sectionStr} section`
  }
  if (sectionsEdited.length === 1) {
    return `Updated ${count} fields in ${sectionStr} section`
  }
  return `Updated ${count} fields across ${sectionStr} sections`
}

/**
 * Build a human-readable summary for a create action.
 */
export function buildCreateSummary(eventData) {
  const parts = []
  if (eventData.guest_name) parts.push(eventData.guest_name.split(/\s+/).pop() || eventData.guest_name)
  if (eventData.event_type) parts.push(eventData.event_type === 'Other' ? (eventData.event_type_other || 'Other') : eventData.event_type)
  if (eventData.pax) parts.push(`${eventData.pax}pax`)
  if (eventData.shift) parts.push(eventData.shift.charAt(0).toUpperCase())
  const venue = VENUE_BY_ID[eventData.venue_id]
  if (venue) parts.push(venue.short)
  return `Created booking: ${parts.join(' | ') || eventData.title || 'Untitled'}`
}

/**
 * Build a human-readable summary for a delete action.
 */
export function buildDeleteSummary(eventData) {
  const parts = []
  if (eventData.title) parts.push(eventData.title)
  const venue = VENUE_BY_ID[eventData.venue_id]
  if (venue) parts.push(venue.short)
  return `Deleted booking: ${parts.join(' | ') || 'Unknown'}`
}

/**
 * Build a summary for soft-delete (CRM events).
 */
export function buildSoftDeleteSummary(eventData) {
  const parts = []
  if (eventData.title) parts.push(eventData.title)
  const venue = VENUE_BY_ID[eventData.venue_id]
  if (venue) parts.push(venue.short)
  return `Removed CRM-synced booking: ${parts.join(' | ') || 'Unknown'}`
}

/**
 * Build a summary for bulk delete.
 */
export function buildBulkDeleteSummary(startDate, endDate, count) {
  // Format month name from startDate
  const d = new Date(startDate + 'T00:00:00')
  const month = d.toLocaleString('en-US', { month: 'long', year: 'numeric' })
  return `Cleared ${month} — deleted ${count} bookings`
}
