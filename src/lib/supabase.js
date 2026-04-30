import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — Supabase client will not work until these are set.',
  )
}

const SESSION_KEY = 'ambria_session'
const SKEW_SECONDS = 60

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  global: {
    fetch: async (url, options) => {
      const response = await fetch(url, options)
      if (response.status === 401 && localStorage.getItem(SESSION_KEY)) {
        window.dispatchEvent(new CustomEvent('ambria:session-expired'))
      }
      return response
    },
  },
})

/** Read stored session. Returns { access_token, expires_at, user } or null. */
export function getStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw)
    if (!session?.access_token || !session?.expires_at || !session?.user) return null
    if (session.expires_at - SKEW_SECONDS <= Date.now() / 1000) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return session
  } catch {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

/** Persist session to localStorage after a successful login. */
export function storeSession(access_token, expires_at, user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ access_token, expires_at, user }))
}

/** Apply the stored JWT to the Supabase client for authorized requests. */
export async function applySession(access_token) {
  await supabase.auth.setSession({ access_token, refresh_token: access_token })
}

/** Full logout — clear Supabase auth + localStorage. */
export async function clearSession() {
  try { await supabase.auth.signOut() } catch { /* ignore */ }
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem('ambria_user')
}
