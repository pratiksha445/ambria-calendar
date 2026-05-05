import { supabase } from './supabase.js'
import { logAction } from './audit.js'
import { isPastEvent } from './reviews.js'

const PAYMENT_VENUES = new Set(['tender', 'ws'])

/**
 * Returns true if the event is a past TND/WS event eligible for payment completion flow.
 */
export function isPastPaymentEvent(event) {
  if (!event) return false
  if (!PAYMENT_VENUES.has(event.venue_id)) return false
  return isPastEvent(event)
}

/**
 * Returns true if payment_remaining_venue is '0' or 0.
 */
export function isPaymentComplete(event) {
  if (!event) return false
  return event.payment_remaining_venue === '0' || event.payment_remaining_venue === 0
}

/**
 * Check if user can mark payment complete for a TND/WS event.
 * Same as edit permissions: admin, GM, sales_person, or created_by.
 */
export function canMarkPayment(user, event) {
  if (!user || !event) return false
  if (user.role === 'admin') return true
  if (user.role === 'gm') return true
  if (event.created_by != null && user.id === event.created_by) return true
  if (event.sales_person_id && event.sales_person_id === user.id) return true
  if (!event.sales_person_id && event.sales_person && user.name === event.sales_person) return true
  return false
}

/**
 * Mark payment as complete by setting payment_remaining_venue to '0'.
 * Returns the updated event row.
 */
export async function markPaymentComplete(eventId, user, remark) {
  const { data, error } = await supabase
    .from('events')
    .update({ payment_remaining_venue: '0' })
    .eq('id', eventId)
    .select()
    .single()

  if (error) throw error

  logAction(user.id, user.name, 'payment_complete', 'event', eventId, {
    summary: `Payment marked complete`,
    remark: remark || null,
    marked_by: user.name,
  }, user.role)

  return data
}

/**
 * Fetch who marked payment complete from audit_log.
 * Returns { user_name, created_at, details } or null.
 */
export async function fetchPaymentCompletion(eventId) {
  const { data, error } = await supabase
    .from('audit_log')
    .select('user_name, created_at, details')
    .eq('entity_type', 'event')
    .eq('entity_id', eventId)
    .eq('action', 'payment_complete')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[ambria] fetch payment completion failed', error)
    return null
  }
  return data
}
