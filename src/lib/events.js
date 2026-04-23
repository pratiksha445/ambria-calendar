import { supabase } from './supabase.js'
import { logAction } from './audit.js'

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
export async function createEvent(eventData, user) {
  const payload = { ...eventData, source: 'manual', created_by: user?.id || null }

  const { data, error } = await supabase
    .from('events')
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  if (user) logAction(user.id, user.name, 'create', 'event', data.id, data)
  return data
}

/**
 * Update a manual event only. Refuses to touch rows with source != 'manual'
 * so CRM-owned bookings can't be edited from the calendar UI.
 */
export async function updateEvent(id, eventData, user) {
  // Fetch old data for audit diff
  let oldData = null
  if (user) {
    const { data: old } = await supabase.from('events').select('*').eq('id', id).maybeSingle()
    oldData = old
  }

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

  if (user && oldData) {
    const changes = {}
    for (const key of Object.keys(patch)) {
      if (String(oldData[key] ?? '') !== String(data[key] ?? '')) {
        changes[key] = { old: oldData[key], new: data[key] }
      }
    }
    logAction(user.id, user.name, 'update', 'event', data.id, {
      title: data.title, venue_id: data.venue_id, changes,
    })
  }
  return data
}

/**
 * Bulk-delete all events in a date range.
 * Manual events are hard-deleted; CRM events are soft-deleted (deleted_at).
 */
export async function bulkDeleteMonth(startDate, endDate, user) {
  // Count before deleting for audit
  let manualCount = 0, crmCount = 0
  if (user) {
    const { count: mc } = await supabase
      .from('events').select('*', { count: 'exact', head: true })
      .eq('source', 'manual').gte('date', startDate).lte('date', endDate)
    const { count: cc } = await supabase
      .from('events').select('*', { count: 'exact', head: true })
      .neq('source', 'manual').gte('date', startDate).lte('date', endDate).is('deleted_at', null)
    manualCount = mc || 0
    crmCount = cc || 0
  }

  // Hard delete manual events
  const { error: manualErr } = await supabase
    .from('events')
    .delete()
    .eq('source', 'manual')
    .gte('date', startDate)
    .lte('date', endDate)

  if (manualErr) throw manualErr

  // Soft delete CRM events
  const { error: crmErr } = await supabase
    .from('events')
    .update({ deleted_at: new Date().toISOString() })
    .neq('source', 'manual')
    .gte('date', startDate)
    .lte('date', endDate)
    .is('deleted_at', null)

  if (crmErr) throw crmErr

  if (user) {
    logAction(user.id, user.name, 'bulk_delete', 'event', null, {
      count: manualCount + crmCount,
      manual_deleted: manualCount,
      crm_soft_deleted: crmCount,
      month: `${startDate} to ${endDate}`,
    })
  }
}

/**
 * Delete any event by id.
 * Manual events are hard-deleted; CRM events are soft-deleted (deleted_at).
 */
export async function deleteEvent(id, user) {
  // Fetch the event first to determine its source
  const { data: event, error: fetchErr } = await supabase
    .from('events')
    .select('id, source, title, venue_id')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr) throw fetchErr
  if (!event) throw new Error(`Event ${id} not found`)

  if (event.source === 'manual') {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id)
    if (error) throw error
    if (user) logAction(user.id, user.name, 'delete', 'event', id, { title: event.title, venue_id: event.venue_id })
  } else {
    const { error } = await supabase
      .from('events')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    if (user) logAction(user.id, user.name, 'soft_delete', 'event', id, { title: event.title, venue_id: event.venue_id })
  }

  return event
}
