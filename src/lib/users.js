import { supabase } from './supabase.js'

/**
 * Login — returns { status, user } where status is one of:
 * 'ok' | 'pending' | 'rejected' | 'deactivated' | 'not_found' | 'wrong_pin'
 */
export async function loginUser(phone, pin) {
  // First find by phone (any status)
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
  return { status: 'ok', user }
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
    .insert({ ...userData, approval_status: 'approved', approved_at: new Date().toISOString() })
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
  return data // null if not found
}

/** Generate a random 4-digit PIN */
function generatePin() {
  return String(Math.floor(1000 + Math.random() * 9000))
}

/** Request access — creates a pending user with auto-generated PIN */
export async function requestAccess(name, phone) {
  const pin = generatePin()
  const { data, error } = await supabase
    .from('users')
    .insert({
      name,
      phone,
      pin,
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

/** Reset a user's PIN to a new random 4-digit PIN */
export async function resetPin(id) {
  const pin = generatePin()
  const { data, error } = await supabase
    .from('users')
    .update({ pin })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return { ...data, pin }
}
