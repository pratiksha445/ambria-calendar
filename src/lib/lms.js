/**
 * LMS contract fetch + field-mapping helpers.
 * Used by BookingForm to pull contract data from the LMS proxy edge function.
 */

// ── Category → LMS department ──
const DEPT_MAP = {
  ap: 'venue', am: 'venue', ae: 'venue', ar: 'venue',
  add: 'decor', ac: 'catering', aee: 'entertainment',
}

export function getLmsDepartment(venueId) {
  return DEPT_MAP[venueId] || null
}

// ── LMS venue_id → app category ──
const LMS_VENUE_TO_CAT = { '3': 'ap', '6': 'am', '19': 'ae', '16': 'ar' }

// ── Function type ID → display name (for picker labels) ──
const FUNCTION_TYPE_NAMES = {
  '1': 'Ring Ceremony', '2': 'Birthday', '3': 'Wedding', '4': 'Reception',
  '5': 'Kua Poojan', '6': 'Anniversary', '7': 'Lagan', '8': 'Sagan',
  '9': 'Cocktail', '10': 'Religious', '11': 'Corporate', '12': 'Proposal Ceremony',
  '14': 'Haldi', '15': 'Mehendi', '16': 'Roka Ceremony', '17': 'Residential Wedding',
  '18': 'Destination Wedding', '19': 'Kothi Booking', '20': 'Sangeet',
  '21': 'Baby Shower', '22': 'Engagement', '23': 'Tender', '24': 'Barat Assembly',
  '25': 'House Party', '26': 'Lunch Function', '27': 'Breakfast Function',
  '28': 'Dinner Function', '29': 'Breakfast', '30': 'Lunch', '31': 'Kitty Party',
  '32': 'Restaurant Sale', '33': 'Lohri', '34': 'Diwali Party',
  '35': 'Get Together', '36': 'Mata Ki Chowki',
}

// ── Cancel-remarks field per department (for client-side filtering) ──
const CANCEL_FIELDS = {
  venue: 'fisc_cancel_remarks',
  decor: 'dhc_cancel_remarks',
  catering: 'chc_cancel_remarks',
  entertainment: 'ehc_cancel_remarks',
}

// ── Function type ID field per department ──
const FUNC_ID_FIELDS = {
  venue: 'fiscd_function_type',
  decor: 'dhcd_function',
  catering: 'chcd_function',
  entertainment: 'ehcd_function',
}

/** Resolve display name for a contract's event/function type */
function resolveFuncName(contract, department) {
  const name = contract.functionname
  if (name && String(name).trim()) return String(name).trim()
  const idField = FUNC_ID_FIELDS[department]
  const id = idField ? String(contract[idField] || '') : ''
  return FUNCTION_TYPE_NAMES[id] || ''
}

/** Check if a contract is cancelled (client-side secondary filter) */
export function isContractCancelled(contract, department) {
  const field = CANCEL_FIELDS[department]
  if (!field) return false
  const val = contract[field]
  if (val && typeof val === 'string' && val.trim() !== '') return true
  return false
}

// ── Function type ID → event type ──
const FUNC_TYPE_MAP = {
  '1':  { type: 'Other', other: 'Ring Ceremony' },
  '2':  { type: 'Birthday' },
  '3':  { type: 'Wedding' },
  '4':  { type: 'Reception' },
  '5':  { type: 'Other', other: 'Kua Poojan' },
  '6':  { type: 'Anniversary' },
  '7':  { type: 'Other', other: 'Lagan' },
  '8':  { type: 'Sagan' },
  '9':  { type: 'Cocktail' },
  '10': { type: 'Religious Event' },
  '11': { type: 'Corporate' },
  '12': { type: 'Other', other: 'Proposal' },
  '14': { type: 'Haldi' },
  '15': { type: 'Mehendi' },
  '16': { type: 'Other', other: 'Roka Ceremony' },
  '17': { type: 'Other', other: 'Residential Wedding' },
  '18': { type: 'Other', other: 'Destination Wedding' },
  '19': { type: 'Other', other: 'Kothi Booking' },
  '20': { type: 'Other', other: 'Sangeet' },
  '21': { type: 'Baby Shower' },
  '22': { type: 'Engagement' },
  '23': { type: 'Other' },
  '24': { type: 'Other', other: 'Barat Assembly' },
  '25': { type: 'Other', other: 'House Party' },
  '26': { type: 'Other', other: 'Lunch Function' },
  '27': { type: 'Other', other: 'Breakfast Function' },
  '28': { type: 'Other', other: 'Dinner Function' },
  '29': { type: 'Other', other: 'Breakfast' },
  '30': { type: 'Other', other: 'Lunch' },
  '31': { type: 'Other', other: 'Kitty Party' },
  '32': { type: 'Other', other: 'Restaurant Sale' },
  '33': { type: 'Other', other: 'Lohri' },
  '34': { type: 'Other', other: 'Diwali Party' },
  '35': { type: 'Social Gathering' },
  '36': { type: 'Religious Event' },
}

// ── Session → Shift ──
function mapSession(session, time) {
  if (session === 'Lunch' || session === 'Dinner' || session === 'Morning' || session === 'Sundowner') return session
  // Time-based inference
  if (time) {
    const match = String(time).match(/^(\d{1,2}):?(\d{2})?/)
    if (match) {
      const h = parseInt(match[1], 10)
      if (h < 12) return 'Morning'
      if (h < 15) return 'Lunch'
      if (h < 17) return 'Sundowner'
      return 'Dinner'
    }
  }
  return ''
}

// ── Menu ID → { menuType, menuCat } ──
const VEG_MENU_IDS = new Set([2, 4, 6, 8, 32, 34, 36])
const NV_MENU_IDS = new Set([3, 5, 7, 9, 22, 33, 35, 37])

function mapMenuFromId(menuId, menuName) {
  const id = Number(menuId)
  const isVeg = VEG_MENU_IDS.has(id)
  const isNv = NV_MENU_IDS.has(id)
  const menuType = isVeg ? 'Veg' : isNv ? 'Non-Veg' : ''
  let menuCat = ''
  if (menuName) {
    const n = menuName.toLowerCase()
    if (n.includes('custom')) {
      menuCat = 'Customised'
    } else if (n.includes('double magnum')) {
      menuCat = isVeg ? 'DMV' : 'DMNV'
    } else if (n.includes('magnum') || n.includes('pearl')) {
      menuCat = isVeg ? 'MV' : 'MNV'
    } else if (n.includes('multi cuisine') || n.includes('multi-cuisine')) {
      menuCat = isVeg ? 'MCV' : 'MCNV'
    } else if (n.includes('luxury') || n.includes('bliss')) {
      menuCat = isVeg ? 'LV' : 'LNV'
    } else if (n.includes('sapphire')) {
      menuCat = isVeg ? 'DMV' : 'DMNV'
    }
  }
  return { menuType, menuCat }
}

function mapCateringMenu(cateringType, menuId, menuName) {
  const isVeg = cateringType === 'Veg'
  const menuType = isVeg ? 'Veg' : (cateringType === 'Non Veg' ? 'Non-Veg' : '')
  let menuCat = ''
  if (menuName) {
    const n = menuName.toLowerCase()
    if (n.includes('custom')) {
      menuCat = 'Customised'
    } else if (n.includes('double magnum')) {
      menuCat = isVeg ? 'DMV' : 'DMNV'
    } else if (n.includes('magnum') || n.includes('pearl')) {
      menuCat = isVeg ? 'MV' : 'MNV'
    } else if (n.includes('multi cuisine') || n.includes('multi-cuisine')) {
      menuCat = isVeg ? 'MCV' : 'MCNV'
    } else if (n.includes('luxury') || n.includes('bliss')) {
      menuCat = isVeg ? 'LV' : 'LNV'
    } else if (n.includes('sapphire')) {
      menuCat = isVeg ? 'DMV' : 'DMNV'
    }
  }
  return { menuType, menuCat }
}

// ── Decor priority → decor_type ──
function mapDecorType(priority) {
  if (!priority) return ''
  const p = priority.toLowerCase()
  if (p === 'silver') return 'Silver'
  if (p === 'gold') return 'Gold'
  if (p === 'premium' || p === 'platinum') return 'Premium'
  return ''
}

// ── Fuzzy sub-venue match ──
function fuzzySubVenue(locationStr, subVenues) {
  if (!locationStr || !subVenues || subVenues.length === 0) return ''
  const loc = locationStr.toLowerCase()
  // Try exact match first
  for (const sv of subVenues) {
    if (sv.toLowerCase() === loc) return sv
  }
  // Try "includes" match
  for (const sv of subVenues) {
    if (loc.includes(sv.toLowerCase()) || sv.toLowerCase().includes(loc)) return sv
  }
  return ''
}

// ── Title-case a string (e.g. "MEHENDI" → "Mehendi") ──
function titleCase(s) {
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

// ── Known event type dropdown values (must match formFields.js EVENT_TYPES exactly) ──
const KNOWN_EVENT_TYPES = new Set([
  'Anand Karaj', 'Anniversary', 'Baby Shower', 'Birthday', 'Cocktail',
  'Conference', 'Corporate', 'Engagement', 'Exhibition', 'Haldi',
  'Intimate Gathering', 'Kirtan', 'Mehendi', 'Nikah', 'Proposal',
  'Reception', 'Religious Event', 'Sagan', 'Social Gathering', 'Wedding',
  'Other',
])

/** Try to match a raw LMS function name to a known dropdown value (case-insensitive) */
function matchKnownType(name) {
  if (!name) return null
  const lower = name.trim().toLowerCase()
  for (const t of KNOWN_EVENT_TYPES) {
    if (t.toLowerCase() === lower) return t
  }
  return null
}

// ── Map event type from function ID / name ──
function mapEventType(funcTypeId, funcName) {
  const mapped = FUNC_TYPE_MAP[String(funcTypeId)]
  if (mapped) {
    return {
      event_type: mapped.type,
      event_type_other: mapped.other || (mapped.type === 'Other' && funcName ? titleCase(funcName) : ''),
    }
  }
  // If we have a function name from the API, try to match to a known dropdown value
  if (funcName) {
    const known = matchKnownType(funcName)
    if (known) return { event_type: known, event_type_other: '' }
    return { event_type: 'Other', event_type_other: titleCase(funcName) }
  }
  return { event_type: '', event_type_other: '' }
}

// ── Build display label for contract picker ──
export function contractLabel(contract, department) {
  const funcType = resolveFuncName(contract, department)
  let guest = '', session = '', entryNo = '', venueName = ''

  if (department === 'venue') {
    guest = contract.fisc_guest_name || ''
    session = contract.fiscd_session || ''
    entryNo = contract.fisc_entryno || ''
  } else if (department === 'decor') {
    guest = contract.dhc_guest_name || ''
    session = contract.dhcd_session || ''
    entryNo = contract.dhc_entry_no || ''
    venueName = contract.dhcd_venue2 || ''
  } else if (department === 'catering') {
    guest = contract.chc_guest_name || ''
    session = contract.chcd_session || ''
    entryNo = contract.chc_entry_no || ''
    venueName = contract.chcd_venue2 || ''
  } else if (department === 'entertainment') {
    guest = contract.ehc_guest_name || ''
    session = contract.ehcd_session || ''
    entryNo = contract.ehc_entry_no || ''
    venueName = contract.ehcd_venue2 || ''
  }

  // Venue (in-house): "Guest | EVENT_TYPE | Shift — #Entry"
  // Outdoor (decor/catering/ent): "Guest | EVENT_TYPE | VenueName | Shift — #Entry"
  const parts = department === 'venue'
    ? [guest, funcType, session]
    : [guest, funcType, venueName, session]
  const label = parts.filter(Boolean).join(' | ')
  return entryNo ? `${label} — #${entryNo}` : label
}

// ── Check if venue contract matches selected category ──
export function contractVenueMatch(contract, venueId) {
  const lmsVenueId = String(contract.fiscd_venue_id || '')
  const mappedCat = LMS_VENUE_TO_CAT[lmsVenueId]
  if (!mappedCat) return true // unknown venue — don't warn
  return mappedCat === venueId
}

// Keys that live on eventSlots[0] for slot-based categories (ADD/AC/AEE)
const SLOT_FIELD_KEYS = new Set([
  'event_type', 'event_type_other', 'shift', 'time', 'pax',
  'decor_type', 'color_theme', 'menu_type', 'menu_cat', 'elements',
])

// ── Map contract fields to form state ──
// Returns { formFields: {...}, slotFields: {...} }
// For venue (AP/AM/AE/AR), everything goes into formFields.
// For slot-based categories (ADD/AC/AEE), per-event fields go into slotFields.
export function mapContractToForm(contract, department, venueId, subVenues) {
  const raw = {}

  if (department === 'venue') {
    const funcId = contract.fiscd_function_type || ''
    const funcName = resolveFuncName(contract, department)
    const et = mapEventType(funcId, funcName)
    if (et.event_type) raw.event_type = et.event_type
    if (et.event_type_other) raw.event_type_other = et.event_type_other

    if (contract.fisc_guest_name) raw.guest_name = contract.fisc_guest_name
    if (contract.fisc_client_mobile) raw.phone = contract.fisc_client_mobile

    const shift = mapSession(contract.fiscd_session, contract.fiscd_function_timings)
    if (shift) raw.shift = shift
    if (contract.fiscd_function_timings) raw.time = contract.fiscd_function_timings

    const pax = contract.fiscd_pax_no
    if (pax) raw.pax = String(pax)

    // Menu
    const menuId = contract.fiscd_menu || ''
    const menuName = contract.menuname || ''
    if (menuId) {
      const { menuType, menuCat } = mapMenuFromId(menuId, menuName)
      if (menuType) raw.menu_type = menuType
      if (menuCat) raw.menu_cat = menuCat
      raw.booking_status = 'VMD'
    }

    // Sub-venue
    const location = contract.address1 || ''
    if (location && subVenues) {
      const sv = fuzzySubVenue(location, subVenues)
      if (sv) raw.sub_venue = sv
    }

    // Store LMS identifiers
    raw._lms_entry_no = contract.fisc_entryno || ''
    raw._lms_head_id = contract.fisc_id || ''
  }

  if (department === 'decor') {
    const funcId = contract.dhcd_function || ''
    const funcName = resolveFuncName(contract, department)
    const et = mapEventType(funcId, funcName)
    if (et.event_type) raw.event_type = et.event_type
    if (et.event_type_other) raw.event_type_other = et.event_type_other

    if (contract.dhc_guest_name) raw.guest_name = contract.dhc_guest_name
    if (contract.dhc_contact_no) raw.phone = contract.dhc_contact_no

    const shift = mapSession(contract.dhcd_session, contract.dhcd_time)
    if (shift) raw.shift = shift
    if (contract.dhcd_time) raw.time = contract.dhcd_time
    if (contract.dhcd_venue2) raw.venue_name = contract.dhcd_venue2
    if (contract.dhcd_address2) raw.location = contract.dhcd_address2

    const pax = contract.dhcd_pax
    if (pax) raw.pax = String(pax)

    const decorType = mapDecorType(contract.dhc_priority)
    if (decorType) raw.decor_type = decorType

    raw._lms_entry_no = contract.dhc_entry_no || ''
    raw._lms_head_id = contract.dhc_id || ''
  }

  if (department === 'catering') {
    const funcId = contract.chcd_function || ''
    const funcName = resolveFuncName(contract, department)
    const et = mapEventType(funcId, funcName)
    if (et.event_type) raw.event_type = et.event_type
    if (et.event_type_other) raw.event_type_other = et.event_type_other

    if (contract.chc_guest_name) raw.guest_name = contract.chc_guest_name
    if (contract.chc_contact_no) raw.phone = contract.chc_contact_no

    const shift = mapSession(contract.chcd_session, contract.chcd_time)
    if (shift) raw.shift = shift
    if (contract.chcd_time) raw.time = contract.chcd_time
    if (contract.chcd_venue2) raw.venue_name = contract.chcd_venue2
    if (contract.chcd_address2) raw.location = contract.chcd_address2

    const pax = contract.chcd_pax
    if (pax) raw.pax = String(pax)

    // Catering menu
    const cateringType = contract.chcd_catering || ''
    const menuId = contract.chcd_menu || ''
    const menuName = contract.menuname || ''
    if (cateringType || menuId) {
      const { menuType, menuCat } = mapCateringMenu(cateringType, menuId, menuName)
      if (menuType) raw.menu_type = menuType
      if (menuCat) raw.menu_cat = menuCat
    }

    raw._lms_entry_no = contract.chc_entry_no || ''
    raw._lms_head_id = contract.chc_id || ''
  }

  if (department === 'entertainment') {
    const funcId = contract.ehcd_function || ''
    const funcName = resolveFuncName(contract, department)
    const et = mapEventType(funcId, funcName)
    if (et.event_type) raw.event_type = et.event_type
    if (et.event_type_other) raw.event_type_other = et.event_type_other

    if (contract.ehc_guest_name) raw.guest_name = contract.ehc_guest_name
    if (contract.ehc_contact_no) raw.phone = contract.ehc_contact_no

    const shift = mapSession(contract.ehcd_session, contract.ehcd_time)
    if (shift) raw.shift = shift
    if (contract.ehcd_time) raw.time = contract.ehcd_time
    if (contract.ehcd_venue2) raw.venue_name = contract.ehcd_venue2
    if (contract.ehcd_address2) raw.location = contract.ehcd_address2

    raw._lms_entry_no = contract.ehc_entry_no || ''
    raw._lms_head_id = contract.ehc_id || ''
  }

  // Split into form-level fields and slot-level fields
  // For venue categories (AP/AM/AE/AR), all fields are form-level.
  // For slot categories (ADD/AC/AEE), event-specific fields go to slotFields.
  const isSlotCategory = department !== 'venue'
  const formFields = {}
  const slotFields = {}

  for (const [key, val] of Object.entries(raw)) {
    if (isSlotCategory && SLOT_FIELD_KEYS.has(key)) {
      slotFields[key] = val
    } else {
      formFields[key] = val
    }
  }

  return { formFields, slotFields }
}
