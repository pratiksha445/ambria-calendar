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
import { fetchEvents, deleteEvent, bulkDeleteMonth } from './lib/events.js'
import { fetchActiveEventTypes } from './lib/eventTypes.js'
import { seedIfEmpty } from './lib/seedEvents.js'
import { startOfMonth, endOfMonth, toIsoDate, addDays } from './lib/dates.js'
import { VENUES, applyDynamic } from './config/venues.js'
import { fetchActiveCategories } from './lib/categories.js'
import { logAction } from './lib/audit.js'
import { useLanguage } from './i18n/LanguageContext.jsx'
import useSwipeNav from './hooks/useSwipeNav.js'
import './App.css'

const ALL_SOURCES = ['crm', 'manual']

function getStoredUser() {
  try {
    const s = localStorage.getItem('ambria_user')
    return s ? JSON.parse(s) : null
  } catch { return null }
}

export default function App() {
  const { t, formatMonthYear } = useLanguage()
  const [user, setUser] = useState(getStoredUser)
  const [currentView, setCurrentView] = useState('calendar')
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [view, setView] = useState('month')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [events, setEvents] = useState([])
  const [activeFilters, setActiveFilters] = useState(() => new Set(VENUES.map((v) => v.id)))
  const [activeSources, setActiveSources] = useState(() => new Set(ALL_SOURCES))
  const [venueKey, setVenueKey] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null) // null | { mode: 'new'|'edit', event? }
  const [reloadKey, setReloadKey] = useState(0)
  const [toast, setToast] = useState(null)
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [needsPinChange, setNeedsPinChange] = useState(false)
  const [changePinOpen, setChangePinOpen] = useState(false)
  const [dayModalDate, setDayModalDate] = useState(null)
  const [exportModal, setExportModal] = useState(null) // null | { from, to }
  const [eventTypes, setEventTypes] = useState([])
  const calendarBodyRef = useRef(null)

  // Load dynamic categories from Supabase — falls back to hardcoded defaults on failure
  useEffect(() => {
    if (!user) return
    fetchActiveCategories()
      .then((rows) => {
        if (rows.length > 0) {
          applyDynamic(rows)
          setActiveFilters(new Set(VENUES.map((v) => v.id)))
          setVenueKey((k) => k + 1)
        }
      })
      .catch(() => {/* offline — keep hardcoded defaults */})
  }, [user])

  // Load event types for abbreviation lookup on calendar pills
  useEffect(() => {
    if (!user) return
    fetchActiveEventTypes()
      .then(setEventTypes)
      .catch(() => {})
  }, [user, reloadKey])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        await seedIfEmpty()
        const start = toIsoDate(startOfMonth(currentDate))
        const end = toIsoDate(endOfMonth(currentDate))
        const rows = await fetchEvents(start, end)
        if (!cancelled) setEvents(rows)
      } catch (err) {
        console.error('[ambria] load failed', err)
        if (!cancelled) setError(err?.message ?? String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate.getFullYear(), currentDate.getMonth(), reloadKey, user])

  const abbrMap = useMemo(() => {
    const m = {}
    for (const et of eventTypes) if (et.abbreviation) m[et.name] = et.abbreviation
    return m
  }, [eventTypes])

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase()
    const words = q ? q.split(/\s+/).filter(Boolean) : []
    return events.filter((ev) => {
      if (!activeFilters.has(ev.venue_id)) return false
      if (!activeSources.has(ev.source)) return false
      if (!words.length) return true
      const hay = [
        ev.guest_name, ev.tender_name, ev.title, ev.venue_name,
        ev.sales_person, ev.event_type, ev.sub_venue,
        ev.event_type && abbrMap[ev.event_type],
      ].filter(Boolean).join(' ').toLowerCase()
      return words.every((w) => hay.includes(w))
    })
  }, [events, activeFilters, activeSources, search, abbrMap])

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

  // Swipe navigation for the calendar grid
  useSwipeNav(calendarBodyRef, { onPrev: handlePrev, onNext: handleNext })

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

  const handleSelectDate = (d) => {
    setSelectedDate(d)
    if (d.getMonth() !== currentDate.getMonth() ||
        d.getFullYear() !== currentDate.getFullYear()) {
      setCurrentDate(d)
    }
    if (view === 'month' || view === 'week') {
      setDayModalDate(d)
    }
  }

  const filtersHideEverything = !loading && events.length > 0 && filteredEvents.length === 0

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  const openNew = () => {
    const iso = toIsoDate(selectedDate)
    setModal({ mode: 'new', event: { date: iso } })
  }
  const openNewFromDate = (d) => {
    setDayModalDate(null)
    const iso = toIsoDate(d)
    setModal({ mode: 'new', event: { date: iso } })
  }
  const openEdit = (ev) => {
    if (!ev) return
    setModal({ mode: 'edit', event: ev })
  }
  const closeModal = () => setModal(null)
  const handleSaved = (row) => {
    setModal(null)
    showToast(t('Booking saved'))
    if (row?.date) {
      const d = new Date(row.date)
      setSelectedDate(d)
      if (d.getMonth() !== currentDate.getMonth() ||
          d.getFullYear() !== currentDate.getFullYear()) {
        setCurrentDate(d)
        return // useEffect will refetch for the new month
      }
    }
    setReloadKey((k) => k + 1)
  }
  const handleDeleted = () => {
    setModal(null)
    showToast(t('Booking deleted'))
    setReloadKey((k) => k + 1)
  }
  const handleCardDelete = async (ev) => {
    try {
      await deleteEvent(ev.id, user)
      showToast(t('Event deleted'))
      setReloadKey((k) => k + 1)
    } catch (err) {
      console.error('[ambria] card delete failed', err)
    }
  }

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

  const handleClearMonth = () => setConfirmBulk(true)
  const executeBulkDelete = async () => {
    const start = toIsoDate(startOfMonth(currentDate))
    const end = toIsoDate(endOfMonth(currentDate))
    try {
      await bulkDeleteMonth(start, end, user)
      setConfirmBulk(false)
      showToast(t('All events in {month} cleared', { month: formatMonthYear(currentDate) }))
      setReloadKey((k) => k + 1)
    } catch (err) {
      console.error('[ambria] bulk delete failed', err)
    }
  }

  // Auth handlers
  const handleLogin = (u, pinChange) => {
    setUser(u)
    setNeedsPinChange(!!pinChange)
  }

  const handleLogout = async () => {
    if (user) {
      await logAction(user.id, user.name, 'logout', 'session', null, { summary: 'Logged out' })
    }
    localStorage.removeItem('ambria_user')
    setUser(null)
    setCurrentView('calendar')
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

  const manualCount = events.filter((e) => e.source === 'manual').length
  const crmCount = events.filter((e) => e.source !== 'manual').length

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
        events={events}
        totalCount={events.length}
        shownCount={filteredEvents.length}
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
                  events={filteredEvents}
                  eventTypes={eventTypes}
                />
              )}
              {view === 'week' && (
                <WeekView
                  currentDate={currentDate}
                  selectedDate={selectedDate}
                  onSelectDate={handleSelectDate}
                  events={filteredEvents}
                />
              )}
              {view === 'day' && (
                <DayView
                  selectedDate={selectedDate}
                  events={filteredEvents}
                  onEdit={openEdit}
                  onDelete={handleCardDelete}
                  onAdd={openNew}
                  user={user}
                />
              )}
            </main>
          </>
        )}
        {currentView === 'users' && user.role === 'admin' && (
          <UserManagement currentUser={user} showToast={showToast} onMenu={() => setSidebarOpen(true)} />
        )}
        {currentView === 'audit' && user.role === 'admin' && (
          <AuditLog onMenu={() => setSidebarOpen(true)} />
        )}
        {currentView === 'event-types' && user.role === 'admin' && (
          <EventTypeManagement currentUser={user} showToast={showToast} onMenu={() => setSidebarOpen(true)} />
        )}
        {currentView === 'categories' && user.role === 'admin' && (
          <CategoryManagement currentUser={user} showToast={showToast} onMenu={() => setSidebarOpen(true)} />
        )}
        {currentView === 'elements' && user.role === 'admin' && (
          <ManageElements currentUser={user} showToast={showToast} onMenu={() => setSidebarOpen(true)} />
        )}
      </div>
      <DayModal
        date={dayModalDate}
        events={events}
        onClose={() => setDayModalDate(null)}
        onAdd={openNewFromDate}
        onEdit={(ev) => { setDayModalDate(null); openEdit(ev) }}
        onDelete={handleCardDelete}
        onExport={handleExportDay}
        user={user}
      />
      <BookingModal
        open={!!modal}
        initial={modal?.event}
        onClose={closeModal}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
        user={user}
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
