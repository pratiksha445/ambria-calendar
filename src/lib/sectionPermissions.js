// Section-level edit permissions for AP/AM/AE/AR booking forms.
// Returns a Set of section titles the current user may edit.
//
// Rules:
// - Venue: editable by admin, or user whose id matches sales_person_id or delivery_person_id
// - Decor: editable by admin, or Decor Sales + In-house/In-house+Outdoor
// - Entertainment: editable by admin, or Entertainment Sales + In-house/In-house+Outdoor
// - New bookings (no id): all sections editable
// - Non-AP/AM/AE/AR categories: no section locks

const OWN_VENUE_IDS = new Set(['ap', 'am', 'ae', 'ar'])
const INHOUSE_TYPES = new Set(['In-house', 'In-house + Outdoor'])

/**
 * @param {object} user   - current logged-in user { id, role, department, sales_type }
 * @param {object} event  - existing booking row (null for new bookings)
 * @param {string} venueId
 * @returns {Set<string>|null}  Set of editable section titles, or null if no locks apply
 */
export function getEditableSections(user, event, venueId) {
  // No locks for new bookings
  if (!event?.id) return null
  // No locks for non-venue categories
  if (!OWN_VENUE_IDS.has(venueId)) return null
  // Admin bypasses all locks
  if (user?.role === 'admin') return null

  const editable = new Set()

  // Venue section: editable if user is sales_person or delivery_person
  if (
    (event.sales_person_id && user?.id === event.sales_person_id) ||
    (event.delivery_person_id && user?.id === event.delivery_person_id) ||
    // Fallback for old data without _id: match by name
    (!event.sales_person_id && event.sales_person && user?.name === event.sales_person) ||
    (!event.delivery_person_id && event.delivery_person && user?.name === event.delivery_person)
  ) {
    editable.add('Venue')
  }

  // Decor section: editable if user is Decor Sales + In-house type
  if (user?.department === 'Decor Sales' && INHOUSE_TYPES.has(user?.sales_type)) {
    editable.add('Decor')
  }

  // Entertainment section: editable if user is Entertainment Sales + In-house type
  if (user?.department === 'Entertainment Sales' && INHOUSE_TYPES.has(user?.sales_type)) {
    editable.add('Entertainment')
  }

  return editable
}

/**
 * Returns the set of field keys belonging to locked (non-editable) sections.
 * Used to strip those keys from the update payload.
 */
export function getLockedFieldKeys(sections, editableSections) {
  if (!editableSections) return new Set() // no locks
  const locked = new Set()
  for (const section of sections) {
    const title = section.title || ''
    if (!title || editableSections.has(title)) continue
    // Notes section (no title) is always editable
    for (const field of section.fields) {
      if (field.type === 'group') {
        for (const f of field.fields) {
          locked.add(f.key)
          if (f.inlineCheckbox) locked.add(f.inlineCheckbox.key)
        }
      } else {
        locked.add(field.key)
        if (field.inlineCheckbox) locked.add(field.inlineCheckbox.key)
      }
    }
  }
  return locked
}
