import { supabase } from './supabase.js'

/**
 * Fetch events whose `date` falls within [startDate, endDate] (inclusive).
 * Dates are ISO strings (YYYY-MM-DD).
 */
export async function fetchEvents(startDate, endDate) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .is('deleted_at', null)
    .order('date', { ascending: true })
    .order('time', { ascending: true, nullsFirst: true })

  if (error) throw error
  return data ?? []
}

/**
 * Insert a manual event. Forces source = 'manual' — CRM rows come in via sync.
 */
export async function createEvent(eventData) {
  const payload = { ...eventData, source: 'manual' }

  const { data, error } = await supabase
    .from('events')
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Update a manual event only. Refuses to touch rows with source != 'manual'
 * so CRM-owned bookings can't be edited from the calendar UI.
 */
export async function updateEvent(id, eventData) {
  const { source: _ignored, ...patch } = eventData

  const { data, error } = await supabase
    .from('events')
    .update(patch)
    .eq('id', id)
    .eq('source', 'manual')
    .select()
    .single()

  if (error) throw error
  if (!data) {
    throw new Error(`Event ${id} is not a manual event or does not exist`)
  }
  return data
}

/**
 * Soft-delete a CRM event — sets deleted_at so the row stays in the DB
 * (preventing re-creation on next sync) but disappears from the calendar.
 */
export async function softDeleteEvent(id) {
  const { data, error } = await supabase
    .from('events')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Delete a manual event only — same guard as updateEvent.
 */
export async function deleteEvent(id) {
  const { data, error } = await supabase
    .from('events')
    .delete()
    .eq('id', id)
    .eq('source', 'manual')
    .select()
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new Error(`Event ${id} is not a manual event or does not exist`)
  }
  return data
}
