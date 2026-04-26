import { supabase } from './supabase.js'
import { logAction } from './audit.js'

/** Hard timeout — rejects if the promise doesn't settle within ms */
function withTimeout(promise, ms = 10000) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Request timed out — check your Supabase connection')), ms)
    }),
  ]).finally(() => clearTimeout(timer))
}

/** Fetch all event types, sorted by sort_order */
export async function fetchEventTypes() {
  console.log('[eventTypes] fetchEventTypes …')
  const { data, error } = await withTimeout(
    supabase.from('event_types').select('*').order('sort_order', { ascending: true })
  )
  if (error) { console.error('[eventTypes] fetchEventTypes error:', error); throw error }
  console.log('[eventTypes] fetched', data?.length, 'types')
  return data ?? []
}

/** Fetch all event types for dropdown use */
export async function fetchActiveEventTypes() {
  const { data, error } = await withTimeout(
    supabase.from('event_types').select('*').order('sort_order', { ascending: true })
  )
  if (error) throw error
  return data ?? []
}

/** Create a new event type */
export async function createEventType(name, user) {
  console.log('[eventTypes] createEventType called:', name)

  // Get max sort_order
  const { data: existing, error: sortErr } = await withTimeout(
    supabase.from('event_types').select('sort_order').order('sort_order', { ascending: false }).limit(1)
  )
  if (sortErr) console.warn('[eventTypes] sort_order query error (continuing):', sortErr.message)
  const nextOrder = (existing?.[0]?.sort_order ?? 0) + 1
  console.log('[eventTypes] inserting with sort_order:', nextOrder)

  const { data, error } = await withTimeout(
    supabase.from('event_types').insert({ name, sort_order: nextOrder }).select().single()
  )
  if (error) { console.error('[eventTypes] createEventType insert error:', error); throw error }
  console.log('[eventTypes] inserted:', data.id)

  // Fire-and-forget audit — never block the main flow
  if (user) {
    logAction(user.id, user.name, 'create', 'event_type', data.id, { name }).catch(() => {})
  }
  return data
}

/** Update an event type (name, is_active) */
export async function updateEventType(id, updates, user) {
  console.log('[eventTypes] updateEventType:', id, updates)
  const { data, error } = await withTimeout(
    supabase.from('event_types').update(updates).eq('id', id).select().single()
  )
  if (error) { console.error('[eventTypes] updateEventType error:', error); throw error }

  if (user) {
    logAction(user.id, user.name, 'update', 'event_type', data.id, {
      name: data.name, ...updates,
    }).catch(() => {})
  }
  return data
}

/** Delete an event type */
export async function deleteEventType(id, user) {
  console.log('[eventTypes] deleteEventType:', id)
  const { data: existing } = await withTimeout(
    supabase.from('event_types').select('name').eq('id', id).maybeSingle()
  ).catch(() => ({ data: null }))

  const { error } = await withTimeout(
    supabase.from('event_types').delete().eq('id', id)
  )
  if (error) { console.error('[eventTypes] deleteEventType error:', error); throw error }

  if (user && existing) {
    logAction(user.id, user.name, 'delete', 'event_type', id, { name: existing.name }).catch(() => {})
  }
}

/** Reorder event types by passing ordered array of ids */
export async function reorderEventTypes(orderedIds, user) {
  const updates = orderedIds.map((id, i) =>
    supabase.from('event_types').update({ sort_order: i + 1 }).eq('id', id)
  )
  await withTimeout(Promise.all(updates))

  if (user) {
    logAction(user.id, user.name, 'update', 'event_type', null, {
      action: 'reorder', count: orderedIds.length,
    }).catch(() => {})
  }
}
