import { supabase } from './supabase.js'
import { logAction } from './audit.js'

/** Fetch all categories, sorted by sort_order */
export async function fetchCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data ?? []
}

/** Fetch only active categories */
export async function fetchActiveCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data ?? []
}

/** Create a new category */
export async function createCategory(fields, user) {
  const { data: existing } = await supabase
    .from('categories')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
  const nextOrder = (existing?.[0]?.sort_order ?? 0) + 1

  const { data, error } = await supabase
    .from('categories')
    .insert({ ...fields, sort_order: nextOrder })
    .select()
    .single()
  if (error) throw error

  if (user) {
    await logAction(user.id, user.name, 'create', 'category', data.id, {
      summary: `Added category: ${data.name}`, name: data.name, venue_id: data.venue_id,
    })
  }
  return data
}

/** Update a category */
export async function updateCategory(id, updates, user) {
  const { data, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error

  if (user) {
    await logAction(user.id, user.name, 'update', 'category', data.id, {
      summary: `Updated category: ${data.name}`, name: data.name, ...updates,
    })
  }
  return data
}

/** Delete a category (custom only — enforced at UI level) */
export async function deleteCategory(id, user) {
  const { data: existing } = await supabase
    .from('categories')
    .select('name, venue_id')
    .eq('id', id)
    .maybeSingle()

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
  if (error) throw error

  if (user && existing) {
    await logAction(user.id, user.name, 'delete', 'category', id, {
      summary: `Deleted category: ${existing.name}`, name: existing.name, venue_id: existing.venue_id,
    })
  }
}

/** Reorder categories by passing ordered array of ids */
export async function reorderCategories(orderedIds, user) {
  const updates = orderedIds.map((id, i) =>
    supabase.from('categories').update({ sort_order: i + 1 }).eq('id', id)
  )
  await Promise.all(updates)

  if (user) {
    await logAction(user.id, user.name, 'update', 'category', null, {
      summary: 'Reordered categories', action: 'reorder', count: orderedIds.length,
    })
  }
}
