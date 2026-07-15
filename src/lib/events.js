import { supabase } from './supabase.js'
import { logAction } from './audit.js'
import {
  buildAuditDiff, buildCreateSummary, buildDeleteSummary,
  buildSoftDeleteSummary, buildBulkDeleteSummary,
} from './auditDiff.js'
import { FIELD_MAP } from '../config/formFields.js'

// ── Per-category DB column allowlist ──
// Prevents leaking columns from other categories (e.g. kitchen_head on AP save).
// Meta columns every category can write:
const META_COLUMNS = ['venue_id', 'title', 'status', 'date', 'source', 'created_by']

function filterPayloadByCategory(payload) {
  const venueId = payload.venue_id
  if (!venueId) return payload
  const categoryFields = FIELD_MAP[venueId]
  if (!categoryFields) return payload // unknown category — pass through
  const allowed = new Set([...META_COLUMNS, ...categoryFields])
  const filtered = {}
  const stripped = []
  for (const [key, value] of Object.entries(payload)) {
    if (allowed.has(key)) {
      filtered[key] = value
    } else {
      stripped.push(key)
    }
  }
  if (stripped.length > 0) {
    console.warn('[ambria save] stripped non-category columns:', stripped, 'for category:', venueId)
  }
  return filtered
}

/**
 * Fetch events whose `date` falls within [startDate, endDate] (inclusive),
 * plus Villa events whose stay (check_in_date → check_out_date) overlaps the range.
 * Dates are ISO strings (YYYY-MM-DD).
 */
export async function fetchEvents(startDate, endDate) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .is('deleted_at', null)
    .or(`and(date.gte.${startDate},date.lte.${endDate}),and(venue_id.eq.villa,check_in_date.lte.${endDate},check_out_date.gte.${startDate}),and(venue_id.eq.tender,date.lte.${endDate},end_date.gte.${startDate}),and(setup_date.gte.${startDate},setup_date.lte.${endDate}),and(clearance_date.gte.${startDate},clearance_date.lte.${endDate})`)
    .order('date', { ascending: true })
    .order('time', { ascending: true, nullsFirst: true })

  if (error) throw error
  return data ?? []
}

/**
 * Insert a manual event. Forces source = 'manual' — CRM rows come in via sync.
 */
export async function createEvent(eventData, user) {
  const raw = { ...eventData, source: 'manual', created_by: user?.id || null }
  const payload = filterPayloadByCategory(raw)

  const { data, error } = await supabase
    .from('events')
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  if (user) {
    const summary = buildCreateSummary(data)
    logAction(user.id, user.name, 'create', 'event', data.id, {
      summary,
      booking_title: data.title,
      venue_id: data.venue_id,
    }, user.role)
  }
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

  const { source: _ignored, ...rawPatch } = eventData
  const patch = filterPayloadByCategory(rawPatch)

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
    const diff = buildAuditDiff(oldData, data, data.venue_id)
    if (diff) {
      logAction(user.id, user.name, 'update', 'event', data.id, {
        summary: diff.summary,
        booking_title: data.title,
        venue_id: data.venue_id,
        sections_edited: diff.sections_edited,
        changes: diff.changes,
      }, user.role)
    }
  }
  return data
}

/**
 * Bulk-delete all events in a date range.
 * All events are soft-deleted (deleted_at) so linked reviews survive
 * (a hard delete would cascade-delete the review row via the events FK).
 */
export async function bulkDeleteMonth(startDate, endDate, user) {
  // Count before deleting for audit
  let manualCount = 0, crmCount = 0
  if (user) {
    const { count: mc } = await supabase
      .from('events').select('*', { count: 'exact', head: true })
      .eq('source', 'manual').gte('date', startDate).lte('date', endDate).is('deleted_at', null)
    const { count: cc } = await supabase
      .from('events').select('*', { count: 'exact', head: true })
      .neq('source', 'manual').gte('date', startDate).lte('date', endDate).is('deleted_at', null)
    manualCount = mc || 0
    crmCount = cc || 0
  }

  // Soft delete manual events
  const { error: manualErr } = await supabase
    .from('events')
    .update({ deleted_at: new Date().toISOString() })
    .eq('source', 'manual')
    .gte('date', startDate)
    .lte('date', endDate)
    .is('deleted_at', null)

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
    const totalCount = manualCount + crmCount
    const summary = buildBulkDeleteSummary(startDate, endDate, totalCount)
    logAction(user.id, user.name, 'bulk_delete', 'event', null, {
      summary,
      count: totalCount,
      manual_deleted: manualCount,
      crm_soft_deleted: crmCount,
      month: `${startDate} to ${endDate}`,
    }, user.role)
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
    if (user) {
      const summary = buildDeleteSummary(event)
      logAction(user.id, user.name, 'delete', 'event', id, {
        summary, title: event.title, venue_id: event.venue_id,
      }, user.role)
    }
  } else {
    const { error } = await supabase
      .from('events')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    if (user) {
      const summary = buildSoftDeleteSummary(event)
      logAction(user.id, user.name, 'soft_delete', 'event', id, {
        summary, title: event.title, venue_id: event.venue_id,
      }, user.role)
    }
  }

  return event
}

/**
 * Check for an existing booking that matches the key identifiers of a new booking.
 * Returns the matching row or null if no duplicate is found.
 * Only queries non-deleted rows.
 */
export async function checkDuplicateBooking({ venueId, date, guestName, shift, checkInDate, checkOutDate, tenderName }) {
  let q = supabase
    .from('events')
    .select('id, title, date, guest_name, shift, check_in_date, check_out_date, tender_name')
    .is('deleted_at', null)
    .eq('venue_id', venueId)

  if (venueId === 'villa') {
    const ciDate = checkInDate || date
    const coDate = checkOutDate || ciDate
    if (!ciDate) return null
    if (guestName?.trim()) q = q.ilike('guest_name', guestName.trim())
    q = q.lte('check_in_date', coDate).gte('check_out_date', ciDate)
  } else if (venueId === 'tender') {
    if (!date && !tenderName?.trim()) return null
    if (date) q = q.eq('date', date)
    if (tenderName?.trim()) q = q.ilike('tender_name', tenderName.trim())
  } else {
    if (!date || !guestName?.trim()) return null
    q = q.eq('date', date).ilike('guest_name', guestName.trim())
    if (shift) q = q.eq('shift', shift)
  }

  const { data } = await q.limit(1)
  return data?.[0] ?? null
}

/**
 * Fetch distinct guest names for autocomplete.
 */
export async function fetchDistinctGuestNames() {
  const { data, error } = await supabase
    .from('events')
    .select('guest_name')
    .is('deleted_at', null)
    .not('guest_name', 'is', null)
    .neq('guest_name', '')
  if (error) throw error
  const unique = [...new Set((data || []).map((r) => r.guest_name))].sort()
  return unique
}
