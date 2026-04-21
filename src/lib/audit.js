import { supabase } from './supabase.js'

export async function logAction(userId, userName, action, entityType, entityId, details) {
  try {
    await supabase.from('audit_log').insert({
      user_id: userId,
      user_name: userName,
      action,
      entity_type: entityType,
      entity_id: entityId ?? null,
      details: details ?? null,
    })
  } catch (err) {
    console.error('[ambria] audit log failed', err)
  }
}
