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

// ── Entry number field per department ──
const ENTRY_NO_FIELDS = {
  venue: 'fisc_entryno',
  decor: 'dhc_entry_no',
  catering: 'chc_entry_no',
  entertainment: 'ehc_entry_no',
}

// ── Time field per department (for sorting functions within a group) ──
const TIME_FIELDS = {
  venue: 'fiscd_function_timings',
  decor: 'dhcd_time',
  catering: 'chcd_time',
  entertainment: 'ehcd_time',
}

/** Group flat contract rows by entry number. Returns array of { entryNo, guest, venueName, rows[] } */
export function groupContractsByEntry(contracts, department) {
  const entryField = ENTRY_NO_FIELDS[department]
  const timeField = TIME_FIELDS[department]
  const groups = new Map()

  for (const c of contracts) {
    const entryNo = String(c[entryField] || '').trim() || `_no_entry_${groups.size}`
    if (!groups.has(entryNo)) {
      let guest = '', venueName = ''
      if (department === 'venue') {
        guest = c.fisc_guest_name || ''
      } else if (department === 'decor') {
        guest = c.dhc_guest_name || ''
        venueName = c.dhcd_venue2 || ''
      } else if (department === 'catering') {
        guest = c.chc_guest_name || ''
        venueName = c.chcd_venue2 || ''
      } else if (department === 'entertainment') {
        guest = c.ehc_guest_name || ''
        venueName = c.ehcd_venue2 || ''
      }
      groups.set(entryNo, { entryNo, guest, venueName, rows: [] })
    }
    groups.get(entryNo).rows.push(c)
  }

  // Sort rows within each group by time (earliest first)
  for (const g of groups.values()) {
    g.rows.sort((a, b) => {
      const ta = String(a[timeField] || '').replace(/[^0-9:]/g, '')
      const tb = String(b[timeField] || '').replace(/[^0-9:]/g, '')
      return ta.localeCompare(tb)
    })
  }

  return [...groups.values()]
}

/** Build grouped picker label: "Guest | VenueName — #Entry (N functions)" */
export function groupLabel(group, department) {
  const parts = department === 'venue'
    ? [group.guest]
    : [group.guest, group.venueName]
  const label = parts.filter(Boolean).join(' | ')
  const entryPart = group.entryNo.startsWith('_no_entry_') ? '' : ` — #${group.entryNo}`
  const countPart = group.rows.length > 1 ? ` (${group.rows.length} functions)` : ''
  return `${label}${entryPart}${countPart}`
}

/** Get list of function type display names for a group's rows */
export function groupFuncNames(group, department) {
  return group.rows.map((c) => resolveFuncName(c, department)).filter(Boolean)
}

// ── Check if venue contract matches selected category ──
export function contractVenueMatch(contract, venueId) {
  const lmsVenueId = String(contract.fiscd_venue_id || '')
  const mappedCat = LMS_VENUE_TO_CAT[lmsVenueId]
  if (!mappedCat) return true // unknown venue — don't warn
  return mappedCat === venueId
}

// Keys that live on eventSlots for slot-based categories (ADD/AC/AEE)
const SLOT_FIELD_KEYS = new Set([
  'event_type', 'event_type_other', 'shift', 'time', 'pax',
  'decor_type', 'color_theme', 'menu_type', 'menu_cat', 'elements',
])

/** Extract per-function (slot-level) fields from a single contract row */
function extractSlotFields(row, department) {
  const slot = {}

  const funcIdField = FUNC_ID_FIELDS[department]
  const funcId = funcIdField ? (row[funcIdField] || '') : ''
  const funcName = resolveFuncName(row, department)
  const et = mapEventType(funcId, funcName)
  if (et.event_type) slot.event_type = et.event_type
  if (et.event_type_other) slot.event_type_other = et.event_type_other

  if (department === 'venue') {
    const shift = mapSession(row.fiscd_session, row.fiscd_function_timings)
    if (shift) slot.shift = shift
    if (row.fiscd_function_timings) slot.time = row.fiscd_function_timings
    if (row.fiscd_pax_no) slot.pax = String(row.fiscd_pax_no)
    const menuId = row.fiscd_menu || ''
    const menuName = row.menuname || ''
    if (menuId) {
      const { menuType, menuCat } = mapMenuFromId(menuId, menuName)
      if (menuType) slot.menu_type = menuType
      if (menuCat) slot.menu_cat = menuCat
    }
  } else if (department === 'decor') {
    const shift = mapSession(row.dhcd_session, row.dhcd_time)
    if (shift) slot.shift = shift
    if (row.dhcd_time) slot.time = row.dhcd_time
    if (row.dhcd_pax) slot.pax = String(row.dhcd_pax)
    const decorType = mapDecorType(row.dhc_priority)
    if (decorType) slot.decor_type = decorType
  } else if (department === 'catering') {
    const shift = mapSession(row.chcd_session, row.chcd_time)
    if (shift) slot.shift = shift
    if (row.chcd_time) slot.time = row.chcd_time
    if (row.chcd_pax) slot.pax = String(row.chcd_pax)
    const cateringType = row.chcd_catering || ''
    const menuId = row.chcd_menu || ''
    const menuName = row.menuname || ''
    if (cateringType || menuId) {
      const { menuType, menuCat } = mapCateringMenu(cateringType, menuId, menuName)
      if (menuType) slot.menu_type = menuType
      if (menuCat) slot.menu_cat = menuCat
    }
  } else if (department === 'entertainment') {
    const shift = mapSession(row.ehcd_session, row.ehcd_time)
    if (shift) slot.shift = shift
    if (row.ehcd_time) slot.time = row.ehcd_time
  }

  return slot
}

/** Extract header-level (form-level) fields from the first contract row */
function extractFormFields(row, department, subVenues) {
  const fields = {}

  if (department === 'venue') {
    if (row.fisc_guest_name) fields.guest_name = row.fisc_guest_name
    if (row.fisc_client_mobile) fields.phone = row.fisc_client_mobile
    const location = row.address1 || ''
    if (location && subVenues) {
      const sv = fuzzySubVenue(location, subVenues)
      if (sv) fields.sub_venue = sv
    }
    // If any menu data present, set booking_status
    if (row.fiscd_menu) fields.booking_status = 'VMD'
    fields._lms_entry_no = row.fisc_entryno || ''
    fields._lms_head_id = row.fisc_id || ''
  } else if (department === 'decor') {
    if (row.dhc_guest_name) fields.guest_name = row.dhc_guest_name
    if (row.dhc_contact_no) fields.phone = row.dhc_contact_no
    if (row.dhcd_venue2) fields.venue_name = row.dhcd_venue2
    if (row.dhcd_address2) fields.location = row.dhcd_address2
    fields._lms_entry_no = row.dhc_entry_no || ''
    fields._lms_head_id = row.dhc_id || ''
  } else if (department === 'catering') {
    if (row.chc_guest_name) fields.guest_name = row.chc_guest_name
    if (row.chc_contact_no) fields.phone = row.chc_contact_no
    if (row.chcd_venue2) fields.venue_name = row.chcd_venue2
    if (row.chcd_address2) fields.location = row.chcd_address2
    fields._lms_entry_no = row.chc_entry_no || ''
    fields._lms_head_id = row.chc_id || ''
  } else if (department === 'entertainment') {
    if (row.ehc_guest_name) fields.guest_name = row.ehc_guest_name
    if (row.ehc_contact_no) fields.phone = row.ehc_contact_no
    if (row.ehcd_venue2) fields.venue_name = row.ehcd_venue2
    if (row.ehcd_address2) fields.location = row.ehcd_address2
    fields._lms_entry_no = row.ehc_entry_no || ''
    fields._lms_head_id = row.ehc_id || ''
  }

  return fields
}

// ── Map a grouped contract (multiple rows) to form + slots ──
// Returns { formFields, slots: [{...}, ...], extraFuncNames: string[] | null }
// - formFields: header-level fields for the form state
// - slots: array of slot field objects (one per function row)
// - extraFuncNames: for venue categories with >1 function, names of functions 2..N
//                   (venue doesn't support multi-slot, so only first is applied)
export function mapGroupToForm(group, department, venueId, subVenues) {
  const firstRow = group.rows[0]
  const formFields = extractFormFields(firstRow, department, subVenues)

  // For venue (AP/AM/AE/AR): no multi-slot support — merge first row's event
  // fields directly into formFields, report extras
  if (department === 'venue') {
    const firstSlot = extractSlotFields(firstRow, department)
    Object.assign(formFields, firstSlot)
    const extraFuncNames = group.rows.length > 1
      ? group.rows.slice(1).map((r) => resolveFuncName(r, department)).filter(Boolean)
      : null
    return { formFields, slots: [], extraFuncNames }
  }

  // For slot-based categories (ADD/AC/AEE): build one slot per row
  const slots = group.rows.map((row) => extractSlotFields(row, department))
  return { formFields, slots, extraFuncNames: null }
}
