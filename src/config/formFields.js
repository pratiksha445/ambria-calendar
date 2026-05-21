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

export const STATUSES = ['Confirmed', 'Tentative', 'Cancelled', 'Postponed']
export const SHIFTS = ['Morning', 'Lunch', 'Sundowner', 'Dinner']
export const BOOKING_STATUSES = [
  'Only Rental', 'VM', 'VD', 'VE', 'VDE', 'VME', 'VMD', 'VMDE',
]
export const MENU_TYPES = ['Veg', 'Non-Veg', 'Jain', 'Only Chaat', 'Only Fruit']
export const MENU_CATS = ['MV', 'MNV', 'DMV', 'DMNV', 'MCV', 'MCNV', 'LV', 'LNV', 'Customised']
export const VEG_CATS = ['MV', 'DMV', 'MCV', 'LV']
export const NON_VEG_CATS = ['MNV', 'DMNV', 'MCNV', 'LNV']
export const FP_STATUSES = ['Released', 'Delayed by guest', 'Not Released']
export const DECOR_TYPES = ['Silver', 'Gold', 'Premium']
export const DECOR_STATUSES = ['Open', 'Meeting', 'Closure', 'Outdoor']
export const ENTERTAINMENT_STATUSES = ['Open', 'Meeting', 'Closure', 'Outdoor']
export const FUNCTION_CATEGORIES = ['Silver', 'Gold', 'Platinum']
export const GUEST_CATEGORIES = ['Multi-Event Client', 'Repeat Client', 'Premium Client', 'Standard Client', 'Reference Client']
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
  'Band', 'Bridal Mehndi', 'Cakes & Gift Hampers', 'Choreography',
  'E-invite / Return Gifts', 'Groom Styling', 'Guest Mehendi',
  'Luxury Cars / Vintage Cars', 'Makeup', 'Outside Entertainment',
  'Paan', 'Party Makeup', 'Photography', 'Small Counters',
  'Wedding Planning', 'Others',
]

export const SALES_TYPES = ['In-house', 'Outdoor', 'In-house + Outdoor']
export const SALES_DEPARTMENTS = ['Venue Sales', 'Decor Sales', 'Entertainment Sales', 'Catering Sales', 'Wedding Services']

export const DEPARTMENTS = [
  'Venue Sales', 'Decor Sales', 'Entertainment Sales', 'Catering Sales',
  'Wedding Services', 'Kitchen', 'F&B Service', 'Housekeeping', 'Admin', 'Management',
  'Social/Tech', 'Decor Operations', 'Tender', 'Accounts',
]
export const VENUE_TYPES = ['Lawn', 'Banquet', 'Lawn + Bqt', 'Poolside', 'Terrace', 'Courtyard', 'Restaurant', 'Private Villa', 'Home']
export const SITE_AVAILABILITIES = ['1 day', '-2 day', 'Morning', '+2 hr bandwidth', 'Same day', 'Others']
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
const phoneWithPlusFilter = (v) => v.replace(/[^\d+\s]/g, '')
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

const MENU_PACKAGES = new Set(['VM', 'VME', 'VMD', 'VMDE'])
const NO_CAT_TYPES = new Set(['Only Chaat', 'Only Fruit'])
const notMenu = (f) => !f.booking_status || !MENU_PACKAGES.has(f.booking_status)
const noCatMenu = (f) => NO_CAT_TYPES.has(f.menu_type)
const notMenuOrNoCat = (f) => notMenu(f) || noCatMenu(f)
const noCatMenuHelper = (f) => noCatMenu(f) ? 'Not applicable for Only Chaat / Only Fruit' : ''
const decorOutdoor = (f) => f.decor_status === 'Outdoor'
const decorOutdoorHelper = (f) => decorOutdoor(f) ? 'Not applicable for Outdoor — handled externally' : ''
const entOutdoor = (f) => f.entertainment_status === 'Outdoor'
const entOutdoorHelper = (f) => entOutdoor(f) ? 'Not applicable for Outdoor — handled externally' : ''
const menuCatOptions = (f) => {
  if (f.menu_type === 'Non-Veg') return [...NON_VEG_CATS, 'Customised']
  if (f.menu_type === 'Veg' || f.menu_type === 'Jain') return [...VEG_CATS, 'Customised']
  return MENU_CATS
}
const isOther = (f) => f.event_type === 'Other'

// ---------- Per-category shared blocks ----------

const statusField = S('Status', 'status', STATUSES)
const notesField = TA('Notes', 'notes', false, { placeholder: 'Optional…' })

// Reusable validated field builders
const guestName = () => T('Guest Name', 'guest_name', true, {
  placeholder: 'e.g. Mr. Sharma', filterFn: nameFilter, filterError: 'Only letters allowed',
})
const phoneReq = () => ({
  type: 'phone', label: 'Guest Phone', key: 'phone', required: true,
  filterFn: phoneFilter, filterError: 'Only numbers allowed',
  placeholder: '98765 43210', inputMode: 'tel',
})
const phoneOpt = () => ({
  type: 'phone', label: 'Guest Phone', key: 'phone', required: false,
  filterFn: phoneFilter, filterError: 'Only numbers allowed',
  placeholder: '98765 43210', inputMode: 'tel',
})
const paxField = () => T('Pax', 'pax', true, {
  filterFn: paxFilter, filterError: 'Only numbers allowed', inputMode: 'numeric',
})
const roomsField = () => T('Rooms', 'rooms', true, {
  filterFn: paxFilter, filterError: 'Only numbers allowed', inputMode: 'numeric',
})
const salesPersonField = () => ({
  type: 'user-select', label: 'Sales Person', key: 'sales_person', required: true,
})
const operationManagerField = () => ({
  type: 'user-select', label: 'F&B Service Manager', key: 'operation_manager', required: true,
})
const venueNameField = (placeholder) => T('Venue Name', 'venue_name', true, {
  placeholder: placeholder || 'Hotel Taj, Farmhouse…', filterFn: venueNameFilter,
})
const tenderNameField = () => T('Tender Name', 'tender_name', true, {
  filterFn: nameFilter, filterError: 'Only letters allowed',
})

function eventTypeFields(dynamicTypes, { searchable = false } = {}) {
  const options = dynamicTypes && dynamicTypes.length > 0 ? dynamicTypes : EVENT_TYPES
  const eventTypeField = searchable
    ? {
        type: 'searchable-select',
        label: 'Event Type',
        key: 'event_type',
        required: true,
        options: options.map((o) => {
          if (typeof o === 'object' && o.abbreviation) {
            return {
              value: o.name,
              label: `${o.name} (${o.abbreviation})`,
              searchTerms: [o.abbreviation],
            }
          }
          const name = typeof o === 'object' ? o.name : o
          return { value: name, label: name }
        }),
      }
    : S('Event Type', 'event_type', options.map((o) => typeof o === 'object' ? o.name : o))
  return [
    eventTypeField,
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
        ...eventTypeFields(dynamicTypes, { searchable: true }),
        // Row 2: Package Type | Status
        S('Package Type', 'booking_status', BOOKING_STATUSES),
        statusField,
        // Row 3: Date | Shift
        D('Date', 'date'),
        S('Shift', 'shift', SHIFTS),
        // Row 4: Baraat Time | Function Start Time
        TM('Baraat Time', 'baraat_time', false),
        TM('Function Start Time', 'time'),
        // Row 5: Chaat Time | Wind Up Time
        TM('Chaat Time', 'chaat_time', false),
        TM('Wind Up Time', 'wind_up_time', false, {
          requiredWhen: (f) => f.shift === 'Lunch' || f.shift === 'Sundowner',
          inlineCheckbox: { key: 'wind_up_next_day', label: '+1' },
        }),
        // Row 6: FP | Rooms + Liquor
        S('FP', 'fp_status', FP_STATUSES, true, { disabledWhen: notMenu }),
        { ...roomsField(), inlineCheckbox: { key: 'liquor', label: 'Liquor' } },
        // Row 7: Menu Type | Menu Category
        S('Menu Type', 'menu_type', MENU_TYPES, true, { disabledWhen: notMenu }),
        S('Menu Category', 'menu_cat', MENU_CATS, true, { disabledWhen: notMenuOrNoCat, getOptions: menuCatOptions, helperText: noCatMenuHelper }),
        // Row 8: Payment Status | Pending Payment %
        S('Payment Status', 'payment_timing', PAYMENT_TIMINGS),
        T('Pending Payment %', 'payment_remaining_venue', true, {
          filterFn: percentFilter, filterError: 'Only numbers 0-100',
          suffix: '%', inputMode: 'numeric',
        }),
        // Row 9: Guest Name | Guest Phone
        guestName(),
        phoneReq(),
        // Row 10: Pax | Comp. Plates
        paxField(),
        T('Comp. Plates', 'complimentary_plates', false, {
          filterFn: paxFilter, filterError: 'Only numbers allowed', inputMode: 'numeric',
          placeholder: '0',
        }),
        // Row 11: Guest Category
        S('Guest Category', 'guest_category', GUEST_CATEGORIES, true),
        { type: 'guest-select', label: 'Reference Guest', key: 'reference_guest', required: false },
        // Row 11: Sales Person
        { ...salesPersonField(),
          userFilter: { department: 'Venue Sales', salesTypes: ['In-house', 'In-house + Outdoor'] },
          userEmptyMsg: 'No Venue Sales users available. Add users in Manage Users.',
        },
        // Row 12: Delivery Person | F&B Service Manager
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
        TM('Pheras Time', 'pheras_time', false, { inlineCheckbox: { key: 'pheras_next_day', label: '+1' } }),
        S('Decor Status', 'decor_status', DECOR_STATUSES, false),
        S('Decor Category', 'function_category', FUNCTION_CATEGORIES, false, { disabledWhen: decorOutdoor, helperText: decorOutdoorHelper }),
        T('Pending Payment — Decor %', 'payment_remaining_decor', false, {
          filterFn: percentFilter, filterError: 'Only numbers 0-100',
          suffix: '%', inputMode: 'numeric',
          disabledWhen: decorOutdoor, helperText: decorOutdoorHelper,
        }),
        { type: 'user-select', label: 'Delivery Person (Decor)', key: 'decor_delivery_person', required: false,
          userFilter: { department: 'Decor Sales', salesTypes: ['In-house', 'In-house + Outdoor'] },
          userEmptyMsg: 'No Decor Sales users available. Add users in Manage Users.',
          disabledWhen: decorOutdoor, helperText: decorOutdoorHelper,
        },
        { type: 'user-select', label: 'Operation Manager (Decor)', key: 'decor_operation_manager', required: false,
          userFilter: { department: 'Decor Operations' },
          userEmptyMsg: 'No Decor Operations users available. Add users in Manage Users.',
          disabledWhen: decorOutdoor, helperText: decorOutdoorHelper,
        },
      ],
    },
    {
      title: 'Entertainment',
      prominent: true,
      collapsible: true,
      fields: [
        S('Entertainment Status', 'entertainment_status', ENTERTAINMENT_STATUSES, false),
        { type: 'multiselect', label: 'Elements', key: 'elements', options: dynamicElements || ELEMENT_OPTIONS_FALLBACK, required: false, disabledWhen: entOutdoor, helperText: entOutdoorHelper },
        T('Pending Payment — Ent %', 'payment_remaining_ent', false, {
          filterFn: percentFilter, filterError: 'Only numbers 0-100',
          suffix: '%', inputMode: 'numeric',
          disabledWhen: entOutdoor, helperText: entOutdoorHelper,
        }),
        { type: 'user-select', label: 'Delivery Person (Entertainment)', key: 'ent_delivery_person', required: false,
          userFilter: { department: 'Entertainment Sales', salesTypes: ['In-house', 'In-house + Outdoor'] },
          userEmptyMsg: 'No Entertainment Sales users available. Add users in Manage Users.',
          disabledWhen: entOutdoor, helperText: entOutdoorHelper,
        },
      ],
    },
    {
      fields: [notesField],
    },
  ]
}

// Villa — stay booking
function villaSections(venue, dynamicTypes) {
  return [
    {
      title: 'Stay',
      fields: [
        { ...S('Sub-Venue', 'sub_venue', venue.subVenues), inlineCheckbox: { key: 'airbnb', label: 'Airbnb' } },
        ...eventTypeFields(dynamicTypes, { searchable: false }).map((f) =>
          f.key === 'event_type' ? { ...f, required: false } : f
        ),
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
        T('Extra Bedding', 'extra_bedding', true, {
          filterFn: paxFilter, filterError: 'Only numbers allowed', inputMode: 'numeric',
        }),
      ],
    },
    {
      title: 'Guest',
      fields: [
        guestName(),
        phoneReq(),
        paxField(),
        S('Guest Category', 'guest_category', GUEST_CATEGORIES, true),
        { type: 'guest-select', label: 'Reference Guest', key: 'reference_guest', required: false },
        { ...salesPersonField(),
          userFilter: { departments: ['Venue Sales', 'Social/Tech'] },
          userEmptyMsg: 'No Venue Sales / Social/Tech users available. Add users in Manage Users.',
        },
        T('Pending Payment %', 'payment_remaining_venue', true, {
          filterFn: percentFilter, filterError: 'Only numbers 0-100',
          suffix: '%', inputMode: 'numeric',
        }),
        S('Payment Status', 'payment_timing', PAYMENT_TIMINGS),
        notesField,
      ],
    },
  ]
}

// ADD — external venue decor
function addSections(_venue, dynamicTypes) {
  const isSiteOther = (f) => f.site_availability === 'Others'
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
      title: 'Booking',
      fields: [
        statusField,
        S('Site Availability', 'site_availability', SITE_AVAILABILITIES, true),
        {
          ...T('Specify', 'site_availability_other', true, {
            placeholder: 'Describe availability',
          }),
          showWhen: isSiteOther,
          fullWidth: true,
        },
        D('Date', 'date'),
      ],
    },
    { title: 'Events', type: 'event-slots', fields: [] },
    {
      title: 'Guest & Team',
      fields: [
        guestName(),
        phoneReq(),
        S('Guest Category', 'guest_category', GUEST_CATEGORIES, true),
        { type: 'guest-select', label: 'Reference Guest', key: 'reference_guest', required: false },
        { ...salesPersonField(),
          userFilter: { department: 'Decor Sales', salesTypes: ['Outdoor', 'In-house + Outdoor'] },
          userEmptyMsg: 'No Decor Sales (Outdoor) users available. Add users in Manage Users.',
        },
        { type: 'user-select', label: 'Execution Person', key: 'execution_person', required: true,
          userFilter: { department: 'Decor Sales', salesTypes: ['Outdoor', 'In-house + Outdoor'] },
          userEmptyMsg: 'No Decor Sales (Outdoor) users available. Add users in Manage Users.',
        },
        { type: 'user-select', label: 'Operation Manager', key: 'operation_manager', required: true,
          userFilter: { department: 'Decor Operations' },
          userEmptyMsg: 'No Decor Operations users available. Add users in Manage Users.',
        },
        T('Venue Manager Name', 'venue_manager_name', false, {
          filterFn: nameFilter, filterError: 'Only letters allowed',
        }),
        T('Venue Manager Number', 'venue_manager_number', false, {
          filterFn: phoneWithPlusFilter, filterError: 'Only + and numbers allowed', inputMode: 'numeric',
        }),
      ],
    },
    {
      title: 'Payment',
      fields: [
        S('Payment Status', 'payment_timing', PAYMENT_TIMINGS),
        T('Pending Payment %', 'payment_remaining_venue', true, {
          filterFn: percentFilter, filterError: 'Only numbers 0-100',
          suffix: '%', inputMode: 'numeric',
        }),
        notesField,
      ],
    },
  ]
}

// AC — external venue cuisine
function acSections(_venue, dynamicTypes) {
  const isSiteOther = (f) => f.site_availability === 'Others'
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
      title: 'Booking',
      fields: [
        statusField,
        S('Site Availability', 'site_availability', SITE_AVAILABILITIES, true),
        {
          ...T('Specify', 'site_availability_other', true, {
            placeholder: 'Describe availability',
          }),
          showWhen: isSiteOther,
          fullWidth: true,
        },
        D('Date', 'date'),
      ],
    },
    { title: 'Events', type: 'event-slots', fields: [] },
    {
      title: 'Guest & Team',
      fields: [
        guestName(),
        phoneReq(),
        S('Guest Category', 'guest_category', GUEST_CATEGORIES, true),
        { type: 'guest-select', label: 'Reference Guest', key: 'reference_guest', required: false },
        { ...salesPersonField(),
          userFilter: { department: 'Catering Sales', salesTypes: ['Outdoor', 'In-house + Outdoor'] },
          userEmptyMsg: 'No Catering Sales (Outdoor) users available. Add users in Manage Users.',
        },
        { type: 'user-select', label: 'Service Head', key: 'service_head', required: true,
          userFilter: { department: 'F&B Service' },
          userEmptyMsg: 'No F&B Service users available. Add users in Manage Users.',
        },
        { type: 'user-select', label: 'Kitchen Head', key: 'kitchen_head', required: true,
          userFilter: { department: 'Kitchen' },
          userEmptyMsg: 'No Kitchen users available. Add users in Manage Users.',
        },
        T('Venue Manager Name', 'venue_manager_name', false, {
          filterFn: nameFilter, filterError: 'Only letters allowed',
        }),
        T('Venue Manager Number', 'venue_manager_number', false, {
          filterFn: phoneWithPlusFilter, filterError: 'Only + and numbers allowed', inputMode: 'numeric',
        }),
      ],
    },
    {
      title: 'Payment',
      fields: [
        T('Pending Payment %', 'payment_remaining_venue', true, {
          filterFn: percentFilter, filterError: 'Only numbers 0-100',
          suffix: '%', inputMode: 'numeric',
        }),
        S('Payment Status', 'payment_timing', PAYMENT_TIMINGS),
        notesField,
      ],
    },
  ]
}

// AEE — external venue events & entertainment
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
      title: 'Booking',
      fields: [
        statusField,
        D('Date', 'date'),
      ],
    },
    { title: 'Events', type: 'event-slots', fields: [] },
    {
      title: 'Guest & Team',
      fields: [
        guestName(),
        phoneReq(),
        S('Guest Category', 'guest_category', GUEST_CATEGORIES, true),
        { type: 'guest-select', label: 'Reference Guest', key: 'reference_guest', required: false },
        { ...salesPersonField(),
          userFilter: { department: 'Entertainment Sales' },
          userEmptyMsg: 'No Entertainment Sales users available. Add users in Manage Users.',
        },
        { type: 'user-select', label: 'Delivery Person', key: 'delivery_person', required: true,
          userFilter: { department: 'Entertainment Sales' },
          userEmptyMsg: 'No Entertainment Sales users available. Add users in Manage Users.',
        },
      ],
    },
    {
      title: 'Payment',
      fields: [
        T('Pending Payment %', 'payment_remaining_venue', true, {
          filterFn: percentFilter, filterError: 'Only numbers 0-100',
          suffix: '%', inputMode: 'numeric',
        }),
        S('Payment Status', 'payment_timing', PAYMENT_TIMINGS),
        notesField,
      ],
    },
  ]
}

// Tender — unified event-type dropdown, pax, sales person, mandatory phone
function tenderSections(_venue, dynamicTypes) {
  return [
    {
      title: 'Tender',
      fields: [
        venueNameField(),
        T('Location', 'location', false, { placeholder: 'Google Maps link or address', mapLink: true }),
        ...eventTypeFields(dynamicTypes),
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
        paxField(),
        phoneReq(),
        { ...salesPersonField(),
          userFilter: { department: 'Tender' },
          userEmptyMsg: 'No Tender department users available. Add users in Manage Users.',
        },
        S('Guest Category', 'guest_category', GUEST_CATEGORIES, true),
        { type: 'guest-select', label: 'Reference Guest', key: 'reference_guest', required: false },
        T('Pending Payment %', 'payment_remaining_venue', true, {
          filterFn: percentFilter, filterError: 'Only numbers 0-100',
          suffix: '%', inputMode: 'numeric',
        }),
        S('Payment Status', 'payment_timing', PAYMENT_TIMINGS),
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
        paxField(),
        S('Guest Category', 'guest_category', GUEST_CATEGORIES, true),
        { type: 'guest-select', label: 'Reference Guest', key: 'reference_guest', required: false },
        { ...salesPersonField(),
          userFilter: { department: 'Wedding Services' },
          userEmptyMsg: 'No Wedding Services users available. Add users in Manage Users.',
        },
        T('Pending Payment %', 'payment_remaining_venue', true, {
          filterFn: percentFilter, filterError: 'Only numbers 0-100',
          suffix: '%', inputMode: 'numeric',
        }),
        S('Payment Status', 'payment_timing', PAYMENT_TIMINGS),
        notesField,
      ],
    },
  ]
}

// ---------- Field parity: valid keys per category ----------

const VENUE_FIELD_KEYS = [
  'sub_venue', 'event_type', 'event_type_other', 'shift', 'date', 'time',
  'decor_time', 'chaat_time', 'baraat_time', 'wind_up_time', 'wind_up_next_day', 'varmala_time', 'pheras_time', 'pheras_next_day',
  'booking_status', 'menu_type', 'menu_cat', 'fp_status', 'rooms', 'liquor',
  'decor_status', 'entertainment_status', 'function_category', 'elements',
  'delivery_person', 'delivery_person_id', 'decor_delivery_person', 'decor_delivery_person_id',
  'decor_operation_manager', 'decor_operation_manager_id',
  'ent_delivery_person', 'ent_delivery_person_id', 'operation_manager', 'operation_manager_id',
  'payment_remaining_venue', 'payment_remaining_decor', 'payment_remaining_ent', 'payment_timing',
  'guest_name', 'phone', 'pax', 'complimentary_plates', 'guest_category', 'reference_guest', 'sales_person', 'sales_person_id', 'notes',
  'postponed_from_date', 'postponed_at',
]

export const FIELD_MAP = {
  ap: VENUE_FIELD_KEYS,
  am: VENUE_FIELD_KEYS,
  ae: VENUE_FIELD_KEYS,
  ar: VENUE_FIELD_KEYS,
  villa: [
    'sub_venue', 'event_type', 'event_type_other',
    'check_in_date', 'check_out_date', 'check_in_time', 'check_out_time',
    'pool_included', 'meal_included', 'added_service', 'airbnb',
    'guest_name', 'phone', 'pax', 'extra_bedding', 'guest_category', 'reference_guest', 'sales_person', 'sales_person_id',
    'payment_remaining_venue', 'payment_timing', 'notes',
    'postponed_from_date', 'postponed_at',
  ],
  add: [
    'venue_name', 'venue_type', 'location', 'event_type', 'event_type_other',
    'shift', 'date', 'time', 'site_availability', 'site_availability_other',
    'decor_type', 'color_theme',
    'guest_name', 'phone', 'pax', 'guest_category', 'reference_guest', 'sales_person', 'sales_person_id',
    'execution_person', 'execution_person_id',
    'operation_manager', 'operation_manager_id',
    'venue_manager_name', 'venue_manager_number',
    'payment_remaining_venue', 'payment_timing', 'notes',
    'postponed_from_date', 'postponed_at',
    'event_slots',
  ],
  ac: [
    'venue_name', 'venue_type', 'location', 'event_type', 'event_type_other',
    'shift', 'date', 'time', 'site_availability', 'site_availability_other',
    'menu_type', 'menu_cat',
    'guest_name', 'phone', 'pax', 'guest_category', 'reference_guest', 'sales_person', 'sales_person_id',
    'service_head', 'service_head_id', 'kitchen_head', 'kitchen_head_id',
    'venue_manager_name', 'venue_manager_number',
    'payment_remaining_venue', 'payment_timing', 'notes',
    'postponed_from_date', 'postponed_at',
    'event_slots',
  ],
  aee: [
    'venue_name', 'venue_type', 'location', 'event_type', 'event_type_other',
    'shift', 'date', 'time',
    'guest_name', 'phone', 'pax', 'guest_category', 'reference_guest', 'sales_person', 'sales_person_id',
    'delivery_person', 'delivery_person_id', 'elements',
    'payment_remaining_venue', 'payment_timing', 'notes',
    'postponed_from_date', 'postponed_at',
    'event_slots',
  ],
  ws: [
    'service_type', 'service_type_other',
    'venue_name', 'location', 'event_type', 'event_type_other',
    'date', 'time',
    'guest_name', 'phone', 'pax', 'guest_category', 'reference_guest', 'sales_person', 'sales_person_id',
    'payment_remaining_venue', 'payment_timing', 'notes',
    'postponed_from_date', 'postponed_at',
  ],
  tender: [
    'venue_name', 'location', 'event_type', 'event_type_other', 'event_type_text',
    'date', 'end_date',
    'tender_name', 'phone', 'pax', 'sales_person', 'sales_person_id', 'guest_category', 'reference_guest',
    'payment_remaining_venue', 'payment_timing', 'notes',
    'postponed_from_date', 'postponed_at',
  ],
}

// Union of every saveable field key — used to null-out irrelevant columns.
export const ALL_SAVEABLE_KEYS = [
  'sub_venue', 'event_type', 'event_type_other', 'shift', 'date', 'time',
  'decor_time', 'chaat_time', 'baraat_time', 'wind_up_time', 'wind_up_next_day', 'varmala_time', 'pheras_time', 'pheras_next_day',
  'booking_status', 'menu_type', 'menu_cat', 'fp_status', 'rooms', 'liquor',
  'decor_status', 'entertainment_status', 'function_category', 'elements',
  'delivery_person', 'delivery_person_id', 'decor_delivery_person', 'decor_delivery_person_id',
  'decor_operation_manager', 'decor_operation_manager_id',
  'ent_delivery_person', 'ent_delivery_person_id', 'operation_manager', 'operation_manager_id',
  'payment_remaining_venue', 'payment_remaining_decor', 'payment_remaining_ent', 'payment_timing',
  'guest_name', 'phone', 'pax', 'complimentary_plates', 'extra_bedding', 'guest_category', 'reference_guest', 'sales_person', 'sales_person_id', 'notes',
  'check_in_date', 'check_out_date', 'check_in_time', 'check_out_time',
  'pool_included', 'meal_included', 'added_service', 'airbnb',
  'venue_name', 'venue_type', 'location', 'decor_type', 'color_theme',
  'site_availability', 'site_availability_other',
  'execution_person', 'execution_person_id',
  'venue_manager_name', 'venue_manager_number',
  'tender_name', 'event_type_text', 'end_date',
  'service_type', 'service_type_other', 'vendor_name', 'vendor_phone',
  'service_head', 'service_head_id', 'kitchen_head', 'kitchen_head_id',
  'event_slots',
  'postponed_from_date', 'postponed_at',
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

// Per-slot field definitions for ADD/AC/AEE event-slot cards.
export function getSlotFields(venueId, dynamicTypes, dynamicElements) {
  if (venueId === 'add') {
    return [
      ...eventTypeFields(dynamicTypes),
      S('Shift', 'shift', SHIFTS),
      TM('Time', 'time'),
      T('Pax', 'pax', true, { filterFn: paxFilter, filterError: 'Only numbers allowed', inputMode: 'numeric' }),
      S('Decor Type', 'decor_type', DECOR_TYPES),
      T('Color Theme', 'color_theme', false),
    ]
  }
  if (venueId === 'ac') {
    return [
      ...eventTypeFields(dynamicTypes),
      S('Shift', 'shift', SHIFTS),
      TM('Time', 'time'),
      T('Pax', 'pax', true, { filterFn: paxFilter, filterError: 'Only numbers allowed', inputMode: 'numeric' }),
      S('Menu Type', 'menu_type', MENU_TYPES),
      S('Menu Category', 'menu_cat', MENU_CATS, true, { disabledWhen: noCatMenu, getOptions: menuCatOptions, helperText: noCatMenuHelper }),
    ]
  }
  if (venueId === 'aee') {
    return [
      ...eventTypeFields(dynamicTypes),
      S('Shift', 'shift', SHIFTS),
      TM('Time', 'time'),
      T('Pax', 'pax', true, { filterFn: paxFilter, filterError: 'Only numbers allowed', inputMode: 'numeric' }),
      { type: 'multiselect', label: 'Elements', key: 'elements', options: dynamicElements || ELEMENT_OPTIONS_FALLBACK, required: true, fullWidth: true },
    ]
  }
  return []
}

// Flatten sections to a single field list — convenient for validation.
// Expands 'group' type fields into their child fields.
export function getAllFields(venueId, dynamicTypes, dynamicElements) {
  return getFormConfig(venueId, dynamicTypes, dynamicElements).flatMap((s) => s.fields).flatMap(
    (f) => f.type === 'group' ? f.fields : [f]
  )
}

// Fields required even when status is Tentative (category is enforced separately).
const TENTATIVE_REQUIRED_KEYS = new Set(['sales_person', 'date', 'check_in_date'])

// Returns true if the given field is effectively required in the current
// form state (handles disabledWhen, showWhen, requiredWhen, and tentative mode).
export function isFieldRequired(field, form) {
  // Tentative bookings only require category + date + sales person
  if (form.status === 'Tentative' && !TENTATIVE_REQUIRED_KEYS.has(field.key)) return false

  const req = field.requiredWhen ? field.requiredWhen(form) : field.required
  if (!req) return false
  if (field.disabledWhen && field.disabledWhen(form)) return false
  if (field.showWhen && !field.showWhen(form)) return false
  return true
}
