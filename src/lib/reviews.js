import { supabase } from './supabase.js'
import { logAction } from './audit.js'

/** Rating field definitions per category type */
const VENUE_RATING_FIELDS = [
  { key: 'rating_food', label: 'Food' },
  { key: 'rating_service', label: 'Service' },
  { key: 'rating_decor', label: 'Decor' },
  { key: 'rating_entertainment', label: 'Entertainment' },
  { key: 'rating_housekeeping', label: 'Housekeeping' },
  { key: 'rating_valet', label: 'Valet' },
  { key: 'rating_overall', label: 'Overall' },
  { key: 'rating_poc_availability', label: 'POC Availability' },
]

const ADD_RATING_FIELDS = [
  { key: 'rating_furniture', label: 'Furniture' },
  { key: 'rating_structure_fabric', label: 'Structure + Fabric' },
  { key: 'rating_floral', label: 'Floral' },
  { key: 'rating_transport', label: 'Transport' },
  { key: 'rating_light', label: 'Light' },
  { key: 'rating_timely_execution', label: 'Timely Execution' },
  { key: 'rating_cleanliness', label: 'Cleanliness' },
  { key: 'rating_poc_availability', label: 'POC Availability' },
]

const AC_RATING_FIELDS = [
  { key: 'rating_chaat', label: 'Chaat' },
  { key: 'rating_beverages', label: 'Beverages' },
  { key: 'rating_main_course', label: 'Main Course' },
  { key: 'rating_pre_dining', label: 'Pre-dining' },
  { key: 'rating_desserts', label: 'Desserts' },
  { key: 'rating_service_staff', label: 'Service Staff' },
  { key: 'rating_quality', label: 'Quality' },
  { key: 'rating_hygiene', label: 'Hygiene' },
  { key: 'rating_transport', label: 'Transport' },
  { key: 'rating_timely_execution', label: 'Timely Execution' },
  { key: 'rating_poc_availability', label: 'POC Availability' },
]

const AEE_RATING_FIELDS = [
  { key: 'rating_baraat', label: 'Baraat' },
  { key: 'rating_bridal_entry', label: 'Bridal Entry' },
  { key: 'rating_groom_entry', label: 'Groom Entry' },
  { key: 'rating_jaimala', label: 'Jaimala' },
  { key: 'rating_artist_quality', label: 'Artist Quality' },
  { key: 'rating_product_quality', label: 'Product Quality' },
  { key: 'rating_timely_execution', label: 'Timely Execution' },
  { key: 'rating_poc_availability', label: 'POC Availability' },
]

const VILLA_RATING_FIELDS = [
  { key: 'rating_checkin_readiness', label: 'Check-in Readiness' },
  { key: 'rating_housekeeping', label: 'Housekeeping' },
  { key: 'rating_amenities', label: 'Amenities' },
  { key: 'rating_food_service', label: 'Food & Service' },
  { key: 'rating_team_coordination', label: 'Team Coordination' },
]

export function getRatingFields(venueId) {
  if (venueId === 'add') return ADD_RATING_FIELDS
  if (venueId === 'ac') return AC_RATING_FIELDS
  if (venueId === 'aee') return AEE_RATING_FIELDS
  if (venueId === 'villa') return VILLA_RATING_FIELDS
  return VENUE_RATING_FIELDS
}

/** Returns true if all ratings for this category are optional (e.g. Villa). */
export function areRatingsOptional(venueId) {
  return venueId === 'villa'
}

/**
 * Fetch review for a single event.
 * Returns the review object or null.
 */
export async function fetchReview(eventId) {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle()

  if (error) throw error
  return data
}

/**
 * Fetch reviews for multiple events at once.
 * Returns a Map of event_id → review.
 */
export async function fetchReviewsByEventIds(eventIds) {
  if (!eventIds || eventIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .in('event_id', eventIds)

  if (error) throw error
  const map = new Map()
  for (const r of (data ?? [])) {
    map.set(r.event_id, r)
  }
  return map
}

/**
 * Build the upsert payload — only includes rating columns relevant to the category.
 */
function buildPayload(reviewData, user) {
  const base = {
    event_id: reviewData.event_id,
    review_payment_status: reviewData.review_payment_status,
    remark: reviewData.remark || null,
    submitted_by: user?.id || null,
    submitted_by_name: user?.name || null,
    submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  if (reviewData._venueId === 'villa') {
    // Villa: all ratings optional — store value or null
    base.rating_checkin_readiness = reviewData.rating_checkin_readiness || null
    base.rating_housekeeping = reviewData.rating_housekeeping || null
    base.rating_amenities = reviewData.rating_amenities || null
    base.rating_food_service = reviewData.rating_food_service || null
    base.rating_team_coordination = reviewData.rating_team_coordination || null
  } else if (reviewData._venueId === 'add') {
    base.rating_poc_availability = reviewData.rating_poc_availability
    base.rating_furniture = reviewData.rating_furniture
    base.rating_structure_fabric = reviewData.rating_structure_fabric
    base.rating_floral = reviewData.rating_floral
    base.rating_transport = reviewData.rating_transport
    base.rating_light = reviewData.rating_light
    base.rating_timely_execution = reviewData.rating_timely_execution
    base.rating_cleanliness = reviewData.rating_cleanliness
  } else if (reviewData._venueId === 'ac') {
    base.rating_poc_availability = reviewData.rating_poc_availability
    base.rating_chaat = reviewData.rating_chaat
    base.rating_beverages = reviewData.rating_beverages
    base.rating_main_course = reviewData.rating_main_course
    base.rating_pre_dining = reviewData.rating_pre_dining
    base.rating_desserts = reviewData.rating_desserts
    base.rating_service_staff = reviewData.rating_service_staff
    base.rating_quality = reviewData.rating_quality
    base.rating_hygiene = reviewData.rating_hygiene
    base.rating_transport = reviewData.rating_transport
    base.rating_timely_execution = reviewData.rating_timely_execution
  } else if (reviewData._venueId === 'aee') {
    base.rating_poc_availability = reviewData.rating_poc_availability
    base.rating_baraat = reviewData.rating_baraat
    base.rating_bridal_entry = reviewData.rating_bridal_entry
    base.rating_groom_entry = reviewData.rating_groom_entry
    base.rating_jaimala = reviewData.rating_jaimala
    base.rating_artist_quality = reviewData.rating_artist_quality
    base.rating_product_quality = reviewData.rating_product_quality
    base.rating_timely_execution = reviewData.rating_timely_execution
  } else {
    // Venue-specific columns (AP/AM/AE/AR)
    base.rating_poc_availability = reviewData.rating_poc_availability
    base.rating_food = reviewData.rating_food
    base.rating_service = reviewData.rating_service
    base.rating_decor = reviewData.rating_decor
    base.rating_entertainment = reviewData.rating_entertainment
    base.rating_housekeeping = reviewData.rating_housekeeping
    base.rating_valet = reviewData.rating_valet
    base.rating_overall = reviewData.rating_overall
  }

  return base
}

/**
 * Upsert a review (insert if new, update if exists for this event_id).
 */
export async function upsertReview(reviewData, user) {
  const payload = buildPayload(reviewData, user)

  const { data, error } = await supabase
    .from('reviews')
    .upsert(payload, { onConflict: 'event_id' })
    .select()
    .single()

  if (error) throw error

  // Audit log
  if (user) {
    const isUpdate = !!reviewData.id
    const action = isUpdate ? 'update' : 'create'
    const summary = isUpdate
      ? `Review updated for ${reviewData.event_title || 'event'}`
      : `Review submitted for ${reviewData.event_title || 'event'}`
    logAction(user.id, user.name, action, 'review', data.id, {
      summary,
      event_id: reviewData.event_id,
      event_title: reviewData.event_title,
    }, user.role)
  }

  return data
}

/**
 * Check if the current user can edit a review for an event.
 */
export function canEditReview(user, event) {
  if (!user || !event) return false
  if (user.role === 'admin') return true
  if (event.sales_person_id && event.sales_person_id === user.id) return true
  if (event.delivery_person_id && event.delivery_person_id === user.id) return true
  // Villa: Social/Tech staff, GM of Venue Sales, GM of Management
  if (event.venue_id === 'villa') {
    if (user.department === 'Social/Tech') return true
    if (user.role === 'gm' && (user.department === 'Venue Sales' || user.department === 'Management')) return true
    return false
  }
  // ADD: execution person and operation manager can also edit
  if (event.venue_id === 'add') {
    if (event.execution_person_id && event.execution_person_id === user.id) return true
    if (event.operation_manager_id && event.operation_manager_id === user.id) return true
  }
  // AC: service head and kitchen head can also edit
  if (event.venue_id === 'ac') {
    if (event.service_head_id && event.service_head_id === user.id) return true
    if (event.kitchen_head_id && event.kitchen_head_id === user.id) return true
  }
  return false
}

/**
 * Check whether an event's date has passed.
 * Villa uses check_out_date, TND/WS use end_date, others use date.
 */
export function isPastEvent(event) {
  if (!event) return false
  const today = new Date().toISOString().slice(0, 10)
  if (event.venue_id === 'villa') {
    return (event.check_out_date || event.check_in_date || event.date) < today
  }
  if (event.venue_id === 'tender' || event.venue_id === 'ws') {
    return (event.end_date || event.date) < today
  }
  return event.date < today
}

/**
 * Check if an event is eligible for review.
 * Must be AP/AM/AE/AR/ADD/AC/AEE/Villa and event date < today.
 * Villa uses check_out_date (not check_in_date).
 */
const REVIEWABLE_VENUES = new Set(['ap', 'am', 'ae', 'ar', 'add', 'ac', 'aee', 'villa'])

export function isReviewable(event) {
  if (!event) return false
  if (!REVIEWABLE_VENUES.has(event.venue_id)) return false
  const today = new Date().toISOString().slice(0, 10)
  const eventDate = event.venue_id === 'villa' ? (event.check_out_date || event.check_in_date || event.date) : event.date
  return eventDate < today
}

/**
 * Get a quick-glance rating for the review summary.
 * Venue reviews: rating_overall. ADD/AC reviews: average of category ratings.
 */
export function getQuickRating(review, venueId) {
  if (!review) return 0
  if (venueId === 'add' || venueId === 'ac' || venueId === 'aee' || venueId === 'villa') {
    const fields = getRatingFields(venueId)
    const vals = fields
      .map((f) => review[f.key])
      .filter((v) => v != null && v > 0)
    if (vals.length === 0) return 0
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  }
  return review.rating_overall || 0
}
