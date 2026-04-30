import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { fetchActiveEventTypes } from '../lib/eventTypes.js'
import { fetchActiveUsers } from '../lib/users.js'
import { fetchActiveElements } from '../lib/elements.js'

const DirectoryCtx = createContext(null)

const STALE_MS = 5 * 60 * 1000 // 5 minutes

export function DirectoryProvider({ children }) {
  const [eventTypes, setEventTypes] = useState([])
  const [users, setUsers] = useState([])
  const [elements, setElements] = useState([])
  const lastFetched = useRef(0)

  const refresh = useCallback(async (force = false) => {
    if (!force && Date.now() - lastFetched.current < STALE_MS) return
    const stored = localStorage.getItem('ambria_user')
    if (!stored) return
    lastFetched.current = Date.now()
    await Promise.allSettled([
      fetchActiveEventTypes().then(setEventTypes),
      fetchActiveUsers().then(setUsers),
      fetchActiveElements().then(setElements),
    ])
  }, [])

  const clear = useCallback(() => {
    setEventTypes([])
    setUsers([])
    setElements([])
    lastFetched.current = 0
  }, [])

  // Initial fetch (fires on page reload when user is in localStorage)
  useEffect(() => { refresh(true) }, [refresh])

  // Stale-while-revalidate on window focus
  useEffect(() => {
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  const eventTypeAbbrByName = useMemo(() => {
    const m = {}
    for (const et of eventTypes) if (et.abbreviation) m[et.name] = et.abbreviation
    return m
  }, [eventTypes])

  const value = useMemo(
    () => ({ eventTypes, eventTypeAbbrByName, users, elements, refresh, clear }),
    [eventTypes, eventTypeAbbrByName, users, elements, refresh, clear],
  )

  return (
    <DirectoryCtx.Provider value={value}>
      {children}
    </DirectoryCtx.Provider>
  )
}

export function useDirectory() {
  return useContext(DirectoryCtx)
}
