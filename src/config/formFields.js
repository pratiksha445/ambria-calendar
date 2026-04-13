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
  'VMD', 'Only Rental', 'Rental + Decor', 'Rental + DJ', 'Rental + Add on Food',
]
export const MENU_TYPES = ['Veg', 'Non-Veg', 'Jain', 'Chaat']
export const MENU_CATS = ['MV', 'MNV', 'DMV', 'DMNV', 'MCV', 'MCNV', 'LV', 'LNV', 'Customised']
export const FP_STATUSES = ['Released', 'Delayed by guest', 'Not Released']
export const DECOR_TYPES = ['Silver', 'Gold', 'Premium']
export const VENUE_TYPES = ['Lawn', 'Banquet', 'Lawn + Bqt', 'Poolside']
export const POOL_OPTIONS = ['Yes', 'No']
export const MEAL_OPTIONS = ['Breakfast', 'Lunch', 'Dinner', 'All Meals', 'None']

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

// ---------- Conditional helpers ----------

const notVMD = (f) => f.booking_status && f.booking_status !== 'VMD'
const isOther = (f) => f.event_type === 'Other'

// ---------- Per-category shared blocks ----------

const statusField = S('Status', 'status', STATUSES)
const notesField = TA('Notes', 'notes', false, { placeholder: 'Optional…' })

const eventTypeFields = [
  S('Event Type', 'event_type', EVENT_TYPES),
  {
    ...T('Specify Event Type', 'event_type_other', true, {
      placeholder: 'Describe the event',
    }),
    showWhen: isOther,
  },
]

// AP/AM/AE/AR — venue booking
function ownVenueSections(venue) {
  return [
    {
      title: 'Venue',
      fields: [
        S('Sub-Venue', 'sub_venue', venue.subVenues),
        ...eventTypeFields,
        S('Shift', 'shift', SHIFTS),
        statusField,
      ],
    },
    {
      title: 'Date & Time',
      fields: [D('Date', 'date'), TM('Time', 'time')],
    },
    {
      title: 'Booking',
      fields: [
        S('Booking Status', 'booking_status', BOOKING_STATUSES),
        S('Menu Type', 'menu_type', MENU_TYPES, true, { disabledWhen: notVMD }),
        S('Menu Category', 'menu_cat', MENU_CATS, true, { disabledWhen: notVMD }),
        S('FP', 'fp_status', FP_STATUSES, true, { disabledWhen: notVMD }),
      ],
    },
    {
      title: 'Guest',
      fields: [
        T('Guest Name', 'guest_name', true, { placeholder: 'e.g. Mr. Sharma' }),
        T('Phone', 'phone'),
        T('Pax', 'pax'),
        T('Sales Person', 'sales_person'),
        notesField,
      ],
    },
  ]
}

// Villa — stay booking
function villaSections(venue) {
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
        T('Guest Name', 'guest_name'),
        T('Phone', 'phone'),
        T('Pax', 'pax'),
        T('Sales Person', 'sales_person'),
        notesField,
      ],
    },
  ]
}

// ADD — external venue decor
function addSections() {
  return [
    {
      title: 'Venue',
      fields: [
        T('Venue Name', 'venue_name', true, { placeholder: 'Hotel Taj, Farmhouse…' }),
        S('Venue Type', 'venue_type', VENUE_TYPES),
        T('Location', 'location', false, { placeholder: 'Google Maps link or address' }),
      ],
    },
    {
      title: 'Event',
      fields: [
        ...eventTypeFields,
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
        T('Guest Name', 'guest_name'),
        T('Phone', 'phone'),
        T('Sales Person', 'sales_person'),
        notesField,
      ],
    },
  ]
}

// AC — external venue cuisine
function acSections() {
  return [
    {
      title: 'Venue',
      fields: [
        T('Venue Name', 'venue_name'),
        S('Venue Type', 'venue_type', VENUE_TYPES),
        T('Location', 'location', false, { placeholder: 'Google Maps link or address' }),
      ],
    },
    {
      title: 'Event',
      fields: [
        ...eventTypeFields,
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
        T('Guest Name', 'guest_name'),
        T('Phone', 'phone'),
        T('Pax', 'pax'),
        T('Sales Person', 'sales_person'),
        notesField,
      ],
    },
  ]
}

// AEE — same as ADD minus decor
function aeeSections() {
  return [
    {
      title: 'Venue',
      fields: [
        T('Venue Name', 'venue_name'),
        S('Venue Type', 'venue_type', VENUE_TYPES),
        T('Location', 'location', false, { placeholder: 'Google Maps link or address' }),
      ],
    },
    {
      title: 'Event',
      fields: [
        ...eventTypeFields,
        S('Shift', 'shift', SHIFTS),
        statusField,
        D('Date', 'date'),
        TM('Time', 'time'),
      ],
    },
    {
      title: 'Guest',
      fields: [
        T('Guest Name', 'guest_name'),
        T('Phone', 'phone'),
        T('Sales Person', 'sales_person'),
        notesField,
      ],
    },
  ]
}

// Tender — free text event, optional phone, no shift/pax/sales
function tenderSections() {
  return [
    {
      title: 'Tender',
      fields: [
        T('Venue Name', 'venue_name'),
        T('Location', 'location', false, { placeholder: 'Google Maps link or address' }),
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
        T('Tender Name', 'tender_name'),
        T('Phone', 'phone', false, { placeholder: 'Optional' }),
        notesField,
      ],
    },
  ]
}

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

export function getFormConfig(venueId) {
  const venue = VENUE_BY_ID[venueId]
  if (!venue) return []
  const build = BUILDERS[venueId]
  return build ? build(venue) : []
}

// Flatten sections to a single field list — convenient for validation.
export function getAllFields(venueId) {
  return getFormConfig(venueId).flatMap((s) => s.fields)
}

// Returns true if the given field is effectively required in the current
// form state (handles disabledWhen — disabled fields aren't required).
export function isFieldRequired(field, form) {
  if (!field.required) return false
  if (field.disabledWhen && field.disabledWhen(form)) return false
  if (field.showWhen && !field.showWhen(form)) return false
  return true
}
