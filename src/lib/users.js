import { supabase } from './supabase.js'

export async function loginUser(phone, pin) {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, phone, role')
    .eq('phone', phone)
    .eq('pin', pin)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function fetchUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createUser(userData) {
  const { data, error } = await supabase
    .from('users')
    .insert(userData)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateUser(id, userData) {
  const { data, error } = await supabase
    .from('users')
    .update(userData)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteUser(id) {
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function toggleUserActive(id, isActive) {
  const { data, error } = await supabase
    .from('users')
    .update({ is_active: isActive })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
