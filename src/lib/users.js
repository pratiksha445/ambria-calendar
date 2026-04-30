import { supabase } from './supabase.js'

const DEFAULT_PIN = '0000'

/** Fetch active approved users for dropdowns (Sales Person, etc.) — returns [{id, name}] */
export async function fetchActiveUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('id, name')
    .eq('is_active', true)
    .eq('approval_status', 'approved')
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

/** Fetch active approved users filtered by department and/or sales types — returns [{id, name}] */
export async function fetchFilteredUsers(filter) {
  let q = supabase
    .from('users')
    .select('id, name')
    .eq('is_active', true)
    .eq('approval_status', 'approved')
  if (filter?.department) q = q.eq('department', filter.department)
  if (filter?.salesTypes?.length) q = q.in('sales_type', filter.salesTypes)
  q = q.order('name', { ascending: true })
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

/**
 * Login via public.login() RPC — returns { status, user, access_token, expires_at }
 * status: 'ok' | 'error'
 */
export async function loginUser(phone, pin) {
  const { data, error } = await supabase.rpc('login', { p_phone: phone, p_pin: pin })
  if (error) return { status: 'error', user: null }
  return {
    status: 'ok',
    user: data.user,
    access_token: data.access_token,
    expires_at: data.expires_at,
  }
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
  try {
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
  } catch (err) {
    if (err?.message?.includes('duplicate') || err?.message?.includes('unique')) throw err
    throw new Error('User creation will be re-enabled in the next deploy — contact the dev.')
  }
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
export async function requestAccess(name, phone, department, salesType) {
  try {
    const { data, error } = await supabase
      .from('users')
      .insert({
        name,
        phone,
        department: department || null,
        sales_type: salesType || null,
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
  } catch (err) {
    if (err?.message?.includes('duplicate') || err?.message?.includes('unique')) throw err
    throw new Error('Signup will be re-enabled in the next deploy — contact the dev.')
  }
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
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ pin: DEFAULT_PIN })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  } catch {
    throw new Error('PIN reset will be re-enabled in the next deploy — contact the dev.')
  }
}

/** Admin sets a custom PIN for any user */
export async function adminSetPin(id, newPin) {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ pin: newPin })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  } catch {
    throw new Error('PIN reset will be re-enabled in the next deploy — contact the dev.')
  }
}

/** Set PIN on first login (forced change from 0000) */
export async function setInitialPin(userId, newPin) {
  try {
    const { error } = await supabase
      .from('users')
      .update({ pin: newPin })
      .eq('id', userId)
    if (error) throw error
  } catch {
    throw new Error('PIN setup will be re-enabled in the next deploy — contact the dev.')
  }
}

/** Self-service PIN change — no client-side verification (RPC coming next deploy) */
export async function changeSelfPin(userId, currentPin, newPin) {
  try {
    const { error } = await supabase
      .from('users')
      .update({ pin: newPin })
      .eq('id', userId)
    if (error) throw error
    return { success: true }
  } catch {
    throw new Error('PIN change will be re-enabled in the next deploy — contact the dev.')
  }
}
