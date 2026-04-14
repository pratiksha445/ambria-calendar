// Input sanitization — applied to all text fields before Supabase save.
// See spec: strip whitespace, escape HTML, remove dangerous tags,
// strip control chars, enforce field length limits, phone/pax rules.

const LIMITS = {
  guest_name: 100,
  tender_name: 100,
  sales_person: 100,
  venue_name: 200,
  phone: 20,
  pax: 10,
  location: 500,
  notes: 1000,
  event_type_text: 100,
  event_type_other: 100,
  title: 300,
  added_service: 200,
}

const DANGEROUS_RE = /<\s*\/?\s*(script|iframe|object|embed)[^>]*>/gi
const CONTROL_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

export function sanitizeText(value, key) {
  if (value == null || value === '') return null
  let s = String(value)
  s = s.replace(CONTROL_RE, '')
  s = s.replace(DANGEROUS_RE, '')
  s = escapeHtml(s)
  s = s.trim()
  const limit = LIMITS[key]
  if (limit && s.length > limit) s = s.slice(0, limit)
  return s || null
}

export function sanitizePhone(value) {
  if (value == null || value === '') return null
  let s = String(value).replace(/[^\d\s+\-]/g, '').trim()
  if (s.length > 20) s = s.slice(0, 20)
  return s || null
}

export function sanitizePax(value) {
  if (value == null || value === '') return null
  let s = String(value).replace(/\D/g, '')
  if (s.length > 10) s = s.slice(0, 10)
  return s || null
}
