import { supabase } from './supabase.js'
import { logAction } from './audit.js'

/** Hard timeout — rejects if the promise doesn't settle within ms */
function withTimeout(promise, ms = 10000) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Request timed out')), ms)
    }),
  ]).finally(() => clearTimeout(timer))
}

// ── Module-level label cache ──
// Shared across all consumers so only one fetch happens.
let _labelCache = null
let _labelPromise = null

/** Fetch all elements (admin page) */
export async function fetchElements() {
  const { data, error } = await withTimeout(
    supabase.from('elements').select('*').order('sort_order', { ascending: true })
  )
  if (error) throw error
  return data ?? []
}

/** Fetch all elements for dropdown use */
export async function fetchActiveElements() {
  const { data, error } = await withTimeout(
    supabase.from('elements').select('id, name, name_hi')
      .order('sort_order', { ascending: true }).order('name', { ascending: true })
  )
  if (error) throw error
  return data ?? []
}

/** Load element labels (name → name_hi map). Cached at module level. */
export async function loadElementLabels() {
  if (_labelCache) return _labelCache
  if (!_labelPromise) {
    _labelPromise = supabase.from('elements').select('name, name_hi')
      .then(({ data }) => {
        _labelCache = {}
        ;(data ?? []).forEach((el) => {
          if (el.name_hi) _labelCache[el.name] = el.name_hi
        })
        return _labelCache
      })
      .catch(() => {
        _labelCache = {}
        return _labelCache
      })
  }
  return _labelPromise
}

/** Get Hindi label for an element name. Returns English name if no Hindi label. */
export function getElementLabel(name, lang, labels) {
  if (lang === 'hi' && labels && labels[name]) return labels[name]
  return name
}

/** Bust the label cache (call after admin changes) */
export function invalidateElementCache() {
  _labelCache = null
  _labelPromise = null
}

/** Create a new element */
export async function createElement(name, nameHi, user) {
  const { data: existing, error: sortErr } = await withTimeout(
    supabase.from('elements').select('sort_order').order('sort_order', { ascending: false }).limit(1)
  )
  if (sortErr) console.warn('[elements] sort_order query error:', sortErr.message)
  const nextOrder = (existing?.[0]?.sort_order ?? 0) + 1

  const { data, error } = await withTimeout(
    supabase.from('elements').insert({
      name, name_hi: nameHi || null, sort_order: nextOrder,
    }).select().single()
  )
  if (error) throw error

  invalidateElementCache()
  if (user) {
    logAction(user.id, user.name, 'create', 'element', data.id, { name }).catch(() => {})
  }
  return data
}

/** Update an element */
export async function updateElement(id, updates, user) {
  const { data, error } = await withTimeout(
    supabase.from('elements').update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
  )
  if (error) throw error

  invalidateElementCache()
  if (user) {
    logAction(user.id, user.name, 'update', 'element', data.id, {
      name: data.name, ...updates,
    }).catch(() => {})
  }
  return data
}

/** Delete an element */
export async function deleteElement(id, user) {
  const { data: existing } = await withTimeout(
    supabase.from('elements').select('name').eq('id', id).maybeSingle()
  ).catch(() => ({ data: null }))

  const { error } = await withTimeout(
    supabase.from('elements').delete().eq('id', id)
  )
  if (error) throw error

  invalidateElementCache()
  if (user && existing) {
    logAction(user.id, user.name, 'delete', 'element', id, { name: existing.name }).catch(() => {})
  }
}

/** Reorder elements by passing ordered array of ids */
export async function reorderElements(orderedIds, user) {
  const updates = orderedIds.map((id, i) =>
    supabase.from('elements').update({ sort_order: i + 1 }).eq('id', id)
  )
  await withTimeout(Promise.all(updates))

  invalidateElementCache()
  if (user) {
    logAction(user.id, user.name, 'update', 'element', null, {
      action: 'reorder', count: orderedIds.length,
    }).catch(() => {})
  }
}
