import { supabase } from './supabase.js'
import { logAction } from './audit.js'

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
 * Upsert a review (insert if new, update if exists for this event_id).
 */
export async function upsertReview(reviewData, user) {
  const payload = {
    event_id: reviewData.event_id,
    review_payment_status: reviewData.review_payment_status,
    rating_food: reviewData.rating_food,
    rating_service: reviewData.rating_service,
    rating_decor: reviewData.rating_decor,
    rating_entertainment: reviewData.rating_entertainment,
    rating_housekeeping: reviewData.rating_housekeeping,
    rating_valet: reviewData.rating_valet,
    rating_overall: reviewData.rating_overall,
    rating_poc_availability: reviewData.rating_poc_availability,
    remark: reviewData.remark || null,
    submitted_by: user?.id || null,
    submitted_by_name: user?.name || null,
    submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

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
  return false
}

/**
 * Check if an event is eligible for review.
 * Must be AP/AM/AE/AR and event date < today.
 */
const REVIEWABLE_VENUES = new Set(['ap', 'am', 'ae', 'ar'])

export function isReviewable(event) {
  if (!event) return false
  if (!REVIEWABLE_VENUES.has(event.venue_id)) return false
  const today = new Date().toISOString().slice(0, 10)
  return event.date < today
}
