// Auto-generated title per-venue. Mirrors knowledge-base §5.
//
// Salutations (Mr., Mrs., Ms., Dr., Shri, Smt — with or without trailing dot)
// are stripped; we use the first non-salutation word as the "first name".
//
// When a translation function (t) is provided, translatable parts
// (event types, shift initials, pax suffix, Multi-Event) are localized.
// User-entered data (names, venue names) stays as-is.

const SALUTATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'shri', 'smt',
  'mr.', 'mrs.', 'ms.', 'dr.',
])

function firstName(name) {
  if (!name || typeof name !== 'string') return ''
  const parts = name.trim().split(/\s+/)
  // Drop any leading salutation tokens.
  while (parts.length > 1 && SALUTATIONS.has(parts[0].toLowerCase())) {
    parts.shift()
  }
  return parts[0] ?? ''
}

function shiftInitial(shift, t) {
  if (!shift) return ''
  if (t) return t(`shift_short_${shift}`) || shift.charAt(0).toUpperCase()
  return shift.charAt(0).toUpperCase() // Morning→M, Lunch→L, Sundowner→S, Dinner→D
}

function eventTypeLabel(form, t) {
  const raw = form.event_type === 'Other'
    ? (form.event_type_other || '')
    : (form.event_type || '')
  if (!raw) return ''
  // Translate known event types; user-entered "Other" text stays as-is
  if (t && form.event_type !== 'Other') return t(raw)
  return raw
}

function paxLabel(pax, t) {
  if (!pax) return ''
  if (t) return `${pax}${t('pax_suffix')}`
  return `${pax}pax`
}

function joinPipes(parts) {
  return parts.map((p) => (p ?? '').toString().trim()).filter(Boolean).join(' | ')
}

export function autoTitle(form, t) {
  if (!form || !form.venue_id) return ''

  const venueId = form.venue_id

  if (venueId === 'villa') {
    const fn = firstName(form.guest_name)
    if (!fn && !form.sub_venue) return ''
    const parts = [fn || '—']
    if (form.sub_venue) parts.push(form.sub_venue)
    if (form.pax) parts.push(paxLabel(form.pax, t))
    return parts.join(' | ')
  }

  if (venueId === 'tender') {
    const etRaw = eventTypeLabel(form, t) || form.event_type_text || ''
    return joinPipes([
      firstName(form.tender_name),
      etRaw,
      paxLabel(form.pax, t),
      form.venue_name,
    ])
  }

  if (venueId === 'ap' || venueId === 'am' || venueId === 'ae' || venueId === 'ar') {
    return joinPipes([
      firstName(form.guest_name),
      eventTypeLabel(form, t),
      paxLabel(form.pax, t),
      shiftInitial(form.shift, t),
      form.menu_cat,
    ])
  }

  if (venueId === 'ws') {
    return joinPipes([
      firstName(form.guest_name),
      eventTypeLabel(form, t),
      paxLabel(form.pax, t),
      form.venue_name,
    ])
  }

  // add, ac, aee — external venue bookings
  const slots = Array.isArray(form.event_slots) ? form.event_slots : []
  if (slots.length > 1) {
    const multiLabel = t ? t('Multi-Event') : 'Multi-Event'
    return joinPipes([firstName(form.guest_name), multiLabel, form.venue_name])
  }
  // Slot fields (pax, event_type) live in event_slots[0] during editing;
  // top-level form fields are only synced at save time.
  const s0 = slots[0] || {}
  const pax = s0.pax || form.pax
  return joinPipes([
    firstName(form.guest_name),
    eventTypeLabel({ event_type: s0.event_type || form.event_type, event_type_other: s0.event_type_other || form.event_type_other }, t),
    paxLabel(pax, t),
    form.venue_name,
  ])
}
