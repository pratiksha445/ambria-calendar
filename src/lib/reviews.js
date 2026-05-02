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

export function getRatingFields(venueId) {
  if (venueId === 'add') return ADD_RATING_FIELDS
  return VENUE_RATING_FIELDS
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
    rating_poc_availability: reviewData.rating_poc_availability,
    remark: reviewData.remark || null,
    submitted_by: user?.id || null,
    submitted_by_name: user?.name || null,
    submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  if (reviewData._venueId === 'add') {
    // ADD-specific columns
    base.rating_furniture = reviewData.rating_furniture
    base.rating_structure_fabric = reviewData.rating_structure_fabric
    base.rating_floral = reviewData.rating_floral
    base.rating_transport = reviewData.rating_transport
    base.rating_light = reviewData.rating_light
    base.rating_timely_execution = reviewData.rating_timely_execution
    base.rating_cleanliness = reviewData.rating_cleanliness
  } else {
    // Venue-specific columns (AP/AM/AE/AR)
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
  // ADD: execution person and operation manager can also edit
  if (event.venue_id === 'add') {
    if (event.execution_person_id && event.execution_person_id === user.id) return true
    if (event.operation_manager_id && event.operation_manager_id === user.id) return true
  }
  return false
}

/**
 * Check if an event is eligible for review.
 * Must be AP/AM/AE/AR/ADD and event date < today.
 */
const REVIEWABLE_VENUES = new Set(['ap', 'am', 'ae', 'ar', 'add'])

export function isReviewable(event) {
  if (!event) return false
  if (!REVIEWABLE_VENUES.has(event.venue_id)) return false
  const today = new Date().toISOString().slice(0, 10)
  return event.date < today
}

/**
 * Get a quick-glance rating for the review summary.
 * Venue reviews: rating_overall. ADD reviews: average of all ADD ratings.
 */
export function getQuickRating(review, venueId) {
  if (!review) return 0
  if (venueId === 'add') {
    const vals = [
      review.rating_furniture, review.rating_structure_fabric,
      review.rating_floral, review.rating_transport,
      review.rating_light, review.rating_timely_execution,
      review.rating_cleanliness, review.rating_poc_availability,
    ].filter((v) => v != null && v > 0)
    if (vals.length === 0) return 0
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  }
  return review.rating_overall || 0
}
