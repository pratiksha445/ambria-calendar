import { supabase } from './supabase.js'

const DEFAULT_PIN = '0000'

/** Fetch active approved user names for dropdowns (Sales Person, etc.) */
export async function fetchActiveUserNames() {
  const { data, error } = await supabase
    .from('users')
    .select('name')
    .eq('is_active', true)
    .eq('approval_status', 'approved')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map((u) => u.name)
}

/**
 * Login — returns { status, user, needsPinChange?, reason? }
 * status: 'ok' | 'pending' | 'rejected' | 'deactivated' | 'not_found' | 'wrong_pin'
 */
export async function loginUser(phone, pin) {
  const { data: row, error } = await supabase
    .from('users')
    .select('id, name, phone, role, pin, is_active, approval_status, rejection_reason')
    .eq('phone', phone)
    .maybeSingle()
  if (error) throw error
  if (!row) return { status: 'not_found', user: null }

  if (row.approval_status === 'pending') return { status: 'pending', user: null }
  if (row.approval_status === 'rejected') return { status: 'rejected', user: null, reason: row.rejection_reason }
  if (!row.is_active) return { status: 'deactivated', user: null }
  if (row.pin !== pin) return { status: 'wrong_pin', user: null }

  const user = { id: row.id, name: row.name, phone: row.phone, role: row.role }
  return { status: 'ok', user, needsPinChange: row.pin === DEFAULT_PIN }
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
    .insert({
      ...userData,
      pin: userData.pin || DEFAULT_PIN,
      approval_status: 'approved',
      approved_at: new Date().toISOString(),
    })
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

/** Check if a phone number is already registered and its status */
export async function checkPhoneStatus(phone) {
  const { data, error } = await supabase
    .from('users')
    .select('id, approval_status, is_active')
    .eq('phone', phone)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Request access — creates a pending user with default PIN 0000 */
export async function requestAccess(name, phone, department) {
  const { data, error } = await supabase
    .from('users')
    .insert({
      name,
      phone,
      department: department || null,
      pin: DEFAULT_PIN,
      role: 'staff',
      is_active: true,
      approval_status: 'pending',
      requested_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/** Approve a pending user */
export async function approveUser(id, adminId) {
  const { data, error } = await supabase
    .from('users')
    .update({
      approval_status: 'approved',
      approved_by: adminId,
      approved_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/** Reject a user (or re-reject) */
export async function rejectUser(id, reason) {
  const { data, error } = await supabase
    .from('users')
    .update({
      approval_status: 'rejected',
      rejection_reason: reason || null,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/** Admin reset — sets user's PIN back to default 0000 */
export async function resetPin(id) {
  const { data, error } = await supabase
    .from('users')
    .update({ pin: DEFAULT_PIN })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/** Admin sets a custom PIN for any user */
export async function adminSetPin(id, newPin) {
  const { data, error } = await supabase
    .from('users')
    .update({ pin: newPin })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/** Set PIN on first login (forced change from 0000) */
export async function setInitialPin(userId, newPin) {
  const { error } = await supabase
    .from('users')
    .update({ pin: newPin })
    .eq('id', userId)
  if (error) throw error
}

/** Self-service PIN change — verifies current PIN first */
export async function changeSelfPin(userId, currentPin, newPin) {
  const { data: row, error: fetchErr } = await supabase
    .from('users')
    .select('pin')
    .eq('id', userId)
    .single()
  if (fetchErr) throw fetchErr
  if (row.pin !== currentPin) return { success: false, error: 'Current PIN is incorrect' }

  const { error: updateErr } = await supabase
    .from('users')
    .update({ pin: newPin })
    .eq('id', userId)
  if (updateErr) throw updateErr
  return { success: true }
}
