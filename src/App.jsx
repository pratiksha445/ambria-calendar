import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Header from './components/Header.jsx'
import Sidebar from './components/Sidebar.jsx'
import MonthView from './components/MonthView.jsx'
import WeekView from './components/WeekView.jsx'
import DayView from './components/DayView.jsx'
import BookingModal from './components/BookingModal.jsx'
import DayModal from './components/DayModal.jsx'
import ExportModal from './components/ExportModal.jsx'
import LoginScreen from './components/LoginScreen.jsx'
import SetPinScreen from './components/SetPinScreen.jsx'
import ChangePinModal from './components/ChangePinModal.jsx'
import UserManagement from './components/UserManagement.jsx'
import AuditLog from './components/AuditLog.jsx'
import EventTypeManagement from './components/EventTypeManagement.jsx'
import CategoryManagement from './components/CategoryManagement.jsx'
import ManageElements from './components/ManageElements.jsx'
import VenueManagers from './components/VenueManagers.jsx'
import EventList from './components/EventList.jsx'
import Reviews from './components/Reviews.jsx'
import ReviewModal from './components/ReviewModal.jsx'
import PaymentModal from './components/PaymentModal.jsx'
import { fetchEvents, deleteEvent, bulkDeleteMonth } from './lib/events.js'
import { saveUserFilters } from './lib/users.js'
import { fetchReviewsByEventIds, isReviewable } from './lib/reviews.js'
import { getEventTypeAbbr } from './lib/eventTypes.js'
import { seedIfEmpty } from './lib/seedEvents.js'
import { useDirectory } from './contexts/DirectoryContext.jsx'
import { startOfMonth, endOfMonth, toIsoDate, addDays } from './lib/dates.js'
import { VENUES, VENUE_BY_ID, applyDynamic } from './config/venues.js'
import { fetchActiveCategories } from './lib/categories.js'
import { logAction } from './lib/audit.js'
import { useKillSwitch } from './contexts/KillSwitchContext.jsx'
import { useLanguage } from './i18n/LanguageContext.jsx'
import useSwipeNav from './hooks/useSwipeNav.js'
import { readDraft, clearDraft } from './hooks/useFormDraft.js'
import './App.css'

const ALL_SOURCES = ['crm', 'manual']
const ALL_VENUE_IDS = new Set(VENUES.map((v) => v.id))

function initCategoryFilters(savedFilters) {
  const cats = savedFilters?.categories
  if (!Array.isArray(cats)) return new Set(VENUES.map((v) => v.id)) // never saved → all on
  // Restore only the saved categories (dropping any that no longer exist)
  return new Set(cats.filter((id) => ALL_VENUE_IDS.has(id)))
}

function getSeasonCategory(dateStr, seasonData) {
  if (!seasonData || !seasonData.dates) return null
  const parts = dateStr.split('-')
  const mmdd = parts[1] + '-' + parts[2]
  const category = seasonData.dates[mmdd]
  if (category) return category
  return seasonData.default_category || null
}

// ── Month-level fetch tracking ──
function mKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function mergeEvents(existing, incoming, from, to) {
  const incomingIds = new Set(incoming.map((e) => e.id))
  const kept = existing.filter((e) => {
    if (incomingIds.has(e.id)) return false
    if (e.date >= from && e.date <= to) return false
    return true
  })
  return [...kept, ...incoming]
}

function getStoredUser() {
  try {
    const s = localStorage.getItem('ambria_user')
    return s ? JSON.parse(s) : null
  } catch { return null }
}

export default function App() {
  const { t, formatMonthYear } = useLanguage()
  const { killSwitch, toggleKillSwitch } = useKillSwitch()
  const [user, setUser] = useState(getStoredUser)
  const [currentView, setCurrentView] = useState('calendar')
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [view, setView] = useState('month')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [allEvents, setAllEvents] = useState([])
  const [activeFilters, setActiveFilters] = useState(() => initCategoryFilters(getStoredUser()?.saved_filters))
  const [activeSources, setActiveSources] = useState(() => new Set(ALL_SOURCES))
  const [sectionFilter, setSectionFilter] = useState(null) // null | 'decor_pending' | 'ent_pending' | 'all_filled'
  const [venueKey, setVenueKey] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(() => {
    const draft = readDraft()
    if (draft?.isOpen && draft.formState) {
      const event = {
        ...draft.formState,
        venue_id: draft.venueId,
        event_slots: draft.slots || [],
        _draftManualTitle: draft.manualTitle ?? null,
      }
      if (draft.isEditing && draft.eventId) event.id = draft.eventId
      return { mode: draft.isEditing ? 'edit' : 'new', event, _fromDraft: true }
    }
    return null
  }) // null | { mode: 'new'|'edit', event? }
  const [toast, setToast] = useState(null)
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [needsPinChange, setNeedsPinChange] = useState(false)
  const [changePinOpen, setChangePinOpen] = useState(false)
  const [dayModalDate, setDayModalDate] = useState(null)
  const [exportModal, setExportModal] = useState(null) // null | { from, to }
  const [reviewModal, setReviewModal] = useState(null) // null | event
  const [reviewMap, setReviewMap] = useState(() => new Map())
  const [paymentModal, setPaymentModal] = useState(null) // null | event
  const [seasonData, setSeasonData] = useState(null)
  const { eventTypes, eventTypeAbbrByName, refresh: refreshDirectory, clear: clearDirectory } = useDirectory()
  const calendarBodyRef = useRef(null)
  const fetchedMonthsRef = useRef(new Set())
  const fetchingRef = useRef(new Set())
  const [fetchedMonths, setFetchedMonths] = useState(() => new Set())
  const seeded = useRef(false)
  const searchFetchedRef = useRef(false)

  // Fetch season calendar data (once on login, non-critical)
  useEffect(() => {
    if (!user) return
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/season-proxy`
    fetch(url, {
      headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setSeasonData(d) })
      .catch(() => {/* season badges non-critical */})
  }, [user])

  // Load dynamic categories from Supabase — falls back to hardcoded defaults on failure
  useEffect(() => {
    if (!user) return
    fetchActiveCategories()
      .then((rows) => {
        if (rows.length > 0) {
          applyDynamic(rows)
          setActiveFilters(initCategoryFilters(user.saved_filters))
          setVenueKey((k) => k + 1)
        }
      })
      .catch(() => {/* offline — keep hardcoded defaults */})
  }, [user])

  // ── Prefetch system: current + 3 months ahead, background pre-fetch on navigate ──
  const searchActive = !!search.trim()
  const currentMonthKey = mKey(currentDate)

  // Background fetch for a single month (non-blocking, fire-and-forget)
  const fetchMonthBg = useCallback((date) => {
    const key = mKey(date)
    if (fetchedMonthsRef.current.has(key) || fetchingRef.current.has(key)) return
    fetchingRef.current.add(key)
    const from = toIsoDate(startOfMonth(date))
    const to = toIsoDate(endOfMonth(date))
    fetchEvents(from, to)
      .then((rows) => {
        if (import.meta.env.DEV) console.log(`[ambria prefetch] ${key} count=${rows.length}`)
        setAllEvents((prev) => mergeEvents(prev, rows, from, to))
        fetchedMonthsRef.current.add(key)
        setFetchedMonths(new Set(fetchedMonthsRef.current))
      })
      .catch((err) => console.error('[ambria] prefetch failed', key, err))
      .finally(() => fetchingRef.current.delete(key))
  }, [])

  // Prefetch base month + count months ahead
  const prefetchAhead = useCallback((base, count) => {
    for (let i = 0; i <= count; i++) {
      fetchMonthBg(new Date(base.getFullYear(), base.getMonth() + i, 1))
    }
  }, [fetchMonthBg])

  // ── Initial load: current month + 3 ahead in one request ──
  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function init() {
      // Mark months as in-flight immediately (before any await) to prevent
      // the navigation prefetch effect from firing duplicate requests
      const now = new Date()
      const keys = []
      for (let i = -1; i <= 3; i++) {
        const key = mKey(new Date(now.getFullYear(), now.getMonth() + i, 1))
        fetchingRef.current.add(key)
        keys.push(key)
      }
      if (!seeded.current) {
        await seedIfEmpty()
        seeded.current = true
      }
      setLoading(true)
      setError(null)
      try {
        const from = toIsoDate(startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1)))
        const to = toIsoDate(endOfMonth(new Date(now.getFullYear(), now.getMonth() + 3, 1)))
        const rows = await fetchEvents(from, to)
        if (cancelled) return
        if (import.meta.env.DEV) console.log(`[ambria initial] ${from}..${to} count=${rows.length}`)
        setAllEvents((prev) => mergeEvents(prev, rows, from, to))
        for (const key of keys) {
          fetchedMonthsRef.current.add(key)
          fetchingRef.current.delete(key)
        }
        setFetchedMonths(new Set(fetchedMonthsRef.current))
      } catch (err) {
        console.error('[ambria] initial load failed', err)
        if (!cancelled) setError(err?.message ?? String(err))
        for (const key of keys) fetchingRef.current.delete(key)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    init()
    return () => { cancelled = true }
  }, [user])

  // ── Pre-fetch +3 months ahead and 1 month behind whenever the viewed month changes ──
  useEffect(() => {
    if (!user || searchActive) return
    prefetchAhead(currentDate, 3)
    // Prefetch 1 month behind so backward navigation is instant
    fetchMonthBg(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonthKey, user, searchActive, prefetchAhead, fetchMonthBg])

  // ── Search: wide-range fetch (±12 months) ──
  useEffect(() => {
    if (!searchActive) { searchFetchedRef.current = false; return }
    if (!user || searchFetchedRef.current) return
    searchFetchedRef.current = true
    const now = new Date()
    const from = toIsoDate(addDays(now, -365))
    const to = toIsoDate(addDays(now, 365))
    setLoading(true)
    fetchEvents(from, to)
      .then((rows) => {
        if (import.meta.env.DEV) console.log(`[ambria search] ${from}..${to} count=${rows.length}`)
        setAllEvents((prev) => mergeEvents(prev, rows, from, to))
        for (let i = -12; i <= 12; i++) {
          fetchedMonthsRef.current.add(mKey(new Date(now.getFullYear(), now.getMonth() + i, 1)))
        }
        setFetchedMonths(new Set(fetchedMonthsRef.current))
      })
      .catch((err) => setError(err?.message ?? String(err)))
      .finally(() => setLoading(false))
  }, [searchActive, user])

  // ── Fetch reviews for reviewable events ──
  useEffect(() => {
    if (!user) return
    const reviewableIds = allEvents.filter(isReviewable).map((e) => e.id)
    if (reviewableIds.length === 0) return
    fetchReviewsByEventIds(reviewableIds)
      .then((map) => setReviewMap(map))
      .catch((err) => console.error('[ambria] fetch reviews failed', err))
  }, [allEvents, user])

  // ── Month-scoped events for sidebar counts ──
  const monthStart = toIsoDate(startOfMonth(currentDate))
  const monthEnd = toIsoDate(endOfMonth(currentDate))
  const monthEvents = useMemo(
    () => allEvents.filter((e) => e.date >= monthStart && e.date <= monthEnd),
    [allEvents, monthStart, monthEnd],
  )

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase()
    const words = q ? q.split(/\s+/).filter(Boolean) : []
    const ownSet = new Set(['ap', 'am', 'ae', 'ar'])
    return allEvents.filter((ev) => {
      if (!activeFilters.has(ev.venue_id)) return false
      if (!activeSources.has(ev.source)) return false
      // Section status filter (only applies to own-venue events)
      if (sectionFilter && ownSet.has(ev.venue_id)) {
        const dFilled = ev.decor_status != null && ev.decor_status !== ''
        const eFilled = ev.entertainment_status != null && ev.entertainment_status !== ''
        if (sectionFilter === 'decor_pending' && dFilled) return false
        if (sectionFilter === 'ent_pending' && eFilled) return false
        if (sectionFilter === 'all_filled' && (!dFilled || !eFilled)) return false
      }
      // Section filter hides non-own-venue events when active (only show AP/AM/AE/AR)
      if (sectionFilter && !ownSet.has(ev.venue_id)) return false
      if (!words.length) return true
      const hay = [
        ev.guest_name, ev.tender_name, ev.title, ev.venue_name,
        ev.sales_person, ev.event_type, ev.sub_venue,
        VENUE_BY_ID[ev.venue_id]?.short,
        VENUE_BY_ID[ev.venue_id]?.name,
        ev.event_type && ev.event_type !== 'Other' ? eventTypeAbbrByName[ev.event_type] : null,
        ev.event_type === 'Other' && ev.event_type_other ? getEventTypeAbbr('Other', ev.event_type_other, []) : null,
      ].filter(Boolean).join(' ').toLowerCase()
      return words.every((w) => hay.includes(w))
    })
  }, [allEvents, activeFilters, activeSources, search, eventTypeAbbrByName, sectionFilter])

  // ── Kill Switch: hide all event data without touching the DB ──
  const visibleEvents = killSwitch ? [] : filteredEvents
  const visibleMonthEvents = killSwitch ? [] : monthEvents

  const filteredMonthCount = useMemo(
    () => visibleEvents.filter((e) => e.date >= monthStart && e.date <= monthEnd).length,
    [visibleEvents, monthStart, monthEnd],
  )

  const handlePrev = () => {
    if (view === 'month') {
      setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
    } else if (view === 'week') {
      const next = addDays(currentDate, -7)
      setCurrentDate(next)
      setSelectedDate(next)
    } else {
      const next = addDays(selectedDate, -1)
      setSelectedDate(next)
      setCurrentDate(next)
    }
  }

  const handleNext = () => {
    if (view === 'month') {
      setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
    } else if (view === 'week') {
      const next = addDays(currentDate, 7)
      setCurrentDate(next)
      setSelectedDate(next)
    } else {
      const next = addDays(selectedDate, 1)
      setSelectedDate(next)
      setCurrentDate(next)
    }
  }

  const handleToday = () => {
    const t = new Date()
    setCurrentDate(t)
    setSelectedDate(t)
  }

  // Swipe navigation for the calendar grid — with predictive pre-fetch
  const handleSwipeDirection = useCallback((dir) => {
    if (searchActive) return
    if (dir === 'next') {
      // Pre-fetch one month beyond the normal +3 window
      fetchMonthBg(new Date(currentDate.getFullYear(), currentDate.getMonth() + 4, 1))
    } else {
      // Pre-fetch one month behind
      fetchMonthBg(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    }
  }, [currentDate, searchActive, fetchMonthBg])

  useSwipeNav(calendarBodyRef, { onPrev: handlePrev, onNext: handleNext, onDirection: handleSwipeDirection })

  const toggleFilter = (id) => {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSource = (src) => {
    setActiveSources((prev) => {
      const next = new Set(prev)
      if (next.has(src)) next.delete(src)
      else next.add(src)
      return next
    })
  }

  const selectAllVenues = () => setActiveFilters(new Set(VENUES.map((v) => v.id)))
  const selectNoVenues = () => setActiveFilters(new Set())

  // Persist category filters to DB (debounced, fire-and-forget)
  const filterSaveTimer = useRef(null)
  const activeFiltersRef = useRef(activeFilters)
  activeFiltersRef.current = activeFilters
  const filtersRestoredRef = useRef(false)
  // Arm after the initial render so the restore-from-localStorage doesn't trigger a save
  useEffect(() => {
    const t = setTimeout(() => { filtersRestoredRef.current = true }, 100)
    return () => clearTimeout(t)
  }, [])

  const flushFiltersToDisk = useCallback(() => {
    if (!user?.id) return
    const filters = { categories: [...activeFiltersRef.current] }
    saveUserFilters(user.id, filters).catch(() => {})
    try {
      const stored = JSON.parse(localStorage.getItem('ambria_user') || '{}')
      stored.saved_filters = filters
      localStorage.setItem('ambria_user', JSON.stringify(stored))
    } catch { /* ignore */ }
  }, [user?.id])

  // Debounced save on every filter change (skips the initial restoration)
  useEffect(() => {
    if (!filtersRestoredRef.current) return
    if (!user?.id) return
    clearTimeout(filterSaveTimer.current)
    filterSaveTimer.current = setTimeout(flushFiltersToDisk, 1000)
    return () => clearTimeout(filterSaveTimer.current)
  }, [activeFilters, user?.id, flushFiltersToDisk])

  // Immediate save when tab is hidden (covers app-close before debounce fires)
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden' && filtersRestoredRef.current) {
        clearTimeout(filterSaveTimer.current)
        flushFiltersToDisk()
      }
    }
    document.addEventListener('visibilitychange', onHidden)
    return () => document.removeEventListener('visibilitychange', onHidden)
  }, [flushFiltersToDisk])

  // Fallback: sync localStorage on beforeunload (async DB call can't reliably finish here)
  useEffect(() => {
    const onUnload = () => {
      if (!user?.id || !filtersRestoredRef.current) return
      try {
        const filters = { categories: [...activeFiltersRef.current] }
        const stored = JSON.parse(localStorage.getItem('ambria_user') || '{}')
        stored.saved_filters = filters
        localStorage.setItem('ambria_user', JSON.stringify(stored))
      } catch { /* ignore */ }
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [user?.id])

  const handleSelectDate = (d) => {
    setSelectedDate(d)
    if (d.getMonth() !== currentDate.getMonth() ||
        d.getFullYear() !== currentDate.getFullYear()) {
      setCurrentDate(d)
    }
    if (view === 'month') {
      setDayModalDate(d)
    }
  }

  // Check ref (most up-to-date, synchronously mutated on fetch complete)
  // in addition to state (triggers re-renders) to avoid a stale-state flash
  // where the ref has the month but the batched setState hasn't committed yet
  const monthCached = fetchedMonthsRef.current.has(currentMonthKey) || fetchedMonths.has(currentMonthKey)
  const filtersHideEverything = !killSwitch && !loading && monthCached && visibleMonthEvents.length > 0 && filteredMonthCount === 0

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }, [])

  const openNew = () => {
    const iso = toIsoDate(selectedDate)
    setModal({ mode: 'new', event: { date: iso } })
  }
  const openNewFromDate = (d) => {
    setDayModalDate(null)
    const iso = toIsoDate(d)
    setModal({ mode: 'new', event: { date: iso } })
  }
  const openEdit = useCallback((ev) => {
    if (!ev) return
    setModal({ mode: 'edit', event: ev })
  }, [])
  const closeModal = () => { clearDraft(); setModal(null) }
  const handleSaved = (row) => {
    clearDraft()
    setModal(null)
    showToast(t('Booking saved'))
    if (row) {
      setAllEvents((prev) => {
        const idx = prev.findIndex((e) => e.id === row.id)
        if (idx >= 0) return prev.map((e) => (e.id === row.id ? row : e))
        return [...prev, row]
      })
    }
    if (row?.date) {
      const d = new Date(row.date)
      setSelectedDate(d)
      if (d.getMonth() !== currentDate.getMonth() ||
          d.getFullYear() !== currentDate.getFullYear()) {
        setCurrentDate(d)
      }
    }
  }
  const handleDeleted = () => {
    clearDraft()
    const deletedId = modal?.event?.id
    setModal(null)
    showToast(t('Booking deleted'))
    if (deletedId) {
      setAllEvents((prev) => prev.filter((e) => e.id !== deletedId))
    }
  }
  const handleCardDelete = useCallback(async (ev) => {
    try {
      await deleteEvent(ev.id, user)
      showToast(t('Event deleted'))
      setAllEvents((prev) => prev.filter((e) => e.id !== ev.id))
    } catch (err) {
      console.error('[ambria] card delete failed', err)
    }
  }, [user, t, showToast])

  const handleExport = () => {
    const from = toIsoDate(startOfMonth(currentDate))
    const to = toIsoDate(endOfMonth(currentDate))
    setExportModal({ from, to })
  }
  const handleExportDay = (d) => {
    const iso = toIsoDate(d)
    setDayModalDate(null)
    setExportModal({ from: iso, to: iso })
  }

  const openReview = useCallback((ev) => {
    setReviewModal(ev)
  }, [])

  const handleReviewSaved = useCallback((eventId, reviewData) => {
    setReviewMap((prev) => {
      const next = new Map(prev)
      next.set(eventId, reviewData)
      return next
    })
    showToast(t('Review submitted'))
  }, [t, showToast])

  const openPayment = useCallback((ev) => {
    setPaymentModal(ev)
  }, [])

  const handlePaymentSaved = useCallback((eventId, updatedEvent) => {
    setAllEvents((prev) => prev.map((e) => (e.id === eventId ? updatedEvent : e)))
    showToast(t('Payment marked complete'))
  }, [t, showToast])

  const handleClearMonth = () => setConfirmBulk(true)
  const executeBulkDelete = async () => {
    const start = toIsoDate(startOfMonth(currentDate))
    const end = toIsoDate(endOfMonth(currentDate))
    try {
      await bulkDeleteMonth(start, end, user)
      setConfirmBulk(false)
      showToast(t('All events in {month} cleared', { month: formatMonthYear(currentDate) }))
      setAllEvents((prev) => prev.filter((e) => e.date < start || e.date > end))
    } catch (err) {
      console.error('[ambria] bulk delete failed', err)
    }
  }

  // Auth handlers
  const handleLogin = (u, pinChange) => {
    setUser(u)
    filtersRestoredRef.current = false
    setActiveFilters(initCategoryFilters(u?.saved_filters))
    setTimeout(() => { filtersRestoredRef.current = true }, 100)
    setNeedsPinChange(!!pinChange)
    refreshDirectory(true)
  }

  const handleLogout = async () => {
    if (user) {
      await logAction(user.id, user.name, 'logout', 'session', null, { summary: 'Logged out' })
    }
    localStorage.removeItem('ambria_user')
    setUser(null)
    setCurrentView('calendar')
    setAllEvents([])
    fetchedMonthsRef.current = new Set()
    fetchingRef.current = new Set()
    setFetchedMonths(new Set())
    searchFetchedRef.current = false
    seeded.current = false
    clearDirectory()
  }

  const handleNavigate = (v) => {
    setCurrentView(v)
    setSidebarOpen(false)
  }

  // Show login screen if not authenticated
  if (!user) return <LoginScreen onLogin={handleLogin} />

  // Forced PIN change on first login with default PIN
  if (needsPinChange) {
    return <SetPinScreen user={user} onComplete={() => setNeedsPinChange(false)} />
  }

  const canClearMonth = user.role === 'admin'

  const manualCount = visibleMonthEvents.filter((e) => e.source === 'manual').length
  const crmCount = visibleMonthEvents.filter((e) => e.source !== 'manual').length

  return (
    <div className="app">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        search={search}
        onSearch={setSearch}
        activeFilters={activeFilters}
        onToggleFilter={toggleFilter}
        onSelectAllVenues={selectAllVenues}
        onSelectNoVenues={selectNoVenues}
        activeSources={activeSources}
        onToggleSource={toggleSource}
        sectionFilter={sectionFilter}
        onSectionFilter={setSectionFilter}
        events={visibleMonthEvents}
        totalCount={visibleMonthEvents.length}
        shownCount={filteredMonthCount}
        user={user}
        currentView={currentView}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        onChangePin={() => { setSidebarOpen(false); setChangePinOpen(true) }}
      />
      <div className="app-main">
        {currentView === 'calendar' && (
          <>
            <Header
              currentDate={currentDate}
              view={view}
              onViewChange={setView}
              onPrev={handlePrev}
              onNext={handleNext}
              onToday={handleToday}
              onMenu={() => setSidebarOpen(true)}
              onAdd={openNew}
              onExport={handleExport}
              onClearMonth={canClearMonth ? handleClearMonth : null}
              onSelectMonth={setCurrentDate}
              killSwitch={killSwitch}
              onToggleKillSwitch={() => toggleKillSwitch(user)}
              user={user}
            />
            <main className="app-body" ref={calendarBodyRef}>
              {error && <div className="error-banner">{error}</div>}
              {loading && <div className="loading">{t('Loading…')}</div>}
              {filtersHideEverything && (
                <div className="filter-empty-banner">{t('No events match your filters')}</div>
              )}
              {view === 'month' && (
                <MonthView
                  currentDate={currentDate}
                  selectedDate={selectedDate}
                  onSelectDate={handleSelectDate}
                  onEventClick={openEdit}
                  events={visibleEvents}
                  eventTypes={eventTypes}
                  skeleton={!monthCached && !loading}
                  seasonData={seasonData}
                  getSeasonCategory={getSeasonCategory}
                />
              )}
              {view === 'week' && (
                <>
                  <WeekView
                    currentDate={currentDate}
                    selectedDate={selectedDate}
                    onSelectDate={handleSelectDate}
                    events={visibleEvents}
                    seasonData={seasonData}
                    getSeasonCategory={getSeasonCategory}
                  />
                  <div className="week-day-divider" />
                  <DayView
                    selectedDate={selectedDate}
                    events={visibleEvents}
                    onEdit={openEdit}
                    onDelete={handleCardDelete}
                    onAdd={openNew}
                    user={user}
                    reviewMap={reviewMap}
                    onReview={openReview}
                    onPayment={openPayment}
                    seasonData={seasonData}
                    getSeasonCategory={getSeasonCategory}
                  />
                </>
              )}
              {view === 'day' && (
                <DayView
                  selectedDate={selectedDate}
                  events={visibleEvents}
                  onEdit={openEdit}
                  onDelete={handleCardDelete}
                  onAdd={openNew}
                  user={user}
                  reviewMap={reviewMap}
                  onReview={openReview}
                  onPayment={openPayment}
                  seasonData={seasonData}
                  getSeasonCategory={getSeasonCategory}
                />
              )}
            </main>
          </>
        )}
        {currentView === 'users' && user.role === 'admin' && (
          <UserManagement currentUser={user} showToast={showToast} onMenu={() => setSidebarOpen(true)} killSwitch={killSwitch} />
        )}
        {currentView === 'audit' && (user.role === 'admin' || user.role === 'gm') && (
          <AuditLog onMenu={() => setSidebarOpen(true)} killSwitch={killSwitch} />
        )}
        {currentView === 'event-types' && user.role === 'admin' && (
          <EventTypeManagement currentUser={user} showToast={showToast} onMenu={() => setSidebarOpen(true)} killSwitch={killSwitch} />
        )}
        {currentView === 'categories' && user.role === 'admin' && (
          <CategoryManagement currentUser={user} showToast={showToast} onMenu={() => setSidebarOpen(true)} killSwitch={killSwitch} />
        )}
        {currentView === 'elements' && user.role === 'admin' && (
          <ManageElements currentUser={user} showToast={showToast} onMenu={() => setSidebarOpen(true)} killSwitch={killSwitch} />
        )}
        {currentView === 'venue-managers' && user.role === 'admin' && (
          <VenueManagers currentUser={user} showToast={showToast} onMenu={() => setSidebarOpen(true)} killSwitch={killSwitch} />
        )}
        {currentView === 'event-list' && user.role === 'admin' && (
          <EventList currentUser={user} showToast={showToast} onMenu={() => setSidebarOpen(true)} killSwitch={killSwitch} />
        )}
        {currentView === 'reviews' && user.role === 'admin' && (
          <Reviews currentUser={user} showToast={showToast} onMenu={() => setSidebarOpen(true)} killSwitch={killSwitch} />
        )}
      </div>
      <DayModal
        date={dayModalDate}
        events={killSwitch ? [] : allEvents}
        onClose={() => setDayModalDate(null)}
        onAdd={openNewFromDate}
        onEdit={(ev) => { setDayModalDate(null); openEdit(ev) }}
        onDelete={handleCardDelete}
        onExport={handleExportDay}
        user={user}
        reviewMap={reviewMap}
        onReview={(ev) => { setDayModalDate(null); openReview(ev) }}
        onPayment={(ev) => { setDayModalDate(null); openPayment(ev) }}
      />
      <BookingModal
        open={!!modal}
        initial={modal?.event}
        restoredFromDraft={!!modal?._fromDraft}
        onClose={closeModal}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
        user={user}
      />
      <ReviewModal
        open={!!reviewModal}
        event={reviewModal}
        user={user}
        onClose={() => setReviewModal(null)}
        onReviewSaved={handleReviewSaved}
      />
      <PaymentModal
        open={!!paymentModal}
        event={paymentModal}
        user={user}
        onClose={() => setPaymentModal(null)}
        onPaymentSaved={handlePaymentSaved}
      />
      <ExportModal
        open={!!exportModal}
        onClose={() => setExportModal(null)}
        defaultFrom={exportModal?.from || ''}
        defaultTo={exportModal?.to || ''}
      />
      {confirmBulk && (
        <div className="modal-root" role="dialog" aria-modal="true">
          <div className="modal-backdrop" onClick={() => setConfirmBulk(false)} />
          <div className="bulk-delete-card">
            <h3>{t('Delete all events in {month}?', { month: formatMonthYear(currentDate) })}</h3>
            <p>
              {t('This will delete {count} manual events', { count: manualCount })}
              {crmCount > 0 && ' ' + t('and hide {count} CRM events', { count: crmCount })}
            </p>
            <div className="bulk-delete-actions">
              <button className="btn-ghost" onClick={() => setConfirmBulk(false)}>{t('Cancel')}</button>
              <button className="btn-danger" onClick={executeBulkDelete}>{t('Delete All')}</button>
            </div>
          </div>
        </div>
      )}
      {changePinOpen && (
        <ChangePinModal
          user={user}
          onClose={() => setChangePinOpen(false)}
          showToast={showToast}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
