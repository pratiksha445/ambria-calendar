import { supabase } from './supabase.js'

/**
 * Fetch a single setting by key from the app_settings table.
 * Returns the value string, or the provided fallback on error / missing row.
 */
export async function fetchSetting(key, fallback = 'off') {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .single()
    if (error || !data) return fallback
    return data.value
  } catch {
    return fallback
  }
}

/**
 * Update a setting value.  Also stamps updated_at and updated_by.
 */
export async function updateSetting(key, value, userId) {
  const { error } = await supabase
    .from('app_settings')
    .update({ value, updated_at: new Date().toISOString(), updated_by: userId })
    .eq('key', key)
  if (error) throw error
}
