// ============================================================
// signupSession.js
//
// WHAT THIS FILE IS
//   The small bits of sign-up state that must survive closing the app,
//   kept in localStorage on this device:
//     1. The pending sign-up { phone, token, name }. The token is this
//        device's secret, and it is the only thing that lets this device
//        set the first PIN after approval.
//     2. The last phone that signed in successfully. It pre-fills the
//        phone box on the Sign In screen.
//
// WHY IT EXISTS
//   The app opens straight on Request Access. Without this memory, a user
//   who closed the app while waiting would see the empty form again.
//
// USED BY
//   src/components/LoginScreen.jsx, src/lib/users.js (token generation)
//
// DEPENDS ON
//   Browser localStorage + Web Crypto (crypto.getRandomValues / subtle).
//   Every storage call is wrapped in try/catch because private mode can block it.
// ============================================================

const PENDING_KEY = 'ambria_pending_signup'
const LAST_PHONE_KEY = 'ambria_last_phone'

export function readPendingSignup() {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    const v = raw ? JSON.parse(raw) : null
    return v?.phone && v?.token ? v : null
  } catch { return null }
}

export function savePendingSignup(pending) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(pending)) } catch { /* ignore */ }
}

export function clearPendingSignup() {
  try { localStorage.removeItem(PENDING_KEY) } catch { /* ignore */ }
}

export function readLastPhone() {
  try { return localStorage.getItem(LAST_PHONE_KEY) || null } catch { return null }
}

// Deliberately NOT cleared on logout, so the next Sign In is pre-filled.
export function rememberPhone(phone) {
  try { localStorage.setItem(LAST_PHONE_KEY, phone) } catch { /* ignore */ }
}

// Called when the account behind the remembered phone no longer exists.
export function forgetPhone() {
  try { localStorage.removeItem(LAST_PHONE_KEY) } catch { /* ignore */ }
}

/** 32 random bytes as hex. Unguessable, unlike a 4-digit PIN. */
export function generateSignupToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** SHA-256 hex. Must match encode(digest(token, 'sha256'), 'hex') in 028_signup_token.sql. */
export async function hashSignupToken(token) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}
