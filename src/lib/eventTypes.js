import { supabase } from './supabase.js'
import { logAction } from './audit.js'

function withTimeout(promise, ms = 10000) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Request timed out — check your Supabase connection')), ms)
    }),
  ]).finally(() => clearTimeout(timer))
}

export async function fetchEventTypes() {
  const { data, error } = await withTimeout(
    supabase.from('event_types').select('*').order('name', { ascending: true })
  )
  if (error) throw error
  return data ?? []
}

export async function fetchActiveEventTypes() {
  const { data, error } = await withTimeout(
    supabase.from('event_types').select('*').order('name', { ascending: true })
  )
  if (error) throw error
  return data ?? []
}

export async function createEventType(name, nameHi, abbreviation, user) {
  const { data: existing, error: sortErr } = await withTimeout(
    supabase.from('event_types').select('sort_order').order('sort_order', { ascending: false }).limit(1)
  )
  if (sortErr) console.warn('[eventTypes] sort_order query error:', sortErr.message)
  const nextOrder = (existing?.[0]?.sort_order ?? 0) + 1

  const { data, error } = await withTimeout(
    supabase.from('event_types').insert({ name, name_hi: nameHi || null, abbreviation: abbreviation || null, sort_order: nextOrder }).select().single()
  )
  if (error) throw error

  if (user) {
    logAction(user.id, user.name, 'create', 'event_type', data.id, { summary: `Added event type: ${name}`, name, abbreviation }).catch(() => {})
  }
  return data
}

export async function updateEventType(id, updates, user) {
  const { data, error } = await withTimeout(
    supabase.from('event_types').update(updates).eq('id', id).select().single()
  )
  if (error) throw error

  if (user) {
    logAction(user.id, user.name, 'update', 'event_type', data.id, {
      summary: `Edited event type: ${data.name}`, name: data.name, ...updates,
    }).catch(() => {})
  }
  return data
}

export async function deleteEventType(id, user) {
  const { data: existing } = await withTimeout(
    supabase.from('event_types').select('name').eq('id', id).maybeSingle()
  ).catch(() => ({ data: null }))

  const { error } = await withTimeout(
    supabase.from('event_types').delete().eq('id', id)
  )
  if (error) throw error

  if (user && existing) {
    logAction(user.id, user.name, 'delete', 'event_type', id, { summary: `Deleted event type: ${existing.name}`, name: existing.name }).catch(() => {})
  }
}

export async function reorderEventTypes(orderedIds, user) {
  const updates = orderedIds.map((id, i) =>
    supabase.from('event_types').update({ sort_order: i + 1 }).eq('id', id)
  )
  await withTimeout(Promise.all(updates))

  if (user) {
    logAction(user.id, user.name, 'update', 'event_type', null, {
      summary: 'Reordered event types', action: 'reorder', count: orderedIds.length,
    }).catch(() => {})
  }
}
