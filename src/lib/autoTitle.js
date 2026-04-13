// Auto-generated title per-venue. Mirrors knowledge-base §5.
//
// Salutations (Mr., Mrs., Ms., Dr., Shri, Smt — with or without trailing dot)
// are stripped; we use the first non-salutation word as the "first name".
//
// Shift shortforms: M=Morning, L=Lunch, S=Sundowner, D=Dinner.

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

function shiftInitial(shift) {
  if (!shift) return ''
  return shift.charAt(0).toUpperCase() // Morning→M, Lunch→L, Sundowner→S, Dinner→D
}

function eventTypeLabel(form) {
  if (form.event_type === 'Other') return form.event_type_other || ''
  return form.event_type || ''
}

function joinPipes(parts) {
  return parts.map((p) => (p ?? '').toString().trim()).filter(Boolean).join(' | ')
}

export function autoTitle(form) {
  if (!form || !form.venue_id) return ''

  const venueId = form.venue_id

  if (venueId === 'villa') {
    const fn = firstName(form.guest_name)
    if (!fn && !form.sub_venue) return ''
    const right = form.sub_venue || ''
    return right ? `${fn || '—'} — ${right}` : fn
  }

  if (venueId === 'tender') {
    return joinPipes([
      firstName(form.tender_name),
      form.event_type_text,
      form.venue_name,
    ])
  }

  if (venueId === 'ap' || venueId === 'am' || venueId === 'ae' || venueId === 'ar') {
    return joinPipes([
      firstName(form.guest_name),
      eventTypeLabel(form),
      form.pax ? `${form.pax}pax` : '',
      shiftInitial(form.shift),
      form.menu_cat,
    ])
  }

  // add, ac, aee — external venue bookings
  return joinPipes([
    firstName(form.guest_name),
    eventTypeLabel(form),
    form.venue_name,
    shiftInitial(form.shift),
  ])
}
