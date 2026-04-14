import { useEffect, useMemo, useState } from 'react'
import Header from './components/Header.jsx'
import Sidebar from './components/Sidebar.jsx'
import MonthView from './components/MonthView.jsx'
import WeekView from './components/WeekView.jsx'
import DayView from './components/DayView.jsx'
import BookingModal from './components/BookingModal.jsx'
import { fetchEvents, deleteEvent, bulkDeleteMonth } from './lib/events.js'
import { seedIfEmpty } from './lib/seedEvents.js'
import { startOfMonth, endOfMonth, toIsoDate, addDays, formatMonthYear } from './lib/dates.js'
import { VENUES } from './config/venues.js'
import './App.css'

const ALL_VENUE_IDS = VENUES.map((v) => v.id)
const ALL_SOURCES = ['crm', 'manual']

export default function App() {
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [view, setView] = useState('month')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [events, setEvents] = useState([])
  const [activeFilters, setActiveFilters] = useState(() => new Set(ALL_VENUE_IDS))
  const [activeSources, setActiveSources] = useState(() => new Set(ALL_SOURCES))
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null) // null | { mode: 'new'|'edit', event? }
  const [reloadKey, setReloadKey] = useState(0)
  const [toast, setToast] = useState(null)
  const [confirmBulk, setConfirmBulk] = useState(false)

  useEffect(() => {
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
  }, [currentDate.getFullYear(), currentDate.getMonth(), reloadKey])

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase()
    return events.filter((ev) => {
      if (!activeFilters.has(ev.venue_id)) return false
      if (!activeSources.has(ev.source)) return false
      if (!q) return true
      const hay = [
        ev.guest_name, ev.tender_name, ev.title, ev.venue_name,
        ev.sales_person, ev.phone,
      ].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [events, activeFilters, activeSources, search])

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

  const selectAllVenues = () => setActiveFilters(new Set(ALL_VENUE_IDS))
  const selectNoVenues = () => setActiveFilters(new Set())

  const handleSelectDate = (d) => {
    setSelectedDate(d)
    if (d.getMonth() !== currentDate.getMonth() ||
        d.getFullYear() !== currentDate.getFullYear()) {
      setCurrentDate(d)
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
  const openEdit = (ev) => {
    if (!ev) return
    setModal({ mode: 'edit', event: ev })
  }
  const closeModal = () => setModal(null)
  const handleSaved = (row) => {
    setModal(null)
    showToast('Booking saved')
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
    showToast('Booking deleted')
    setReloadKey((k) => k + 1)
  }
  const handleCardDelete = async (ev) => {
    try {
      await deleteEvent(ev.id)
      showToast('Event deleted')
      setReloadKey((k) => k + 1)
    } catch (err) {
      console.error('[ambria] card delete failed', err)
    }
  }

  const handleClearMonth = () => setConfirmBulk(true)
  const executeBulkDelete = async () => {
    const start = toIsoDate(startOfMonth(currentDate))
    const end = toIsoDate(endOfMonth(currentDate))
    try {
      await bulkDeleteMonth(start, end)
      setConfirmBulk(false)
      showToast(`All events in ${formatMonthYear(currentDate)} cleared`)
      setReloadKey((k) => k + 1)
    } catch (err) {
      console.error('[ambria] bulk delete failed', err)
    }
  }

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
      />
      <div className="app-main">
        <Header
          currentDate={currentDate}
          view={view}
          onViewChange={setView}
          onPrev={handlePrev}
          onNext={handleNext}
          onToday={handleToday}
          onMenu={() => setSidebarOpen(true)}
          onAdd={openNew}
          onClearMonth={handleClearMonth}
        />
        <main className="app-body">
          {error && <div className="error-banner">{error}</div>}
          {loading && <div className="loading">Loading…</div>}
          {filtersHideEverything && (
            <div className="filter-empty-banner">No events match your filters</div>
          )}
          {view === 'month' && (
            <MonthView
              currentDate={currentDate}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              events={filteredEvents}
              onEdit={openEdit}
              onDelete={handleCardDelete}
            />
          )}
          {view === 'week' && (
            <WeekView
              currentDate={currentDate}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              events={filteredEvents}
              onEdit={openEdit}
              onDelete={handleCardDelete}
            />
          )}
          {view === 'day' && (
            <DayView
              selectedDate={selectedDate}
              events={filteredEvents}
              onEdit={openEdit}
              onDelete={handleCardDelete}
            />
          )}
        </main>
      </div>
      <BookingModal
        open={!!modal}
        initial={modal?.event}
        onClose={closeModal}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
      {confirmBulk && (
        <div className="modal-root" role="dialog" aria-modal="true">
          <div className="modal-backdrop" onClick={() => setConfirmBulk(false)} />
          <div className="bulk-delete-card">
            <h3>Delete all events in {formatMonthYear(currentDate)}?</h3>
            <p>
              This will delete {manualCount} manual {manualCount === 1 ? 'event' : 'events'}
              {crmCount > 0 && ` and hide ${crmCount} CRM ${crmCount === 1 ? 'event' : 'events'}`}
            </p>
            <div className="bulk-delete-actions">
              <button className="btn-ghost" onClick={() => setConfirmBulk(false)}>Cancel</button>
              <button className="btn-danger" onClick={executeBulkDelete}>Delete All</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
