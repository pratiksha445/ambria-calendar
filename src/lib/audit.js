import { supabase } from './supabase.js'

export async function logAction(userId, userName, action, entityType, entityId, details, actorRole) {
  try {
    await supabase.from('audit_log').insert({
      user_id: userId,
      user_name: userName,
      action,
      entity_type: entityType,
      entity_id: entityId ?? null,
      details: details ?? null,
      actor_role: actorRole ?? null,
    })
  } catch (err) {
    console.error('[ambria] audit log failed', err)
  }
}
