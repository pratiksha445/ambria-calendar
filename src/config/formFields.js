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
export const MENU_TYPES = ['Veg', 'Non-Veg', 'Jain']
export const MENU_CATS = ['MV', 'MNV', 'DMV', 'DMNV', 'MCV', 'MCNV', 'LV', 'LNV', 'Customised']
export const FP_STATUSES = ['Released', 'Delayed by guest', 'Not Released']
export const DECOR_TYPES = ['Silver', 'Gold', 'Premium']
export const DECOR_STATUSES = ['Open', 'Meeting', 'Closure', 'Outdoor']
export const ENTERTAINMENT_STATUSES = ['Open', 'Meeting', 'Closure', 'Outdoor']
export const FUNCTION_CATEGORIES = ['Silver', 'Gold', 'Platinum']
export const PAYMENT_TIMINGS = ['Before Event', 'On the Day', 'After Event']
// Hardcoded fallback — used only when DB fetch fails
export const ELEMENT_OPTIONS_FALLBACK = [
  'Coldpyros', 'Coldpyro Guns', 'Flower Shower', 'Sparkle Machine',
  'CO2 Jets/Guns', 'Dhol', 'Live Band', 'Ghori Baggi', 'Vintage Car',
  'Mascot', 'Celebrity Artist', 'Sky Shots', 'Color Sky Shot', 'Color Bomb',
  'LED Screen', 'Singer', 'DJ', 'Percussionist', 'Lazer', 'Bubble Machine',
  'Sound', 'Anchor', 'Paparazzi Artist', 'International Artist',
  'Classical Dance Artist', 'Molecular Bar', 'Tattoo Artist',
]
export const SERVICE_TYPES = [
  'Photography', 'Makeup', 'Party Makeup', 'Guest Mehendi', 'Bridal Mehndi',
  'Band', 'Choreography', 'Paan', 'Small Counters', 'Others',
]

export const SALES_TYPES = ['In-house', 'Outdoor', 'In-house + Outdoor']
export const SALES_DEPARTMENTS = ['Venue Sales', 'Decor Sales', 'Entertainment Sales', 'Catering Sales', 'Wedding Services']

export const DEPARTMENTS = [
  'Venue Sales', 'Decor Sales', 'Entertainment Sales', 'Catering Sales',
  'Wedding Services', 'Kitchen', 'F&B Service', 'Housekeeping', 'Admin', 'Management',
  'Social/Tech', 'Decor Operations', 'Tender', 'Accounts',
]
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
const CB = (label, key, extra = {}) =>
  ({ type: 'checkbox', label, key, required: false, ...extra })

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
const salesPersonField = () => ({
  type: 'user-select', label: 'Sales Person', key: 'sales_person', required: true,
})
const operationManagerField = () => ({
  type: 'user-select', label: 'Operation Manager', key: 'operation_manager', required: true,
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
      fullWidth: true,
    },
  ]
}

// AP/AM/AE/AR — venue booking (3-section layout)
// Venue section field order matches the 2-column grid spec (left|right per row)
function ownVenueSections(venue, dynamicTypes, dynamicElements) {
  return [
    {
      title: 'Venue',
      prominent: true,
      fields: [
        // Row 1: Sub-Venue | Event Type
        S('Sub-Venue', 'sub_venue', venue.subVenues),
        ...eventTypeFields(dynamicTypes),
        // Row 2: Package Type | Status
        S('Package Type', 'booking_status', BOOKING_STATUSES),
        statusField,
        // Row 3: Date | Shift
        D('Date', 'date'),
        S('Shift', 'shift', SHIFTS),
        // Row 4: Baraat Time | Wind Up Time
        TM('Baraat Time', 'baraat_time'),
        TM('Wind Up Time', 'wind_up_time'),
        // Row 5: Assembly Time | Chaat Time
        TM('Assembly Time', 'time'),
        TM('Chaat Time', 'chaat_time'),
        // Row 6: FP | (empty)
        S('FP', 'fp_status', FP_STATUSES, true, { disabledWhen: notVMD }),
        // Row 7: Menu Type | Menu Category
        S('Menu Type', 'menu_type', MENU_TYPES, true, { disabledWhen: notVMD }),
        S('Menu Category', 'menu_cat', MENU_CATS, true, { disabledWhen: notVMD }),
        // Row 8: Pending Payment % | Payment Status
        T('Pending Payment %', 'payment_remaining_venue', true, {
          filterFn: percentFilter, filterError: 'Only numbers 0-100',
          suffix: '%', inputMode: 'numeric',
        }),
        S('Payment Status', 'payment_timing', PAYMENT_TIMINGS),
        // Row 9: Guest Name | Phone
        guestName(),
        phoneReq(),
        // Row 10: Pax | Sales Person
        paxField(),
        { ...salesPersonField(),
          userFilter: { department: 'Venue Sales', salesTypes: ['In-house', 'In-house + Outdoor'] },
          userEmptyMsg: 'No Venue Sales users available. Add users in Manage Users.',
        },
        // Row 11: Delivery Person | Operation Manager
        { type: 'user-select', label: 'Delivery Person', key: 'delivery_person', required: true,
          userFilter: { department: 'Venue Sales', salesTypes: ['In-house', 'In-house + Outdoor'] },
          userEmptyMsg: 'No Venue Sales users available. Add users in Manage Users.',
        },
        { ...operationManagerField(),
          userFilter: { department: 'F&B Service' },
          userEmptyMsg: 'No F&B Service users available. Add users in Manage Users.',
        },
      ],
    },
    {
      title: 'Decor',
      prominent: true,
      collapsible: true,
      fields: [
        TM('Decor Time', 'decor_time', false),
        TM('Varmala Time', 'varmala_time', false),
        TM('Pheras Time', 'pheras_time', false),
        CB('Pheras Next Day (+1)', 'pheras_next_day'),
        S('Decor Status', 'decor_status', DECOR_STATUSES, false),
        S('Decor Category', 'function_category', FUNCTION_CATEGORIES, false),
        T('Pending Payment — Decor %', 'payment_remaining_decor', false, {
          filterFn: percentFilter, filterError: 'Only numbers 0-100',
          suffix: '%', inputMode: 'numeric',
        }),
        { type: 'user-select', label: 'Delivery Person (Decor)', key: 'decor_delivery_person', required: false,
          userFilter: { department: 'Decor Sales', salesTypes: ['In-house', 'In-house + Outdoor'] },
          userEmptyMsg: 'No Decor Sales users available. Add users in Manage Users.',
        },
      ],
    },
    {
      title: 'Entertainment',
      prominent: true,
      collapsible: true,
      fields: [
        S('Entertainment Status', 'entertainment_status', ENTERTAINMENT_STATUSES, false),
        { type: 'multiselect', label: 'Elements', key: 'elements', options: dynamicElements || ELEMENT_OPTIONS_FALLBACK, required: false },
        T('Pending Payment — Ent %', 'payment_remaining_ent', false, {
          filterFn: percentFilter, filterError: 'Only numbers 0-100',
          suffix: '%', inputMode: 'numeric',
        }),
        { type: 'user-select', label: 'Delivery Person (Entertainment)', key: 'ent_delivery_person', required: false,
          userFilter: { department: 'Entertainment Sales', salesTypes: ['In-house', 'In-house + Outdoor'] },
          userEmptyMsg: 'No Entertainment Sales users available. Add users in Manage Users.',
        },
      ],
    },
    {
      fields: [notesField],
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
        T('Pending Payment %', 'payment_remaining_venue', false, {
          filterFn: percentFilter, filterError: 'Only numbers 0-100',
          suffix: '%', inputMode: 'numeric',
        }),
        S('Payment Status', 'payment_timing', PAYMENT_TIMINGS, false),
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
        T('Pending Payment %', 'payment_remaining_venue', false, {
          filterFn: percentFilter, filterError: 'Only numbers 0-100',
          suffix: '%', inputMode: 'numeric',
        }),
        S('Payment Status', 'payment_timing', PAYMENT_TIMINGS, false),
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
        T('Pending Payment %', 'payment_remaining_venue', false, {
          filterFn: percentFilter, filterError: 'Only numbers 0-100',
          suffix: '%', inputMode: 'numeric',
        }),
        S('Payment Status', 'payment_timing', PAYMENT_TIMINGS, false),
        notesField,
      ],
    },
  ]
}

// AEE — external venue events & entertainment
function aeeSections(_venue, dynamicTypes, dynamicElements) {
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
        { type: 'multiselect', label: 'Elements', key: 'elements', options: dynamicElements || ELEMENT_OPTIONS_FALLBACK, required: true, fullWidth: true },
        T('Pending Payment %', 'payment_remaining_venue', false, {
          filterFn: percentFilter, filterError: 'Only numbers 0-100',
          suffix: '%', inputMode: 'numeric',
        }),
        S('Payment Status', 'payment_timing', PAYMENT_TIMINGS, false),
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
        T('Pending Payment %', 'payment_remaining_venue', false, {
          filterFn: percentFilter, filterError: 'Only numbers 0-100',
          suffix: '%', inputMode: 'numeric',
        }),
        S('Payment Status', 'payment_timing', PAYMENT_TIMINGS, false),
        notesField,
      ],
    },
  ]
}

// WS — Wedding Services (external vendor coordination)
function wsSections(_venue, dynamicTypes) {
  const isServiceOther = (f) => Array.isArray(f.service_type) && f.service_type.includes('Others')
  return [
    {
      title: 'Services',
      fields: [
        { type: 'multiselect', label: 'Service Type', key: 'service_type', options: SERVICE_TYPES, required: true, fullWidth: true },
        {
          ...T('Specify Service Type', 'service_type_other', true, {
            placeholder: 'Describe the service',
          }),
          showWhen: isServiceOther,
          fullWidth: true,
        },
        T('Vendor Name', 'vendor_name', true, {
          filterFn: nameFilter, filterError: 'Only letters allowed',
        }),
        {
          type: 'phone', label: 'Vendor Phone', key: 'vendor_phone', required: false,
          filterFn: phoneFilter, filterError: 'Only numbers allowed',
          placeholder: '98765 43210', inputMode: 'tel',
        },
      ],
    },
    {
      title: 'Venue',
      fields: [
        venueNameField(),
        T('Location', 'location', false, { placeholder: 'Google Maps link or address', mapLink: true }),
      ],
    },
    {
      title: 'Event',
      fields: [
        ...eventTypeFields(dynamicTypes),
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
        T('Pending Payment %', 'payment_remaining_venue', false, {
          filterFn: percentFilter, filterError: 'Only numbers 0-100',
          suffix: '%', inputMode: 'numeric',
        }),
        S('Payment Status', 'payment_timing', PAYMENT_TIMINGS, false),
        notesField,
      ],
    },
  ]
}

// ---------- Field parity: valid keys per category ----------

const VENUE_FIELD_KEYS = [
  'sub_venue', 'event_type', 'event_type_other', 'shift', 'date', 'time',
  'decor_time', 'chaat_time', 'baraat_time', 'wind_up_time', 'varmala_time', 'pheras_time', 'pheras_next_day',
  'booking_status', 'menu_type', 'menu_cat', 'fp_status',
  'decor_status', 'entertainment_status', 'function_category', 'elements',
  'delivery_person', 'decor_delivery_person', 'ent_delivery_person', 'operation_manager',
  'payment_remaining_venue', 'payment_remaining_decor', 'payment_remaining_ent', 'payment_timing',
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
    'guest_name', 'phone', 'pax', 'sales_person',
    'payment_remaining_venue', 'payment_timing', 'notes',
  ],
  add: [
    'venue_name', 'venue_type', 'location', 'event_type', 'event_type_other',
    'shift', 'date', 'time', 'decor_type',
    'guest_name', 'phone', 'sales_person',
    'payment_remaining_venue', 'payment_timing', 'notes',
  ],
  ac: [
    'venue_name', 'venue_type', 'location', 'event_type', 'event_type_other',
    'shift', 'date', 'time', 'menu_type', 'menu_cat',
    'guest_name', 'phone', 'pax', 'sales_person',
    'payment_remaining_venue', 'payment_timing', 'notes',
  ],
  aee: [
    'venue_name', 'venue_type', 'location', 'event_type', 'event_type_other',
    'shift', 'date', 'time',
    'guest_name', 'phone', 'sales_person', 'elements',
    'payment_remaining_venue', 'payment_timing', 'notes',
  ],
  ws: [
    'service_type', 'service_type_other', 'vendor_name', 'vendor_phone',
    'venue_name', 'location', 'event_type', 'event_type_other',
    'date', 'time',
    'guest_name', 'phone', 'sales_person',
    'payment_remaining_venue', 'payment_timing', 'notes',
  ],
  tender: [
    'venue_name', 'location', 'event_type_text', 'date', 'end_date',
    'tender_name', 'phone',
    'payment_remaining_venue', 'payment_timing', 'notes',
  ],
}

// Union of every saveable field key — used to null-out irrelevant columns.
export const ALL_SAVEABLE_KEYS = [
  'sub_venue', 'event_type', 'event_type_other', 'shift', 'date', 'time',
  'decor_time', 'chaat_time', 'baraat_time', 'wind_up_time', 'varmala_time', 'pheras_time', 'pheras_next_day',
  'booking_status', 'menu_type', 'menu_cat', 'fp_status',
  'decor_status', 'entertainment_status', 'function_category', 'elements',
  'delivery_person', 'decor_delivery_person', 'ent_delivery_person', 'operation_manager',
  'payment_remaining_venue', 'payment_remaining_decor', 'payment_remaining_ent', 'payment_timing',
  'guest_name', 'phone', 'pax', 'sales_person', 'notes',
  'check_in_date', 'check_out_date', 'check_in_time', 'check_out_time',
  'pool_included', 'meal_included', 'added_service',
  'venue_name', 'venue_type', 'location', 'decor_type',
  'tender_name', 'event_type_text', 'end_date',
  'service_type', 'service_type_other', 'vendor_name', 'vendor_phone',
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
  ws: wsSections,
  tender: tenderSections,
}

export function getFormConfig(venueId, dynamicTypes, dynamicElements) {
  const venue = VENUE_BY_ID[venueId]
  if (!venue) return []
  const build = BUILDERS[venueId]
  return build ? build(venue, dynamicTypes, dynamicElements) : []
}

// Flatten sections to a single field list — convenient for validation.
// Expands 'group' type fields into their child fields.
export function getAllFields(venueId, dynamicTypes, dynamicElements) {
  return getFormConfig(venueId, dynamicTypes, dynamicElements).flatMap((s) => s.fields).flatMap(
    (f) => f.type === 'group' ? f.fields : [f]
  )
}

// Returns true if the given field is effectively required in the current
// form state (handles disabledWhen — disabled fields aren't required).
export function isFieldRequired(field, form) {
  if (!field.required) return false
  if (field.disabledWhen && field.disabledWhen(form)) return false
  if (field.showWhen && !field.showWhen(form)) return false
  return true
}
