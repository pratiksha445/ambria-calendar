import { useEffect, useMemo, useState } from 'react'
import Header from './components/Header.jsx'
import Sidebar from './components/Sidebar.jsx'
import MonthView from './components/MonthView.jsx'
import WeekView from './components/WeekView.jsx'
import DayView from './components/DayView.jsx'
import { fetchEvents } from './lib/events.js'
import { seedIfEmpty } from './lib/seedEvents.js'
import { startOfMonth, endOfMonth, toIsoDate, addDays } from './lib/dates.js'
import { VENUES } from './config/venues.js'
import './App.css'

const ALL_VENUE_IDS = VENUES.map((v) => v.id)

export default function App() {
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [view, setView] = useState('month')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [events, setEvents] = useState([])
  const [activeFilters, setActiveFilters] = useState(() => new Set(ALL_VENUE_IDS))
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Fetch events for the currently-viewed month. Seeds sample data on first load.
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
    // Refetch only when the month actually changes, not on every day navigation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate.getFullYear(), currentDate.getMonth()])

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase()
    return events.filter((ev) => {
      if (!activeFilters.has(ev.venue_id)) return false
      if (!q) return true
      const hay = [
        ev.title, ev.guest_name, ev.sales_person, ev.venue_name, ev.tender_name,
      ].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [events, activeFilters, search])

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

  const handleSelectDate = (d) => {
    setSelectedDate(d)
    if (d.getMonth() !== currentDate.getMonth() ||
        d.getFullYear() !== currentDate.getFullYear()) {
      setCurrentDate(d)
    }
  }

  return (
    <div className="app">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        search={search}
        onSearch={setSearch}
        activeFilters={activeFilters}
        onToggleFilter={toggleFilter}
        events={events}
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
          onAdd={() => alert('Booking form arrives in Phase 5')}
        />
        <main className="app-body">
          {error && <div className="error-banner">{error}</div>}
          {loading && <div className="loading">Loading…</div>}
          {view === 'month' && (
            <MonthView
              currentDate={currentDate}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              events={filteredEvents}
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
            />
          )}
        </main>
      </div>
    </div>
  )
}
