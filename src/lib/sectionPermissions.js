// Section-level edit permissions for AP/AM/AE/AR booking forms.
// Returns a Set of section titles the current user may edit.
//
// Rules:
// - Admin and GM bypass all locks.
// - Division Head: department-scoped access (see DH_SCOPE below).
// - Venue: editable by admin, or user whose id matches sales_person_id or delivery_person_id
// - Decor: editable by admin, or Decor Sales + In-house/In-house+Outdoor,
//          or assigned decor_delivery_person
// - Entertainment: editable by admin, or Entertainment Sales + In-house/In-house+Outdoor,
//                  or assigned ent_delivery_person
// - New bookings (no id): all sections editable
// - Non-AP/AM/AE/AR categories: no section locks (permission via canAccessBooking)

const OWN_VENUE_IDS = new Set(['ap', 'am', 'ae', 'ar'])
const INHOUSE_TYPES = new Set(['In-house', 'In-house + Outdoor'])

// Division Head department → { ownVenueSection, standaloneCategory }
// ownVenueSection: which AP/AM/AE/AR section they can unlock
// standaloneCategory: which standalone category they can edit any booking in
const DH_SCOPE = {
  'Venue Sales':         { ownVenueSection: 'Venue',         standalone: new Set(['villa']) },
  'Decor Sales':         { ownVenueSection: 'Decor',         standalone: new Set(['add']) },
  'Entertainment Sales': { ownVenueSection: 'Entertainment', standalone: new Set(['aee']) },
  'Catering Sales':      { ownVenueSection: null,            standalone: new Set(['ac']) },
}

function isDH(user) {
  return user?.role === 'division_head'
}

function dhScope(user) {
  if (!isDH(user)) return null
  return DH_SCOPE[user.department] || null
}

/** Match user against a booking's assigned-person field (id preferred, name fallback). */
function matchesAssigned(user, eventId, eventName) {
  if (eventId && user?.id === eventId) return true
  if (!eventId && eventName && user?.name === eventName) return true
  return false
}

/**
 * Returns true if the user should be allowed to open/edit a booking
 * (i.e. the Edit button should be visible in EventCard / DayModal).
 *
 * For non-AP/AM/AE/AR, falls back to creator check.
 * For AP/AM/AE/AR, also checks assigned-person fields, department, and DH scope.
 */
export function canAccessBooking(user, event) {
  if (!user || !event) return false
  if (user.role === 'admin') return true
  if (user.role === 'gm') return true
  if (event.created_by != null && user.id === event.created_by) return true

  // Division Head: department-scoped access to standalone categories
  const scope = dhScope(user)
  if (scope) {
    // Standalone categories (Villa, ADD, AC, AEE)
    if (scope.standalone.has(event.venue_id)) return true
    // AP/AM/AE/AR: DH always gets access (section locking handled by getEditableSections)
    if (OWN_VENUE_IDS.has(event.venue_id) && scope.ownVenueSection) return true
  }

  // For AP/AM/AE/AR: check if user is an assigned person or has department access
  if (OWN_VENUE_IDS.has(event.venue_id)) {
    // Venue section: sales_person or delivery_person
    if (matchesAssigned(user, event.sales_person_id, event.sales_person)) return true
    if (matchesAssigned(user, event.delivery_person_id, event.delivery_person)) return true
    // Decor section: decor_delivery_person, decor_operation_manager, or department match
    if (matchesAssigned(user, event.decor_delivery_person_id, event.decor_delivery_person)) return true
    if (matchesAssigned(user, event.decor_operation_manager_id, event.decor_operation_manager)) return true
    if (user.department === 'Decor Sales' && INHOUSE_TYPES.has(user.sales_type)) return true
    // Entertainment section: ent_delivery_person or department match
    if (matchesAssigned(user, event.ent_delivery_person_id, event.ent_delivery_person)) return true
    if (user.department === 'Entertainment Sales' && INHOUSE_TYPES.has(user.sales_type)) return true
    // Operation manager
    if (matchesAssigned(user, event.operation_manager_id, event.operation_manager)) return true
  }

  // Standalone categories: staff can edit if assigned as sales_person
  if (matchesAssigned(user, event.sales_person_id, event.sales_person)) return true

  return false
}

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
  // Admin and GM bypass all locks
  if (user?.role === 'admin') return null
  if (user?.role === 'gm') return null

  const editable = new Set()

  // Division Head: unlock only their department's section
  const scope = dhScope(user)
  if (scope?.ownVenueSection) {
    editable.add(scope.ownVenueSection)
  }

  // Venue section: editable if user is sales_person or delivery_person
  if (
    matchesAssigned(user, event.sales_person_id, event.sales_person) ||
    matchesAssigned(user, event.delivery_person_id, event.delivery_person)
  ) {
    editable.add('Venue')
  }

  // Decor section: editable if user is Decor Sales/Ops + In-house type, or assigned decor delivery/operation person
  if (
    (user?.department === 'Decor Sales' && INHOUSE_TYPES.has(user?.sales_type)) ||
    matchesAssigned(user, event.decor_delivery_person_id, event.decor_delivery_person) ||
    matchesAssigned(user, event.decor_operation_manager_id, event.decor_operation_manager)
  ) {
    editable.add('Decor')
  }

  // Entertainment section: editable if user is Entertainment Sales + In-house type, or assigned ent delivery person
  if (
    (user?.department === 'Entertainment Sales' && INHOUSE_TYPES.has(user?.sales_type)) ||
    matchesAssigned(user, event.ent_delivery_person_id, event.ent_delivery_person)
  ) {
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
