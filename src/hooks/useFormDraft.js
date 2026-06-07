import { useEffect, useRef, useCallback } from 'react'

const DRAFT_KEY = 'ambria-form-draft'
const MAX_AGE_MS = 30 * 60 * 1000 // 30 minutes
const DEBOUNCE_MS = 500

/** Read the stored draft. Returns the parsed object or null. */
export function readDraft() {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const draft = JSON.parse(raw)
    if (Date.now() - draft.savedAt > MAX_AGE_MS) {
      sessionStorage.removeItem(DRAFT_KEY)
      return null
    }
    return draft
  } catch {
    sessionStorage.removeItem(DRAFT_KEY)
    return null
  }
}

/** Remove the stored draft. */
export function clearDraft() {
  sessionStorage.removeItem(DRAFT_KEY)
}

/**
 * Hook that persists form state to sessionStorage on every change (debounced)
 * and flushes immediately when the tab is hidden / page is unloading.
 *
 * @param {boolean}  isOpen     – whether the form modal is currently open
 * @param {Function} getState   – returns the draft object to persist (called on save)
 */
export function useFormDraft(isOpen, getState) {
  const timerRef = useRef(null)
  const getStateRef = useRef(getState)
  getStateRef.current = getState

  // Flush: write immediately, cancel any pending debounce
  const flush = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = null
    try {
      const state = getStateRef.current()
      if (state) {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...state, savedAt: Date.now() }))
      }
    } catch { /* quota exceeded – silently ignore */ }
  }, [])

  // Debounced save – call this whenever a field changes
  const save = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(flush, DEBOUNCE_MS)
  }, [flush])

  // Listen for tab-hide / page-unload while form is open
  useEffect(() => {
    if (!isOpen) return

    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    const onUnload = () => flush()

    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', onUnload)
    window.addEventListener('beforeunload', onUnload)

    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', onUnload)
      window.removeEventListener('beforeunload', onUnload)
      clearTimeout(timerRef.current)
    }
  }, [isOpen, flush])

  return save
}
