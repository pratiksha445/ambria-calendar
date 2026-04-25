// Data-driven field configs for the booking form — mirrors
// ambria-knowledge-base.md §2 (field lists per category) and §4 (dropdowns).
//
// Field shape:
//   { key, label, type, required, options?, placeholder?,
//     showWhen?(form), disabledWhen?(form) }
//
// `getFormConfig(venueId)` returns an array of sections (each with a
// `title` and a `fields` array) so BookingForm can `.map()` them out.

import { VENUE_BY_ID } from './venues.js'

// ---------- Dropdown options (see knowledge base §3 + §4) ----------

export const EVENT_TYPES = [
  'Anand Karaj', 'Anniversary', 'Baby Shower', 'Birthday', 'Cocktail',
  'Conference', 'Corporate', 'Engagement', 'Exhibition', 'Haldi',
  'Intimate Gathering', 'Kirtan', 'Mehendi', 'Nikah', 'Proposal',
  'Reception', 'Religious Event', 'Sagan', 'Social Gathering', 'Wedding',
  'Other',
]

export const STATUSES = ['Confirmed', 'Tentative']
export const SHIFTS = ['Morning', 'Lunch', 'Sundowner', 'Dinner']
export const BOOKING_STATUSES = [
  'VMD', 'Only Rental', 'Rental + In-Decor', 'Rental + In-Ent', 'Rental + Chaat',
  'Rental + Add on Food', 'Rental + Outdoor Catering', 'Rental + Outdoor Decor', 'VMD + Outdoor Ent',
]
export const MENU_TYPES = ['Veg', 'Non-Veg', 'Jain', 'Chaat']
export const MENU_CATS = ['MV', 'MNV', 'DMV', 'DMNV', 'MCV', 'MCNV', 'LV', 'LNV', 'Customised']
export const FP_STATUSES = ['Released', 'Delayed by guest', 'Not Released']
export const DECOR_TYPES = ['Silver', 'Gold', 'Premium']
export const DECOR_STATUSES = ['Open', 'Meeting', 'Closure', 'Outdoor']
export const ENTERTAINMENT_STATUSES = ['Open', 'Meeting', 'Closure', 'Outdoor']
export const FUNCTION_CATEGORIES = ['Silver', 'Gold', 'Platinum']
export const PAYMENT_TIMINGS = ['Before Event', 'On the Day', 'After Event']
export const VENUE_TYPES = ['Lawn', 'Banquet', 'Lawn + Bqt', 'Poolside']
export const POOL_OPTIONS = ['Yes', 'No']
export const MEAL_OPTIONS = [
  'Breakfast',
  { value: 'Lunch', label: 'Lunch (meal)' },
  { value: 'Dinner', label: 'Dinner (meal)' },
  'All Meals',
  'None',
]

export const COUNTRY_CODES = [
  { value: '+91', code: '+91', flag: '\u{1F1EE}\u{1F1F3}', label: 'India' },
  { value: '+1_US', code: '+1', flag: '\u{1F1FA}\u{1F1F8}', label: 'USA' },
  { value: '+1_CA', code: '+1', flag: '\u{1F1E8}\u{1F1E6}', label: 'Canada' },
  { value: '+44', code: '+44', flag: '\u{1F1EC}\u{1F1E7}', label: 'UK' },
  { value: '+61', code: '+61', flag: '\u{1F1E6}\u{1F1FA}', label: 'Australia' },
  { value: '+971', code: '+971', flag: '\u{1F1E6}\u{1F1EA}', label: 'UAE' },
  { value: '+65', code: '+65', flag: '\u{1F1F8}\u{1F1EC}', label: 'Singapore' },
  { value: '+60', code: '+60', flag: '\u{1F1F2}\u{1F1FE}', label: 'Malaysia' },
]

export function getCodeFromValue(val) {
  const entry = COUNTRY_CODES.find((c) => c.value === val)
  return entry ? entry.code : '+91'
}

export function parsePhoneCode(storedPhone) {
  if (!storedPhone) return { value: '+91', number: '' }
  const s = String(storedPhone).trim()
  // Match longest code first (e.g. +971 before +9)
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length)
  for (const entry of sorted) {
    if (s.startsWith(entry.code)) {
      return { value: entry.value, number: s.slice(entry.code.length).trim() }
    }
  }
  return { value: '+91', number: s }
}

// ---------- Field builders (keeps configs terse) ----------

const S = (label, key, options, required = true, extra = {}) =>
  ({ type: 'select', label, key, options, required, ...extra })
const T = (label, key, required = true, extra = {}) =>
  ({ type: 'text', label, key, required, ...extra })
const D = (label, key, required = true, extra = {}) =>
  ({ type: 'date', label, key, required, ...extra })
const TM = (label, key, required = true, extra = {}) =>
  ({ type: 'time', label, key, required, ...extra })
const TA = (label, key, required = false, extra = {}) =>
  ({ type: 'textarea', label, key, required, ...extra })

// ---------- Input filters — strip invalid characters on keystroke ----------

const nameFilter = (v) => v.replace(/[^a-zA-Z\s.']/g, '')
const phoneFilter = (v) => v.replace(/[^\d\s]/g, '')
const paxFilter = (v) => v.replace(/\D/g, '')
const percentFilter = (v) => {
  const stripped = v.replace(/\D/g, '')
  if (stripped === '') return ''
  const n = parseInt(stripped, 10)
  if (n > 100) return '100'
  return String(n)
}
const venueNameFilter = (v) => v.replace(/[^a-zA-Z0-9\s.,\-'&()#]/g, '')

// ---------- Conditional helpers ----------

const notVMD = (f) => f.booking_status && f.booking_status !== 'VMD' && f.booking_status !== 'VMD + Outdoor Ent'
const isOther = (f) => f.event_type === 'Other'

// ---------- Per-category shared blocks ----------

const statusField = S('Status', 'status', STATUSES)
const notesField = TA('Notes', 'notes', false, { placeholder: 'Optional…' })

// Reusable validated field builders
const guestName = () => T('Guest Name', 'guest_name', true, {
  placeholder: 'e.g. Mr. Sharma', filterFn: nameFilter, filterError: 'Only letters allowed',
})
const phoneReq = () => ({
  type: 'phone', label: 'Phone', key: 'phone', required: true,
  filterFn: phoneFilter, filterError: 'Only numbers allowed',
  placeholder: '98765 43210', inputMode: 'tel',
})
const phoneOpt = () => ({
  type: 'phone', label: 'Phone', key: 'phone', required: false,
  filterFn: phoneFilter, filterError: 'Only numbers allowed',
  placeholder: '98765 43210', inputMode: 'tel',
})
const paxField = () => T('Pax', 'pax', true, {
  filterFn: paxFilter, filterError: 'Only numbers allowed', inputMode: 'numeric',
})
const salesPersonField = () => T('Sales Person', 'sales_person', true, {
  filterFn: nameFilter, filterError: 'Only letters allowed',
})
const venueNameField = (placeholder) => T('Venue Name', 'venue_name', true, {
  placeholder: placeholder || 'Hotel Taj, Farmhouse…', filterFn: venueNameFilter,
})
const tenderNameField = () => T('Tender Name', 'tender_name', true, {
  filterFn: nameFilter, filterError: 'Only letters allowed',
})

function eventTypeFields(dynamicTypes) {
  const options = dynamicTypes && dynamicTypes.length > 0 ? dynamicTypes : EVENT_TYPES
  return [
    S('Event Type', 'event_type', options),
    {
      ...T('Specify Event Type', 'event_type_other', true, {
        placeholder: 'Describe the event',
      }),
      showWhen: isOther,
    },
  ]
}

// AP/AM/AE/AR — venue booking
function ownVenueSections(venue, dynamicTypes) {
  return [
    {
      title: 'Venue',
      fields: [
        S('Sub-Venue', 'sub_venue', venue.subVenues),
        ...eventTypeFields(dynamicTypes),
        S('Shift', 'shift', SHIFTS),
        statusField,
      ],
    },
    {
      title: 'Date & Time',
      fields: [D('Date', 'date')],
    },
    {
      title: 'Event Schedule',
      fields: [
        TM('Assembly Time', 'time'),
        TM('Decor Time', 'decor_time'),
        TM('Chaat Time', 'chaat_time'),
        TM('Baraat Time', 'baraat_time'),
        TM('Varmala Time', 'varmala_time'),
        TM('Pheras Time', 'pheras_time'),
      ],
    },
    {
      title: 'Booking',
      fields: [
        S('Package Type', 'booking_status', BOOKING_STATUSES),
        S('Menu Type', 'menu_type', MENU_TYPES, true, { disabledWhen: notVMD }),
        S('Menu Category', 'menu_cat', MENU_CATS, true, { disabledWhen: notVMD }),
        S('FP', 'fp_status', FP_STATUSES, true, { disabledWhen: notVMD }),
      ],
    },
    {
      title: 'Operations',
      fields: [
        S('Decor Status', 'decor_status', DECOR_STATUSES),
        S('Entertainment Status', 'entertainment_status', ENTERTAINMENT_STATUSES),
        S('Function Category', 'function_category', FUNCTION_CATEGORIES),
        T('Delivery Person', 'delivery_person', true, {
          filterFn: nameFilter, filterError: 'Only letters allowed',
        }),
        T('Payment Remaining', 'payment_remaining', true, {
          filterFn: percentFilter, filterError: 'Only numbers 0-100',
          suffix: '%', inputMode: 'numeric',
        }),
        S('Payment Timing', 'payment_timing', PAYMENT_TIMINGS),
      ],
    },
    {
      title: 'Guest',
      fields: [
        guestName(),
        phoneReq(),
        paxField(),
        salesPersonField(),
        notesField,
      ],
    },
  ]
}

// Villa — stay booking
function villaSections(venue, _dynamicTypes) {
  return [
    {
      title: 'Stay',
      fields: [
        S('Sub-Venue', 'sub_venue', venue.subVenues),
        statusField,
      ],
    },
    {
      title: 'Dates',
      fields: [
        D('Check-In Date', 'check_in_date'),
        D('Check-Out Date', 'check_out_date'),
        TM('Check-In Time', 'check_in_time'),
        TM('Check-Out Time', 'check_out_time'),
      ],
    },
    {
      title: 'Inclusions',
      fields: [
        S('Pool Included', 'pool_included', POOL_OPTIONS),
        S('Meal Included', 'meal_included', MEAL_OPTIONS),
        T('Added Service', 'added_service', false, {
          placeholder: 'DJ, Bonfire, BBQ…',
        }),
      ],
    },
    {
      title: 'Guest',
      fields: [
        guestName(),
        phoneReq(),
        paxField(),
        salesPersonField(),
        notesField,
      ],
    },
  ]
}

// ADD — external venue decor
function addSections(_venue, dynamicTypes) {
  return [
    {
      title: 'Venue',
      fields: [
        venueNameField(),
        S('Venue Type', 'venue_type', VENUE_TYPES),
        T('Location', 'location', false, { placeholder: 'Google Maps link or address', mapLink: true }),
      ],
    },
    {
      title: 'Event',
      fields: [
        ...eventTypeFields(dynamicTypes),
        S('Shift', 'shift', SHIFTS),
        statusField,
        D('Date', 'date'),
        TM('Time', 'time'),
      ],
    },
    {
      title: 'Decor',
      fields: [S('Decor Type', 'decor_type', DECOR_TYPES)],
    },
    {
      title: 'Guest',
      fields: [
        guestName(),
        phoneReq(),
        salesPersonField(),
        notesField,
      ],
    },
  ]
}

// AC — external venue cuisine
function acSections(_venue, dynamicTypes) {
  return [
    {
      title: 'Venue',
      fields: [
        venueNameField(),
        S('Venue Type', 'venue_type', VENUE_TYPES),
        T('Location', 'location', false, { placeholder: 'Google Maps link or address', mapLink: true }),
      ],
    },
    {
      title: 'Event',
      fields: [
        ...eventTypeFields(dynamicTypes),
        S('Shift', 'shift', SHIFTS),
        statusField,
        D('Date', 'date'),
        TM('Time', 'time'),
      ],
    },
    {
      title: 'Menu',
      fields: [
        S('Menu Type', 'menu_type', MENU_TYPES),
        S('Menu Category', 'menu_cat', MENU_CATS),
      ],
    },
    {
      title: 'Guest',
      fields: [
        guestName(),
        phoneReq(),
        paxField(),
        salesPersonField(),
        notesField,
      ],
    },
  ]
}

// AEE — same as ADD minus decor
function aeeSections(_venue, dynamicTypes) {
  return [
    {
      title: 'Venue',
      fields: [
        venueNameField(),
        S('Venue Type', 'venue_type', VENUE_TYPES),
        T('Location', 'location', false, { placeholder: 'Google Maps link or address', mapLink: true }),
      ],
    },
    {
      title: 'Event',
      fields: [
        ...eventTypeFields(dynamicTypes),
        S('Shift', 'shift', SHIFTS),
        statusField,
        D('Date', 'date'),
        TM('Time', 'time'),
      ],
    },
    {
      title: 'Guest',
      fields: [
        guestName(),
        phoneReq(),
        salesPersonField(),
        notesField,
      ],
    },
  ]
}

// Tender — free text event, optional phone, no shift/pax/sales
function tenderSections(_venue, _dynamicTypes) {
  return [
    {
      title: 'Tender',
      fields: [
        venueNameField(),
        T('Location', 'location', false, { placeholder: 'Google Maps link or address', mapLink: true }),
        T('Event Type', 'event_type_text', true, { placeholder: 'e.g. Wedding Catering' }),
        statusField,
      ],
    },
    {
      title: 'Dates',
      fields: [
        D('Start Date', 'date'),
        D('End Date', 'end_date', false),
      ],
    },
    {
      title: 'Contact',
      fields: [
        tenderNameField(),
        phoneOpt(),
        notesField,
      ],
    },
  ]
}

// ---------- Field parity: valid keys per category ----------

const VENUE_FIELD_KEYS = [
  'sub_venue', 'event_type', 'event_type_other', 'shift', 'date', 'time',
  'decor_time', 'chaat_time', 'baraat_time', 'varmala_time', 'pheras_time',
  'booking_status', 'menu_type', 'menu_cat', 'fp_status',
  'decor_status', 'entertainment_status', 'function_category',
  'delivery_person', 'payment_remaining', 'payment_timing',
  'guest_name', 'phone', 'pax', 'sales_person', 'notes',
]

export const FIELD_MAP = {
  ap: VENUE_FIELD_KEYS,
  am: VENUE_FIELD_KEYS,
  ae: VENUE_FIELD_KEYS,
  ar: VENUE_FIELD_KEYS,
  villa: [
    'sub_venue', 'check_in_date', 'check_out_date', 'check_in_time', 'check_out_time',
    'pool_included', 'meal_included', 'added_service',
    'guest_name', 'phone', 'pax', 'sales_person', 'notes',
  ],
  add: [
    'venue_name', 'venue_type', 'location', 'event_type', 'event_type_other',
    'shift', 'date', 'time', 'decor_type',
    'guest_name', 'phone', 'sales_person', 'notes',
  ],
  ac: [
    'venue_name', 'venue_type', 'location', 'event_type', 'event_type_other',
    'shift', 'date', 'time', 'menu_type', 'menu_cat',
    'guest_name', 'phone', 'pax', 'sales_person', 'notes',
  ],
  aee: [
    'venue_name', 'venue_type', 'location', 'event_type', 'event_type_other',
    'shift', 'date', 'time',
    'guest_name', 'phone', 'sales_person', 'notes',
  ],
  tender: [
    'venue_name', 'location', 'event_type_text', 'date', 'end_date',
    'tender_name', 'phone', 'notes',
  ],
}

// Union of every saveable field key — used to null-out irrelevant columns.
export const ALL_SAVEABLE_KEYS = [
  'sub_venue', 'event_type', 'event_type_other', 'shift', 'date', 'time',
  'decor_time', 'chaat_time', 'baraat_time', 'varmala_time', 'pheras_time',
  'booking_status', 'menu_type', 'menu_cat', 'fp_status',
  'decor_status', 'entertainment_status', 'function_category',
  'delivery_person', 'payment_remaining', 'payment_timing',
  'guest_name', 'phone', 'pax', 'sales_person', 'notes',
  'check_in_date', 'check_out_date', 'check_in_time', 'check_out_time',
  'pool_included', 'meal_included', 'added_service',
  'venue_name', 'venue_type', 'location', 'decor_type',
  'tender_name', 'event_type_text', 'end_date',
]

// ---------- Public API ----------

const BUILDERS = {
  ap: ownVenueSections,
  am: ownVenueSections,
  ae: ownVenueSections,
  ar: ownVenueSections,
  villa: villaSections,
  add: addSections,
  ac: acSections,
  aee: aeeSections,
  tender: tenderSections,
}

export function getFormConfig(venueId, dynamicTypes) {
  const venue = VENUE_BY_ID[venueId]
  if (!venue) return []
  const build = BUILDERS[venueId]
  return build ? build(venue, dynamicTypes) : []
}

// Flatten sections to a single field list — convenient for validation.
export function getAllFields(venueId, dynamicTypes) {
  return getFormConfig(venueId, dynamicTypes).flatMap((s) => s.fields)
}

// Returns true if the given field is effectively required in the current
// form state (handles disabledWhen — disabled fields aren't required).
export function isFieldRequired(field, form) {
  if (!field.required) return false
  if (field.disabledWhen && field.disabledWhen(form)) return false
  if (field.showWhen && !field.showWhen(form)) return false
  return true
}
